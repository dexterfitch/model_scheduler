import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Container, Badge, Row, Col } from 'react-bootstrap';
import { formatDateTime, formatTime, roundToNearest5, findActiveGigForAvailability } from "../utils/time";
import { GENDER_IDENTITIES, SKIN_TONES } from "../utils/constants";
import ModelBodyFields from "./ModelBodyFields";
import { extractErrorMessages } from "../utils/formatters";
import { useDialog } from "./DialogProvider";

const SuperUserPanel = ({ currentUser, refreshUser }) => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const { confirm, notify } = useDialog();
  const showError = (title, err) => notify({ title, message: extractErrorMessages(err, 'Please try again.') });

  const [sockForm, setSockForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    stage_name: "", skin_tone: "Medium", gender_identity: "",
    willing_to_model_nude: false, body_type: "", genitalia: ""
  });
  const [sockErrors, setSockErrors] = useState([]);
  const [sockSuccess, setSockSuccess] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelAvailability, setModelAvailability] = useState([]);
  const [newSlots, setNewSlots] = useState([]);
  const [availErrors, setAvailErrors] = useState([]);
  const [availSuccess, setAvailSuccess] = useState(false);
  const [modelGigs, setModelGigs] = useState([]);

  const fetchUsers = useCallback(() => api.get('/users')
    .then(res => setUsers(res.data))
    .catch(err => console.error("Failed to fetch users", err)), []);

  useEffect(() => {
    if (currentUser && !currentUser.superuser) navigate('/');
    fetchUsers();
  }, [currentUser, navigate, fetchUsers]);

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

  const getActiveGigForSlot = (slotId) => findActiveGigForAvailability(modelGigs, slotId);

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
      // Name the exact gig, in case one availability block holds two classes
      await api.post(`/art_model_availabilities/${slotId}/cancel`, { gig_id: gig?.id });
      fetchModelAvailability(selectedModelId);
    } catch (err) {
      showError("Couldn't release the model", err);
    }
  };

  const addNewSlot = () => {
    setNewSlots(prev => [...prev, { date: "", start: "09:00", end: "17:00" }]);
  };

  const updateNewSlot = (index, field, value) => {
    setNewSlots(prev => prev.map((slot, i) => i === index ? { ...slot, [field]: value } : slot));
  };

  const removeNewSlot = (index) => {
    setNewSlots(prev => prev.filter((_, i) => i !== index));
  };

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

  const handlePromote = async (userId, newRole) => {
    try {
      await api.post(`/users/${userId}/promote`, { role: newRole });
      fetchUsers();
    } catch (err) {
      showError("Couldn't change their role", err);
    }
  };

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

  const handleSwitchRole = async (targetRole) => {
    try {
      const res = await api.post(`/users/${currentUser.id}/promote`, { role: targetRole });
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

  const handleSockFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSockForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'willing_to_model_nude' && !checked ? { genitalia: "" } : {})
    }));
  };

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
        </div>
      </div>

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
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              Sock account created successfully!
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setSockSuccess(false)}></button>
            </div>
          )}
          {sockErrors.length > 0 && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
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
                  {SKIN_TONES.map(t => <option key={t} value={t}>{t}</option>)}
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
                <div className="alert alert-success alert-dismissible fade show" role="alert">
                  Availability saved!
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setAvailSuccess(false)}></button>
                </div>
              )}
              {availErrors.length > 0 && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
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
                        <input id={`new-slot-${i}-start`} type="time" className="form-control form-control-sm" value={slot.start}
                          onChange={e => updateNewSlot(i, 'start', e.target.value)}
                          onBlur={e => updateNewSlot(i, 'start', roundToNearest5(e.target.value))} />
                      </Col>
                      <Col xs={5} sm={3}>
                        <label className="form-label small mb-1" htmlFor={`new-slot-${i}-end`}>End</label>
                        <input id={`new-slot-${i}-end`} type="time" className="form-control form-control-sm" value={slot.end}
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

    </Container>
  );
};

export default SuperUserPanel;
