import React, { useState, useEffect } from "react";
import { Container, Table, Badge, Form, InputGroup, Button, Offcanvas, ListGroup } from "react-bootstrap";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";

function AllRequests() {
  const [requests, setRequests] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [search, setSearch] = useState("");

  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [recommendedModels, setRecommendedModels] = useState([]);

  const today = new Date();
  const [filterStart, setFilterStart] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  );
  const [filterEnd, setFilterEnd] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api.get("/faculty_requests").then(res => setRequests(res.data));
    api.get("/art_model_availabilities").then(res => setAvailabilities(res.data));
  }, []);

  const filterRequests = (status) => {
    const term = search.toLowerCase();
    return requests
      .filter(r => r.status === status)
      .filter(r => {
        if (showAll) return true;
        const gigDate = new Date(r.starts_at);
        return gigDate >= new Date(filterStart + "T00:00:00") && gigDate <= new Date(filterEnd + "T23:59:59");
      })
      .filter(r => {
        const className = r.class_name?.toLowerCase() || "";
        const department = r.department?.toLowerCase() || "";
        const firstName = r.user?.first_name?.toLowerCase() || "";
        const lastName = r.user?.last_name?.toLowerCase() || "";
        const fullName = `${firstName} ${lastName}`;
        return className.includes(term) || department.includes(term) ||
          firstName.includes(term) || lastName.includes(term) || fullName.includes(term);
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  };

  const pending = filterRequests('pending');
  const matched = filterRequests('matched');
  const archived = filterRequests('archived').reverse();

  const handleShowMatch = (request) => {
    setSelectedRequest(request);
    const reqStart = new Date(request.starts_at);
    const reqEnd = new Date(request.ends_at);
    const isNudeReq = request.model_mode === "nude";

    const candidates = availabilities.filter((avail) => {
      const availStart = new Date(avail.starts_at);
      const availEnd = new Date(avail.ends_at);
      const timeMatch = availStart <= reqStart && availEnd >= reqEnd;
      const nudityMatch = !isNudeReq || avail.user?.willing_to_model_nude;
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
    if (!confirm("Confirm booking?")) return;
    api.post("/gigs", {
      faculty_request_id: selectedRequest.id,
      art_model_availability_id: availabilityId
    })
    .then(() => {
      setShowSidebar(false);
      window.location.reload();
    })
    .catch(err => {
      console.error(err);
      alert("Error creating gig. Check console.");
    });
  };

  const formatDate = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderTable = (rows, showAction) => (
    <Table hover responsive className="shadow-sm bg-white align-middle mb-0">
      <thead className="bg-light">
        <tr>
          <th>Date Needed</th>
          <th>Class / Dept</th>
          <th>Faculty</th>
          <th>Reqs</th>
          {showAction && <th>Action</th>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={showAction ? 5 : 4} className="text-center py-3 text-muted">None.</td></tr>
        ) : (
          rows.map(req => (
            <tr key={req.id}>
              <td>{new Date(req.starts_at).toLocaleDateString()}</td>
              <td>
                <div className="fw-bold">{req.class_name}</div>
                {req.department && <Badge bg="secondary" style={{ fontSize: '0.7em' }}>{req.department}</Badge>}
                <div className="small text-muted mt-1">
                  {formatDate(req.starts_at)} - {formatDate(req.ends_at)}
                </div>
              </td>
              <td>{req.user?.first_name} {req.user?.last_name}</td>
              <td>
                {req.model_mode === 'nude'
                  ? <span className="text-danger fw-bold me-2">Nude</span>
                  : <span className="text-success me-2">Clothed</span>}
                <small className="text-muted d-block">
                  {formatSkinTone(req.pref_skin_tone)}, {req.pref_gender} Gender Presentation
                </small>
                {req.notes && <small className="text-muted fst-italic d-block">📝 {req.notes}</small>}
              </td>
              {showAction && (
                <td>
                  <Button size="sm" variant="outline-primary" onClick={() => handleShowMatch(req)}>
                    Find Match
                  </Button>
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Faculty Requests</h2>
        <InputGroup style={{ maxWidth: '300px' }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control
            placeholder="Search class, faculty, dept..."
            onChange={e => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <div className="d-flex align-items-end gap-3 mb-4 p-3 bg-light rounded">
        <div>
          <Form.Label className="small fw-bold mb-1">From</Form.Label>
          <Form.Control 
            type="date" 
            value={filterStart} 
            onChange={e => { setFilterStart(e.target.value); setShowAll(false); }}
            disabled={showAll}
          />
        </div>
        <div>
          <Form.Label className="small fw-bold mb-1">To</Form.Label>
          <Form.Control 
            type="date" 
            value={filterEnd} 
            onChange={e => { setFilterEnd(e.target.value); setShowAll(false); }}
            disabled={showAll}
          />
        </div>
        <Button 
          variant={showAll ? "secondary" : "outline-secondary"} 
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Use Date Filters" : "Show All"}
        </Button>
      </div>
      
      <div className="mb-4">
        <h5 className="fw-bold text-warning mb-2">Pending ({pending.length})</h5>
        {renderTable(pending, true)}
      </div>

      <div className="mb-4">
        <h5 className="fw-bold text-success mb-2">Matched ({matched.length})</h5>
        {renderTable(matched, false)}
      </div>

      <div className="mb-4">
        <h5 className="fw-bold text-secondary mb-2">Cancelled ({archived.length})</h5>
        {renderTable(archived, false)}
      </div>

      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Find Model</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {selectedRequest && (
            <div className="mb-4 p-3 bg-light rounded">
              <strong>Match for:</strong> {selectedRequest.class_name}<br />
              <small>{new Date(selectedRequest.starts_at).toLocaleDateString()} • {formatDate(selectedRequest.starts_at)} - {formatDate(selectedRequest.ends_at)}</small><br />
              <small className="text-muted">Needs: {formatSkinTone(selectedRequest.pref_skin_tone)}, {selectedRequest.pref_gender} Gender Presentation</small>
              {selectedRequest.notes && (
                <div className="mt-2 text-muted small fst-italic">📝 {selectedRequest.notes}</div>
              )}
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