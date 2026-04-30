import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Card, Button, ListGroup, Badge, Spinner, Alert } from "react-bootstrap";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";

function GigCreator() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/faculty_requests"),
      api.get("/art_model_availabilities")
    ]).then(([reqRes, availRes]) => {
      const targetReq = reqRes.data.find(r => r.id === parseInt(requestId));
      setRequest(targetReq);

      if (targetReq) {
        const reqStart = new Date(targetReq.starts_at);
        const reqEnd = new Date(targetReq.ends_at);
        const isNudeReq = targetReq.model_mode === "nude";

        const candidates = availRes.data.filter(avail => {
          const availStart = new Date(avail.starts_at);
          const availEnd = new Date(avail.ends_at);
          const timeMatch = availStart <= reqStart && availEnd >= reqEnd;
          const nudityMatch = !isNudeReq || avail.user.willing_to_model_nude;
          const statusMatch = avail.status === 'active';
          return timeMatch && nudityMatch && statusMatch;
        });

        const scored = candidates.map(c => {
          let score = 0;
          if (c.user.skin_tone === targetReq.pref_skin_tone) score++;
          if (c.user.gender_identity === targetReq.pref_gender) score++;
          return { ...c, score };
        });

        scored.sort((a, b) => b.score - a.score);
        setMatches(scored);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error loading data:", err);
      setError("Failed to load request data. Please try again.");
      setLoading(false);
    });
  }, [requestId]);

  const handleBook = (availabilityId) => {
    if (!confirm("Confirm booking this model?")) return;

    api.post("/gigs", {
      gig: {
        faculty_request_id: requestId,
        art_model_availability_id: availabilityId
      }
    }).then(() => {
      setBookingSuccess(true);
      setTimeout(() => navigate("/calendar"), 1500);
    }).catch(err => {
      console.error(err);
      setError("Error creating gig. Please try again.");
    });
  };

  if (loading) return (
    <Container className="p-5 text-center">
      <Spinner animation="border" />
    </Container>
  );

  if (!request) return (
    <Container className="p-5">
      <Alert variant="danger">Request not found.</Alert>
    </Container>
  );

  const formatDate = (d) => new Date(d).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <Container className="py-4" style={{ maxWidth: '800px' }}>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {bookingSuccess && (
        <Alert variant="success" dismissible onClose={() => setBookingSuccess(false)}>
          Gig confirmed! Redirecting...
        </Alert>
      )}

      <Button variant="outline-secondary" className="mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i> Back
      </Button>

      <h2 className="mb-4">Create Gig Match</h2>

      <Card className="mb-4 border-primary shadow-sm">
        <Card.Header className="bg-primary text-white">Target Class</Card.Header>
        <Card.Body>
          <h3>{request.class_name}</h3>
          <div className="text-muted mb-2">
            <i className="bi bi-person me-1"></i>
            {request.user.first_name} {request.user.last_name}
          </div>
          <div className="mb-2">
            <strong>Time:</strong> {formatDate(request.starts_at)} — {formatDate(request.ends_at)}
          </div>
          <div>
            {request.model_mode === 'nude'
              ? <Badge bg="danger" className="me-2">Nude Required</Badge>
              : <Badge bg="success" className="me-2">Clothed</Badge>}
            <Badge bg="info" text="dark">
              Pref: {formatSkinTone(request.pref_skin_tone)}, {request.pref_gender}
            </Badge>
          </div>
        </Card.Body>
      </Card>

      <h4 className="text-secondary mb-3">Available Models ({matches.length})</h4>
      <ListGroup>
        {matches.length === 0 ? (
          <Alert variant="warning">No models found who match this time & nudity requirement.</Alert>
        ) : (
          matches.map(model => (
            <ListGroup.Item
              key={model.id}
              className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 p-3"
            >
              <div>
                <h5 className="mb-1">
                  {model.user.first_name} {model.user.last_name}
                  {model.score > 0 && <Badge bg="warning" text="dark" className="ms-2">★ Match</Badge>}
                </h5>
                <div className="text-muted small">
                  {formatSkinTone(model.user.skin_tone)} / {model.user.gender_identity}
                </div>
                <div className="text-success small">
                  Available: {formatDate(model.starts_at)} - {formatDate(model.ends_at)}
                </div>
              </div>
              <Button variant="success" onClick={() => handleBook(model.id)}>
                Book Model
              </Button>
            </ListGroup.Item>
          ))
        )}
      </ListGroup>
    </Container>
  );
}

export default GigCreator;