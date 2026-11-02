/**
 * The SuperUser Panel: try the app as faculty or a model, change people's roles,
 * grant SuperUser status, remove a person's data on request, read the Error Log,
 * create sock accounts and manage their free time, and clear the test data made
 * under the SuperUser's own account.
 */

import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Container, Badge, Row, Col, Modal, Button } from 'react-bootstrap';
import { formatDateTime, formatTime, roundToNearest5, findActiveGigForAvailability } from "../utils/time";
import { GENDER_IDENTITIES, SKIN_TONE_ANSWERS } from "../utils/constants";
import ModelBodyFields from "./ModelBodyFields";
import SkinTonePicker from "./SkinTonePicker";
import { extractErrorMessages } from "../utils/formatters";
import { useDialog } from "./DialogProvider";
import ErrorLog from "./ErrorLog";
import { useRevealMessage } from '../utils/revealMessage';

/** The panel, for SuperUsers only. */
const SuperUserPanel = ({ currentUser, refreshUser }) => {
  const [users, setUsers] = useState([]);
  const [clearedMessage, setClearedMessage] = useState('');
  const navigate = useNavigate();
  const { confirm, notify } = useDialog();
  /** Shows why something didn't work. */
  const showError = (title, err) => notify({ title, message: extractErrorMessages(err, 'Please try again.') });

  const [sockForm, setSockForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    stage_name: "", skin_tone: "Medium", gender_identity: "",
    willing_to_model_nude: false, body_type: "", genitalia: ""
  });
  const [sockErrors, setSockErrors] = useState([]);
  const sockErrorsRef = useRevealMessage(sockErrors);
  const [sockSuccess, setSockSuccess] = useState(false);
  const sockSuccessRef = useRevealMessage(sockSuccess);

  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelAvailability, setModelAvailability] = useState([]);
  const [newSlots, setNewSlots] = useState([]);
  const [availErrors, setAvailErrors] = useState([]);
  const availErrorsRef = useRevealMessage(availErrors);
  const [availSuccess, setAvailSuccess] = useState(false);
  const availSuccessRef = useRevealMessage(availSuccess);
  const [modelGigs, setModelGigs] = useState([]);

  /** Loads everyone. */
  const fetchUsers = useCallback(() => api.get('/users')
    .then(res => setUsers(res.data))
    .catch(err => console.error("Failed to fetch users", err)), []);

  useEffect(() => {
    if (currentUser && !currentUser.superuser) navigate('/');
    fetchUsers();
  }, [currentUser, navigate, fetchUsers]);

  /** Loads the chosen sock account's free time and gigs. */
  const fetchModelAvailability = async (userId) => {
    try {
      const res = await api.get(`/art_model_availabilities?user_id=${userId}`);
      const now = new Date();
      const upcoming = res.data.filter(a => new Date(a.ends_at) >= now && a.status !== 'cancelled');
      setModelAvailability(upcoming.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
    } catch (err) {
      console.error("Failed to fetch availability", err);
    }

    try {
      const gigsRes = await api.get('/gigs');
      const filtered = gigsRes.data.filter(g =>
        g.art_model_availability.user.id === parseInt(userId) && g.status === 'confirmed'
      );
      setModelGigs(filtered);
    } catch (err) {
      console.error("Failed to fetch gigs", err);
    }
  };

  /** The booked gig in a block of free time, if any. */
  const getActiveGigForSlot = (slotId) => findActiveGigForAvailability(modelGigs, slotId);

  /** Chooses which sock account's free time to manage. */
  const handleModelSelect = (e) => {
    const id = e.target.value;
    setSelectedModelId(id);
    setNewSlots([]);
    setAvailErrors([]);
    setAvailSuccess(false);
    if (id) fetchModelAvailability(id);
    else {
      setModelAvailability([]);
      setModelGigs([]);
    }
  };

  /** Deletes a block of free time, after confirming. */
  const handleDeleteSlot = async (slotId) => {
    const confirmed = await confirm({
      title: 'Delete this availability?',
      message: "This time won't be offered to classes anymore.",
      confirmLabel: 'Delete',
      cancelLabel: 'Keep It',
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.delete(`/art_model_availabilities/${slotId}`);
      fetchModelAvailability(selectedModelId);
    } catch (err) {
      showError("Couldn't delete this availability", err);
    }
  };

  /** Cancels the gig in a block of free time, after confirming. */
  const handleCancelSlotGig = async (slotId, gig) => {
    const confirmed = await confirm({
      title: `Release this model from ${gig?.faculty_request?.class_name || 'this gig'}?`,
      message: "The class's date goes back to pending so you can book someone else.",
      confirmLabel: 'Release Model',
      cancelLabel: 'Keep Booking',
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.post(`/art_model_availabilities/${slotId}/cancel`, { gig_id: gig?.id });
      fetchModelAvailability(selectedModelId);
    } catch (err) {
      showError("Couldn't release the model", err);
    }
  };

  /** Adds a row for new free time. */
  const addNewSlot = () => {
    setNewSlots(prev => [...prev, { date: "", start: "09:00", end: "17:00" }]);
  };

  /** Changes a row of new free time. */
  const updateNewSlot = (index, field, value) => {
    setNewSlots(prev => prev.map((slot, i) => i === index ? { ...slot, [field]: value } : slot));
  };

  /** Removes a row of new free time. */
  const removeNewSlot = (index) => {
    setNewSlots(prev => prev.filter((_, i) => i !== index));
  };

  /** Saves every filled-in row of new free time. */
  const handleSaveSlots = async () => {
    if (!selectedModelId) return;
    setAvailErrors([]);
    setAvailSuccess(false);
    try {
      for (const slot of newSlots) {
        if (!slot.date || !slot.start || !slot.end) continue;
        await api.post('/art_model_availabilities', {
          art_model_availability: {
            user_id: selectedModelId,
            starts_at: new Date(`${slot.date}T${slot.start}`),
            ends_at: new Date(`${slot.date}T${slot.end}`),
            status: 'active'
          }
        });
      }
      setNewSlots([]);
      setAvailSuccess(true);
      fetchModelAvailability(selectedModelId);
    } catch (err) {
      const errors = err.response?.data?.errors || ["Something went wrong."];
      setAvailErrors(errors);
    }
  };

  const [skinToneAsk, setSkinToneAsk] = useState(null);
  const [chosenTone, setChosenTone] = useState('');
  /** Whether a person has answered the skin tone question. */
  const hasSkinTone = (person) => SKIN_TONE_ANSWERS.includes(person?.skin_tone);
  /** Opens the skin tone question before switching someone to model. */
  const askForSkinTone = (ask) => { setChosenTone(''); setSkinToneAsk(ask); };

  /** Changes someone's role, asking for a skin tone first if they're becoming a model. */
  const handlePromote = async (userId, newRole, skinTone) => {
    const person = users.find(u => u.id === userId);
    if (newRole === 'model' && !skinTone && !hasSkinTone(person)) {
      askForSkinTone({ userId, name: `${person?.first_name} ${person?.last_name}` });
      return;
    }
    try {
      await api.post(`/users/${userId}/promote`, skinTone ? { role: newRole, skin_tone: skinTone } : { role: newRole });
      fetchUsers();
    } catch (err) {
      showError("Couldn't change their role", err);
    }
  };

  /** Makes an admin a SuperUser, after confirming. */
  const handlePromoteToSuperUser = async (userId) => {
    const person = users.find(u => u.id === userId);
    const confirmed = await confirm({
      title: `Make ${person ? `${person.first_name} ${person.last_name}` : 'this admin'} a SuperUser?`,
      message: 'SuperUsers can do everything in the app, including granting SuperUser to others and switching roles.',
      confirmLabel: 'Make SuperUser',
      cancelLabel: 'Go Back'
    });
    if (!confirmed) return;
    try {
      await api.post(`/users/${userId}/promote_to_superuser`);
      fetchUsers();
    } catch (err) {
      showError("Couldn't make them a SuperUser", err);
    }
  };

  /**
   * Removes a person's data on request, after a warning, and shows the row as removed.
   * Says why if it can't be done yet.
   */
  const handleRemoveData = async (person) => {
    const confirmed = await confirm({
      title: `Remove ${person.first_name} ${person.last_name}'s data?`,
      message: "Their name, email, phone, photo and every personal answer are deleted, their upcoming free time and updates are removed, and they're signed out everywhere. Past gigs and classes stay, shown as Removed Person, so reports still add up. This can't be undone.",
      confirmLabel: 'Remove Data',
      cancelLabel: 'Go Back',
      danger: true
    });
    if (!confirmed) return;
    try {
      const res = await api.post(`/users/${person.id}/remove_data`);
      setUsers(prev => prev.map(u => (u.id === person.id ? res.data : u)));
    } catch (err) {
      showError("Couldn't remove their data", err);
    }
  };

  /** Switches the SuperUser's own role, to try the app as faculty or a model. */
  const handleSwitchRole = async (targetRole, skinTone) => {
    if (targetRole === 'model' && !skinTone && !hasSkinTone(currentUser)) {
      askForSkinTone({ self: true });
      return;
    }
    try {
      const res = await api.post(`/users/${currentUser.id}/promote`, skinTone ? { role: targetRole, skin_tone: skinTone } : { role: targetRole });
      refreshUser(res.data);
      notify({
        title: `You're now using the app as ${targetRole === 'admin' ? 'an admin' : `a ${targetRole}`}`,
        message: targetRole === 'admin' ? undefined : 'Use Restore Admin Role in the pink banner to switch back.'
      });
    } catch (err) {
      console.error(err);
      showError("Couldn't switch roles", err);
    }
  };

  /** Continues the role change with the chosen skin tone. */
  const finishSkinToneAsk = () => {
    const ask = skinToneAsk;
    setSkinToneAsk(null);
    if (ask.self) handleSwitchRole('model', chosenTone);
    else handlePromote(ask.userId, 'model', chosenTone);
  };

  /** Saves a changed field in the sock account form. */
  const handleSockFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSockForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'willing_to_model_nude' && !checked ? { genitalia: "" } : {})
    }));
  };

  /** Creates the sock account. */
  const handleCreateSockAccount = async (e) => {
    e.preventDefault();
    setSockErrors([]);
    setSockSuccess(false);
    try {
      await api.post('/users', {
        user: {
          ...sockForm,
          first_name: `🧦 ${sockForm.first_name}`,
          role: 'model'
        }
      });
      setSockSuccess(true);
      setSockForm({
        first_name: "", last_name: "", email: "", phone: "",
        stage_name: "", skin_tone: "Medium", gender_identity: "",
        willing_to_model_nude: false, body_type: "", genitalia: ""
      });
      fetchUsers();
    } catch (err) {
      const errors = err.response?.data?.errors || ["Something went wrong."];
      setSockErrors(errors);
    }
  };

  const models = users.filter(u => u.role === 'model');

  const roleOrder = { admin: 0, model: 1, faculty: 2 };

  const sortedUsers = [...users].sort((a, b) => {
    const aRank = a.superuser ? -1 : (roleOrder[a.role] ?? 99);
    const bRank = b.superuser ? -1 : (roleOrder[b.role] ?? 99);
    if (aRank !== bRank) return aRank - bRank;
    const aName = `${a.first_name} ${a.last_name}`.toLowerCase();
    const bName = `${b.first_name} ${b.last_name}`.toLowerCase();
    return aName.localeCompare(bName);
  });

  if (!currentUser?.superuser) return null;

  /** A count with the right word form, like 1 class or 2 classes. */
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  /** Clears the SuperUser's own test classes and free time, after saying exactly what will go. */
  const handleClearTestData = async () => {
    setClearedMessage('');
    let counts;
    try {
      counts = (await api.get('/test_data')).data;
    } catch (err) {
      return showError("Couldn't check your test data", err);
    }
    if (counts.classes === 0 && counts.dates === 0 && counts.availability === 0) {
      return notify({ title: 'Nothing to clear', message: "You don't have any test classes or availability." });
    }
    const parts = [
      counts.classes > 0 && `${plural(counts.classes, 'class', 'classes')} (${plural(counts.dates, 'date')})`,
      counts.availability > 0 && plural(counts.availability, 'availability block'),
    ].filter(Boolean);
    const reopened = counts.real_classes_booked > 0
      ? ` ${plural(counts.real_classes_booked, 'real class', 'real classes')} you were booked into as a model goes back to needing a model.`
      : '';
    const ok = await confirm({
      title: 'Clear your test data?',
      message: `This deletes ${parts.join(' and ')} that you made under your own account, with their bookings.${reopened} Nobody else's classes or availability are touched. This can't be undone.`,
      confirmLabel: 'Clear Test Data',
      cancelLabel: 'Keep It',
      danger: true
    });
    if (!ok) return;
    try {
      const { data } = await api.delete('/test_data');
      setClearedMessage(`Cleared ${plural(data.classes, 'class', 'classes')} and ${plural(data.availability, 'availability block')}.`);
    } catch (err) {
      showError("Couldn't clear your test data", err);
    }
  };

  return (
    <Container className="mt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>SuperUser Controls</h2>
        <Badge bg="warning" text="dark">God Mode Active</Badge>
      </div>

      <div className="card shadow mb-4 border-warning">
        <div className="card-header bg-warning text-dark fw-bold">
          Testing Tools (Real Role Switching)
        </div>
        <div className="card-body">
          <p className="mb-3">
            Clicking these buttons will <strong>actually change your role in the database</strong>.
            Because you are a SuperUser, you will see a banner to restore your Admin status at any time.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-outline-primary" onClick={() => handleSwitchRole('faculty')}>Become Faculty</button>
            <button className="btn btn-outline-success" onClick={() => handleSwitchRole('model')}>Become Model</button>
            <button className="btn btn-outline-secondary" onClick={() => handleSwitchRole('admin')} disabled={currentUser.role === 'admin'}>Restore Admin</button>
          </div>

          <hr />
          <p className="mb-2">
            Done testing? This clears the classes you requested and the availability you added
            under your own account. Nobody else's records are touched.
          </p>
          <button type="button" className="btn btn-outline-danger" onClick={handleClearTestData}>Clear My Test Data</button>
          {clearedMessage && <p className="text-success mt-2 mb-0" role="status">{clearedMessage}</p>}
        </div>
      </div>

      <ErrorLog />

      <div className="card shadow mb-4">
        <div className="card-header bg-light fw-bold">User Management</div>
        <div className="card-body p-0">

          <div className="d-none d-md-block">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.first_name} {u.last_name}</td>
                    <td>{u.email}</td>
                    <td>
                      {u.role === 'admin' && <Badge bg="danger">Admin</Badge>}
                      {u.role === 'faculty' && <Badge bg="primary">Faculty</Badge>}
                      {u.role === 'model' && <Badge bg="success">Model</Badge>}
                      {u.superuser && <Badge bg="warning" text="dark" className="ms-1">Super</Badge>}
                    </td>
                    <td>
                      {u.id === currentUser.id ? (
                        <span className="text-muted small">That's you</span>
                      ) : u.removed_at ? (
                        <Badge bg="secondary">Data removed</Badge>
                      ) : (
                        <div className="d-flex gap-2 align-items-center flex-wrap">
                          {!u.superuser && (
                            <div className="btn-group" role="group">
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handlePromote(u.id, 'admin')}>Admin</button>
                              <button className="btn btn-sm btn-outline-primary" onClick={() => handlePromote(u.id, 'faculty')}>Faculty</button>
                              <button className="btn btn-sm btn-outline-success" onClick={() => handlePromote(u.id, 'model')}>Model</button>
                            </div>
                          )}
                          {u.role === 'admin' && !u.superuser && (
                            <button className="btn btn-sm btn-warning text-dark" onClick={() => handlePromoteToSuperUser(u.id)}>
                              ⭐ Make SuperUser
                            </button>
                          )}
                          {!u.superuser && (
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => handleRemoveData(u)}>
                              Remove Data
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-md-none p-3">
            {sortedUsers.map(u => (
              <div key={u.id} className="card mb-3 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <div className="fw-bold">{u.first_name} {u.last_name}</div>
                    <div>
                      {u.role === 'admin' && <Badge bg="danger">Admin</Badge>}
                      {u.role === 'faculty' && <Badge bg="primary">Faculty</Badge>}
                      {u.role === 'model' && <Badge bg="success">Model</Badge>}
                      {u.superuser && <Badge bg="warning" text="dark" className="ms-1">Super</Badge>}
                    </div>
                  </div>
                  <div className="small text-muted mb-3">
                    <i className="bi bi-envelope me-1"></i>{u.email}
                  </div>
                  {u.id === currentUser.id ? (
                    <span className="text-muted small">That's you</span>
                  ) : u.removed_at ? (
                    <Badge bg="secondary">Data removed</Badge>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {!u.superuser && (
                        <div className="btn-group w-100" role="group">
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handlePromote(u.id, 'admin')}>Admin</button>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => handlePromote(u.id, 'faculty')}>Faculty</button>
                          <button className="btn btn-sm btn-outline-success" onClick={() => handlePromote(u.id, 'model')}>Model</button>
                        </div>
                      )}
                      {u.role === 'admin' && !u.superuser && (
                        <button className="btn btn-sm btn-warning text-dark w-100" onClick={() => handlePromoteToSuperUser(u.id)}>
                          ⭐ Make SuperUser
                        </button>
                      )}
                      {!u.superuser && (
                        <button className="btn btn-sm btn-outline-secondary w-100" onClick={() => handleRemoveData(u)}>
                          Remove Data
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div className="card shadow mb-4 border-info">
        <div className="card-header bg-primary text-white fw-bold">
          Create Sock Account (Offline Model)
        </div>
        <div className="card-body">
          {sockSuccess && (
            <div ref={sockSuccessRef} tabIndex={-1} className="alert alert-success alert-dismissible fade show" role="alert">
              Sock account created successfully!
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setSockSuccess(false)}></button>
            </div>
          )}
          {sockErrors.length > 0 && (
            <div ref={sockErrorsRef} tabIndex={-1} className="alert alert-danger alert-dismissible fade show" role="alert">
              {sockErrors.map((e, i) => <div key={i}>{e}</div>)}
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setSockErrors([])}></button>
            </div>
          )}
          <form onSubmit={handleCreateSockAccount}>
            <Row className="mb-3">
              <Col xs={12} md={6} className="mb-3 mb-md-0">
                <label className="form-label fw-bold" htmlFor="sock-first-name">First Name</label>
                <input id="sock-first-name" required className="form-control" name="first_name" value={sockForm.first_name} onChange={handleSockFormChange} />
              </Col>
              <Col xs={12} md={6}>
                <label className="form-label fw-bold" htmlFor="sock-last-name">Last Name</label>
                <input id="sock-last-name" required className="form-control" name="last_name" value={sockForm.last_name} onChange={handleSockFormChange} />
              </Col>
            </Row>
            <Row className="mb-3">
              <Col xs={12} md={6} className="mb-3 mb-md-0">
                <label className="form-label fw-bold" htmlFor="sock-email">Email (@mica.edu)</label>
                <input id="sock-email" required type="email" className="form-control" name="email" value={sockForm.email} onChange={handleSockFormChange} />
              </Col>
              <Col xs={12} md={6}>
                <label className="form-label fw-bold" htmlFor="sock-phone">Phone</label>
                <input id="sock-phone" type="tel" className="form-control" name="phone" value={sockForm.phone} onChange={handleSockFormChange} />
              </Col>
            </Row>
            <Row className="mb-3">
              <Col xs={12} md={6} className="mb-3 mb-md-0">
                <label className="form-label fw-bold" htmlFor="sock-stage-name">Stage Name</label>
                <input id="sock-stage-name" className="form-control" name="stage_name" value={sockForm.stage_name} onChange={handleSockFormChange} />
              </Col>
              <Col xs={12} md={6}>
                <label className="form-label fw-bold" htmlFor="sock-gender">Gender</label>
                <select id="sock-gender" className="form-select" name="gender_identity" value={sockForm.gender_identity} onChange={handleSockFormChange} required>
                  <option value="">Select...</option>
                  {GENDER_IDENTITIES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col xs={12} md={6} className="mb-3 mb-md-0">
                <label className="form-label fw-bold" htmlFor="sock-skin-tone">Skin Tone</label>
                <select id="sock-skin-tone" required className="form-select" name="skin_tone" value={sockForm.skin_tone} onChange={handleSockFormChange}>
                  {SKIN_TONE_ANSWERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Col>
              <Col xs={12} md={6} className="d-flex align-items-end pb-1">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" name="willing_to_model_nude" id="sock-nude-check"
                    checked={sockForm.willing_to_model_nude} onChange={handleSockFormChange} />
                  <label className="form-check-label fw-bold" htmlFor="sock-nude-check">Willing to Model Nude</label>
                </div>
              </Col>
            </Row>
            <ModelBodyFields
              values={sockForm}
              labelClassName="form-label fw-bold"
              onChange={(name, value) => setSockForm(prev => ({ ...prev, [name]: value }))}
            />
            <div className="mt-4">
              <button type="submit" className="btn btn-primary text-white w-100">Create Sock Account</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow mb-4 border-success">
        <div className="card-header bg-success text-white fw-bold">
          Manage Offline Model Availability
        </div>
        <div className="card-body">
          <div className="mb-4">
            <label className="form-label fw-bold" htmlFor="avail-model">Select Model</label>
            <select id="avail-model" className="form-select" value={selectedModelId} onChange={handleModelSelect}>
              <option value="">-- Choose a model --</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} {m.stage_name ? `(${m.stage_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedModelId && (
            <>
              <h6 className="fw-bold mb-2">Existing Availability</h6>
              {modelAvailability.length === 0 ? (
                <p className="text-muted small mb-3">No availability on record.</p>
              ) : (
                <div className="mb-4">
                  {modelAvailability.map(slot => {
                    const activeGig = getActiveGigForSlot(slot.id);
                    return (
                      <div key={slot.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                        <span className="small">
                          {formatDateTime(slot.starts_at)} &mdash; {formatTime(slot.ends_at)}
                          {activeGig && <Badge bg="info" text="dark" className="ms-2">{activeGig.faculty_request.class_name}</Badge>}
                        </span>
                        <button
                          className="btn btn-sm btn-outline-danger ms-2"
                          aria-label={`${activeGig ? 'Cancel gig' : 'Delete availability'} on ${formatDateTime(slot.starts_at)}`}
                          title={activeGig ? 'Cancel gig' : 'Delete availability'}
                          onClick={() => activeGig ? handleCancelSlotGig(slot.id, activeGig) : handleDeleteSlot(slot.id)}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">Add New Slots</h6>
                <button type="button" className="btn btn-sm btn-outline-success" onClick={addNewSlot}>+ Add Slot</button>
              </div>

              {availSuccess && (
                <div ref={availSuccessRef} tabIndex={-1} className="alert alert-success alert-dismissible fade show" role="alert">
                  Availability saved!
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setAvailSuccess(false)}></button>
                </div>
              )}
              {availErrors.length > 0 && (
                <div ref={availErrorsRef} tabIndex={-1} className="alert alert-danger alert-dismissible fade show" role="alert">
                  {availErrors.map((e, i) => <div key={i}>{e}</div>)}
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setAvailErrors([])}></button>
                </div>
              )}

              {newSlots.map((slot, i) => (
                <div key={i} className="card mb-2 bg-light">
                  <div className="card-body py-2 px-3">
                    <Row className="g-2 align-items-end">
                      <Col xs={12} sm={4}>
                        <label className="form-label small mb-1" htmlFor={`new-slot-${i}-date`}>Date</label>
                        <input id={`new-slot-${i}-date`} type="date" className="form-control form-control-sm" value={slot.date}
                          onChange={e => updateNewSlot(i, 'date', e.target.value)} />
                      </Col>
                      <Col xs={5} sm={3}>
                        <label className="form-label small mb-1" htmlFor={`new-slot-${i}-start`}>Start</label>
                        <input id={`new-slot-${i}-start`} type="time" step={300} min="00:00" className="form-control form-control-sm" value={slot.start}
                          onChange={e => updateNewSlot(i, 'start', e.target.value)}
                          onBlur={e => updateNewSlot(i, 'start', roundToNearest5(e.target.value))} />
                      </Col>
                      <Col xs={5} sm={3}>
                        <label className="form-label small mb-1" htmlFor={`new-slot-${i}-end`}>End</label>
                        <input id={`new-slot-${i}-end`} type="time" step={300} min="00:00" className="form-control form-control-sm" value={slot.end}
                          onChange={e => updateNewSlot(i, 'end', e.target.value)}
                          onBlur={e => updateNewSlot(i, 'end', roundToNearest5(e.target.value))} />
                      </Col>
                      <Col xs={2} sm={2} className="d-flex align-items-end">
                        <button type="button" className="btn btn-sm btn-outline-danger w-100" aria-label={`Remove new slot ${i + 1}`} title="Remove slot" onClick={() => removeNewSlot(i)}>
                          <span aria-hidden="true">✕</span>
                        </button>
                      </Col>
                    </Row>
                  </div>
                </div>
              ))}

              {newSlots.length > 0 && (
                <button className="btn btn-success w-100 mt-3" onClick={handleSaveSlots}>
                  Save Slots
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <Modal show={!!skinToneAsk} onHide={() => setSkinToneAsk(null)} centered aria-labelledby="skin-tone-ask-title">
        <Modal.Header closeButton>
          <Modal.Title id="skin-tone-ask-title" as="h2" className="h5">
            {skinToneAsk?.self ? 'Choose your skin tone' : `Choose a skin tone for ${skinToneAsk?.name}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Models need a skin tone so classes can be matched. It can be changed later on the profile.</p>
          <SkinTonePicker value={chosenTone} onChange={setChosenTone} required />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSkinToneAsk(null)}>Go Back</Button>
          <Button variant="primary" disabled={!chosenTone} onClick={finishSkinToneAsk}>Switch to Model</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SuperUserPanel;
