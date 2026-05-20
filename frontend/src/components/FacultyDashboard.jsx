import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Alert } from "react-bootstrap";
import styles from "./FacultyDashboard.module.css";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";

const DEPARTMENTS = [
  "Painting", "Drawing", "Illustration", "FYE", "Sculpture", "Open Studies"
];

const emptyDate = () => ({ date: "", start_time: "", end_time: "" });

function FacultyDashboard({ user }) {
  const [series, setSeries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [formData, setFormData] = useState({
    class_name: "",
    department: "",
    model_mode: "clothed",
    pref_skin_tone: "Any",
    pref_gender: "Any",
    notes: "",
    room_number: ""
  });

  // CHANGED: dates is now an array of {date, start_time, end_time}
  const [dates, setDates] = useState([emptyDate()]);

  useEffect(() => {
    fetchMySeries();
  }, [user.id]);

  const fetchMySeries = () => {
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

  const generateTimeOptions = () => {
    const options = [];
    let start = 8 * 60;
    const end = 22 * 60;
    while (start <= end) {
      const hours = Math.floor(start / 60);
      const mins = start % 60;
      const value = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      options.push(<option key={value} value={value} />);
      start += 5;
    }
    return options;
  };

  const roundToNearest5 = (timeStr) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m;
    const rounded = Math.round(totalMins / 5) * 5;
    const newH = Math.floor(rounded / 60);
    const newM = rounded % 60;
    return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ADDED: handlers for the dates array
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

    // Validate all dates
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
        fetchMySeries();
        setFormData({
          class_name: "", department: "", model_mode: "clothed",
          pref_skin_tone: "Any", pref_gender: "Any", notes: "", room_number: ""
        });
        setDates([emptyDate()]);
      })
      .catch((err) => {
        console.error(err);
        setSubmitError("Error submitting request. Please try again.");
      });
  };

  const handleCancelSeries = (seriesId) => {
    if (!confirm("Cancel this entire request? All dates will be cancelled.")) return;
    api.delete(`/request_series/${seriesId}`)
      .then(() => {
        setSubmitSuccess("Request cancelled.");
        setTimeout(() => setSubmitSuccess(''), 3000);
        fetchMySeries();
      })
      .catch(err => console.error(err));
  };

  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
          <p className="text-muted">Manage your model needs</p>
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
          const requests = s.faculty_requests || [];
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

                  <div className="mb-3">
                    {requests.map((req, idx) => (
                      <div key={req.id} className={idx > 0 ? "mt-1 pt-1 border-top" : ""}>
                        <div className="fw-bold">{formatDate(req.starts_at)}</div>
                        <div className="text-muted small">{formatTime(req.starts_at)} - {formatTime(req.ends_at)}</div>
                      </div>
                    ))}
                    {s.room_number && (
                      <div className="text-muted small mt-1">
                        <i className="bi bi-door-open me-1"></i>{s.room_number}
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
                      {s.status === 'matched' ? "Cancel Confirmed Class" : "Cancel Request"}
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
              <Col md={3} className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Select required name="department" value={formData.department} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Form.Select>
              </Col>
              <Col md={3} className="mb-3">
                <Form.Label>Room Number</Form.Label>
                <Form.Control name="room_number" value={formData.room_number} onChange={handleInputChange} placeholder="e.g. Fox 413" />
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
                      list="time-options"
                      value={d.start_time}
                      onChange={e => handleDateChange(index, 'start_time', e.target.value)}
                      onBlur={e => handleDateBlur(index, 'start_time', e.target.value)}
                      min="08:00" max="22:00"
                    />
                  </Col>
                  <Col md={4} className="mb-2">
                    <Form.Label className="small">End Time</Form.Label>
                    <Form.Control
                      required
                      type="time"
                      list="time-options"
                      value={d.end_time}
                      onChange={e => handleDateChange(index, 'end_time', e.target.value)}
                      onBlur={e => handleDateBlur(index, 'end_time', e.target.value)}
                      min="08:00" max="22:00"
                    />
                  </Col>
                </Row>
              </div>
            ))}

            <datalist id="time-options">{generateTimeOptions()}</datalist>

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
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-Binary">Non-Binary</option>
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
    </Container>
  );
}

export default FacultyDashboard;