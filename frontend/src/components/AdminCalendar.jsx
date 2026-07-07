import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, ListGroup, Badge, Alert } from "react-bootstrap";
import api from "../services/api";
import { formatDateWithWeekday, formatTime } from "../utils/time";
import SharedCalendar from "./SharedCalendar";

function AdminCalendar() {
  const navigate = useNavigate();
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const gigsRes = await api.get("/gigs");
      const gigs = gigsRes.data
        .filter(gig => gig.status === 'confirmed')
        .map(gig => ({
          id: `gig-${gig.id}`,
          title: `✅ ${gig.faculty_request.class_name}`,
          start: gig.faculty_request.starts_at,
          end: gig.faculty_request.ends_at,
          backgroundColor: '#198754',
          borderColor: '#198754',
          extendedProps: { type: 'gig', ...gig }
        }));

      const reqRes = await api.get("/faculty_requests");

      const requests = reqRes.data
        .filter(r => r.status === 'pending')
        .map(req => ({
          id: `req-${req.id}`,
          title: `❓ ${req.class_name}`,
          start: req.starts_at,
          end: req.ends_at,
          backgroundColor: '#fd7e14',
          borderColor: '#fd7e14',
          extendedProps: { type: 'request', requestId: req.id, seriesId: req.request_series_id, ...req }
        }));

      const availRes = await api.get("/art_model_availabilities");
      const futureAvail = availRes.data.filter(a => new Date(a.starts_at) >= new Date());
      futureAvail.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

      setCalendarEvents([...gigs, ...requests]);
      setAvailabilities(futureAvail);

    } catch (err) {
      console.error("Error loading calendar data", err);
      setError("Failed to load calendar data. Please try again later.");
    }
  };

  const handleEventClick = (info) => {
    const props = info.event.extendedProps;
    
    if (props.type === 'request') {
      navigate(`/gigs/new/${props.seriesId}?type=series`);
    } else {
      const location = [props.faculty_request.building, props.faculty_request.room_number]
        .filter(Boolean)
        .join(' ');
      alert(
        `Gig: ${props.faculty_request.class_name}\n` +
        `Model: ${props.art_model_availability.user.first_name}` +
        (location ? `\nLocation: ${location}` : '')
      );
    }
  };

  return (
    <Container fluid className="py-4">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Row>
        <Col md={9} className="order-2 order-md-1 my-4 my-md-0">
          <h2 className="mb-4">Full Schedule</h2>
          <SharedCalendar 
            events={calendarEvents} 
            onEventClick={handleEventClick}
          />
        </Col>
        <Col md={3} className="order-1 order-md-2">
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
                      {formatDateWithWeekday(avail.starts_at)}
                    </div>
                    <div className="small fw-bold">
                      {formatTime(avail.starts_at)} - {formatTime(avail.ends_at)}
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