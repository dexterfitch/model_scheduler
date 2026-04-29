import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Badge, Tab, Tabs, Button, Modal, Form, Alert, ListGroup } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";
import { formatSkinTone } from "../utils/formatters"; 

function ModelDashboard({ user }) {
  const [myGigs, setMyGigs] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [openCallEvents, setOpenCallEvents] = useState([]);
  const [openCallInfo, setOpenCallInfo] = useState(null);
  const [showOpenCallModal, setShowOpenCallModal] = useState(false)
  const [activeTab, setActiveTab] = useState("schedule");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [times, setTimes] = useState({ start: "09:00", end: "17:00" });
  const [modalError, setModalError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, [user.id]);

  useEffect(() => {
    if (activeTab === "availability") {
      setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
    }
  }, [activeTab]);

  const fetchData = () => {
    api.get("/gigs").then((res) => {
      const my_gigs = res.data.sort((a, b) => {
        return new Date(a.faculty_request.starts_at) - new Date(b.faculty_request.starts_at);
      });
      setMyGigs(my_gigs);
    }).catch(err => console.error("Error fetching gigs:", err));

    api.get(`/art_model_availabilities?user_id=${user.id}`).then((res) => {
      const events = res.data.map(a => ({
        id: a.id,
        title: a.status === 'active' ? 'Free' : 'Cancelled',
        start: a.starts_at,
        end: a.ends_at,
        backgroundColor: a.status === 'active' ? '#198754' : '#6c757d',
        display: 'block',
        extendedProps: { ...a }
      }));
      setCalendarEvents(events);
    }).catch(err => console.error("Error fetching availabilities:", err));

    api.get("/faculty_requests").then((res) => {
      const openCalls = res.data
        .filter(r => r.status === 'pending')
        .filter(r => r.model_mode === 'clothed' || user.willing_to_model_nude)
        .map(r => ({
          id: `open-call-${r.id}`,
          title: r.model_mode === 'nude' ? '🔴 Open Call (Nude)' : '🟠 Open Call',
          start: r.starts_at,
          end: r.ends_at,
          backgroundColor: r.model_mode === 'nude' ? '#dc3545' : '#fd7e14',
          borderColor: r.model_mode === 'nude' ? '#dc3545' : '#fd7e14',
          display: 'block',
          editable: false,
          extendedProps: { isOpenCall: true, mode: r.model_mode }
        }));
      setOpenCallEvents(openCalls);
    }).catch(err => console.error("Error fetching requests:", err));    
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

  const upcomingGigs = myGigs.filter(gig => {
    const gigDate = new Date(gig.faculty_request.starts_at);
    const now = new Date();
    const twoWeeks = new Date();
    twoWeeks.setDate(now.getDate() + 14);
    return gigDate >= now && gigDate <= twoWeeks;
  });


  const handleDateSelect = (selectInfo) => {
    setEditingId(null);
    setSelectedDate(selectInfo.startStr.split('T')[0]); 
    setTimes({ start: "09:00", end: "17:00" });
    setModalError('');
    setShowModal(true);
  };

  const handleEventClick = (info) => {
    if (info.event.extendedProps.isOpenCall) {
      setOpenCallInfo({
        start: info.event.start,
        end: info.event.end,
        mode: info.event.extendedProps.mode
      });
      setShowOpenCallModal(true);
      return;
    }

    const props = info.event.extendedProps;
    setEditingId(info.event.id);
    
    const startObj = new Date(props.starts_at);
    const endObj = new Date(props.ends_at);
    
    setSelectedDate(props.starts_at.split('T')[0]);

    const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    setTimes({
        start: formatTime(startObj),
        end: formatTime(endObj)
    });

    setModalError('');
    setShowModal(true);
  };

  const handleTimeChange = (e) => {
    const { name, value } = e.target;
    setTimes(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const cleanedTime = roundToNearest5(value);
    setTimes(prev => ({ ...prev, [name]: cleanedTime }));
  };

  const handleSubmitAvailability = (e) => {
    e.preventDefault();
    
    const startsAt = new Date(`${selectedDate}T${times.start}`);
    const endsAt = new Date(`${selectedDate}T${times.end}`);
    
    const now = new Date();
    if (startsAt < now) {
      setModalError("You cannot set availability in the past.");
      return;
    }

    const startHour = parseInt(times.start.split(':')[0]);
    const endHour = parseInt(times.end.split(':')[0]);

    if (startHour < 8 || startHour >= 22) {
      setModalError("Availability must start between 8:00 AM and 10:00 PM.");
      return;
    }
    if (endHour > 22 || (endHour === 22 && times.end.split(':')[1] !== "00")) {
      setModalError("Availability must end by 10:00 PM.");
      return;
    }
    if (endsAt <= startsAt) {
      setModalError("End time must be after start time");
      return;
    }

    const payload = {
      starts_at: startsAt,
      ends_at: endsAt
    };

    if (editingId) {
        api.patch(`/art_model_availabilities/${editingId}`, { art_model_availability: payload })
        .then(() => {
            setPageSuccess(editingId ? "Availability updated!" : "Availability added!");
            setShowModal(false);
            fetchData();
        })
        .catch(err => {
            console.error(err);
            setModalError("Error saving availability. Please try again.");
        });
    } else {
        api.post("/art_model_availabilities", { art_model_availability: payload })
        .then(() => {
            setPageSuccess(editingId ? "Availability updated!" : "Availability added!");
            setShowModal(false);
            fetchData();
        })
        .catch(err => {
            console.error(err);
            setModalError("Error saving availability. Please try again.");
        });
    }
  };

  const handleDelete = () => {
    if(!editingId || !confirm("Delete this availability slot?")) return;
    
    api.delete(`/art_model_availabilities/${editingId}`)
      .then(() => {
        setPageSuccess("Availability deleted!");
        setShowModal(false);
        fetchData();
      })
      .catch(err => {
        setModalError("Error deleting. Please try again.");
      }
      );
  };

  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Container className="py-4">
      {pageSuccess && <Alert variant="success" dismissible onClose={() => setPageSuccess('')}>{pageSuccess}</Alert>}
      <Card className="mb-4 bg-light border-0 shadow-sm">
        <Card.Body className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
          <div>
            <h2 className="mb-1">Hello, {user.first_name}</h2>
            <div className="text-muted">{formatSkinTone(user.skin_tone)} • {user.gender_identity} Presentation</div>
          </div>
          <div className="text-end">
             {user.willing_to_model_nude ? <Badge bg="danger" className="p-2">⚠️ Willing to Model Nude</Badge> : <Badge bg="success" className="p-2">Clothed Only</Badge>}
          </div>
        </Card.Body>
      </Card>

      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
        <Tab eventKey="schedule" title={`My Schedule (${myGigs.length})`}>
          {myGigs.length === 0 ? <Alert variant="info">You have no upcoming gigs.</Alert> : (
            <Row>
              {myGigs.map(gig => (
                <Col md={6} lg={4} key={gig.id} className="mb-3">
                  <Card className="h-100 shadow-sm border-start border-5 border-success">
                    <Card.Body>
                      <Badge bg="success" className="mb-2">Confirmed Gig</Badge>
                      <Card.Title>{gig.faculty_request.class_name}</Card.Title>
                      <div className="mb-3">
                        <div className="fw-bold fs-5">{formatDate(gig.faculty_request.starts_at)}</div>
                        <div className="text-muted">{formatTime(gig.faculty_request.starts_at)} - {formatTime(gig.faculty_request.ends_at)}</div>
                      </div>
                      <div className="p-2 bg-light rounded small">
                        <strong>Faculty:</strong> {gig.faculty_request.user.first_name} {gig.faculty_request.user.last_name} <br/>
                        <strong>Mode:</strong> {gig.faculty_request.model_mode === 'nude' ? <span className="text-danger fw-bold">NUDE</span> : "Clothed"}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Tab>

        <Tab eventKey="availability" title="Manage Availability">
          <Row>
            <Col md={3}>
                <div className="bg-light p-3 rounded border mb-3">
                    <h5 className="mb-3">My Gigs (Next 14 Days)</h5>
                    {upcomingGigs.length === 0 ? (
                        <p className="text-muted small">No upcoming gigs in the next 2 weeks.</p>
                    ) : (
                        <ListGroup variant="flush">
                            {upcomingGigs.map(gig => (
                                <ListGroup.Item key={gig.id} className="bg-transparent px-0 py-2">
                                    <div className="fw-bold small">{gig.faculty_request.class_name}</div>
                                    <div className="small text-muted">
                                        {formatDate(gig.faculty_request.starts_at)}
                                    </div>
                                    <div className="small text-muted">
                                        {formatTime(gig.faculty_request.starts_at)} - {formatTime(gig.faculty_request.ends_at)}
                                    </div>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}
                </div>
            </Col>
            
            <Col md={9}>
                <Alert variant="secondary" className="mb-3">
                    <i className="bi bi-info-circle-fill me-2"></i>
                    Click a date to add time. Click a green block to edit/delete.
                </Alert>
                <SharedCalendar 
                    events={[...calendarEvents, ...openCallEvents]} 
                    editable={true} 
                    onDateSelect={handleDateSelect}
                    onEventClick={handleEventClick} 
                />
            </Col>
          </Row>
        </Tab>
      </Tabs>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? "Edit Availability" : "Set Availability"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && <Alert variant="danger">{modalError}</Alert>}
          <p>Date: <strong>{new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}</strong></p>
          <Form onSubmit={handleSubmitAvailability}>
            <Row>
              <Col>
                <Form.Label>Start Time</Form.Label>
                <Form.Control type="time" name="start" list="model-time-options" value={times.start} onChange={handleTimeChange} onBlur={handleBlur} min="08:00" max="22:00" required />
              </Col>
              <Col>
                <Form.Label>End Time</Form.Label>
                <Form.Control type="time" name="end" list="model-time-options" value={times.end} onChange={handleTimeChange} onBlur={handleBlur} min="08:00" max="22:00" required />
              </Col>
            </Row>
            <datalist id="model-time-options">{generateTimeOptions()}</datalist>

            <div className="mt-4 d-flex justify-content-between">
              <div>
                {editingId && (
                  <Button variant="danger" onClick={handleDelete}>
                    Delete Slot
                  </Button>
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
      <Modal show={showOpenCallModal} onHide={() => setShowOpenCallModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {openCallInfo?.mode === 'nude' ? '🔴 Open Call (Nude)' : '🟠 Open Call (Clothed)'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {openCallInfo && (
            <>
              <p className="mb-2">
                <strong>Date:</strong> {new Date(openCallInfo.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="mb-2">
                <strong>Time:</strong> {formatTime(openCallInfo.start)} - {formatTime(openCallInfo.end)}
              </p>
              <p className="mb-0">
                <strong>Type:</strong> {openCallInfo.mode === 'nude' ? <span className="text-danger fw-bold">Nude</span> : <span className="text-success">Clothed</span>}
              </p>
              <hr />
              <p className="text-muted small mb-0">
                If you're available for this time slot, add your availability on the calendar and the admin will match you.
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowOpenCallModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default ModelDashboard;