import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Badge, Button, Alert, Spinner, Modal, Form } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";
import { formatSkinTone } from "../utils/formatters";

function ModelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);
  const [error, setError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [times, setTimes] = useState({ start: '09:00', end: '17:00' });
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = () => {
    api.get(`/users/${id}`)
      .then(res => setUser(res.data))
      .catch(() => setError("Failed to load model profile. Please try again."));

    api.get(`/art_model_availabilities?user_id=${id}`)
      .then(res => {
        const events = res.data.map(a => ({
          id: a.id,
          title: a.status === 'active' ? 'Available' : 'Cancelled',
          start: a.starts_at,
          end: a.ends_at,
          backgroundColor: a.status === 'active' ? '#198754' : '#6c757d',
          display: 'block',
          extendedProps: { ...a }
        }));
        setAvailabilities(events);
      })
      .catch(() => setError("Failed to load availability. Please try again."));
  };

  const handleDateSelect = (selectInfo) => {
    setEditingId(null);
    setSelectedDate(selectInfo.startStr.split('T')[0]);
    setTimes({ start: '09:00', end: '17:00' });
    setModalError('');
    setShowModal(true);
  };

  const handleEventClick = (info) => {
    const props = info.event.extendedProps;
    setEditingId(info.event.id);
    setSelectedDate(props.starts_at.split('T')[0]);
    const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    setTimes({
      start: formatTime(props.starts_at),
      end: formatTime(props.ends_at)
    });
    setModalError('');
    setShowModal(true);
  };

  const handleTimeChange = (e) => {
    const { name, value } = e.target;
    setTimes(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const startsAt = new Date(`${selectedDate}T${times.start}`);
    const endsAt = new Date(`${selectedDate}T${times.end}`);

    if (endsAt <= startsAt) {
      setModalError("End time must be after start time.");
      return;
    }

    const payload = { starts_at: startsAt, ends_at: endsAt };

    const request = editingId
      ? api.patch(`/art_model_availabilities/${editingId}`, { art_model_availability: payload })
      : api.post('/art_model_availabilities', { art_model_availability: { ...payload, user_id: id } });

    request
      .then(() => {
        setPageSuccess(editingId ? "Availability updated!" : "Availability added!");
        setTimeout(() => setPageSuccess(''), 3000);
        setShowModal(false);
        fetchData();
      })
      .catch(() => setModalError("Error saving availability. Please try again."));
  };

  const handleDelete = () => {
    if (!editingId || !confirm("Delete this availability slot?")) return;
    api.delete(`/art_model_availabilities/${editingId}`)
      .then(() => {
        setPageSuccess("Availability deleted!");
        setTimeout(() => setPageSuccess(''), 3000);
        setShowModal(false);
        fetchData();
      })
      .catch(() => setModalError("Error deleting. Please try again."));
  };

  if (!user && !error) return (
    <Container className="py-5 text-center">
      <Spinner animation="border" variant="secondary" />
    </Container>
  );

  return (
    <Container className="py-4">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {pageSuccess && (
        <Alert variant="success" dismissible onClose={() => setPageSuccess('')}>
          {pageSuccess}
        </Alert>
      )}

      <Button variant="outline-secondary" className="mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i> Back
      </Button>

      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm border-0 bg-light">
            <Card.Body className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <h2 className="mb-1">{user.first_name} {user.last_name}</h2>
                <div className="text-muted">{user.email}</div>
              </div>
              <div className="text-end">
                <div className="mb-2">
                  <Badge bg="info" text="dark" className="me-1">{formatSkinTone(user.skin_tone)}</Badge>
                  <Badge bg="info" text="dark" className="me-1">{user.gender_identity}</Badge>
                </div>
                <div>
                  {user.willing_to_model_nude
                    ? <Badge bg="danger">Nude OK</Badge>
                    : <Badge bg="success">Clothed Only</Badge>}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h4 className="mb-3">Availability Calendar</h4>
      <Alert variant="secondary" className="mb-3">
        <i className="bi bi-info-circle-fill me-2"></i>
        As admin you can add, edit, or delete this model's availability. Click a date to add time. Click a block to edit or delete.
      </Alert>
      <SharedCalendar
        events={availabilities}
        editable={true}
        onDateSelect={handleDateSelect}
        onEventClick={handleEventClick}
      />

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? "Edit Availability" : "Add Availability"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && (
            <Alert variant="danger" dismissible onClose={() => setModalError('')}>
              {modalError}
            </Alert>
          )}
          <p>Date: <strong>{selectedDate && new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}</strong></p>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col>
                <Form.Label>Start Time</Form.Label>
                <Form.Control type="time" name="start" value={times.start} onChange={handleTimeChange} min="08:00" max="22:00" required />
              </Col>
              <Col>
                <Form.Label>End Time</Form.Label>
                <Form.Control type="time" name="end" value={times.end} onChange={handleTimeChange} min="08:00" max="22:00" required />
              </Col>
            </Row>
            <div className="mt-4 d-flex justify-content-between">
              <div>
                {editingId && (
                  <Button variant="danger" onClick={handleDelete}>Delete Slot</Button>
                )}
              </div>
              <div>
                <Button variant="secondary" className="me-2" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button variant="success" type="submit">{editingId ? "Save Changes" : "Add Availability"}</Button>
              </div>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default ModelDetail;