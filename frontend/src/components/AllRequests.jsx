import React, { useState, useEffect } from "react";
import { Container, Table, Badge, Form, InputGroup, Button, Offcanvas, ListGroup } from "react-bootstrap";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";

function AllRequests() {
  // --- STATE ---
  const [requests, setRequests] = useState([]);
  const [availabilities, setAvailabilities] = useState([]); // Pre-loaded for speed
  const [search, setSearch] = useState("");

  // Sidebar / Matching State
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [recommendedModels, setRecommendedModels] = useState([]);

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    // 1. Fetch Requests
    api.get("/faculty_requests").then(res => {
      // Sort: Pending first, then by date (newest first)
      const sorted = res.data.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setRequests(sorted);
    });

    // 2. Fetch Availabilities (Cache these for the matching logic)
    api.get("/art_model_availabilities").then((res) => {
      setAvailabilities(res.data);
    });
  }, []);

  // --- IMPROVED FILTER LOGIC ---
  const filtered = requests.filter(r => {
    const term = search.toLowerCase();
    
    // Safety checks: Ensure fields exist before lowercasing
    const className = r.class_name?.toLowerCase() || "";
    const department = r.department?.toLowerCase() || "";
    const firstName = r.user?.first_name?.toLowerCase() || "";
    const lastName = r.user?.last_name?.toLowerCase() || "";
    const fullName = `${firstName} ${lastName}`; // Allows searching "Frank Faculty"
    
    return (
      className.includes(term) || 
      department.includes(term) ||
      firstName.includes(term) || 
      lastName.includes(term) ||
      fullName.includes(term)
    );
  });

  // --- MATCHING LOGIC (Ported from Dashboard) ---
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
      const nudityMatch = !isNudeReq || avail.user?.willing_to_model_nude; // Safety check added
      
      // Status Check
      const statusMatch = avail.status === 'active';

      return timeMatch && nudityMatch && statusMatch;
    });

    // 2. Score & Sort: Demographic Matches
    const scoredCandidates = candidates.map(avail => {
      let score = 0;
      if (avail.user) {
          if (avail.user.skin_tone === request.pref_skin_tone) score += 1;
          if (avail.user.gender_identity === request.pref_gender) score += 1;
          // Add disability score if relevant
          if (request.pref_disability === 'Yes' && avail.user.disability_status !== 'None') score += 2;
      }
      return { ...avail, score };
    });

    // Sort: High Score first
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
      // Reload page to reflect status changes
      window.location.reload(); 
    })
    .catch(err => {
      console.error(err);
      alert("Error creating gig. Check console.");
    });
  };

  // --- HELPER ---
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge bg="warning" text="dark">Pending</Badge>;
      case 'matched': return <Badge bg="success">Matched</Badge>;
      case 'archived': return <Badge bg="secondary">Archived</Badge>;
      default: return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };
  
  const formatDate = (d) => new Date(d).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  return (
    <Container className="py-4">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Faculty Request Archive</h2>
        <InputGroup style={{ maxWidth: '300px' }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control 
            placeholder="Search class, faculty, dept..." 
            onChange={e => setSearch(e.target.value)} 
          />
        </InputGroup>
      </div>

      {/* TABLE */}
      <Table hover responsive className="shadow-sm bg-white align-middle">
        <thead className="bg-light">
          <tr>
            <th>Date Needed</th>
            <th>Class / Dept</th> {/* Updated Header */}
            <th>Faculty</th>
            <th>Reqs</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
             <tr><td colSpan="6" className="text-center py-4 text-muted">No requests found.</td></tr>
          ) : (
            filtered.map(req => (
              <tr key={req.id}>
                <td>{new Date(req.starts_at).toLocaleDateString()}</td>
                <td>
                  <div className="fw-bold">{req.class_name}</div>
                  {req.department && <Badge bg="secondary" style={{fontSize:'0.7em'}}>{req.department}</Badge>}
                  <div className="small text-muted mt-1">
                    {formatDate(req.starts_at)} - {formatDate(req.ends_at)}
                  </div>
                </td>
                <td>{req.user?.first_name} {req.user?.last_name}</td>
                <td>
                  {req.model_mode === 'nude' ? <span className="text-danger fw-bold me-2">Nude</span> : <span className="text-success me-2">Clothed</span>}
                  <small className="text-muted d-block">
                    {formatSkinTone(req.pref_skin_tone)}, {req.pref_gender}
                    {req.pref_disability === 'Yes' && <span className="text-danger fw-bold ms-1"> (Disability Pref)</span>}
                  </small>
                </td>
                <td>{getStatusBadge(req.status)}</td>
                <td>
                  {req.status === 'pending' ? (
                    <Button 
                      size="sm" 
                      variant="outline-primary" 
                      onClick={() => handleShowMatch(req)}
                    >
                      Find Match
                    </Button>
                  ) : (
                    <Button size="sm" variant="light" disabled className="text-muted">
                      Filled
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {/* --- SIDEBAR: MATCHING (Same as Dashboard) --- */}
      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Find Model</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {selectedRequest && (
            <div className="mb-4 p-3 bg-light rounded">
              <strong>Match for:</strong> {selectedRequest.class_name}<br/>
              <small>{new Date(selectedRequest.starts_at).toLocaleDateString()} • {formatDate(selectedRequest.starts_at)} - {formatDate(selectedRequest.ends_at)}</small><br/>
              <small className="text-muted">Needs: {formatSkinTone(selectedRequest.pref_skin_tone)}, {selectedRequest.pref_gender}</small>
            </div>
          )}

          <h5 className="text-secondary">Recommended</h5>
          <ListGroup variant="flush">
            {recommendedModels.length === 0 ? (
              <div className="text-danger p-2">No models available for this time slot.</div>
            ) : (
              recommendedModels.map(model => (
                <ListGroup.Item key={model.id} action onClick={() => handleCreateGig(model.id)}>
                  <div className="d-flex justify-content-between">
                    <strong>{model.user?.first_name} {model.user?.last_name}</strong>
                    {model.score > 0 && <Badge bg="info">Top Match</Badge>}
                  </div>
                  <div className="small text-muted">
                    {formatSkinTone(model.user?.skin_tone)} / {model.user?.gender_identity}
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

    </Container>
  );
}

export default AllRequests;