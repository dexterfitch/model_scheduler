import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Badge, Form, InputGroup, Button, Row, Col } from "react-bootstrap";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";

function AllRequests() {
  const navigate = useNavigate();
  const [allSeries, setAllSeries] = useState([]);
  const [search, setSearch] = useState("");

  const today = new Date();
  const [filterStart, setFilterStart] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  );
  const [filterEnd, setFilterEnd] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [showAll, setShowAll] = useState(true);

  useEffect(() => {
    api.get("/request_series").then(res => setAllSeries(res.data));
  }, []);

  const filterSeries = (statusFilter) => {
    const term = search.toLowerCase();
    return allSeries
      .filter(s => {
        if (statusFilter === 'pending') return s.faculty_requests?.some(r => r.status === 'pending');
        if (statusFilter === 'matched') return s.status === 'matched';
        if (statusFilter === 'archived') return s.status === 'archived';
        return false;
      })
      .filter(s => {
        if (showAll) return true;
        const firstReq = s.faculty_requests?.[0];
        if (!firstReq) return false;
        const gigDate = new Date(firstReq.starts_at);
        return gigDate >= new Date(filterStart + "T00:00:00") && gigDate <= new Date(filterEnd + "T23:59:59");
      })
      .filter(s => {
        const className = s.class_name?.toLowerCase() || "";
        const department = s.department?.toLowerCase() || "";
        const firstName = s.faculty_requests?.[0]?.user?.first_name?.toLowerCase() || "";
        const lastName = s.faculty_requests?.[0]?.user?.last_name?.toLowerCase() || "";
        const fullName = `${firstName} ${lastName}`;
        return className.includes(term) || department.includes(term) ||
          firstName.includes(term) || lastName.includes(term) || fullName.includes(term);
      })
      .sort((a, b) => {
        const aFirst = a.faculty_requests?.[0]?.starts_at;
        const bFirst = b.faculty_requests?.[0]?.starts_at;
        return new Date(aFirst) - new Date(bFirst);
      });
  };

  const pending = filterSeries('pending');
  const matched = filterSeries('matched');
  const archived = filterSeries('archived').reverse();

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateShort = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const handleReleaseRemaining = async (seriesId) => {
    if (!confirm("Release all remaining matched dates in this series back to pending? This will cancel those gigs and let you rematch the whole remaining series to a new model.")) return;
    try {
      await api.post(`/request_series/${seriesId}/release_remaining`);
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      alert("Failed to release remaining dates.");
    }
  };

  const renderSeriesCard = (s, showAction) => {
    const pendingRequests = s.faculty_requests?.filter(r => r.status === 'pending') || [];
    const allRequests = s.faculty_requests || [];
    const displayRequests = showAction ? pendingRequests : allRequests;
    const faculty = s.user;

    const matchedCount = allRequests.filter(r => r.status === 'matched').length;
    const pendingCount = allRequests.filter(r => r.status === 'pending').length;
    const archivedCount = allRequests.filter(r => r.status === 'archived').length;

    return (
      <div key={s.id} className="card mb-3 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="fw-bold">{s.class_name}</div>
              <div className="d-flex gap-1 flex-wrap mt-1">
                {s.department && <Badge bg="secondary" style={{ fontSize: '0.7em' }}>{s.department}</Badge>}
                {allRequests.length > 1 && <Badge bg="info" text="dark" style={{ fontSize: '0.7em' }}>{allRequests.length} dates</Badge>}
              </div>
              {(s.building || s.room_number) && (
                <div className="small text-muted mt-1">
                  <i className="bi bi-door-open me-1"></i>
                  {s.building}{s.building && s.room_number && " "}{s.room_number}
                </div>
              )}
              {showAction && allRequests.length > 1 && (
                <div className="small text-muted mt-1">
                  Series: {matchedCount > 0 && <Badge bg="success" className="me-1">{matchedCount} Matched</Badge>}
                  {pendingCount > 0 && <Badge bg="warning" text="dark" className="me-1">{pendingCount} Pending</Badge>}
                  {archivedCount > 0 && <Badge bg="secondary" className="me-1">{archivedCount} Cancelled</Badge>}
                </div>
              )}
            </div>
            {s.model_mode === 'nude'
              ? <Badge bg="danger">Nude</Badge>
              : <Badge bg="success">Clothed</Badge>}
          </div>

          <div className="mb-2">
            {displayRequests.map(req => (
              <div key={req.id} className="small text-muted">
                <i className="bi bi-calendar3 me-1"></i>
                {formatDateShort(req.starts_at)} &bull; {formatTime(req.starts_at)} &ndash; {formatTime(req.ends_at)}
              </div>
            ))}
          </div>

          <div className="small text-muted mb-1">
            <i className="bi bi-person me-1"></i>
            {faculty?.first_name} {faculty?.last_name}
          </div>
          <div className="small text-muted mb-2">
            <i className="bi bi-palette me-1"></i>
            {formatSkinTone(s.pref_skin_tone)}, {s.pref_gender} Gender Presentation
          </div>
          {s.notes && (
            <div className="small text-muted fst-italic mb-2 border rounded p-2">
              <i className="bi bi-journal-text me-1"></i>{s.notes}
            </div>
          )}
          {showAction && (
            <div className="d-flex flex-column gap-2">
              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => navigate(`/gigs/new/${s.id}?type=series`)}
              >
                Find Match
              </Button>
              {matchedCount > 0 && (
                <Button
                  size="sm"
                  variant="outline-warning"
                  onClick={() => handleReleaseRemaining(s.id)}
                >
                  Release Remaining for Rematch
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDesktopTable = (seriesList, showAction) => (
    <div className="d-none d-md-block">
      <Table hover responsive className="shadow-sm bg-white align-middle mb-0">
        <thead className="bg-light">
          <tr>
            <th>Date(s)</th>
            <th>Class / Dept</th>
            <th>Faculty</th>
            <th>Reqs</th>
            {showAction && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {seriesList.length === 0 ? (
            <tr>
              <td colSpan={showAction ? 5 : 4} className="text-center py-3 text-muted">None.</td>
            </tr>
          ) : (
            seriesList.map(s => {
              const pendingRequests = s.faculty_requests?.filter(r => r.status === 'pending') || [];
              const allRequests = s.faculty_requests || [];
              const displayRequests = showAction ? pendingRequests : allRequests;
              const faculty = s.user;
              const matchedCount = allRequests.filter(r => r.status === 'matched').length;
              const pendingCount = allRequests.filter(r => r.status === 'pending').length;
              const archivedCount = allRequests.filter(r => r.status === 'archived').length;

              return (
                <tr key={s.id}>
                  <td>
                    {displayRequests.map(req => (
                      <div key={req.id} className="small">
                        {formatDateShort(req.starts_at)}<br />
                        <span className="text-muted">{formatTime(req.starts_at)} - {formatTime(req.ends_at)}</span>
                      </div>
                    ))}
                  </td>
                  <td>
                    <div className="fw-bold">{s.class_name}</div>
                    <div className="d-flex gap-1 flex-wrap mt-1">
                      {s.department && <Badge bg="secondary" style={{ fontSize: '0.7em' }}>{s.department}</Badge>}
                      {allRequests.length > 1 && <Badge bg="info" text="dark" style={{ fontSize: '0.7em' }}>{allRequests.length} dates</Badge>}
                    </div>
                    {s.room_number && (
                      <div className="small text-muted mt-1">
                        <i className="bi bi-door-open me-1"></i>{s.building}{s.building && s.room_number && " "}{s.room_number}
                      </div>
                    )}
                    {showAction && allRequests.length > 1 && (
                      <div className="small text-muted mt-1">
                        Series: {matchedCount > 0 && <Badge bg="success" className="me-1">{matchedCount} Matched</Badge>}
                        {pendingCount > 0 && <Badge bg="warning" text="dark" className="me-1">{pendingCount} Pending</Badge>}
                        {archivedCount > 0 && <Badge bg="secondary" className="me-1">{archivedCount} Cancelled</Badge>}
                      </div>
                    )}
                  </td>
                  <td>{faculty?.first_name} {faculty?.last_name}</td>
                  <td>
                    {s.model_mode === 'nude'
                      ? <span className="text-danger fw-bold me-2">Nude</span>
                      : <span className="text-success me-2">Clothed</span>}
                    <small className="text-muted d-block">
                      {formatSkinTone(s.pref_skin_tone)}, {s.pref_gender} Gender Presentation
                    </small>
                    {s.notes && (
                      <small className="text-muted fst-italic d-block">
                        <i className="bi bi-journal-text me-1"></i>{s.notes}
                      </small>
                    )}
                  </td>
                  {showAction && (
                    <td>
                      <div className="d-flex flex-column gap-2">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => navigate(`/gigs/new/${s.id}?type=series`)}
                        >
                          Find Match
                        </Button>
                        {matchedCount > 0 && (
                          <Button
                            size="sm"
                            variant="outline-warning"
                            onClick={() => handleReleaseRemaining(s.id)}
                          >
                            Release Remaining for Rematch
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </div>
  );

  const renderSection = (seriesList, showAction) => (
    <>
      {renderDesktopTable(seriesList, showAction)}
      <div className="d-md-none">
        {seriesList.length === 0
          ? <p className="text-center text-muted py-3">None.</p>
          : seriesList.map(s => renderSeriesCard(s, showAction))}
      </div>
    </>
  );

  return (
    <Container className="py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <h2 className="mb-0">Faculty Requests</h2>
        <InputGroup style={{ maxWidth: '300px', width: '100%' }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control
            placeholder="Search class, faculty, dept..."
            onChange={e => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <div className="p-3 bg-light rounded mb-4 d-flex align-items-end date-filter-box">
        <Row className="g-2 align-items-end">
          <Col xs={12} md="auto">
            <Button
              className="w-100"
              variant={showAll ? "secondary" : "outline-secondary"}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Filter by Date" : "Show All"}
            </Button>
          </Col>
          {!showAll && (
            <>
              <Col xs={6} md="auto">
                <Form.Label className="small fw-bold mb-1">From</Form.Label>
                <Form.Control
                  type="date"
                  value={filterStart}
                  onChange={e => setFilterStart(e.target.value)}
                />
              </Col>
              <Col xs={6} md="auto">
                <Form.Label className="small fw-bold mb-1">To</Form.Label>
                <Form.Control
                  type="date"
                  value={filterEnd}
                  onChange={e => setFilterEnd(e.target.value)}
                />
              </Col>
            </>
          )}
        </Row>
      </div>

      <div className="mb-4">
        <h5 className="fw-bold text-warning mb-2">Pending ({pending.length})</h5>
        {renderSection(pending, true)}
      </div>

      <div className="mb-4">
        <h5 className="fw-bold text-success mb-2">Matched ({matched.length})</h5>
        {renderSection(matched, false)}
      </div>

      <div className="mb-4">
        <h5 className="fw-bold text-secondary mb-2">Cancelled ({archived.length})</h5>
        {renderSection(archived, false)}
      </div>
    </Container>
  );
}

export default AllRequests;