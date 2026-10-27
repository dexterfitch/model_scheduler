import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, ListGroup, Badge, Alert } from "react-bootstrap";
import api from "../services/api";
import { formatDateWithWeekday, formatTime, availabilityEvents } from "../utils/time";
import { CALENDAR_COLORS } from "../utils/constants";
import SharedCalendar from "./SharedCalendar";
import { useDialog } from "./DialogProvider";

function AdminCalendar() {
  const navigate = useNavigate();
  const { notify } = useDialog();
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
          backgroundColor: CALENDAR_COLORS.green,
          borderColor: CALENDAR_COLORS.green,
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
          backgroundColor: CALENDAR_COLORS.orange,
          borderColor: CALENDAR_COLORS.orange,
          extendedProps: { type: 'request', requestId: req.id, seriesId: req.request_series_id, ...req }
        }));

      const availRes = await api.get("/art_model_availabilities");
      // Only time a model can actually be booked into: active blocks, minus booked classes
      const now = new Date();
      const openTime = availRes.data
        .flatMap(a => availabilityEvents(a, gigsRes.data))
        .filter(piece => piece.kind === 'free' && new Date(piece.end) > now)
        .sort((a, b) => new Date(a.start) - new Date(b.start));

      setCalendarEvents([...gigs, ...requests]);
      setAvailabilities(openTime);

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
      const request = props.faculty_request;
      const model = props.art_model_availability.user;
      const location = [request.building, request.room_number].filter(Boolean).join(' ');
      notify({
        title: request.class_name,
        message: (
          <dl className="row mb-0">
            <dt className="col-4">When</dt>
            <dd className="col-8">{formatDateWithWeekday(request.starts_at)}, {formatTime(request.starts_at)} – {formatTime(request.ends_at)}</dd>
            <dt className="col-4">Model</dt>
            <dd className="col-8">{model.first_name} {model.last_name}</dd>
            {request.user && (<>
              <dt className="col-4">Faculty</dt>
              <dd className="col-8">{request.user.first_name} {request.user.last_name}</dd>
            </>)}
            {location && (<>
              <dt className="col-4">Location</dt>
              <dd className="col-8 mb-0">{location}</dd>
            </>)}
          </dl>
        )
      });
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
        <Col md={9} className="mb-4 mb-md-0">
          <h2 className="mb-4">Full Schedule</h2>
          <SharedCalendar 
            events={calendarEvents} 
            onEventClick={handleEventClick}
          />
        </Col>
        <Col md={3}>
          <h4 id="upcoming-availability-heading" className="mb-3 text-secondary">Upcoming Model Availability</h4>
          <div
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
            tabIndex={0}
            role="region"
            aria-labelledby="upcoming-availability-heading"
          >
            {availabilities.length === 0 ? <p>No upcoming availability.</p> : (
              <ListGroup variant="flush">
                {availabilities.map(({ start, end, extendedProps: avail }) => (
                  <ListGroup.Item key={`${avail.id}-${start}`} className="bg-light mb-2 rounded border">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <strong>{avail.user.first_name} {avail.user.last_name}</strong>
                      {avail.user.willing_to_model_nude ? <Badge bg="danger">Nude OK</Badge> : <Badge bg="success">Clothed</Badge>}
                    </div>
                    <div className="small text-muted">
                      {formatDateWithWeekday(start)}
                    </div>
                    <div className="small fw-bold">
                      {formatTime(start)} - {formatTime(end)}
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