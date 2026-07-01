import React, { useState, useEffect } from "react";
import { Table, Container, Badge, Button, Form, InputGroup, Row, Col } from "react-bootstrap";
import api from "../services/api";

function AllGigs() {
  const [gigs, setGigs] = useState([]);
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
    fetchGigs();
  }, []);

  const fetchGigs = () => {
    api.get("/gigs")
      .then(res => {
        const sorted = res.data.sort((a, b) =>
          new Date(a.faculty_request.starts_at) - new Date(b.faculty_request.starts_at)
        );
        setGigs(sorted);
      })
      .catch(err => console.error(err));
  };

  const handleDelete = (id) => {
    if (!confirm("Are you sure you want to cancel this Gig? The Faculty Request will be re-opened.")) return;
    api.delete(`/gigs/${id}`)
      .then(() => fetchGigs())
      .catch(err => console.error("Error deleting gig", err));
  };

  const filteredGigs = gigs.filter(gig => {
    const term = search.toLowerCase();
    const modelName = `${gig.art_model_availability.user.first_name} ${gig.art_model_availability.user.last_name}`.toLowerCase();
    const facultyName = `${gig.faculty_request.user.first_name} ${gig.faculty_request.user.last_name}`.toLowerCase();
    const className = gig.faculty_request.class_name.toLowerCase();
    const matchesSearch = modelName.includes(term) || facultyName.includes(term) || className.includes(term);

    if (!matchesSearch) return false;
    if (showAll) return true;

    const gigDate = new Date(gig.faculty_request.starts_at);
    return gigDate >= new Date(filterStart + "T00:00:00") && gigDate <= new Date(filterEnd + "T23:59:59");
  });

  const groupedGigs = (() => {
    const groups = [];
    const seriesMap = {};

    filteredGigs.forEach(gig => {
      const seriesId = gig.faculty_request?.request_series_id;
      if (!seriesId) {
        groups.push({ key: `gig-${gig.id}`, gigs: [gig] });
        return;
      }
      if (!seriesMap[seriesId]) {
        const group = { key: `series-${seriesId}`, gigs: [] };
        seriesMap[seriesId] = group;
        groups.push(group);
      }
      seriesMap[seriesId].gigs.push(gig);
    });

    return groups;
  })();

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderStatusBadge = (gig) => {
    if (gig.status === 'confirmed') return <Badge bg="primary">Confirmed</Badge>;
    if (gig.status === 'cancelled') return (
      <Badge bg={gig.billable ? "warning" : "secondary"} text={gig.billable ? "dark" : undefined}>
        {gig.billable ? "⚠️ Cancelled (Billable)" : "Cancelled"}
      </Badge>
    );
    if (gig.status === 'completed') return <Badge bg="success">Completed</Badge>;
    return null;
  };

  return (
    <Container className="py-4">

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <h2 className="mb-0">Gig Registry</h2>
        <InputGroup style={{ maxWidth: '300px', width: '100%' }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control
            placeholder="Search name or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <div className="p-3 bg-light rounded mb-4 d-flex align-items-end date-filter-box">
        <Row className="g-2 align-items-end w-100">
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

      <div className="d-none d-md-block bg-white shadow-sm rounded overflow-hidden">
        <Table hover responsive className="mb-0">
          <thead className="bg-light">
            <tr>
              <th>Date &amp; Time</th>
              <th>Class Name</th>
              <th>Faculty</th>
              <th>Model</th>
              <th>Status</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedGigs.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4 text-muted">
                  No gigs found matching your search.
                </td>
              </tr>
            ) : (
              groupedGigs.map(group => {
                const first = group.gigs[0];
                return (
                  <tr key={group.key}>
                    <td className="align-middle">
                      {group.gigs.map(gig => (
                        <div key={gig.id} className="mb-1">
                          <div className="fw-bold">{new Date(gig.faculty_request?.starts_at).toLocaleDateString()}</div>
                          <div className="small text-muted">
                            {formatTime(gig.faculty_request?.starts_at)} &ndash; {formatTime(gig.faculty_request?.ends_at)}
                          </div>
                        </div>
                      ))}
                    </td>
                    <td className="align-middle">
                      {first.faculty_request?.class_name}
                      {group.gigs.length > 1 && (
                        <Badge bg="info" text="dark" className="ms-2" style={{ fontSize: '0.6em' }}>{group.gigs.length} dates</Badge>
                      )}
                      {first.faculty_request?.model_mode === 'nude' && (
                        <Badge bg="danger" className="ms-2" style={{ fontSize: '0.6em' }}>NUDE</Badge>
                      )}
                      {first.faculty_request?.department && (
                        <div><Badge bg="secondary" style={{ fontSize: '0.6em' }}>{first.faculty_request.department}</Badge></div>
                      )}
                    </td>
                    <td className="align-middle">
                      {first.faculty_request?.user?.first_name} {first.faculty_request?.user?.last_name}
                    </td>
                    <td className="align-middle">
                      {group.gigs.map(gig => (
                        <div key={gig.id} className="mb-1">
                          <Badge bg="success" text="light" className="p-2">
                            {gig.art_model_availability?.user?.first_name} {gig.art_model_availability?.user?.last_name}
                          </Badge>
                        </div>
                      ))}
                    </td>
                    <td className="align-middle">
                      {group.gigs.map(gig => (
                        <div key={gig.id} className="mb-1">{renderStatusBadge(gig)}</div>
                      ))}
                    </td>
                    <td className="align-middle text-end">
                      {group.gigs.map(gig => (
                        <div key={gig.id} className="mb-1">
                          {gig.status === 'confirmed' && (
                            <Button variant="outline-danger" size="sm" onClick={() => handleDelete(gig.id)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      <div className="d-md-none">
        {groupedGigs.length === 0 ? (
          <p className="text-center text-muted py-3">No gigs found matching your search.</p>
        ) : (
          groupedGigs.map(group => {
            const first = group.gigs[0];
            return (
              <div key={group.key} className="card mb-3 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="fw-bold">
                        {first.faculty_request?.class_name}
                        {group.gigs.length > 1 && (
                          <Badge bg="info" text="dark" className="ms-2" style={{ fontSize: '0.65em' }}>{group.gigs.length} dates</Badge>
                        )}
                      </div>
                      {first.faculty_request?.model_mode === 'nude' && (
                        <Badge bg="danger" style={{ fontSize: '0.65em' }}>NUDE</Badge>
                      )}
                      {first.faculty_request?.department && (
                        <Badge bg="secondary" className="ms-1" style={{ fontSize: '0.65em' }}>
                          {first.faculty_request.department}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="small text-muted mb-2">
                    <i className="bi bi-person me-1"></i>
                    Faculty: {first.faculty_request?.user?.first_name} {first.faculty_request?.user?.last_name}
                  </div>
                  {group.gigs.map(gig => (
                    <div key={gig.id} className="border-top pt-2 mt-2">
                      <div className="small text-muted mb-1">
                        <i className="bi bi-calendar3 me-1"></i>
                        {new Date(gig.faculty_request?.starts_at).toLocaleDateString()} &bull; {formatTime(gig.faculty_request?.starts_at)} &ndash; {formatTime(gig.faculty_request?.ends_at)}
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <Badge bg="success" text="light" className="p-1">
                          {gig.art_model_availability?.user?.first_name} {gig.art_model_availability?.user?.last_name}
                        </Badge>
                        {renderStatusBadge(gig)}
                      </div>
                      {gig.status === 'confirmed' && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="w-100 mt-1"
                          onClick={() => handleDelete(gig.id)}
                        >
                          Cancel Gig
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

    </Container>
  );
}

export default AllGigs;