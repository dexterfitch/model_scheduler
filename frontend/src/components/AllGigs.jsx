import React, { useState, useEffect, useCallback } from "react";
import { Table, Container, Badge, Button, Form, InputGroup, Row, Col } from "react-bootstrap";
import api from "../services/api";
import { formatTime, formatDateWithWeekday, formatDateShort } from "../utils/time";
import { isPaid, payStatusLabel } from "../utils/pay";
import CorrectRecordModal from "./CorrectRecordModal";

const personName = (person) => [person?.first_name, person?.last_name].filter(Boolean).join(' ');

// Words first, colour second, so the status reads the same for everyone
const statusLabel = (gig) => payStatusLabel(gig);
const statusColor = (gig) => {
  if (gig.no_show) return 'danger';
  if (gig.status === 'cancelled') return isPaid(gig) ? 'warning' : 'secondary';
  return isPaid(gig) ? 'primary' : 'dark';
};
const StatusBadge = ({ gig }) => <Badge bg={statusColor(gig)}>{statusLabel(gig)}</Badge>;

const ClassBadges = ({ request, className = '' }) => (
  <span className={`d-inline-flex flex-wrap gap-1 ${className}`}>
    {request?.model_mode === 'nude' && <Badge bg="danger">NUDE</Badge>}
    {request?.department && <Badge bg="secondary">{request.department}</Badge>}
  </span>
);

function AllGigs() {
  const [gigs, setGigs] = useState([]);
  const [search, setSearch] = useState("");
  const today = new Date();
  const [filterStart, setFilterStart] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA')
  );
  const [filterEnd, setFilterEnd] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('en-CA')
  );
  // Which dates to show: 'all' (the default), 'upcoming', 'past', or a date 'range'
  const [when, setWhen] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  // The past gig whose record is being corrected
  const [correcting, setCorrecting] = useState(null);

  const fetchGigs = useCallback(() => {
    api.get("/gigs")
      .then(res => {
        const sorted = res.data.sort((a, b) =>
          new Date(a.faculty_request.starts_at) - new Date(b.faculty_request.starts_at)
        );
        setGigs(sorted);
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    fetchGigs();
  }, [fetchGigs]);

  const filteredGigs = gigs.filter(gig => {
    const term = search.trim().toLowerCase();
    const modelName = personName(gig.art_model_availability?.user).toLowerCase();
    const facultyName = personName(gig.faculty_request?.user).toLowerCase();
    const className = (gig.faculty_request?.class_name || '').toLowerCase();
    const matchesSearch = modelName.includes(term) || facultyName.includes(term) || className.includes(term);

    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && gig.status !== statusFilter) return false;
    if (when === 'all') return true;

    // Upcoming: hasn't finished yet. Past: has finished.
    const now = new Date();
    if (when === 'upcoming') return new Date(gig.faculty_request.ends_at) >= now;
    if (when === 'past') return new Date(gig.faculty_request.ends_at) < now;
    const gigDate = new Date(gig.faculty_request.starts_at);
    return gigDate >= new Date(filterStart + "T00:00:00") && gigDate <= new Date(filterEnd + "T23:59:59");
  });

  // Phones show one card per class, with that class's gigs listed inside
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

  // Once a class has started, the only change left is correcting its record
  const hasStarted = (gig) => new Date(gig.faculty_request?.starts_at) <= new Date();
  const renderCorrect = (gig) => hasStarted(gig) && (
    <button
      type="button"
      className="btn btn-link p-0 ms-2 align-baseline small"
      aria-label={`Make Correction for ${personName(gig.art_model_availability?.user)} on ${formatDateShort(gig.faculty_request?.starts_at)}`}
      onClick={() => setCorrecting(gig)}
    >
      Make Correction
    </button>
  );

  const gigTime = (gig) => `${formatTime(gig.faculty_request?.starts_at)} – ${formatTime(gig.faculty_request?.ends_at)}`;

  return (
    <Container className="py-4">

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <h2 className="mb-0">Gig Registry</h2>
        <InputGroup style={{ maxWidth: '300px', width: '100%' }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control
            placeholder="Search name or class..."
            aria-label="Search name or class"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      {/* Two kinds of filter, laid out like Requests: what state a gig is in
          (left), and which dates to show (right, or under a line on phones) */}
      <div className="py-3 border-bottom border-info mb-4 date-filter-box">
        <div className="d-flex flex-column flex-md-row flex-md-wrap justify-content-md-between align-items-md-start gap-3">
          <div role="group" aria-labelledby="gigs-status-label">
            <div id="gigs-status-label" className="filter-group-label">Status</div>
            <div className="d-flex flex-wrap gap-2">
              {[['all', 'All', 'dark'], ['confirmed', 'Confirmed', 'primary'], ['cancelled', 'Cancelled', 'secondary']].map(([key, label, color]) => (
                <Button
                  key={key}
                  className="status-filter-btn"
                  variant={statusFilter === key ? color : `outline-${color}`}
                  aria-pressed={statusFilter === key}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby="gigs-dates-label" className="filter-dates">
            <div id="gigs-dates-label" className="filter-group-label">Dates</div>
            <div className="d-flex flex-wrap gap-2">
              {[['all', 'All Dates'], ['upcoming', 'Upcoming'], ['past', 'Past'], ['range', 'Date Range']].map(([key, label]) => (
                <Button
                  key={key}
                  className="status-filter-btn"
                  variant={when === key ? 'secondary' : 'outline-secondary'}
                  aria-pressed={when === key}
                  onClick={() => setWhen(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {when === 'range' && (
              <Row className="g-2 mt-1">
                <Form.Group as={Col} xs={6} controlId="gigs-from">
                  <Form.Label className="small fw-bold mb-1">From</Form.Label>
                  <Form.Control type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
                </Form.Group>
                <Form.Group as={Col} xs={6} controlId="gigs-to">
                  <Form.Label className="small fw-bold mb-1">To</Form.Label>
                  <Form.Control type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
                </Form.Group>
              </Row>
            )}
          </div>
        </div>
      </div>

      {/* Wider screens: one row per gig */}
      <div className="d-none d-md-block bg-white shadow-sm rounded overflow-hidden">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="bg-light">
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Class</th>
              <th>Faculty</th>
              <th>Model</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredGigs.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4 text-muted">
                  No gigs found matching your search.
                </td>
              </tr>
            ) : (
              filteredGigs.map(gig => (
                <tr key={gig.id}>
                  <td className="text-nowrap">{formatDateWithWeekday(gig.faculty_request?.starts_at)}</td>
                  <td className="text-nowrap">{gigTime(gig)}</td>
                  <td>
                    {gig.faculty_request?.class_name}
                    <ClassBadges request={gig.faculty_request} className="ms-2" />
                  </td>
                  <td>{personName(gig.faculty_request?.user)}</td>
                  <td>{personName(gig.art_model_availability?.user)}</td>
                  <td><StatusBadge gig={gig} />{renderCorrect(gig)}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Phones: one card per class */}
      <div className="d-md-none">
        {groupedGigs.length === 0 ? (
          <p className="text-center text-muted py-3">No gigs found matching your search.</p>
        ) : (
          groupedGigs.map(group => {
            const first = group.gigs[0];
            return (
              <div key={group.key} className="card mb-3 shadow-sm">
                <div className="card-body">
                  <div className="fw-bold">{first.faculty_request?.class_name}</div>
                  <ClassBadges request={first.faculty_request} className="mb-2" />
                  <div className="small text-muted mb-2">
                    <i className="bi bi-person me-1" aria-hidden="true"></i>
                    Faculty: {personName(first.faculty_request?.user)}
                  </div>
                  {group.gigs.map(gig => (
                    <div key={gig.id} className="d-flex justify-content-between align-items-start gap-2 py-2 border-top">
                      <div className="small">
                        <div className="fw-bold">{formatDateWithWeekday(gig.faculty_request?.starts_at)}</div>
                        <div className="text-muted">{gigTime(gig)}</div>
                        <div>{personName(gig.art_model_availability?.user)}</div>
                      </div>
                      <div className="text-end">
                        <StatusBadge gig={gig} />
                        {hasStarted(gig) && <div>{renderCorrect(gig)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {correcting && (
        <CorrectRecordModal
          gig={correcting}
          date={correcting.faculty_request}
          series={correcting.faculty_request}
          onClose={() => setCorrecting(null)}
          onSaved={() => {
            setCorrecting(null);
            fetchGigs();
          }}
        />
      )}
    </Container>
  );
}

export default AllGigs;
