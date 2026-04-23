import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const SuperUserPanel = ({ currentUser, refreshUser }) => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  const [sockForm, setSockForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    stage_name: "", skin_tone: "Medium", gender_identity: "",
    willing_to_model_nude: false
  });
  const [sockErrors, setSockErrors] = useState([]);
  const [sockSuccess, setSockSuccess] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelAvailability, setModelAvailability] = useState([]);
  const [newSlots, setNewSlots] = useState([]);
  const [availErrors, setAvailErrors] = useState([]);
  const [availSuccess, setAvailSuccess] = useState(false);

  useEffect(() => {
    if (currentUser && !currentUser.superuser) navigate('/');
    fetchUsers();
  }, [currentUser, navigate]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const fetchModelAvailability = async (userId) => {
    try {
      const res = await api.get(`/art_model_availabilities?user_id=${userId}`);
      setModelAvailability(res.data.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
    } catch (err) {
      console.error("Failed to fetch availability", err);
    }
  };

  const handleModelSelect = (e) => {
    const id = e.target.value;
    setSelectedModelId(id);
    setNewSlots([]);
    setAvailErrors([]);
    setAvailSuccess(false);
    if (id) fetchModelAvailability(id);
    else setModelAvailability([]);
  };

  const handleDeleteSlot = async (slotId) => {
    if (!confirm("Delete this availability slot?")) return;
    try {
      await api.delete(`/art_model_availabilities/${slotId}`);
      fetchModelAvailability(selectedModelId);
    } catch (err) {
      alert("Failed to delete slot.");
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
      alert("Failed to update role");
    }
  };

  const handlePromoteToSuperUser = async (userId) => {
    if (!confirm("Promote this user to SuperUser? This grants full god-mode access.")) return;
    try {
      await api.post(`/users/${userId}/promote_to_superuser`);
      fetchUsers();
    } catch (err) {
      alert("Failed to promote to SuperUser");
    }
  };

  const handleSwitchRole = async (targetRole) => {
    try {
      const payload = { role: targetRole };
      if (targetRole === 'model') {
        payload.skin_tone = 'Medium';
        payload.gender_identity = 'SuperUser Test';
        payload.pronouns = 'Any';
        payload.willing_to_model_nude = true;
      }
      const res = await api.patch(`/users/${currentUser.id}`, { user: payload });
      refreshUser(res.data);
      alert(`Switched to ${targetRole} mode!`);
    } catch (err) {
      console.error(err);
      alert("Promote Failed");
    }
  };

  const handleSockFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSockForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleCreateSockAccount = async (e) => {
    e.preventDefault();
    setSockErrors([]);
    setSockSuccess(false);
    try {
      await api.post('/users', { user: { ...sockForm, role: 'model' } });
      setSockSuccess(true);
      setSockForm({
        first_name: "", last_name: "", email: "", phone: "",
        stage_name: "", skin_tone: "Medium", gender_identity: "",
        willing_to_model_nude: false
      });
      fetchUsers();
    } catch (err) {
      const errors = err.response?.data?.errors || ["Something went wrong."];
      setSockErrors(errors);
    }
  };

  const models = users.filter(u => u.role === 'model');

  const formatDateTime = (iso) => new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  if (!currentUser?.superuser) return null;

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>SuperUser Controls</h2>
        <span className="badge bg-warning text-dark">God Mode Active</span>
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
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={() => handleSwitchRole('faculty')}>Become Faculty</button>
            <button className="btn btn-outline-success" onClick={() => handleSwitchRole('model')}>Become Model</button>
            <button className="btn btn-outline-secondary" onClick={() => handleSwitchRole('admin')} disabled={currentUser.role === 'admin'}>Restore Admin</button>
          </div>
        </div>
      </div>

      <div className="card shadow mb-4">
        <div className="card-body">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.first_name} {u.last_name}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.role === 'admin' && <span className="badge bg-danger">Admin</span>}
                    {u.role === 'faculty' && <span className="badge bg-primary">Faculty</span>}
                    {u.role === 'model' && <span className="badge bg-success">Model</span>}
                    {u.superuser && <span className="badge bg-warning text-dark ms-1">Super</span>}
                  </td>
                  <td>
                    {u.id === currentUser.id ? (
                      <span className="text-muted small">That's you</span>
                    ) : (
                      <div className="d-flex gap-2 align-items-center">
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
      </div>

      {/* Create Sock Account */}
      <div className="card shadow mb-4 border-info">
        <div className="card-header bg-info text-white fw-bold">
          Create Sock Account (Offline Model)
        </div>
        <div className="card-body">
          {sockSuccess && <div className="alert alert-success">Sock account created successfully!</div>}
          {sockErrors.length > 0 && (
            <div className="alert alert-danger">
              {sockErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <form onSubmit={handleCreateSockAccount}>
            <div className="row mb-3">
              <div className="col">
                <label className="form-label fw-bold">First Name</label>
                <input required className="form-control" name="first_name" value={sockForm.first_name} onChange={handleSockFormChange} />
              </div>
              <div className="col">
                <label className="form-label fw-bold">Last Name</label>
                <input required className="form-control" name="last_name" value={sockForm.last_name} onChange={handleSockFormChange} />
              </div>
            </div>
            <div className="row mb-3">
              <div className="col">
                <label className="form-label fw-bold">Email (@mica.edu)</label>
                <input required type="email" className="form-control" name="email" value={sockForm.email} onChange={handleSockFormChange} />
              </div>
              <div className="col">
                <label className="form-label fw-bold">Phone</label>
                <input className="form-control" name="phone" value={sockForm.phone} onChange={handleSockFormChange} />
              </div>
            </div>
            <div className="row mb-3">
              <div className="col">
                <label className="form-label fw-bold">Stage Name</label>
                <input className="form-control" name="stage_name" value={sockForm.stage_name} onChange={handleSockFormChange} />
              </div>
              <div className="col">
                <label className="form-label fw-bold">Gender Identity</label>
                <select className="form-select" name="gender_identity" value={sockForm.gender_identity} onChange={handleSockFormChange} required>
                  <option value="">Select...</option>
                  <option value="Woman">Woman</option>
                  <option value="Man">Man</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Transgender">Transgender</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div className="row mb-3">
              <div className="col">
                <label className="form-label fw-bold">Skin Tone</label>
                <select required className="form-select" name="skin_tone" value={sockForm.skin_tone} onChange={handleSockFormChange}>
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Dark">Dark</option>
                </select>
              </div>
              <div className="col d-flex align-items-end pb-1">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" name="willing_to_model_nude" id="nudeCheck"
                    checked={sockForm.willing_to_model_nude} onChange={handleSockFormChange} />
                  <label className="form-check-label fw-bold" htmlFor="nudeCheck">Willing to Model Nude</label>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button type="submit" className="btn btn-info text-white w-100">Create Sock Account</button>
            </div>
          </form>
        </div>
      </div>

      {/* Manage Model Availability */}
      <div className="card shadow mb-4 border-success">
        <div className="card-header bg-success text-white fw-bold">
          Manage Model Availability
        </div>
        <div className="card-body">
          <div className="mb-4">
            <label className="form-label fw-bold">Select Model</label>
            <select className="form-select" value={selectedModelId} onChange={handleModelSelect}>
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
              {/* Existing Slots */}
              <h6 className="fw-bold mb-2">Existing Availability</h6>
              {modelAvailability.length === 0 ? (
                <p className="text-muted small mb-3">No availability on record.</p>
              ) : (
                <div className="mb-4">
                  {modelAvailability.map(slot => (
                    <div key={slot.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                      <span className="small">
                        {formatDateTime(slot.starts_at)} — {new Date(slot.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {slot.status === 'cancelled' && <span className="badge bg-secondary ms-2">Cancelled</span>}
                      </span>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteSlot(slot.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Slots */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">Add New Slots</h6>
                <button type="button" className="btn btn-sm btn-outline-success" onClick={addNewSlot}>+ Add Slot</button>
              </div>

              {availSuccess && <div className="alert alert-success">Availability saved!</div>}
              {availErrors.length > 0 && (
                <div className="alert alert-danger">
                  {availErrors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}

              {newSlots.map((slot, i) => (
                <div key={i} className="row mb-2 align-items-end">
                  <div className="col">
                    <label className="form-label small">Date</label>
                    <input type="date" className="form-control form-control-sm" value={slot.date}
                      onChange={e => updateNewSlot(i, 'date', e.target.value)} />
                  </div>
                  <div className="col">
                    <label className="form-label small">Start</label>
                    <input type="time" className="form-control form-control-sm" value={slot.start}
                      onChange={e => updateNewSlot(i, 'start', e.target.value)} />
                  </div>
                  <div className="col">
                    <label className="form-label small">End</label>
                    <input type="time" className="form-control form-control-sm" value={slot.end}
                      onChange={e => updateNewSlot(i, 'end', e.target.value)} />
                  </div>
                  <div className="col-auto">
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeNewSlot(i)}>✕</button>
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

    </div>
  );
};

export default SuperUserPanel;