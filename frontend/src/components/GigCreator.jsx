import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Container, Card, Button, ListGroup, Badge, Spinner, Alert } from "react-bootstrap";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";

function GigCreator() {
  const { requestId } = useParams();
  const [searchParams] = useSearchParams();
  const isSeries = searchParams.get('type') === 'series';
  const navigate = useNavigate();

  const [series, setSeries] = useState(null);
  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    if (isSeries) {
      loadSeriesData();
    } else {
      loadSingleRequestData();
    }
  }, [requestId]);

  const loadSeriesData = () => {
    Promise.all([
      api.get("/request_series"),
      api.get("/art_model_availabilities"),
      api.get("/gigs")
    ]).then(([seriesRes, availRes, gigsRes]) => {
      const targetSeries = seriesRes.data.find(s => s.id === parseInt(requestId));
      setSeries(targetSeries);

      if (targetSeries) {
        const pendingRequests = targetSeries.faculty_requests?.filter(r => r.status === 'pending') || [];
        const isNudeReq = targetSeries.model_mode === "nude";

        const confirmedGigs = gigsRes.data.filter(g => g.status === 'confirmed');
        const pendingRequestIds = new Set(pendingRequests.map(r => r.id));

        const hasConflict = (userId, reqStart, reqEnd) => confirmedGigs.some(g => {
          if (g.art_model_availability.user.id !== userId) return false;
          if (pendingRequestIds.has(g.faculty_request.id)) return false;
          const gigStart = new Date(g.faculty_request.starts_at);
          const gigEnd = new Date(g.faculty_request.ends_at);
          return gigStart < reqEnd && gigEnd > reqStart;
        });

        const availsByUser = {};
        availRes.data.forEach(avail => {
          if (avail.status !== 'active') return;
          const uid = avail.user.id;
          if (!availsByUser[uid]) availsByUser[uid] = { user: avail.user, avails: [] };
          availsByUser[uid].avails.push(avail);
        });

        const candidates = Object.values(availsByUser).filter(({ user, avails }) => {
          if (isNudeReq && !user.willing_to_model_nude) return false;
          return pendingRequests.every(req => {
            const reqStart = new Date(req.starts_at);
            const reqEnd = new Date(req.ends_at);
            const timeMatch = avails.some(avail => {
              const availStart = new Date(avail.starts_at);
              const availEnd = new Date(avail.ends_at);
              return availStart <= reqStart && availEnd >= reqEnd;
            });
            return timeMatch && !hasConflict(user.id, reqStart, reqEnd);
          });
        }).map(({ user, avails }) => {
          let score = 0;
          if (user.skin_tone === targetSeries.pref_skin_tone) score++;
          if (user.gender_identity === targetSeries.pref_gender) score++;
          return { user, avails, score };
        });

        candidates.sort((a, b) => b.score - a.score);
        setMatches(candidates);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error loading series data:", err);
      setError("Failed to load request data. Please try again.");
      setLoading(false);
    });
  };

  const loadSingleRequestData = () => {
    Promise.all([
      api.get("/faculty_requests"),
      api.get("/art_model_availabilities"),
      api.get("/gigs")
    ]).then(([reqRes, availRes, gigsRes]) => {
      const targetReq = reqRes.data.find(r => r.id === parseInt(requestId));
      setRequest(targetReq);

      if (targetReq) {
        const reqStart = new Date(targetReq.starts_at);
        const reqEnd = new Date(targetReq.ends_at);
        const isNudeReq = targetReq.model_mode === "nude";

        const confirmedGigs = gigsRes.data.filter(g => g.status === 'confirmed');

        const hasConflict = (userId) => confirmedGigs.some(g => {
          if (g.art_model_availability.user.id !== userId) return false;
          if (g.faculty_request.id === targetReq.id) return false;
          const gigStart = new Date(g.faculty_request.starts_at);
          const gigEnd = new Date(g.faculty_request.ends_at);
          return gigStart < reqEnd && gigEnd > reqStart;
        });

        const candidates = availRes.data.filter(avail => {
          const availStart = new Date(avail.starts_at);
          const availEnd = new Date(avail.ends_at);
          const timeMatch = availStart <= reqStart && availEnd >= reqEnd;
          const nudityMatch = !isNudeReq || avail.user.willing_to_model_nude;
          const statusMatch = avail.status === 'active';
          const noConflict = !hasConflict(avail.user.id);
          return timeMatch && nudityMatch && statusMatch && noConflict;
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
  };

  const handleBook = (model) => {
    if (!confirm("Confirm booking this model for all dates in this series?")) return;

    if (isSeries) {
      const pendingRequests = series.faculty_requests?.filter(r => r.status === 'pending') || [];

      Promise.all(
        pendingRequests.map(req => {
          const reqStart = new Date(req.starts_at);
          const reqEnd = new Date(req.ends_at);
          const matchingAvail = model.avails.find(avail => {
            const availStart = new Date(avail.starts_at);
            const availEnd = new Date(avail.ends_at);
            return availStart <= reqStart && availEnd >= reqEnd;
          });
          return api.post("/gigs", {
            gig: {
              faculty_request_id: req.id,
              art_model_availability_id: matchingAvail.id
            }
          });
        })
      ).then(() => {
        setBookingSuccess(true);
        setTimeout(() => navigate("/"), 1500);
      }).catch(err => {
        console.error(err);
        setError("Error creating gigs. Please try again.");
      });
    } else {
      api.post("/gigs", {
        gig: {
          faculty_request_id: requestId,
          art_model_availability_id: model.id
        }
      }).then(() => {
        setBookingSuccess(true);
        setTimeout(() => navigate("/"), 1500);
      }).catch(err => {
        console.error(err);
        setError("Error creating gig. Please try again.");
      });
    }
  };

  if (loading) return (
    <Container className="p-5 text-center">
      <Spinner animation="border" />
    </Container>
  );

  if (!series && !request) return (
    <Container className="p-5">
      <Alert variant="danger">Request not found.</Alert>
    </Container>
  );

  const formatDateOnly = (d) => new Date(d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric'
  });

  const formatTime = (d) => new Date(d).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  });

  const formatDate = (d) => new Date(d).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const displayData = isSeries ? series : request;
  const pendingRequests = isSeries
    ? series.faculty_requests?.filter(r => r.status === 'pending') || []
    : [request];

  return (
    <Container className="py-4" style={{ maxWidth: '800px' }}>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {bookingSuccess && (
        <Alert variant="success" dismissible onClose={() => setBookingSuccess(false)}>
          {isSeries ? `${pendingRequests.length} gigs confirmed! Redirecting...` : 'Gig confirmed! Redirecting...'}
        </Alert>
      )}

      <Button variant="outline-secondary" className="mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i> Back
      </Button>

      <h2 className="mb-4">Create Gig Match</h2>

      <Card className="mb-4 border-primary shadow-sm">
        <Card.Header className="bg-primary text-white">
          Target Class
          {isSeries && pendingRequests.length > 1 && (
            <Badge bg="light" text="dark" className="ms-2">{pendingRequests.length} dates</Badge>
          )}
        </Card.Header>
        
        <Card.Body>
          <h3>{displayData.class_name}</h3>
          <div className="text-muted mb-2">
            <i className="bi bi-person me-1"></i>
            {isSeries
              ? `${series?.user?.first_name} ${series?.user?.last_name}`
              : `${request?.user?.first_name} ${request?.user?.last_name}`}
          </div>
          <div className="mb-2">
            {pendingRequests.map((req) => (
              <div key={req.id} className="small">
                <i className="bi bi-calendar3 me-1"></i>
                {formatDateOnly(req.starts_at)} &nbsp; {formatTime(req.starts_at)} - {formatTime(req.ends_at)}
              </div>
            ))}
          </div>
          {(displayData.building || displayData.room_number) && (
            <div className="text-muted small mb-2">
              <i className="bi bi-door-open me-1"></i>
              {displayData.building}{displayData.building && displayData.room_number && " "}{displayData.room_number}
            </div>
          )}
          <div>
            {displayData.model_mode === 'nude'
              ? <Badge bg="danger" className="me-2">Nude Required</Badge>
              : <Badge bg="success" className="me-2">Clothed</Badge>}
            <Badge bg="info" text="dark">
              Pref: {formatSkinTone(displayData.pref_skin_tone)}, {displayData.pref_gender}
            </Badge>
          </div>
        </Card.Body>
      </Card>

      {isSeries && (
        <Alert variant="info" className="mb-3">
          <i className="bi bi-info-circle-fill me-2"></i>
          Only models available for <strong>all {pendingRequests.length} dates</strong> are shown below.
        </Alert>
      )}

      <h4 className="text-secondary mb-3">Available Models ({matches.length})</h4>
      <ListGroup>
        {matches.length === 0 ? (
          <Alert variant="warning">
            No models found who are available for all dates and meet the nudity requirement.
          </Alert>
        ) : (
          matches.map(model => (
            <ListGroup.Item
              key={isSeries ? model.user.id : model.id}
              className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 p-3"
            >
              <div>
                <h5 className="mb-1">
                  {isSeries ? model.user.first_name : model.user.first_name} {isSeries ? model.user.last_name : model.user.last_name}
                  {model.score > 0 && <Badge bg="warning" text="dark" className="ms-2">★ Match</Badge>}
                </h5>
                <div className="text-muted small">
                  {formatSkinTone(isSeries ? model.user.skin_tone : model.user.skin_tone)} / {isSeries ? model.user.gender_identity : model.user.gender_identity}
                </div>
                {!isSeries && (
                  <div className="text-success small">
                    Available: {formatDate(model.starts_at)} - {formatDate(model.ends_at)}
                  </div>
                )}
              </div>
              <Button variant="success" onClick={() => handleBook(model)}>
                {isSeries ? `Book for All ${pendingRequests.length} Dates` : 'Book Model'}
              </Button>
            </ListGroup.Item>
          ))
        )}
      </ListGroup>
    </Container>
  );
}

export default GigCreator;