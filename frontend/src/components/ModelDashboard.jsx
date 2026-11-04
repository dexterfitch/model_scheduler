/**
 * The model's page: My Gigs (upcoming, completed and cancelled, with cancelling one
 * date or every remaining date of a class, and which of a class's dates each gig is)
 * and Manage Availability (their free time on a calendar, plus Open Calls they can
 * sign up for), plus a calendar subscription link. A model missing a required
 * profile answer is asked to finish their profile; a retired model is told they
 * can't add free time or sign up.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Row, Col, Card, Badge, Tab, Tabs, Button, Modal, Form, Alert, ListGroup } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";
import { useDialog } from "./DialogProvider";
import GigDates from "./GigDates";
import { extractErrorMessages } from "../utils/formatters";
import { roundToNearest5, formatTime, formatDateWithWeekday, validateBusinessHours, formatTimeForInput, availabilityCoversRequest, findActiveGigForAvailability, availabilityEvents, availabilitySavedMessage } from "../utils/time";
import StatusToast from "./StatusToast";
import CalendarLinkButton from "./CalendarLinkButton";
import { useRevealMessage } from '../utils/revealMessage';
import { GENDER_IDENTITIES, SKIN_TONE_ANSWERS } from "../utils/constants";

/** The required profile answers a model is missing, or saved under an option the app no longer offers. */
const missingAnswers = (user) => [
  !SKIN_TONE_ANSWERS.includes(user.skin_tone) && 'Skin Tone',
  !GENDER_IDENTITIES.includes(user.gender_identity) && 'Gender',
].filter(Boolean);

/** The model's page. */
function ModelDashboard({ user }) {
  const { confirm, notify } = useDialog();
  const [myGigs, setMyGigs] = useState([]);
  const [pendingSeries, setPendingSeries] = useState([]);
  const [myAvailabilities, setMyAvailabilities] = useState([]);
  const [activeTab, setActiveTab] = useState("schedule");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [times, setTimes] = useState({ start: "09:00", end: "17:00" });
  const [modalError, setModalError] = useState('');
  const modalErrorRef = useRevealMessage(modalError);
  const [pageSuccess, setPageSuccess] = useState('');
  const [activeGig, setActiveGig] = useState(null);
  const [gigFilter, setGigFilter] = useState('confirmed');

  useEffect(() => {
    if (activeTab === "availability") {
      setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
    }
  }, [activeTab]);

  /** The model's free time and booked gigs as calendar events. */
  const calendarEvents = useMemo(() => myAvailabilities
    .filter(a => a.status === 'active')
    .flatMap(a => availabilityEvents(a, myGigs)), [myAvailabilities, myGigs]);

  /** Loads the model's free time, gigs and open calls. */
  const fetchData = useCallback(() => {
    api.get("/gigs").then((res) => {
      const my_gigs = res.data.sort((a, b) =>
        new Date(a.faculty_request.starts_at) - new Date(b.faculty_request.starts_at)
      );
      setMyGigs(my_gigs);
    }).catch(err => console.error("Error fetching gigs:", err));

    api.get(`/art_model_availabilities?user_id=${user.id}`).then((res) => {
      setMyAvailabilities(res.data);
    }).catch(err => console.error("Error fetching availabilities:", err));

    api.get("/request_series/available_for_model").then((res) => {
      setPendingSeries(res.data);
    }).catch(err => console.error("Error fetching series:", err));
  }, [user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Whether the model's free time already covers every open date of a call. */
  const isAvailableForSeries = (series) => {
    const pendingRequests = series.faculty_requests?.filter(r => r.status === 'pending') || [];
    return pendingRequests.every(req =>
      myAvailabilities.some(avail => avail.status === 'active' && availabilityCoversRequest(avail, req))
    );
  };

  /**
   * Adds free time for each open date of a call that isn't covered yet, one at a time so same-day
   * dates join.
   */
  const handleMarkAvailable = async (series) => {
    const pendingRequests = series.faculty_requests?.filter(r => r.status === 'pending') || [];

    const missingRequests = pendingRequests.filter(req =>
      !myAvailabilities.some(avail => avail.status === 'active' && availabilityCoversRequest(avail, req))
    );

    if (missingRequests.length === 0) return;

    const failed = [];
    for (const req of missingRequests) {
      try {
        await api.post("/art_model_availabilities", {
          art_model_availability: { starts_at: req.starts_at, ends_at: req.ends_at }
        });
      } catch (err) {
        failed.push({ reason: err });
      }
    }
    fetchData();

    if (failed.length === 0) {
      setPageSuccess(pendingRequests.length === 1 ? 'Availability added for this date!' : `Availability added for all ${pendingRequests.length} dates!`);
      return;
    }
    setPageSuccess('');
    notify({
      title: "Couldn't add your availability",
      message: extractErrorMessages(failed[0].reason, "Something went wrong. Please try again.")
    });
  };

  const upcomingGigs = myGigs.filter(gig => {
    if (gig.status !== 'confirmed') return false;
    const gigDate = new Date(gig.faculty_request.starts_at);
    const now = new Date();
    const twoWeeks = new Date();
    twoWeeks.setDate(now.getDate() + 14);
    return gigDate >= now && gigDate <= twoWeeks;
  });

  /** Opens Set Availability on the clicked day. */
  const handleDateSelect = (selectInfo) => {
    setEditingId(null);
    setSelectedDate(selectInfo.startStr.split('T')[0]);
    setTimes({ start: "09:00", end: "17:00" });
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

  /** Rounds a time to 5 minutes when the field is left. */
  const handleBlur = (e) => {
    const { name, value } = e.target;
    const cleanedTime = roundToNearest5(value);
    setTimes(prev => ({ ...prev, [name]: cleanedTime }));
  };

  /** Adds or saves free time, after checking it's in the future and within hours. */
  const handleSubmitAvailability = (e) => {
    e.preventDefault();
    const startsAt = new Date(`${selectedDate}T${times.start}`);
    const endsAt = new Date(`${selectedDate}T${times.end}`);
    const now = new Date();
    if (startsAt < now) { setModalError("You cannot set availability in the past."); return; }
    const hoursError = validateBusinessHours(times.start, times.end);
    if (hoursError) { setModalError(`Availability ${hoursError.charAt(0).toLowerCase()}${hoursError.slice(1)}`); return; }
    if (endsAt <= startsAt) { setModalError("End time must be after start time"); return; }
    const payload = { starts_at: startsAt, ends_at: endsAt };
    if (editingId) {
      api.patch(`/art_model_availabilities/${editingId}`, { art_model_availability: payload })
        .then((res) => { setPageSuccess(availabilitySavedMessage(res.data, "Availability updated!")); setShowModal(false); fetchData(); })
        .catch((err) => setModalError(extractErrorMessages(err, "Error saving availability. Please try again.")));
    } else {
      api.post("/art_model_availabilities", { art_model_availability: payload })
        .then((res) => { setPageSuccess(availabilitySavedMessage(res.data, "Availability added!")); setShowModal(false); fetchData(); })
        .catch((err) => setModalError(extractErrorMessages(err, "Error saving availability. Please try again.")));
    }
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
      .then(() => { setPageSuccess("Availability deleted!"); setShowModal(false); fetchData(); })
      .catch((err) => setModalError(extractErrorMessages(err, "Error deleting. Please try again.")));
  };

  /**
   * Cancels a gig (or every remaining date of its class), after a confirmation that says it won't
   * be paid.
   */
  const cancelGig = async (availabilityId, gig, cancelRemainingSeries = false) => {
    const seriesCount = otherFutureSeriesGigsCount(gig);
    const className = gig?.faculty_request?.class_name || 'this class';
    const unpaid = "Gigs you cancel aren't paid.";

    const question = cancelRemainingSeries
      ? {
          title: 'Cancel all your remaining dates?',
          message: `You'll be taken off all ${seriesCount + 1} of your remaining dates of ${className}. The faculty member's dates go back to pending so an admin can find a replacement. ${unpaid}`,
          confirmLabel: 'Cancel All Remaining'
        }
      : seriesCount > 0
        ? {
            title: 'Cancel just this date?',
            message: `You'll be taken off this one date of ${className}. This class wants the same model for every date, so an admin may give your other dates to someone else too. ${unpaid}`,
            confirmLabel: 'Cancel This Date'
          }
        : {
            title: 'Cancel this gig?',
            message: `The faculty member's date goes back to pending so an admin can find a replacement. ${unpaid}`,
            confirmLabel: 'Cancel Gig'
          };

    if (!(await confirm({ ...question, cancelLabel: 'Keep Gig', danger: true }))) return;

    api.post(`/art_model_availabilities/${availabilityId}/cancel`, {
      gig_id: gig?.id,
      cancel_remaining_series: cancelRemainingSeries
    })
      .then(() => {
        setPageSuccess(cancelRemainingSeries ? "Gig and remaining series dates cancelled." : "Gig participation cancelled.");
        setShowModal(false);
        fetchData();
      })
      .catch((err) => {
        const msg = extractErrorMessages(err, "Error cancelling. Please try again.");
        if (showModal) setModalError(msg); else notify({ title: "Couldn't cancel", message: msg });
      });
  };

  /** Cancels the gig open in the window. */
  const handleCancelGig = (cancelRemainingSeries = false) => {
    if (!editingId || !activeGig) return;
    cancelGig(editingId, activeGig, cancelRemainingSeries);
  };

  /** The booked gig in a block of free time, if any. */
  const getActiveGigForAvailability = (availabilityId) => findActiveGigForAvailability(myGigs, availabilityId);
  /** Whether a gig's class has started. */
  const hasStarted = (gig) => new Date(gig.faculty_request.starts_at) <= new Date();
  /** A gig's status badge: confirmed, completed, cancelled (paid or not) or no-show. */
  const renderGigStatusBadge = (gig) => {
    if (gig.no_show) {
      return <Badge bg="danger" className="mb-2">{gig.billable ? 'No-show (Paid)' : 'No-show (Not paid)'}</Badge>;
    }
    if (gig.status === 'confirmed' && hasStarted(gig) && gig.billable === false) {
      return <Badge bg="secondary" className="mb-2">Completed (Not paid)</Badge>;
    }
    if (gig.status === 'confirmed' && !hasStarted(gig)) {
      return <Badge bg="success" className="mb-2">Confirmed</Badge>;
    }
    if (gig.status === 'completed' || gig.status === 'confirmed') {
      return <Badge bg="primary" className="mb-2">Completed</Badge>;
    }
    if (gig.status === 'cancelled') {
      return gig.billable
        ? <Badge bg="warning" text="dark" className="mb-2">Cancelled (Paid — Late Cancellation)</Badge>
        : <Badge bg="secondary" className="mb-2">Cancelled</Badge>;
    }
    return null;
  };

  const filteredGigs = myGigs.filter(gig => {
    if (gigFilter === 'all') return true;
    if (gigFilter === 'confirmed') return gig.status === 'confirmed' && !hasStarted(gig);
    if (gigFilter === 'completed') return gig.status === 'completed' || (gig.status === 'confirmed' && hasStarted(gig));
    return gig.status === gigFilter;
  });

  const upcomingCount = myGigs.filter(gig => gig.status === 'confirmed' && !hasStarted(gig)).length;

  /** How many other upcoming dates of the same class the model is booked for. */
  const otherFutureSeriesGigsCount = (gig) => {
    const seriesId = gig.faculty_request.request_series_id;
    if (!seriesId) return 0;
    const now = new Date();
    return myGigs.filter(g =>
      g.id !== gig.id &&
      g.status === 'confirmed' &&
      g.faculty_request.request_series_id === seriesId &&
      new Date(g.faculty_request.starts_at) > now
    ).length;
  };

  /**
   * Where a confirmed gig falls among the model's confirmed dates in the same class,
   * like date 1 of 2, or null when it's the class's only date for them.
   */
  const seriesPosition = (gig) => {
    const seriesId = gig.faculty_request.request_series_id;
    if (!seriesId || gig.status !== 'confirmed') return null;
    const dates = myGigs
      .filter(g => g.status === 'confirmed' && g.faculty_request.request_series_id === seriesId)
      .sort((a, b) => new Date(a.faculty_request.starts_at) - new Date(b.faculty_request.starts_at));
    if (dates.length < 2) return null;
    return { index: dates.findIndex(g => g.id === gig.id) + 1, total: dates.length };
  };

  const otherSeriesCount = activeGig ? otherFutureSeriesGigsCount(activeGig) : 0;

  return (
    <Container className="py-4">
      <StatusToast message={pageSuccess} onClose={() => setPageSuccess('')} />
      <Card className="mb-4 bg-light border-0 shadow-sm">
        <Card.Body className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
          <div>
            <h2 className="mb-1">Hello, {user.stage_name || user.first_name}</h2>
            <CalendarLinkButton className="mt-1" />
          </div>
          <div className="text-end">
            {user.willing_to_model_nude
              ? <Badge bg="info" className="p-2">Willing to Model Nude</Badge>
              : <Badge bg="info" className="p-2">Clothed Only</Badge>}
          </div>
        </Card.Body>
        <div className="rainbow-bar"></div>
      </Card>

      {missingAnswers(user).length > 0 && (
        <Alert variant="warning">
          Please finish your profile: {missingAnswers(user).join(' and ')} {missingAnswers(user).length === 1 ? 'is' : 'are'} needed
          so classes can be matched with you. Prefer not to say is fine.{' '}
          <Alert.Link href="/profile">Go to My Profile</Alert.Link>
        </Alert>
      )}

      {user.retired_at && (
        <Alert variant="secondary">
          You're retired from the pose pool, so you can't add free time or sign up for open calls.
          If you'd like to come back, contact the coordinator.
        </Alert>
      )}

      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3 tabs-equal-height" justify>
        <Tab eventKey="schedule" title={<span className="d-block">My Gigs <span className="d-block d-md-inline">({upcomingCount} upcoming)</span></span>}>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Button
              size="sm"
              variant={gigFilter === 'confirmed' ? 'success' : 'outline-success'}
              onClick={() => setGigFilter('confirmed')}
            >
              Confirmed
            </Button>
            <Button
              size="sm"
              variant={gigFilter === 'completed' ? 'primary' : 'outline-primary'}
              onClick={() => setGigFilter('completed')}
            >
              Completed
            </Button>
            <Button
              size="sm"
              variant={gigFilter === 'cancelled' ? 'secondary' : 'outline-secondary'}
              onClick={() => setGigFilter('cancelled')}
            >
              Cancelled
            </Button>
            <Button
              size="sm"
              variant={gigFilter === 'all' ? 'dark' : 'outline-dark'}
              onClick={() => setGigFilter('all')}
            >
              All
            </Button>
          </div>
          {filteredGigs.length === 0 ? (
            <Alert variant="info">
              {gigFilter === 'all' ? 'You have no gigs yet.' : `No ${gigFilter} gigs.`}
            </Alert>
          ) : (
            <Row>
              {filteredGigs.map(gig => (
                <Col md={6} lg={4} key={gig.id} className="mb-3">
                  <Card className="h-100 border border-2 border-primary border-start-thick rounded-1">
                    <Card.Body>
                      {renderGigStatusBadge(gig)}
                      <Card.Title>{gig.faculty_request.class_name}</Card.Title>
                      {seriesPosition(gig) && (
                        <div className="small text-primary fw-semibold mb-2">
                          <i className="bi bi-collection me-1" aria-hidden="true"></i>
                          Date {seriesPosition(gig).index} of your {seriesPosition(gig).total} dates in this class
                        </div>
                      )}
                      {(gig.faculty_request.user || gig.faculty_request.department) && (
                        <div className="text-muted small mb-2">
                          <i className="bi bi-person me-1" aria-hidden="true"></i>
                          {[
                            gig.faculty_request.user && `${gig.faculty_request.user.first_name} ${gig.faculty_request.user.last_name}`,
                            gig.faculty_request.department
                          ].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div className="mb-3">
                        <div className="fw-bold fs-5">{formatDateWithWeekday(gig.faculty_request.starts_at)}</div>
                        <div className="text-muted">{formatTime(gig.faculty_request.starts_at)} - {formatTime(gig.faculty_request.ends_at)}</div>
                      </div>
                      {(gig.faculty_request.building || gig.faculty_request.room_number) && (
                        <div className="text-muted small mb-2">
                          <i className="bi bi-door-open me-1"></i>
                          {gig.faculty_request.building}{gig.faculty_request.building && gig.faculty_request.room_number && " "}{gig.faculty_request.room_number}
                        </div>
                      )}
                      <div className="p-2 bg-light rounded small mb-2">
                        <strong>Mode:</strong> {gig.faculty_request.model_mode === 'nude'
                          ? <span className="text-danger fw-bold">NUDE</span>
                          : "Clothed"}
                      </div>
                      {gig.status === 'confirmed' && !hasStarted(gig) && (
                        otherFutureSeriesGigsCount(gig) > 0 ? (
                          <div className="d-grid gap-2">
                            <Button variant="outline-danger" size="sm" onClick={() => cancelGig(gig.art_model_availability.id, gig)}>
                              Cancel This Date
                            </Button>
                            <Button variant="outline-danger" size="sm" onClick={() => cancelGig(gig.art_model_availability.id, gig, true)}>
                              Cancel All {otherFutureSeriesGigsCount(gig) + 1} Remaining
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="w-100"
                            onClick={() => cancelGig(gig.art_model_availability.id, gig)}
                          >
                            Cancel
                          </Button>
                        )
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Tab>

        <Tab eventKey="availability" title="Manage Availability">
          <Row>
            <Col md={9} className="mb-4 mb-md-0">
              <Alert variant="secondary" className="mb-3">
                <i className="bi bi-info-circle-fill me-2"></i>
                Use Add Availability, or click a date on the grid, to add time. Click a green block to edit/delete.
              </Alert>
              <SharedCalendar
                events={calendarEvents}
                editable={true}
                onDateSelect={handleDateSelect}
                onEventClick={handleEventClick}
              />
            </Col>
            <Col md={3}>
              <div className="bg-light p-3 rounded border mb-3">
                <h5 className="mb-1">Open Calls</h5>
                <p className="text-muted small mb-3">Click "I'm Available" to sign up for a gig.</p>
                {pendingSeries.length === 0 ? (
                  <p className="text-muted small">No open calls right now.</p>
                ) : (
                  pendingSeries.map(series => {
                    const pendingRequests = series.faculty_requests?.filter(r => r.status === 'pending') || [];
                    const available = isAvailableForSeries(series);
                    return (
                      <Card key={series.id} className={`mb-2 border ${available ? 'border-success' : 'border-secondary'}`}>
                        <Card.Body className="p-2">
                          <div className="fw-bold small">{series.class_name}</div>
                          <div className="small text-muted mb-1">{series.department}</div>
                          {pendingRequests.map(req => (
                            <div key={req.id} className="small text-muted">
                              <i className="bi bi-calendar3 me-1"></i>
                              {formatDateWithWeekday(req.starts_at)}<br />
                              <span className="ms-3">{formatTime(req.starts_at)} - {formatTime(req.ends_at)}</span>
                            </div>
                          ))}
                          <div className="mt-2">
                            {series.model_mode === 'nude'
                              ? <Badge bg="danger" className="me-1">Nude</Badge>
                              : <Badge bg="success" className="me-1">Clothed</Badge>}
                            {pendingRequests.length > 1 && (
                              <Badge bg="info" text="dark" className="me-1">{pendingRequests.length} dates</Badge>
                            )}
                            {(series.models_needed || 1) > 1 && (
                              <Badge bg="primary">Group session: {series.models_needed} models</Badge>
                            )}
                          </div>
                          <div className="mt-2">
                            {available ? (
                              <div className="text-success small fw-bold">
                                <i className="bi bi-check-circle-fill me-1"></i>You're Available
                              </div>
                            ) : (
                              <Button
                                variant="outline-success"
                                size="sm"
                                className="w-100 mt-1"
                                onClick={() => handleMarkAvailable(series)}
                              >
                                I'm Available
                              </Button>
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    );
                  })
                )}
              </div>

              <div className="bg-light p-3 rounded border mb-3">
                <h5 className="mb-3">My Gigs (Next 14 Days)</h5>
                {upcomingGigs.length === 0 ? (
                  <p className="text-muted small">No upcoming gigs in the next 2 weeks.</p>
                ) : (
                  <ListGroup variant="flush">
                    {upcomingGigs.map(gig => (
                      <ListGroup.Item key={gig.id} className="bg-transparent px-0 py-2">
                        <div className="fw-bold small">{gig.faculty_request.class_name}</div>
                        <div className="small text-muted">{formatDateWithWeekday(gig.faculty_request.starts_at)}</div>
                        <div className="small text-muted">{formatTime(gig.faculty_request.starts_at)} - {formatTime(gig.faculty_request.ends_at)}</div>
                        {(gig.faculty_request.building || gig.faculty_request.room_number) && (
                          <div className="small text-muted">
                            <i className="bi bi-door-open me-1"></i>
                            {gig.faculty_request.building}{gig.faculty_request.building && gig.faculty_request.room_number && " "}{gig.faculty_request.room_number}
                          </div>
                        )}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </div>
            </Col>
          </Row>
        </Tab>
      </Tabs>

      <Modal show={showModal} onHide={() => setShowModal(false)} aria-labelledby="availability-window-title">
        <Modal.Header closeButton>
          <Modal.Title id="availability-window-title">{activeGig ? "Gig Scheduled" : (editingId ? "Edit Availability" : "Set Availability")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && (
            <Alert ref={modalErrorRef} tabIndex={-1} variant="danger" dismissible onClose={() => setModalError('')}>
              {modalError}
            </Alert>
          )}
          {activeGig ? (
            <>
              <p className="mb-1">You're confirmed for <strong>{activeGig.faculty_request.class_name}</strong>.</p>
              <div className="small text-muted mb-3">
                {[
                  activeGig.faculty_request.department,
                  [activeGig.faculty_request.building, activeGig.faculty_request.room_number].filter(Boolean).join(' '),
                  activeGig.faculty_request.model_mode === 'nude' ? 'Nude' : 'Clothed'
                ].filter(Boolean).join(' · ')}
              </div>
              <GigDates gig={activeGig} gigs={myGigs} />
              <p className="small text-muted">
                <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
                Your availability can't be edited while a gig is scheduled.
              </p>
              <div className="d-flex flex-wrap justify-content-end gap-2">
                <Button variant="outline-danger" onClick={() => handleCancelGig(false)}>
                  Cancel This Date
                </Button>
                {otherSeriesCount > 0 && (
                  <Button variant="outline-danger" onClick={() => handleCancelGig(true)}>
                    Cancel All Remaining Dates
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Form onSubmit={handleSubmitAvailability}>
              <Form.Group className="mb-3" controlId="availability-date">
                <Form.Label>Date</Form.Label>
                <Form.Control type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} required />
              </Form.Group>
              <Row>
                <Form.Group as={Col} controlId="availability-start">
                  <Form.Label>Start Time</Form.Label>
                  <Form.Control type="time" step={300} min="00:00" name="start" value={times.start} onChange={handleTimeChange} onBlur={handleBlur} required />
                </Form.Group>
                <Form.Group as={Col} controlId="availability-end">
                  <Form.Label>End Time</Form.Label>
                  <Form.Control type="time" step={300} min="00:00" name="end" value={times.end} onChange={handleTimeChange} onBlur={handleBlur} required />
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

export default ModelDashboard;
