import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Row, Col, Card, Badge, Button, Offcanvas, ListGroup } from "react-bootstrap";
import { formatSkinTone } from "../utils/formatters";

function AdminDashboard() {
  const [requests, setRequests] = useState([]);
  const [todaysGigs, setTodaysGigs] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [recommendedModels, setRecommendedModels] = useState([]);

  const fetchDashboardData = async () => {
    const [requestsRes, gigsRes, availsRes] = await Promise.all([
      api.get("/faculty_requests"),
      api.get("/gigs"),
      api.get("/art_model_availabilities")
    ]);

    const pending = requestsRes.data
      .filter(r => r.status === 'pending')
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    setRequests(pending);

    const todayStr = new Date().toISOString().split('T')[0];

    const today = gigsRes.data.filter(g =>
      g.faculty_request?.starts_at && g.faculty_request.starts_at.startsWith(todayStr)
    );

    setTodaysGigs(today);
    setAvailabilities(availsRes.data);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleShowMatch = (request) => {
    setSelectedRequest(request);
    
    const reqStart = new Date(request.starts_at);
    const reqEnd = new Date(request.ends_at);
    const isNudeReq = request.model_mode === "nude";

    const candidates = availabilities.filter((avail) => {
      const availStart = new Date(avail.starts_at);
      const availEnd = new Date(avail.ends_at);
      const timeMatch = availStart <= reqStart && availEnd >= reqEnd;
      const nudityMatch = !isNudeReq || avail.user.willing_to_model_nude;
      const statusMatch = avail.status === 'active';
      return timeMatch && nudityMatch && statusMatch;
    });

    const scoredCandidates = candidates.map(avail => {
      let score = 0;
      
      if (avail.user) {
          if (avail.user.skin_tone === request.pref_skin_tone) score += 1;
          if (avail.user.gender_identity === request.pref_gender) score += 1;
      }

      return { ...avail, score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);
    setRecommendedModels(scoredCandidates);
    setShowSidebar(true);
  };

  const handleCreateGig = (availabilityId) => {
    if(!confirm("Confirm booking?")) return;

    api.post("/gigs", {
      faculty_request_id: selectedRequest.id,
      art_model_availability_id: availabilityId
    })
    .then(() => {
      setShowSidebar(false);
      fetchDashboardData(); 
    })
    .catch(err => console.error(err));
  };

  const formatDate = (d) => new Date(d).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  return (
    <div>
      <h2 className="mb-4">Admin Dashboard</h2>
      
      <Row>
        <Col md={7}>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white fw-bold">
              Pending Faculty Requests
            </Card.Header>
            <Card.Body>
              {requests.length === 0 ? <p className="text-muted">No pending requests.</p> : (
                requests.map(req => (
                  <Card key={req.id} className="mb-3 border-start border-5 border-primary">
                    <Card.Body className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-1">{req.class_name}</h5>
                        <div className="mb-2">
                          {req.user.first_name} {req.user.last_name} &nbsp;|&nbsp;
                          {new Date(req.starts_at).toLocaleDateString()} {formatDate(req.starts_at)} - {formatDate(req.ends_at)}
                        </div>
                        <div className="text-muted small mb-2">
                          Request Submitted: {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div>
                            {req.model_mode === "nude" ? <Badge bg="danger">Nude</Badge> : <Badge bg="success">Clothed</Badge>}
                            <span className="ms-2 small text-secondary">
                              Pref: {formatSkinTone(req.pref_skin_tone)}, {req.pref_gender} Gender Presentation
                            </span>
                        </div>
                        {req.notes && (
                          <div className="mt-1 text-muted small fst-italic">📝 {req.notes}</div>
                        )}
                      </div>
                      <Button variant="outline-primary" onClick={() => handleShowMatch(req)}>
                        Find Match
                      </Button>
                    </Card.Body>
                  </Card>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={5}>
          <Card className="shadow-sm">
            <Card.Header className="bg-success text-white fw-bold">
              Today's Schedule
            </Card.Header>
            <Card.Body>
              {todaysGigs.length === 0 ? <p className="text-muted">No gigs scheduled for today.</p> : (
                todaysGigs.map(gig => (
                  <Card key={gig.id} className="mb-3 border-start border-5 border-success">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <h6 className="mb-1 fw-bold">{gig.faculty_request.class_name}</h6>
                        {gig.faculty_request.model_mode === 'nude' 
                          ? <Badge bg="danger">Nude</Badge> 
                          : <Badge bg="success">Clothed</Badge>
                        }
                      </div>
                      <div className="small mb-1">
                        {formatDate(gig.faculty_request.starts_at)} - {formatDate(gig.faculty_request.ends_at)}
                      </div>
                      <div className="small mb-1">
                        Faculty: {gig.faculty_request.user.first_name} {gig.faculty_request.user.last_name}
                      </div>
                      {gig.faculty_request.department && (
                        <div className="small mb-1">
                          Department: {gig.faculty_request.department}
                        </div>
                      )}
                      <div className="small mb-1">
                        Model: <strong>{gig.art_model_availability.user.first_name} {gig.art_model_availability.user.last_name}</strong>
                      </div>
                      {gig.faculty_request.notes && (
                        <div className="small text-muted fst-italic mt-1">📝 {gig.faculty_request.notes}</div>
                      )}
                    </Card.Body>
                  </Card>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Find Model</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {selectedRequest && (
            <div className="mb-4 p-3 bg-light rounded">
              <strong>Match for:</strong> {selectedRequest.class_name}<br/>
              <small>{formatDate(selectedRequest.starts_at)} - {formatDate(selectedRequest.ends_at)}</small><br/>
              <small>Needs: {formatSkinTone(selectedRequest.pref_skin_tone)}, {selectedRequest.pref_gender} Gender Presentation</small>
              {selectedRequest.notes && (
                <div className="mt-2 text-muted small fst-italic">📝 {selectedRequest.notes}</div>
              )}
            </div>
          )}

          <h5 className="text-secondary">Recommended</h5>
          <ListGroup variant="flush">
            {recommendedModels.length === 0 ? (
              <div className="text-danger">No models available for this time slot.</div>
            ) : (
              recommendedModels.map(model => (
                <ListGroup.Item key={model.id} action onClick={() => handleCreateGig(model.id)}>
                  <div className="d-flex justify-content-between">
                    <strong>{model.user.first_name} {model.user.last_name}</strong>
                    {model.score > 0 && <Badge bg="info">Top Match</Badge>}
                  </div>
                  <div className="small text-muted">
                    {formatSkinTone(model.user.skin_tone)} / {model.user.gender_identity}
                  </div>
                  <div className="small text-muted">
                    Avail: {formatDate(model.starts_at)} - {formatDate(model.ends_at)}
                  </div>
                </ListGroup.Item>
              ))
            )}
          </ListGroup>
        </Offcanvas.Body>
      </Offcanvas>

    </div>
  );
}

export default AdminDashboard;