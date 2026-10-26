import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Alert } from "react-bootstrap";
import styles from "./FacultyDashboard.module.css";
import api from "../services/api";
import { useDialog } from "./DialogProvider";
import { formatSkinTone, formatGenderPreference, formatBodyType, formatGenitalia, formatModelCount, extractErrorMessages, formatPreferenceSummary } from "../utils/formatters";
import { roundToNearest5, formatTime, formatDateWithWeekday, validateBusinessHours } from "../utils/time";
import { DEPARTMENTS, BUILDINGS } from "../utils/constants";
import ModelPreferenceFields, {
  DEFAULT_MODEL_PREFERENCES, DEFAULT_SLOT_STATE, applyPreferenceChange, modelSlotsPayload, slotFormState
} from "./ModelPreferenceFields";

const PREFERENCE_KEYS = Object.keys(DEFAULT_MODEL_PREFERENCES);
const pickPreferences = (obj) =>
  Object.fromEntries(PREFERENCE_KEYS.map(k => [k, obj[k] ?? DEFAULT_MODEL_PREFERENCES[k]]));

// Classes where faculty set preferences for each model separately
const hasModelSlots = (s) => (s.model_slots || []).length > 0;

const emptyDate = () => ({ date: "", start_time: "", end_time: "" });

function FacultyDashboard({ user }) {
  const { confirm, notify } = useDialog();
  const [series, setSeries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  // Edit Date: one date's day and times only
  const [editFormData, setEditFormData] = useState({ starts_at: "", starts_time: "", ends_time: "" });
  const [editError, setEditError] = useState('');
  // Edit Class: class details and preferences, shared by every date in the series
  const [editingSeries, setEditingSeries] = useState(null);
  const [classFormData, setClassFormData] = useState({
    class_name: "", department: "", building: "", room_number: "",
    ...DEFAULT_MODEL_PREFERENCES, notes: ""
  });
  const [classError, setClassError] = useState('');
  const [addingDateSeriesId, setAddingDateSeriesId] = useState(null);
  const [newDateForm, setNewDateForm] = useState({ date: '', start_time: '', end_time: '' });
  const [addDateError, setAddDateError] = useState(''); 

  const [formData, setFormData] = useState({
    class_name: "",
    department: "",
    building: "",
    ...DEFAULT_MODEL_PREFERENCES,
    ...DEFAULT_SLOT_STATE,
    notes: "",
    room_number: ""
  });

  const [dates, setDates] = useState([emptyDate()]);

  useEffect(() => {
    fetchSeries();
  }, [user.id]);

  const fetchSeries = () => {
    api.get(`/request_series`)
      .then((res) => {
        const sorted = res.data.sort((a, b) => {
          const aFirst = a.faculty_requests?.[0]?.starts_at;
          const bFirst = b.faculty_requests?.[0]?.starts_at;
          return new Date(aFirst) - new Date(bFirst);
        });
        setSeries(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching series:", err);
        setSubmitError("Error fetching requests. Please try again.");
      });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreferenceChange = (name, value) => {
    setFormData(prev => applyPreferenceChange(prev, name, value));
  };

  const handleClassPreferenceChange = (name, value) => {
    setClassFormData(prev => applyPreferenceChange(prev, name, value));
  };

  const handleDateChange = (index, field, value) => {
    setDates(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const handleDateBlur = (index, field, value) => {
    if (field === 'start_time' || field === 'end_time') {
      const cleaned = roundToNearest5(value);
      setDates(prev => prev.map((d, i) => i === index ? { ...d, [field]: cleaned } : d));
    }
  };

  const addDate = () => setDates(prev => [...prev, emptyDate()]);

  const removeDate = (index) => {
    if (dates.length === 1) return; // always keep at least one
    setDates(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 4);

    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      const inputDate = new Date(d.date + "T00:00:00");

      if (inputDate <= today) {
        setSubmitError(`Date ${i + 1}: Requests must be for a future date (tomorrow or later).`);
        return;
      }
      if (inputDate > maxDate) {
        setSubmitError(`Date ${i + 1}: Cannot be more than 4 months in advance.`);
        return;
      }

      const startDateTime = new Date(`${d.date}T${d.start_time}`);
      const endDateTime = new Date(`${d.date}T${d.end_time}`);
      const hoursError = validateBusinessHours(d.start_time, d.end_time);
      if (hoursError) {
        setSubmitError(`Date ${i + 1}: Classes ${hoursError.charAt(0).toLowerCase()}${hoursError.slice(1)}`);
        return;
      }
      if (endDateTime <= startDateTime) {
        setSubmitError(`Date ${i + 1}: End time must be after start time.`);
        return;
      }
    }

    const payload = {
      request_series: {
        class_name: formData.class_name,
        department: formData.department,
        building: formData.building,
        ...pickPreferences(formData),
        notes: formData.notes,
        room_number: formData.room_number
      },
      dates: dates.map(d => ({
        date: d.date,
        start_time: d.start_time,
        end_time: d.end_time
      })),
      model_slots: modelSlotsPayload(formData)
    };

    api.post("/request_series", payload)
      .then(() => {
        setSubmitSuccess('Request submitted successfully!');
        setTimeout(() => setSubmitSuccess(''), 3000);
        setShowModal(false);
        fetchSeries();
        setFormData({
          class_name: "", department: "", building: "",
          ...DEFAULT_MODEL_PREFERENCES, ...DEFAULT_SLOT_STATE, notes: "", room_number: ""
        });
        setDates([emptyDate()]);
      })
      .catch((err) => {
        console.error(err);
        setSubmitError(extractErrorMessages(err, "Error submitting request. Please try again."));
      });
  };

  const handleCancelDate = async (req) => {
    const booked = (req.confirmed_gigs || []).length > 0;
    const confirmed = await confirm({
      title: `Cancel ${formatDateWithWeekday(req.starts_at)}?`,
      message: booked
        ? 'The model booked for this date will be released. The rest of the class stays as it is.'
        : 'Only this date is cancelled. The rest of the class stays as it is.',
      confirmLabel: 'Cancel Date',
      cancelLabel: 'Keep Date',
      danger: true
    });
    if (!confirmed) return;

    api.delete(`/faculty_requests/${req.id}`)
      .then(() => {
        setSubmitSuccess("Date cancelled.");
        setTimeout(() => setSubmitSuccess(''), 3000);
        fetchSeries();
      })
      .catch((err) => notify({ title: "Couldn't cancel this date", message: extractErrorMessages(err, 'Please try again.') }));
  };

  const handleCancelSeries = async (seriesId) => {
    const confirmed = await confirm({
      title: 'Cancel this class?',
      message: 'All of its dates will be cancelled, and any booked models released.',
      confirmLabel: 'Cancel Class',
      cancelLabel: 'Keep Class',
      danger: true
    });
    if (!confirmed) return;

    api.delete(`/request_series/${seriesId}`)
      .then(() => {
        setSubmitSuccess("Class cancelled.");
        setTimeout(() => setSubmitSuccess(''), 3000);
        fetchSeries();
      })
      .catch((err) => notify({ title: "Couldn't cancel this class", message: extractErrorMessages(err, 'Please try again.') }));
  };

  const openEditModal = (req) => {
    const start = new Date(req.starts_at);
    const end = new Date(req.ends_at);
    const pad = (n) => n.toString().padStart(2, '0');

    setEditingRequest(req);
    setEditFormData({
      starts_at: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      starts_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      ends_time: `${pad(end.getHours())}:${pad(end.getMinutes())}`
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();

    const startDateTime = new Date(`${editFormData.starts_at}T${editFormData.starts_time}`);
    const endDateTime = new Date(`${editFormData.starts_at}T${editFormData.ends_time}`);

    if (endDateTime <= startDateTime) {
      setEditError("End time must be after start time.");
      return;
    }

    const hoursError = validateBusinessHours(editFormData.starts_time, editFormData.ends_time);
    if (hoursError) {
      setEditError(`Classes ${hoursError.charAt(0).toLowerCase()}${hoursError.slice(1)}`);
      return;
    }

    api.patch(`/faculty_requests/${editingRequest.id}`, {
      faculty_request: { starts_at: startDateTime, ends_at: endDateTime }
    })
      .then(() => {
        setSubmitSuccess('Date updated successfully!');
        setTimeout(() => setSubmitSuccess(''), 3000);
        setShowEditModal(false);
        fetchSeries();
      })
      .catch((err) => {
        console.error(err);
        setEditError(extractErrorMessages(err, "Error updating request. Please try again."));
      });
  };

  const openClassModal = (s) => {
    setEditingSeries(s);
    setClassFormData({
      class_name: s.class_name || "",
      department: s.department || "",
      building: s.building || "",
      room_number: s.room_number || "",
      ...pickPreferences(s),
      ...slotFormState(s),
      notes: s.notes || ""
    });
    setClassError('');
  };

  const handleClassInputChange = (e) => {
    const { name, value } = e.target;
    setClassFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClassSubmit = (e) => {
    e.preventDefault();
    api.patch(`/request_series/${editingSeries.id}`, {
      request_series: {
        class_name: classFormData.class_name,
        department: classFormData.department,
        building: classFormData.building,
        room_number: classFormData.room_number,
        ...pickPreferences(classFormData),
        notes: classFormData.notes
      },
      model_slots: modelSlotsPayload(classFormData)
    })
      .then(() => {
        setSubmitSuccess('Class updated for every date!');
        setTimeout(() => setSubmitSuccess(''), 3000);
        setEditingSeries(null);
        fetchSeries();
      })
      .catch((err) => {
        console.error(err);
        setClassError(extractErrorMessages(err, "Error updating class. Please try again."));
      });
  };

  const openAddDateForm = (seriesId) => {
    setAddingDateSeriesId(seriesId);
    setNewDateForm({ date: '', start_time: '', end_time: '' });
    setAddDateError('');
  };

  const handleAddDateChange = (field, value) => {
    setNewDateForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddDateBlur = (field, value) => {
    if (field === 'start_time' || field === 'end_time') {
      setNewDateForm(prev => ({ ...prev, [field]: roundToNearest5(value) }));
    }
  };

  const handleAddDateSubmit = async (series) => {
    setAddDateError('');
    const { date, start_time, end_time } = newDateForm;
    if (!date || !start_time || !end_time) {
      setAddDateError("All fields are required.");
      return;
    }

    const starts_at = new Date(`${date}T${start_time}`);
    const ends_at = new Date(`${date}T${end_time}`);

    try {
      await api.post('/faculty_requests', {
        faculty_request: {
          request_series_id: series.id,
          class_name: series.class_name,
          department: series.department,
          building: series.building,
          room_number: series.room_number,
          ...pickPreferences(series),
          notes: series.notes,
          starts_at,
          ends_at
        }
      });
      setAddingDateSeriesId(null);
      setSubmitSuccess("Date added!");
      setTimeout(() => setSubmitSuccess(''), 3000);
      fetchSeries();
    } catch (err) {
      setAddDateError(extractErrorMessages(err, "Failed to add date."));
    }
  };

  return (
    <Container className={`py-4 ${styles.container}`}>
      {submitSuccess && (
        <Alert variant="success" dismissible onClose={() => setSubmitSuccess('')}>
          {submitSuccess}
        </Alert>
      )}

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h2>My Classes</h2>
          <p className="text-muted mb-0">Manage your model needs. Once a model is booked, only an admin can change that class.</p>
        </div>
        <div className={`d-grid d-md-block {styles.requestBtn}`}>
          <Button
            className={styles.requestBtn}
            variant="primary" size="lg"
            onClick={() => {
              setShowModal(true);
              setSubmitError('');
              setSubmitSuccess('');
            }}>
            + New Request
          </Button>
        </div>
      </div>
      <div className="rainbow-bar mb-4"></div>

      {series.length === 0 && !loading && (
        <Alert variant="info">You haven't requested any models yet. Click "New Request" to start.</Alert>
      )}

      <Row>
        {series.map((s) => {
          const requests = (s.faculty_requests || [])
            .filter(r => r.status !== 'archived')
            .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
          const firstReq = requests[0];
          if (!firstReq) return null;

          return (
            <Col md={6} lg={4} key={s.id} className="mb-4">
              <Card className={`h-100 shadow-sm border-0 ${styles.card}`}>
                <Card.Header className={`text-white fw-bold ${s.status === 'matched' ? 'bg-success' : 'bg-warning'}`}>
                  {s.status === 'matched'
                    ? ((s.models_needed || 1) > 1 ? 'Models Confirmed' : 'Model Confirmed')
                    : 'Pending'}
                  {requests.length > 1 && (
                    <Badge bg="light" text="dark" className="ms-2">{requests.length} dates</Badge>
                  )}
                </Card.Header>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <Card.Title>{s.class_name}</Card.Title>
                    {s.department && <Badge bg="secondary" className="small">{s.department}</Badge>}
                  </div>

                  <div className="mb-2">
                    {requests.map((req, idx) => (
                      <div key={req.id} className={idx > 0 ? "mt-1 pt-1 border-top" : ""}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold">{formatDateWithWeekday(req.starts_at)}</div>
                            <div className="text-muted small">{formatTime(req.starts_at)} - {formatTime(req.ends_at)}</div>
                            {(() => {
                              const booked = req.confirmed_gigs || [];
                              const needed = req.models_needed || 1;
                              if (booked.length === 0) return null;
                              const contact = booked.find(g => g.confirmed_by?.email)?.confirmed_by;
                              return (
                                <div>
                                  {req.status === 'matched'
                                    ? <Badge bg="success">{needed > 1 ? `All ${needed} Models Confirmed` : 'Model Confirmed'}</Badge>
                                    : <Badge bg="warning" text="dark">{booked.length} of {needed} Models Confirmed</Badge>}
                                  <br />
                                  {contact?.email && (
                                    <a
                                      href={`mailto:${contact.email}?subject=${encodeURIComponent(`Edit request: ${s.class_name} (${formatDateWithWeekday(req.starts_at)})`)}&body=${encodeURIComponent(`Hi ${contact.first_name},\n\nI need to make a change to my confirmed request for ${s.class_name} on ${formatDateWithWeekday(req.starts_at)} at ${formatTime(req.starts_at)}.\n\nDetails:\n`)}`}
                                      className="small"
                                      title={`Email ${contact.first_name} about this date`}
                                    >
                                      <small>Need to edit? Contact {contact.email}</small>
                                    </a>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="d-flex gap-1">
                            {req.status === 'pending' && (req.confirmed_gigs || []).length === 0 && (
                              <Button variant="outline-secondary" size="sm" onClick={() => openEditModal(req)}>
                                <i className="bi bi-pencil" aria-hidden="true"></i> Edit Date
                              </Button>
                            )}
                            {req.status !== 'archived' && (
                              <Button variant="outline-danger" size="sm" onClick={() => handleCancelDate(req)}>
                                <i className="bi bi-x-lg"></i> Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {s.status === 'pending' && (
                      <div className="mt-2 pt-2 border-top">
                        {addingDateSeriesId === s.id ? (
                          <div className="p-2 bg-light rounded border">
                            {addDateError && (
                              <Alert variant="danger" dismissible onClose={() => setAddDateError('')} className="py-2 small">
                                {addDateError}
                              </Alert>
                            )}
                            <Row className="g-2">
                              <Col xs={12} sm={4}>
                                <Form.Label className="small mb-1">Date</Form.Label>
                                <Form.Control
                                  type="date"
                                  size="sm"
                                  value={newDateForm.date}
                                  onChange={e => handleAddDateChange('date', e.target.value)}
                                />
                              </Col>
                              <Col xs={6} sm={4}>
                                <Form.Label className="small mb-1">Start</Form.Label>
                                <Form.Control
                                  type="time"
                                  size="sm"
                                  value={newDateForm.start_time}
                                  onChange={e => handleAddDateChange('start_time', e.target.value)}
                                  onBlur={e => handleAddDateBlur('start_time', e.target.value)}
                                />
                              </Col>
                              <Col xs={6} sm={4}>
                                <Form.Label className="small mb-1">End</Form.Label>
                                <Form.Control
                                  type="time"
                                  size="sm"
                                  value={newDateForm.end_time}
                                  onChange={e => handleAddDateChange('end_time', e.target.value)}
                                  onBlur={e => handleAddDateBlur('end_time', e.target.value)}
                                />
                              </Col>
                            </Row>
                            <div className="d-flex justify-content-end gap-2 mt-2">
                              <Button variant="secondary" size="sm" onClick={() => setAddingDateSeriesId(null)}>Cancel</Button>
                              <Button variant="primary" size="sm" onClick={() => handleAddDateSubmit(s)}>Add</Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="outline-primary" size="sm" onClick={() => openAddDateForm(s.id)}>
                            <i className="bi bi-plus-circle me-1"></i> Add Date
                          </Button>
                        )}
                      </div>
                    )}
                    {(s.building || s.room_number) && (
                      <div className="text-muted small mt-1 pt-1 border-top">
                        <i className="bi bi-door-open me-1"></i>
                        {s.building}{s.building && s.room_number && " "}{s.room_number}
                      </div>
                    )}
                  </div>

                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {s.model_mode === 'nude'
                      ? <Badge bg="danger">Nude Required</Badge>
                      : <Badge bg="success">Clothed</Badge>}
                    {!hasModelSlots(s) && s.pref_skin_tone !== 'Any' && <Badge bg="light" text="dark" className="border">{formatSkinTone(s.pref_skin_tone)}</Badge>}
                    {(s.models_needed || 1) > 1 && <Badge bg="primary">{formatModelCount(s.models_needed)}</Badge>}
                    {!hasModelSlots(s) && s.pref_gender !== 'Any' && <Badge bg="light" text="dark" className="border">Gender: {formatGenderPreference(s)}</Badge>}
                    {!hasModelSlots(s) && s.pref_body_type && s.pref_body_type !== 'Any' && <Badge bg="light" text="dark" className="border">{formatBodyType(s.pref_body_type)}</Badge>}
                    {!hasModelSlots(s) && s.model_mode === 'nude' && s.pref_genitalia && s.pref_genitalia !== 'Any' && <Badge bg="light" text="dark" className="border">{formatGenitalia(s.pref_genitalia)}</Badge>}
                  </div>
                  {hasModelSlots(s) && (
                    <ul className="list-unstyled small mb-3">
                      {s.model_slots.map(slot => (
                        <li key={slot.position}>
                          <strong>Model {slot.position}:</strong> {formatPreferenceSummary(slot, s.model_mode)}
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.notes && (
                    <div className="mt-1 text-muted small fst-italic">
                      <i className="bi bi-journal-text"></i>:&nbsp;&nbsp;{s.notes}
                    </div>
                  )}

                  {s.status !== 'archived' && !requests.some(r => (r.confirmed_gigs || []).length > 0) && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="w-100 mt-2"
                      onClick={() => openClassModal(s)}
                    >
                      <i className="bi bi-pencil me-1" aria-hidden="true"></i>Edit Class
                    </Button>
                  )}
                  {s.status !== 'archived' && (
                    <Button
                      variant={s.status === 'matched' ? "danger" : "outline-danger"}
                      size="sm"
                      className="w-100 mt-2"
                      onClick={() => handleCancelSeries(s.id)}
                    >
                      Cancel Class
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Request a Model</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {submitError && (
            <Alert variant="danger" dismissible onClose={() => setSubmitError('')}>
              {submitError}
            </Alert>
          )}
          <Form onSubmit={handleSubmit}>
            <Row>
              <Form.Group as={Col} md={6} className="mb-3" controlId="new-class-name">
                <Form.Label>Class Name</Form.Label>
                <Form.Control required name="class_name" value={formData.class_name} onChange={handleInputChange} placeholder="e.g. Figure Drawing 101" />
              </Form.Group>
              <Form.Group as={Col} md={6} className="mb-3" controlId="new-department">
                <Form.Label>Department</Form.Label>
                <Form.Select required name="department" value={formData.department} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Form.Select>
              </Form.Group>
            </Row>

            <Row>
              <Form.Group as={Col} md={4} className="mb-3" controlId="new-building">
                <Form.Label>Building</Form.Label>
                <Form.Select required name="building" value={formData.building} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group as={Col} md={4} className="mb-3" controlId="new-room">
                <Form.Label>Room Number</Form.Label>
                <Form.Control name="room_number" value={formData.room_number} onChange={handleInputChange} placeholder="e.g. 413" />
              </Form.Group>
            </Row>

            <hr />

            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0">Dates & Times</h5>
              <Button variant="outline-primary" size="sm" type="button" onClick={addDate}>
                <i className="bi bi-plus-circle me-1" aria-hidden="true"></i> Add Another Date
              </Button>
            </div>

            {dates.map((d, index) => (
              <div key={index} className="p-3 mb-2 bg-light rounded border" role="group" aria-labelledby={`new-date-${index}-heading`}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small id={`new-date-${index}-heading`} className="fw-bold text-muted">Date {index + 1}</small>
                  {dates.length > 1 && (
                    <Button variant="outline-danger" size="sm" type="button" onClick={() => removeDate(index)} aria-label={`Remove date ${index + 1}`} title="Remove this date">
                      <i className="bi bi-trash" aria-hidden="true"></i>
                    </Button>
                  )}
                </div>
                <Row>
                  <Form.Group as={Col} md={4} className="mb-2" controlId={`new-date-${index}-date`}>
                    <Form.Label className="small">Date</Form.Label>
                    <Form.Control
                      required
                      type="date"
                      value={d.date}
                      onChange={e => handleDateChange(index, 'date', e.target.value)}
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={4} className="mb-2" controlId={`new-date-${index}-start`}>
                    <Form.Label className="small">Start Time</Form.Label>
                    <Form.Control
                      required
                      type="time"
                      value={d.start_time}
                      onChange={e => handleDateChange(index, 'start_time', e.target.value)}
                      onBlur={e => handleDateBlur(index, 'start_time', e.target.value)}
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={4} className="mb-2" controlId={`new-date-${index}-end`}>
                    <Form.Label className="small">End Time</Form.Label>
                    <Form.Control
                      required
                      type="time"
                      value={d.end_time}
                      onChange={e => handleDateChange(index, 'end_time', e.target.value)}
                      onBlur={e => handleDateBlur(index, 'end_time', e.target.value)}
                    />
                  </Form.Group>
                </Row>
              </div>
            ))}

            <hr />
            <h5>Model Preferences</h5>
            <ModelPreferenceFields values={formData} onChange={handlePreferenceChange} />

            <Form.Group className="mb-3" controlId="new-notes">
              <Form.Label>Notes for Admin</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="e.g. Prefer a model with longer hair for this portrait session..."
              />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
              <Button variant="primary" type="submit">Submit Request</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Edit Date: just this one date's day and times */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Date</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError && (
            <Alert variant="danger" dismissible onClose={() => setEditError('')}>
              {editError}
            </Alert>
          )}
          <p className="small text-muted">
            To change the class name, room or model preferences for every date, use <strong>Edit Class</strong> on the class card.
          </p>
          <Form onSubmit={handleEditSubmit}>
            <Row>
              <Form.Group as={Col} md={4} className="mb-3" controlId="edit-date">
                <Form.Label>Date</Form.Label>
                <Form.Control required type="date" name="starts_at" value={editFormData.starts_at} onChange={handleEditInputChange} />
              </Form.Group>
              <Form.Group as={Col} md={4} className="mb-3" controlId="edit-start">
                <Form.Label>Start Time</Form.Label>
                <Form.Control required type="time" name="starts_time" value={editFormData.starts_time} onChange={handleEditInputChange} />
              </Form.Group>
              <Form.Group as={Col} md={4} className="mb-3" controlId="edit-end">
                <Form.Label>End Time</Form.Label>
                <Form.Control required type="time" name="ends_time" value={editFormData.ends_time} onChange={handleEditInputChange} />
              </Form.Group>
            </Row>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Close</Button>
              <Button variant="primary" type="submit">Save Changes</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Edit Class: details and preferences shared by every date */}
      <Modal show={!!editingSeries} onHide={() => setEditingSeries(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Class</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {classError && (
            <Alert variant="danger" dismissible onClose={() => setClassError('')}>
              {classError}
            </Alert>
          )}
          <p className="small text-muted">Changes here apply to every date of this class.</p>
          <Form onSubmit={handleClassSubmit}>
            <Row>
              <Form.Group as={Col} md={6} className="mb-3" controlId="class-name">
                <Form.Label>Class Name</Form.Label>
                <Form.Control required name="class_name" value={classFormData.class_name} onChange={handleClassInputChange} />
              </Form.Group>
              <Form.Group as={Col} md={6} className="mb-3" controlId="class-department">
                <Form.Label>Department</Form.Label>
                <Form.Select required name="department" value={classFormData.department} onChange={handleClassInputChange}>
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Form.Select>
              </Form.Group>
            </Row>

            <Row>
              <Form.Group as={Col} md={4} className="mb-3" controlId="class-building">
                <Form.Label>Building</Form.Label>
                <Form.Select required name="building" value={classFormData.building} onChange={handleClassInputChange}>
                  <option value="">-- Select --</option>
                  {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group as={Col} md={4} className="mb-3" controlId="class-room">
                <Form.Label>Room Number</Form.Label>
                <Form.Control name="room_number" value={classFormData.room_number} onChange={handleClassInputChange} placeholder="e.g. 413" />
              </Form.Group>
            </Row>

            <hr />
            <h5>Model Preferences</h5>
            <ModelPreferenceFields values={classFormData} onChange={handleClassPreferenceChange} />

            <Form.Group className="mb-3" controlId="class-notes">
              <Form.Label>Notes for Admin</Form.Label>
              <Form.Control as="textarea" rows={3} name="notes" value={classFormData.notes} onChange={handleClassInputChange} />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setEditingSeries(null)}>Close</Button>
              <Button variant="primary" type="submit">Save Changes</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default FacultyDashboard;