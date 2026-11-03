/**
 * An admin's view of one model: their profile and their calendar, where admins can
 * manage the model's free time, and retire the model or bring them back.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Badge, Button, Alert, Spinner, Modal, Form } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";
import { useDialog } from "./DialogProvider";
import { formatSkinTone, extractErrorMessages } from "../utils/formatters";
import { formatTimeForInput, findActiveGigForAvailability, availabilityEvents, availabilitySavedMessage } from "../utils/time";
import GigDates from "./GigDates";
import { useRetireModel } from "./useRetireModel";
import StatusToast from "./StatusToast";
import { useRevealMessage } from '../utils/revealMessage';

/** The model's page for admins. */
function ModelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const retireOrBringBack = useRetireModel();
  const [user, setUser] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);
  const [error, setError] = useState('');
  const errorRef = useRevealMessage(error);
  const [pageSuccess, setPageSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [times, setTimes] = useState({ start: '09:00', end: '17:00' });
  const [modalError, setModalError] = useState('');
  const modalErrorRef = useRevealMessage(modalError);
  const [gigs, setGigs] = useState([]);
  const [activeGig, setActiveGig] = useState(null);

  /** The model's free time and booked gigs as calendar events. */
  const calendarEvents = useMemo(
    () => availabilities.flatMap(a => availabilityEvents(a, gigs, { freeLabel: 'Available' })),
    [availabilities, gigs]
  );

  /** Loads the model, their free time and their gigs. */
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

  /**
   * Retires the model after saying what that means, or brings a retired model back.
   * Says why if it can't be done yet.
   */
  const handleRetire = async () => {
    const result = await retireOrBringBack(user);
    if (!result) return;
    setUser(result.user);
    setPageSuccess(result.message);
    api.get(`/art_model_availabilities?user_id=${id}`).then(r => setAvailabilities(r.data)).catch(() => {});
  };

  /** Opens Add Availability on the clicked day. */
  const handleDateSelect = (selectInfo) => {
    setEditingId(null);
    setSelectedDate(selectInfo.startStr.split('T')[0]);
    setTimes({ start: '09:00', end: '17:00' });
    setModalError('');
    setActiveGig(null);
    setShowModal(true);
  };

  /** Opens a block of free time to edit, or a booked gig's details. */
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

  /** Saves a changed time. */
  const handleTimeChange = (e) => {
    const { name, value } = e.target;
    setTimes(prev => ({ ...prev, [name]: value }));
  };

  /** Adds or saves the model's free time, after checking it. */
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
      .then((res) => {
        setPageSuccess(availabilitySavedMessage(res.data, editingId ? "Availability updated!" : "Availability added!", { forAdmin: true }));
        setShowModal(false);
        fetchData();
      })
      .catch((err) => setModalError(extractErrorMessages(err, "Error saving availability. Please try again.")));
  };

  /** Deletes a block of free time, after confirming. */
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

  /** Releases the model from the gig open in the window, after confirming. */
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

  /** The booked gig in a block of free time, if any. */
  const getActiveGigForAvailability = (availabilityId) => findActiveGigForAvailability(gigs, availabilityId);

  if (!user && !error) return (
    <Container className="py-5 text-center">
      <Spinner animation="border" variant="secondary" />
    </Container>
  );

  return (
    <Container className="py-4">
      {error && (
        <Alert ref={errorRef} tabIndex={-1} variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <StatusToast message={pageSuccess} onClose={() => setPageSuccess('')} />

      <Button variant="outline-secondary" className="mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i> Back
      </Button>

      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm border-0 bg-light">
            <Card.Body className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <h2 className="mb-1">
                  {user.first_name} {user.last_name}
                  {user.retired_at && <Badge bg="secondary" className="ms-2 fs-6 align-middle">Retired</Badge>}
                </h2>
                <div className="text-muted">{user.email}</div>
                <Button
                  variant={user.retired_at ? 'outline-success' : 'outline-secondary'}
                  size="sm"
                  className="mt-2"
                  onClick={handleRetire}
                >
                  {user.retired_at ? 'Bring Back' : 'Retire Model'}
                </Button>
              </div>
              <div className="text-md-end">
                <div className="mb-2">
                  <Badge bg="info" text="dark" className="me-1">{formatSkinTone(user.skin_tone)}</Badge>
                  <Badge bg="info" text="dark" className="me-1">{user.gender_identity}</Badge>
                  {user.body_type && <Badge bg="info" text="dark" className="me-1">{user.body_type} Build</Badge>}
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
            <Alert ref={modalErrorRef} tabIndex={-1} variant="danger" dismissible onClose={() => setModalError('')}>
              {modalError}
            </Alert>
          )}
          {activeGig ? (
            <>
              <p>This model is confirmed for <strong>{activeGig.faculty_request.class_name}</strong>.</p>
              <GigDates gig={activeGig} gigs={gigs} forAdmin />
              <p className="small text-muted">
                <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
                Availability can't be edited while a gig is scheduled. Release Model takes them off this date only.
              </p>
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
                  <Form.Control type="time" step={300} name="start" value={times.start} onChange={handleTimeChange} min="08:00" max="22:00" required />
                </Form.Group>
                <Form.Group as={Col} controlId="availability-end">
                  <Form.Label>End Time</Form.Label>
                  <Form.Control type="time" step={300} name="end" value={times.end} onChange={handleTimeChange} min="08:00" max="22:00" required />
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
