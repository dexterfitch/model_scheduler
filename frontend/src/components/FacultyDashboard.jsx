import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Alert } from "react-bootstrap";
import styles from "./FacultyDashboard.module.css";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";
import { roundToNearest5, formatTime, formatDateWithWeekday } from "../utils/time";

const DEPARTMENTS = [
  "Painting", "Drawing", "Illustration", "FYE", "Sculpture", "Open Studies"
];

const BUILDINGS = ["Main", "Fox", "Lazarus", "Station"];

const emptyDate = () => ({ date: "", start_time: "", end_time: "" });

function FacultyDashboard({ user }) {
  const [series, setSeries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [editFormData, setEditFormData] = useState({
    class_name: "", department: "", building: "", room_number: "",
    model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", notes: "",
    starts_at: "", starts_time: "", ends_time: ""
  });
  const [editError, setEditError] = useState('');
  const [addingDateSeriesId, setAddingDateSeriesId] = useState(null);
  const [newDateForm, setNewDateForm] = useState({ date: '', start_time: '', end_time: '' });
  const [addDateError, setAddDateError] = useState(''); 

  const [formData, setFormData] = useState({
    class_name: "",
    department: "",
    building: "",
    model_mode: "clothed",
    pref_skin_tone: "Any",
    pref_gender: "Any",
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
      const startHour = parseInt(d.start_time.split(':')[0]);
      const endHour = parseInt(d.end_time.split(':')[0]);

      if (startHour < 8 || startHour >= 22) {
        setSubmitError(`Date ${i + 1}: Classes must start between 8:00 AM and 10:00 PM.`);
        return;
      }
      if (endHour > 22 || (endHour === 22 && d.end_time.split(':')[1] !== "00")) {
        setSubmitError(`Date ${i + 1}: Classes must end by 10:00 PM.`);
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
        model_mode: formData.model_mode,
        pref_skin_tone: formData.pref_skin_tone,
        pref_gender: formData.pref_gender,
        notes: formData.notes,
        room_number: formData.room_number
      },
      dates: dates.map(d => ({
        date: d.date,
        start_time: d.start_time,
        end_time: d.end_time
      }))
    };

    api.post("/request_series", payload)
      .then(() => {
        setSubmitSuccess('Request submitted successfully!');
        setTimeout(() => setSubmitSuccess(''), 3000);
        setShowModal(false);
        fetchSeries();
        setFormData({
          class_name: "", department: "", building: "", model_mode: "clothed",
          pref_skin_tone: "Any", pref_gender: "Any", notes: "", room_number: ""
        });
        setDates([emptyDate()]);
      })
      .catch((err) => {
        console.error(err);
        setSubmitError("Error submitting request. Please try again.");
      });
  };

  const handleCancelDate = (req) => {
    if (!confirm("Cancel this date?")) return;

    api.delete(`/faculty_requests/${req.id}`)
      .then(() => {
        setSubmitSuccess("Date cancelled.");
        setTimeout(() => setSubmitSuccess(''), 3000);
        fetchSeries();
      })
      .catch((err) => {
        console.error(err);
        setSubmitSuccess('');
      });
  };

  const handleCancelSeries = (seriesId) => {
    if (!confirm("Cancel this entire request? All dates will be cancelled.")) return;
    api.delete(`/request_series/${seriesId}`)
      .then(() => {
        setSubmitSuccess("Request cancelled.");
        setTimeout(() => setSubmitSuccess(''), 3000);
        fetchSeries();
      })
      .catch(err => console.error(err));
  };

  const openEditModal = (req) => {
    const start = new Date(req.starts_at);
    const end = new Date(req.ends_at);
    const pad = (n) => n.toString().padStart(2, '0');

    setEditingRequest(req);
    setEditFormData({
      class_name: req.class_name,
      department: req.department,
      building: req.building,
      room_number: req.room_number || "",
      model_mode: req.model_mode,
      pref_skin_tone: req.pref_skin_tone,
      pref_gender: req.pref_gender,
      notes: req.notes || "",
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

    const startHour = parseInt(editFormData.starts_time.split(':')[0]);
    const endHour = parseInt(editFormData.ends_time.split(':')[0]);
    if (startHour < 8 || startHour >= 22) {
      setEditError("Classes must start between 8:00 AM and 10:00 PM.");
      return;
    }
    if (endHour > 22 || (endHour === 22 && editFormData.ends_time.split(':')[1] !== "00")) {
      setEditError("Classes must end by 10:00 PM.");
      return;
    }

    api.patch(`/faculty_requests/${editingRequest.id}`, {
      faculty_request: {
        class_name: editFormData.class_name,
        department: editFormData.department,
        building: editFormData.building,
        room_number: editFormData.room_number,
        model_mode: editFormData.model_mode,
        pref_skin_tone: editFormData.pref_skin_tone,
        pref_gender: editFormData.pref_gender,
        notes: editFormData.notes,
        starts_at: startDateTime,
        ends_at: endDateTime
      }
    })
      .then(() => {
        setSubmitSuccess('Request updated successfully!');
        setTimeout(() => setSubmitSuccess(''), 3000);
        setShowEditModal(false);
        fetchSeries();
      })
      .catch((err) => {
        console.error(err);
        setEditError(err.response?.data?.error || "Error updating request. Please try again.");
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
          model_mode: series.model_mode,
          pref_skin_tone: series.pref_skin_tone,
          pref_gender: series.pref_gender,
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
      const messages = err.response?.data?.errors || [err.response?.data?.error] || ["Failed to add date."];
      setAddDateError(Array.isArray(messages) ? messages.join(" ") : messages);
    }
  };

  return (
    <Container className={`py-4 ${styles.container}`}>
      {submitSuccess && (
        <Alert variant="success" dismissible onClose={() => setSubmitSuccess('')}>
          {submitSuccess}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>My Classes</h2>
          <p className="text-muted">Manage your model needs. Note: Confirmed gigs (matched requests) can only be changed by an admin.</p>
        </div>
        <Button
          className={styles.requestButton}
          variant="primary" size="lg"
          onClick={() => {
            setShowModal(true);
            setSubmitError('');
            setSubmitSuccess('');
          }}>
          + New Request
        </Button>
      </div>

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
                  {s.status === 'matched' ? 'Model Confirmed' : 'Pending Match'}
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
                            {req.status === 'matched' && (
                              <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                                <Badge bg="success">Model Confirmed</Badge>
                                {req.gig?.confirmed_by?.email && (
                                  <a
                                    href={`mailto:${req.gig.confirmed_by.email}?subject=${encodeURIComponent(`Edit request: ${s.class_name} (${formatDateWithWeekday(req.starts_at)})`)}&body=${encodeURIComponent(`Hi ${req.gig.confirmed_by.first_name},\n\nI need to make a change to my confirmed request for ${s.class_name} on ${formatDateWithWeekday(req.starts_at)} at ${formatTime(req.starts_at)}.\n\nDetails:\n`)}`}
                                    className="small text-nowrap"
                                    title={`Email ${req.gig.confirmed_by.first_name} about this date`}
                                  >
                                    <i className="bi bi-envelope me-1"></i>
                                    Admin: {req.gig.confirmed_by.email}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="d-flex gap-1">
                            {req.status === 'pending' && (
                              <Button variant="outline-secondary" size="sm" onClick={() => openEditModal(req)}>
                                <i className="bi bi-pencil"></i> Edit
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
                    {s.pref_skin_tone !== 'Any' && <Badge bg="light" text="dark" className="border">{formatSkinTone(s.pref_skin_tone)}</Badge>}
                    {s.pref_gender !== 'Any' && <Badge bg="light" text="dark" className="border">{s.pref_gender} Presentation</Badge>}
                  </div>

                  {s.notes && (
                    <div className="mt-1 text-muted small fst-italic">
                      <i className="bi bi-journal-text"></i>:&nbsp;&nbsp;{s.notes}
                    </div>
                  )}

                  {s.status !== 'archived' && (
                    <Button
                      variant={s.status === 'matched' ? "danger" : "outline-danger"}
                      size="sm"
                      className="w-100 mt-2"
                      onClick={() => handleCancelSeries(s.id)}
                    >
                      {s.status === 'matched' ? "Cancel Confirmed Request" : "Cancel Pending Request"}
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
              <Col md={6} className="mb-3">
                <Form.Label>Class Name</Form.Label>
                <Form.Control required name="class_name" value={formData.class_name} onChange={handleInputChange} placeholder="e.g. Figure Drawing 101" />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Select required name="department" value={formData.department} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Form.Select>
              </Col>
            </Row>

            <Row>
              <Col md={4} className="mb-3">
                <Form.Label>Building</Form.Label>
                <Form.Select required name="building" value={formData.building} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Room Number</Form.Label>
                <Form.Control name="room_number" value={formData.room_number} onChange={handleInputChange} placeholder="e.g. 413" />
              </Col>
            </Row>

            <hr />

            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0">Dates & Times</h5>
              <Button variant="outline-primary" size="sm" type="button" onClick={addDate}>
                <i className="bi bi-plus-circle me-1"></i> Add Another Date
              </Button>
            </div>

            {dates.map((d, index) => (
              <div key={index} className="p-3 mb-2 bg-light rounded border">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="fw-bold text-muted">Date {index + 1}</small>
                  {dates.length > 1 && (
                    <Button variant="outline-danger" size="sm" type="button" onClick={() => removeDate(index)}>
                      <i className="bi bi-trash"></i>
                    </Button>
                  )}
                </div>
                <Row>
                  <Col md={4} className="mb-2">
                    <Form.Label className="small">Date</Form.Label>
                    <Form.Control
                      required
                      type="date"
                      value={d.date}
                      onChange={e => handleDateChange(index, 'date', e.target.value)}
                    />
                  </Col>
                  <Col md={4} className="mb-2">
                    <Form.Label className="small">Start Time</Form.Label>
                    <Form.Control
                      required
                      type="time"
                      value={d.start_time}
                      onChange={e => handleDateChange(index, 'start_time', e.target.value)}
                      onBlur={e => handleDateBlur(index, 'start_time', e.target.value)}
                    />
                  </Col>
                  <Col md={4} className="mb-2">
                    <Form.Label className="small">End Time</Form.Label>
                    <Form.Control
                      required
                      type="time"
                      value={d.end_time}
                      onChange={e => handleDateChange(index, 'end_time', e.target.value)}
                      onBlur={e => handleDateBlur(index, 'end_time', e.target.value)}
                    />
                  </Col>
                </Row>
              </div>
            ))}

            <hr />
            <h5>Model Preferences</h5>

            <Row>
              <Col md={4} className="mb-3">
                <Form.Label>Nudity</Form.Label>
                <Form.Select name="model_mode" value={formData.model_mode} onChange={handleInputChange}>
                  <option value="clothed">Clothed</option>
                  <option value="nude">Nude</option>
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Skin Tone</Form.Label>
                <Form.Select name="pref_skin_tone" value={formData.pref_skin_tone} onChange={handleInputChange}>
                  <option value="Any">Any</option>
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Dark">Dark</option>
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Gender Presentation</Form.Label>
                <Form.Select name="pref_gender" value={formData.pref_gender} onChange={handleInputChange}>
                  <option value="Any">Any</option>
                  <option value="Woman">Woman</option>
                  <option value="Man">Man</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Agender">Agender</option>
                </Form.Select>
              </Col>
            </Row>

            <Form.Group className="mb-3">
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

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError && (
            <Alert variant="danger" dismissible onClose={() => setEditError('')}>
              {editError}
            </Alert>
          )}
          <Form onSubmit={handleEditSubmit}>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Class Name</Form.Label>
                <Form.Control required name="class_name" value={editFormData.class_name} onChange={handleEditInputChange} />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Select required name="department" value={editFormData.department} onChange={handleEditInputChange}>
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Form.Select>
              </Col>
            </Row>

            <Row>
              <Col md={4} className="mb-3">
                <Form.Label>Building</Form.Label>
                <Form.Select required name="building" value={editFormData.building} onChange={handleEditInputChange}>
                  <option value="">-- Select --</option>
                  {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Room Number</Form.Label>
                <Form.Control name="room_number" value={editFormData.room_number} onChange={handleEditInputChange} placeholder="e.g. 413" />
              </Col>
            </Row>

            <Row>
              <Col md={4} className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control required type="date" name="starts_at" value={editFormData.starts_at} onChange={handleEditInputChange} />
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Start Time</Form.Label>
                <Form.Control required type="time" name="starts_time" value={editFormData.starts_time} onChange={handleEditInputChange} />
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>End Time</Form.Label>
                <Form.Control required type="time" name="ends_time" value={editFormData.ends_time} onChange={handleEditInputChange} />
              </Col>
            </Row>

            <hr />
            <h5>Model Preferences</h5>
            <Row>
              <Col md={4} className="mb-3">
                <Form.Label>Nudity</Form.Label>
                <Form.Select name="model_mode" value={editFormData.model_mode} onChange={handleEditInputChange}>
                  <option value="clothed">Clothed</option>
                  <option value="nude">Nude</option>
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Skin Tone</Form.Label>
                <Form.Select name="pref_skin_tone" value={editFormData.pref_skin_tone} onChange={handleEditInputChange}>
                  <option value="Any">Any</option>
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Dark">Dark</option>
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Gender Presentation</Form.Label>
                <Form.Select name="pref_gender" value={editFormData.pref_gender} onChange={handleEditInputChange}>
                  <option value="Any">Any</option>
                  <option value="Woman">Woman</option>
                  <option value="Man">Man</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Agender">Agender</option>
                </Form.Select>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Notes for Admin</Form.Label>
              <Form.Control as="textarea" rows={3} name="notes" value={editFormData.notes} onChange={handleEditInputChange} />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Close</Button>
              <Button variant="primary" type="submit">Save Changes</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default FacultyDashboard;