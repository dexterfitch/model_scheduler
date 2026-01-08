import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Row, Col, Card, Badge, Button, Offcanvas, ListGroup } from "react-bootstrap";
import { formatSkinTone } from "../utils/formatters";

function AdminDashboard() {
  const [requests, setRequests] = useState([]);
  const [todaysGigs, setTodaysGigs] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  
  // State for the Matching Sidebar
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [recommendedModels, setRecommendedModels] = useState([]);

  useEffect(() => {
    // 1. Fetch Requests (Filter for PENDING only)
    api.get("/faculty_requests").then((res) => {
      const pending = res.data.filter(r => r.status === 'pending');
      setRequests(pending);
    });

    // 2. Fetch All Gigs (Filter for TODAY)
    api.get("/gigs").then((res) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const today = res.data.filter(g => g.faculty_request.starts_at.startsWith(todayStr));
      setTodaysGigs(today);
    });

    // 3. Fetch Availabilities (We need these loaded to calculate matches)
    api.get("/art_model_availabilities").then((res) => {
      setAvailabilities(res.data);
    });
  }, []);

  // --- MATCHING LOGIC ---
  const handleShowMatch = (request) => {
    setSelectedRequest(request);
    
    // 1. Filter: Must overlap in time
    const reqStart = new Date(request.starts_at);
    const reqEnd = new Date(request.ends_at);
    const isNudeReq = request.model_mode === "nude";

    const candidates = availabilities.filter((avail) => {
      const availStart = new Date(avail.starts_at);
      const availEnd = new Date(avail.ends_at);
      
      // Time Check: Avail Start <= Req Start AND Avail End >= Req End
      const timeMatch = availStart <= reqStart && availEnd >= reqEnd;
      
      // Nudity Check: If request is nude, model MUST be willing
      const nudityMatch = !isNudeReq || avail.user.willing_to_model_nude;

      return timeMatch && nudityMatch;
    });

    // 2. Score & Sort: Demographic Matches & Fairness
    const scoredCandidates = candidates.map(avail => {
      let score = 0;
      if (avail.user.skin_tone === request.pref_skin_tone) score += 1;
      if (avail.user.gender_identity === request.pref_gender) score += 1;
      // Disability preference matching could go here too

      return { ...avail, score };
    });

    // Sort: High Score first. (Secondary sort by gig count would go here)
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
      alert("Gig Created!");
      setShowSidebar(false);
      // Refresh Data
      window.location.reload(); 
    })
    .catch(err => console.error(err));
  };

  const formatDate = (d) => new Date(d).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  return (
    <div>
      <h2 className="mb-4">Admin Dashboard</h2>
      
      <Row>
        {/* --- LEFT: PENDING REQUESTS --- */}
        <Col md={7}>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white fw-bold">
              ⚡ Pending Faculty Requests
            </Card.Header>
            <Card.Body>
              {requests.length === 0 ? <p className="text-muted">No pending requests.</p> : (
                requests.map(req => (
                  <Card key={req.id} className="mb-3 border-start border-5 border-primary">
                    <Card.Body className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-1">{req.class_name}</h5>
                        <div className="text-muted small mb-2">
                          👤 {req.user.first_name} {req.user.last_name} &nbsp;|&nbsp;
                          🕒 {new Date(req.starts_at).toLocaleDateString()} {formatDate(req.starts_at)} - {formatDate(req.ends_at)}
                        </div>
                        <div>
                           {req.model_mode === "nude" ? <Badge bg="danger">Nude</Badge> : <Badge bg="success">Clothed</Badge>}
                           <span className="ms-2 small text-secondary">Pref: {formatSkinTone(req.pref_skin_tone)}, {req.pref_gender}</span>
                        </div>
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

        {/* --- RIGHT: TODAY'S GIGS --- */}
        <Col md={5}>
          <Card className="shadow-sm">
            <Card.Header className="bg-success text-white fw-bold">
              📅 Today's Schedule
            </Card.Header>
            <Card.Body>
              {todaysGigs.length === 0 ? <p className="text-muted">No gigs scheduled for today.</p> : (
                todaysGigs.map(gig => (
                  <div key={gig.id} className="p-2 border-bottom mb-2">
                    <strong>{formatDate(gig.faculty_request.starts_at)}</strong>: {gig.faculty_request.class_name}
                    <div className="small text-muted">
                      Model: {gig.art_model_availability.user.first_name}
                    </div>
                  </div>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* --- SIDEBAR: MATCHING --- */}
      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Find Model</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {selectedRequest && (
            <div className="mb-4 p-3 bg-light rounded">
              <strong>Match for:</strong> {selectedRequest.class_name}<br/>
              <small>{formatDate(selectedRequest.starts_at)} - {formatDate(selectedRequest.ends_at)}</small><br/>
              <small>Needs: {formatSkinTone(selectedRequest.pref_skin_tone)}, {selectedRequest.pref_gender}</small>
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