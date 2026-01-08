import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Badge, Tab, Tabs, Button, Modal, Form, Alert } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";
import { formatSkinTone } from "../utils/formatters"; 

function ModelDashboard({ user }) {
  const [myGigs, setMyGigs] = useState([]);
  const [myAvailability, setMyAvailability] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  
  // Tab State (to fix calendar rendering issue)
  const [activeTab, setActiveTab] = useState("schedule");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [times, setTimes] = useState({ start: "09:00", end: "17:00" });

  useEffect(() => {
    fetchData();
  }, [user.id]);

  // FIX: Force calendar resize when switching to the Availability tab
  useEffect(() => {
    if (activeTab === "availability") {
      // Small timeout to allow the Bootstrap tab animation to finish
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 200);
    }
  }, [activeTab]);

  const fetchData = () => {
    // 1. Fetch ALL Gigs and filter client-side (Prototype approach)
    api.get("/gigs").then((res) => {
      const my_gigs = res.data
        .filter(g => g.art_model_availability.user.id === user.id)
        .sort((a, b) => new Date(a.faculty_request.starts_at) - new Date(b.faculty_request.starts_at));
      setMyGigs(my_gigs);
    });

    // 2. Fetch My Availability
    api.get(`/art_model_availabilities?user_id=${user.id}`).then((res) => {
      setMyAvailability(res.data);
      
      // Convert to Calendar Events
      const events = res.data.map(a => ({
        id: a.id,
        title: a.status === 'active' ? 'Free' : 'Cancelled',
        start: a.starts_at,
        end: a.ends_at,
        backgroundColor: a.status === 'active' ? '#198754' : '#6c757d', // Green vs Grey
        display: 'block'
      }));
      setCalendarEvents(events);
    });
  };

  // HELPER: Generate options for the Datalist (8am - 10pm)
  const generateTimeOptions = () => {
    const options = [];
    let start = 8 * 60; // 8:00 AM
    const end = 22 * 60; // 10:00 PM

    while (start <= end) {
      const hours = Math.floor(start / 60);
      const mins = start % 60;
      const value = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      options.push(<option key={value} value={value} />);
      start += 5;
    }
    return options;
  };

  // HELPER: Auto-round time to nearest 5 minutes
  const roundToNearest5 = (timeStr) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m;
    const rounded = Math.round(totalMins / 5) * 5;
    
    const newH = Math.floor(rounded / 60);
    const newM = rounded % 60;
    
    return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
  };

  // --- HANDLERS ---

  const handleDateSelect = (selectInfo) => {
    setSelectedDate(selectInfo.startStr); // FullCalendar gives YYYY-MM-DD
    setShowModal(true);
  };

  const handleTimeChange = (e) => {
    const { name, value } = e.target;
    setTimes(prev => ({ ...prev, [name]: value }));
  };

  // NEW: When user leaves the field, snap the value
  const handleBlur = (e) => {
    const { name, value } = e.target;
    const cleanedTime = roundToNearest5(value);
    setTimes(prev => ({ ...prev, [name]: cleanedTime }));
  };

  const handleSubmitAvailability = (e) => {
    e.preventDefault();
    
    // Construct ISO DateTimes
    const startsAt = new Date(`${selectedDate}T${times.start}`);
    const endsAt = new Date(`${selectedDate}T${times.end}`);

    const startHour = parseInt(times.start.split(':')[0]);
    const endHour = parseInt(times.end.split(':')[0]);

    if (startHour < 8 || startHour >= 22) {
      alert("Availability must start between 8:00 AM and 10:00 PM.");
      return;
    }
    
    if (endHour > 22 || (endHour === 22 && times.end.split(':')[1] !== "00")) {
       alert("Availability must end by 10:00 PM.");
       return;
    }

    if (endsAt <= startsAt) {
      alert("End time must be after start time");
      return;
    }

    api.post("/art_model_availabilities", {
      user_id: user.id,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "active"
    }).then(() => {
      alert("Availability Added!");
      setShowModal(false);
      fetchData(); // Refresh calendar
    }).catch(err => console.error(err));
  };

  const handleCancelAvailability = (id) => {
    if(!confirm("Remove this availability block?")) return;
    api.delete(`/art_model_availabilities/${id}`)
      .then(() => fetchData())
      .catch(err => console.error(err));
  };

  // Formatters
  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Container className="py-4">
      {/* --- PROFILE HEADER --- */}
      <Card className="mb-4 bg-light border-0 shadow-sm">
        <Card.Body className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
          <div>
            <h2 className="mb-1">Hello, {user.first_name}</h2>
            <div className="text-muted">
              {formatSkinTone(user.skin_tone)} • {user.gender_identity}
            </div>
          </div>
          <div className="text-end">
             {user.willing_to_model_nude ? (
               <Badge bg="danger" className="p-2">⚠️ Willing to Model Nude</Badge>
             ) : (
               <Badge bg="success" className="p-2">Clothed Only</Badge>
             )}
          </div>
        </Card.Body>
      </Card>

      {/* CHANGED: Controlled Tabs to track active state */}
      <Tabs 
        activeKey={activeTab} 
        onSelect={(k) => setActiveTab(k)} 
        className="mb-3"
      >
        
        {/* --- TAB 1: MY SCHEDULE (GIGS) --- */}
        <Tab eventKey="schedule" title={`My Schedule (${myGigs.length})`}>
          {myGigs.length === 0 ? (
            <Alert variant="info">You have no upcoming gigs scheduled.</Alert>
          ) : (
            <Row>
              {myGigs.map(gig => (
                <Col md={6} lg={4} key={gig.id} className="mb-3">
                  <Card className="h-100 shadow-sm border-start border-5 border-success">
                    <Card.Body>
                      <Badge bg="success" className="mb-2">Confirmed Gig</Badge>
                      <Card.Title>{gig.faculty_request.class_name}</Card.Title>
                      
                      <div className="mb-3">
                        <div className="fw-bold fs-5">{formatDate(gig.faculty_request.starts_at)}</div>
                        <div className="text-muted">
                          {formatTime(gig.faculty_request.starts_at)} - {formatTime(gig.faculty_request.ends_at)}
                        </div>
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

        {/* --- TAB 2: MANAGE AVAILABILITY --- */}
        <Tab eventKey="availability" title="Manage Availability">
          <Alert variant="secondary" className="mb-3">
            <i className="bi bi-info-circle-fill me-2"></i>
            Click any date on the calendar to add your availability.
          </Alert>
          
          <SharedCalendar 
            events={calendarEvents} 
            editable={true} 
            onDateSelect={handleDateSelect}
            onEventClick={(info) => handleCancelAvailability(info.event.id)}
          />
        </Tab>

      </Tabs>

      {/* --- ADD AVAILABILITY MODAL --- */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Set Availability</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Adding availability for: <strong>{selectedDate}</strong></p>
          <Form onSubmit={handleSubmitAvailability}>
            <Row>
              {/* --- HYBRID START TIME --- */}
              <Col>
                <Form.Label>Start Time</Form.Label>
                <Form.Control 
                  type="time"
                  name="start"
                  list="model-time-options" // CONNECTS TO DATALIST
                  value={times.start}
                  onChange={handleTimeChange} 
                  onBlur={handleBlur} // TRIGGERS ROUNDING
                  min="08:00" 
                  max="22:00" 
                  required 
                />
              </Col>
              
              {/* --- HYBRID END TIME --- */}
              <Col>
                <Form.Label>End Time</Form.Label>
                <Form.Control 
                  type="time" 
                  name="end"
                  list="model-time-options" // CONNECTS TO DATALIST
                  value={times.end} 
                  onChange={handleTimeChange} 
                  onBlur={handleBlur} // TRIGGERS ROUNDING
                  min="08:00" 
                  max="22:00" 
                  required 
                />
              </Col>
            </Row>

            {/* --- DATALIST SOURCE --- */}
            <datalist id="model-time-options">
              {generateTimeOptions()}
            </datalist>

            <div className="mt-3 text-end">
              <Button variant="secondary" className="me-2" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="success" type="submit">Save Availability</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

    </Container>
  );
}

export default ModelDashboard;