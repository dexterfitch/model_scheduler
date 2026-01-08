import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, ListGroup, Badge, Card } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";

function AdminCalendar() {
  const navigate = useNavigate();
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch Confirmed Gigs
      const gigsRes = await api.get("/gigs");
      const gigs = gigsRes.data.map(gig => ({
        id: `gig-${gig.id}`,
        title: `✅ ${gig.faculty_request.class_name}`,
        start: gig.faculty_request.starts_at,
        end: gig.faculty_request.ends_at,
        backgroundColor: '#198754', // Green
        borderColor: '#198754',
        extendedProps: { type: 'gig', ...gig }
      }));

      // 2. Fetch Pending Requests
      const reqRes = await api.get("/faculty_requests");
      const requests = reqRes.data
        .filter(r => r.status === 'pending')
        .map(req => ({
          id: `req-${req.id}`,
          title: `❓ ${req.class_name}`,
          start: req.starts_at,
          end: req.ends_at,
          backgroundColor: '#fd7e14', // Orange
          borderColor: '#fd7e14',
          extendedProps: { type: 'request', ...req }
        }));

      // 3. Fetch Model Availabilities (For the sidebar)
      const availRes = await api.get("/art_model_availabilities");
      // Filter for future dates only
      const futureAvail = availRes.data.filter(a => new Date(a.starts_at) >= new Date());
      // Sort by date
      futureAvail.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

      setCalendarEvents([...gigs, ...requests]);
      setAvailabilities(futureAvail);

    } catch (err) {
      console.error("Error loading calendar data", err);
    }
  };

const handleEventClick = (info) => {
    const props = info.event.extendedProps;
    
    // Check if it's a Request or a Gig
    if (props.type === 'request') {
      // Navigate to our new creator page
      // Note: props.id is the raw ID from the DB, not the 'req-123' string
      navigate(`/gigs/new/${props.id}`);
    } else {
      // It's a confirmed gig
      alert(`Gig: ${props.faculty_request.class_name}\nModel: ${props.art_model_availability.user.first_name}`);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString() + " " + new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  return (
    <Container fluid className="py-4">
      <Row>
        {/* --- MAIN CALENDAR AREA --- */}
        <Col md={9}>
          <h2 className="mb-4">Master Schedule</h2>
          <SharedCalendar 
            events={calendarEvents} 
            onEventClick={handleEventClick}
          />
        </Col>

        {/* --- SIDEBAR: AVAILABILITIES --- */}
        <Col md={3}>
          <h4 className="mb-3 text-secondary">Upcoming Model Availability</h4>
          <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            {availabilities.length === 0 ? <p>No upcoming availability.</p> : (
              <ListGroup variant="flush">
                {availabilities.map(avail => (
                  <ListGroup.Item key={avail.id} className="bg-light mb-2 rounded border">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <strong>{avail.user.first_name} {avail.user.last_name}</strong>
                      {avail.user.willing_to_model_nude ? <Badge bg="danger">Nude OK</Badge> : <Badge bg="success">Clothed</Badge>}
                    </div>
                    <div className="small text-muted">
                      {new Date(avail.starts_at).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})}
                    </div>
                    <div className="small fw-bold">
                       {new Date(avail.starts_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                       {new Date(avail.ends_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default AdminCalendar;