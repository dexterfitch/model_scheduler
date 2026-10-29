import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Badge, Button, Alert, Spinner, Modal, Form } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";
import BodyTypeIcon from "./BodyTypeIcon";
import { useDialog } from "./DialogProvider";
import { formatSkinTone, extractErrorMessages } from "../utils/formatters";
import { formatTimeForInput, findActiveGigForAvailability, availabilityEvents } from "../utils/time";

function ModelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const [user, setUser] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);
  const [error, setError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [times, setTimes] = useState({ start: '09:00', end: '17:00' });
  const [modalError, setModalError] = useState('');
  const [gigs, setGigs] = useState([]);
  const [activeGig, setActiveGig] = useState(null);

  // The calendar is worked out from the availability and gigs, so it's never out of step
  const calendarEvents = useMemo(
    () => availabilities.flatMap(a => availabilityEvents(a, gigs, { freeLabel: 'Available' })),
    [availabilities, gigs]
  );

  const fetchData = useCallback(() => {
    api.get(`/users/${id}`)
      .then(res => setUser(res.data))
      .catch(() => setError("Failed to load model profile. Please try again."));

    api.get(`/art_model_availabilities?user_id=${id}`)
      .then(res => setAvailabilities(res.data))
      .catch(() => setError("Failed to load availability. Please try again."));

    api.get(`/gigs`)
      .then(res => {
        const modelGigs = res.data.filter(g => g.art_model_availability.user.id === parseInt(id));
        setGigs(modelGigs);
      })
      .catch(() => setError("Failed to load gig data. Please try again."));
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateSelect = (selectInfo) => {
    setEditingId(null);
    setSelectedDate(selectInfo.startStr.split('T')[0]);
    setTimes({ start: '09:00', end: '17:00' });
    setModalError('');
    setActiveGig(null);
    setShowModal(true);
  };

  const handleEventClick = (info) => {
    const props = info.event.extendedProps;
    setEditingId(info.event.id);
    const startObj = new Date(props.starts_at);
    const endObj = new Date(props.ends_at);
    setSelectedDate(props.starts_at.split('T')[0]);
    setTimes({ start: formatTimeForInput(startObj), end: formatTimeForInput(endObj) });
    setModalError('');
    setActiveGig(getActiveGigForAvailability(Number(info.event.id)));
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
        setShowModal(false);
        fetchData();
      })
      .catch((err) => setModalError(extractErrorMessages(err, "Error saving availability. Please try again.")));
  };

  const handleDelete = async () => {
    if (!editingId) return;
    const confirmed = await confirm({
      title: 'Delete this availability?',
      message: "This time won't be offered to classes anymore.",
      confirmLabel: 'Delete',
      cancelLabel: 'Keep It',
      danger: true
    });
    if (!confirmed) return;
    api.delete(`/art_model_availabilities/${editingId}`)
      .then(() => {
        setPageSuccess("Availability deleted!");
        setShowModal(false);
        fetchData();
      })
      .catch((err) => setModalError(extractErrorMessages(err, "Error deleting. Please try again.")));
  };

  const handleCancelGig = async () => {
    if (!editingId) return;
    const confirmed = await confirm({
      title: `Release ${user.first_name} from this gig?`,
      message: "The class's date goes back to pending so you can book someone else.",
      confirmLabel: 'Release Model',
      cancelLabel: 'Keep Booking',
      danger: true
    });
    if (!confirmed) return;
    api.post(`/art_model_availabilities/${editingId}/cancel`, { gig_id: activeGig?.id })
      .then(() => {
        setPageSuccess("Gig cancelled.");
        setShowModal(false);
        fetchData();
      })
      .catch((err) => setModalError(extractErrorMessages(err, "Error cancelling. Please try again.")));
  };

  const getActiveGigForAvailability = (availabilityId) => findActiveGigForAvailability(gigs, availabilityId);

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
        <Alert variant="success" role="status" dismissible onClose={() => setPageSuccess('')}>
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
              <div className="text-md-end">
                <div className="mb-2">
                  <Badge bg="info" text="dark" className="me-1">{formatSkinTone(user.skin_tone)}</Badge>
                  <Badge bg="info" text="dark" className="me-1">{user.gender_identity}</Badge>
                  {user.body_type && <Badge bg="info" text="dark" className="me-1 d-inline-flex align-items-center gap-1"><BodyTypeIcon type={user.body_type} size={16} />{user.body_type} Build</Badge>}
                  {user.willing_to_model_nude && user.genitalia && <Badge bg="info" text="dark" className="me-1">{user.genitalia} Genitalia</Badge>}
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
        As admin you can add, edit, or delete this model's availability. Use Add Availability, or click a date on the grid, to add time. Click a block to edit or delete.
      </Alert>
      <SharedCalendar
        events={calendarEvents}
        editable={true}
        onDateSelect={handleDateSelect}
        onEventClick={handleEventClick}
      />

      <Modal show={showModal} onHide={() => setShowModal(false)} aria-labelledby="availability-window-title">
        <Modal.Header closeButton>
          <Modal.Title id="availability-window-title">{activeGig ? "Gig Scheduled" : (editingId ? "Edit Availability" : "Add Availability")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && (
            <Alert variant="danger" dismissible onClose={() => setModalError('')}>
              {modalError}
            </Alert>
          )}
          {activeGig ? (
            <>
              <p>Date: <strong>{selectedDate && new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}</strong></p>
              <Alert variant="info">
                <i className="bi bi-info-circle-fill me-2"></i>
                This model is confirmed for <strong>{activeGig.faculty_request.class_name}</strong> from{' '}
                {times.start} to {times.end}. Availability can't be edited while a gig is scheduled.
              </Alert>
              <div className="d-flex justify-content-end">
                <Button variant="outline-danger" onClick={handleCancelGig}>Release Model</Button>
              </div>
            </>
          ) : (
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="availability-date">
                <Form.Label>Date</Form.Label>
                <Form.Control type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} required />
              </Form.Group>
              <Row>
                <Form.Group as={Col} controlId="availability-start">
                  <Form.Label>Start Time</Form.Label>
                  <Form.Control type="time" name="start" value={times.start} onChange={handleTimeChange} min="08:00" max="22:00" required />
                </Form.Group>
                <Form.Group as={Col} controlId="availability-end">
                  <Form.Label>End Time</Form.Label>
                  <Form.Control type="time" name="end" value={times.end} onChange={handleTimeChange} min="08:00" max="22:00" required />
                </Form.Group>
              </Row>
              <div className="mt-4 d-flex justify-content-between">
                <div>
                  {editingId && (
                    <Button variant="outline-danger" onClick={handleDelete}>Delete Slot</Button>
                  )}
                </div>
                <div>
                  <Button variant="secondary" className="me-2" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button variant="success" type="submit">{editingId ? "Save Changes" : "Add Availability"}</Button>
                </div>
              </div>
            </Form>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default ModelDetail;
