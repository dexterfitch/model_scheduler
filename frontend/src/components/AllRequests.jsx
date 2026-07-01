import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Badge, Form, InputGroup, Button, Row, Col, Modal, Alert } from "react-bootstrap";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";
import { roundToNearest5 } from "../utils/time";

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

  const [editingSeries, setEditingSeries] = useState(null);
  const [seriesForm, setSeriesForm] = useState({
    class_name: '', department: '', building: '', room_number: '', notes: '', dates: []
  });
  const [editError, setEditError] = useState('');

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateShort = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const DEPARTMENTS = ["Painting", "Drawing", "Illustration", "FYE", "Sculpture", "Open Studies"];
  const BUILDINGS = ["Main", "Fox", "Lazarus", "Station"];

  const handleReleaseRemaining = async (seriesId) => {
    if (!confirm("Release all remaining matched dates in this series back to pending? This will cancel those gigs and let you rematch the whole remaining series to a new model.")) return;
    try {
      await api.post(`/request_series/${seriesId}/release_remaining`);
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      alert("Failed to release remaining dates.");
    }
  };

  const handleCancelSeries = async (seriesId) => {
    if (!confirm("Cancel this entire request? All matched dates will be released and marked cancelled (billable if same-day), and any pending dates will be removed.")) return;
    try {
      await api.delete(`/request_series/${seriesId}`);
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      alert("Failed to cancel this series.");
    }
  };

  const handleFindNewModel = async (req) => {
    const modelName = `${req.gig?.art_model_availability?.user?.first_name} ${req.gig?.art_model_availability?.user?.last_name}`;
    if (!confirm(`Release ${modelName} from this date and reopen it for rematching? This date will move back to Pending.`)) return;
    try {
      await api.post(`/art_model_availabilities/${req.gig.art_model_availability.id}/cancel`, {
        cancel_remaining_series: false
      });
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      alert("Failed to release this date for rematching.");
    }
  };

  const openEditSeriesModal = (s) => {
    const activeRequests = (s.faculty_requests || [])
      .filter(r => r.status !== 'archived')
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const pad = (n) => String(n).padStart(2, '0');

    setSeriesForm({
      class_name: s.class_name || '',
      department: s.department || '',
      building: s.building || '',
      room_number: s.room_number || '',
      notes: s.notes || '',
      dates: activeRequests.map(r => {
        const startDate = new Date(r.starts_at);
        const endDate = new Date(r.ends_at);
        return {
          id: r.id,
          status: r.status,
          date: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
          start: `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`,
          end: `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
        };
      })
    });
    setEditError('');
    setEditingSeries(s);
  };

  const handleSaveSeriesEdit = async () => {
    setEditError('');
    try {
      await api.patch(`/request_series/${editingSeries.id}`, {
        request_series: {
          class_name: seriesForm.class_name,
          department: seriesForm.department,
          building: seriesForm.building,
          room_number: seriesForm.room_number,
          notes: seriesForm.notes
        }
      });

      for (const d of seriesForm.dates) {
        if (!d.date || !d.start || !d.end) continue;

        const starts_at = new Date(`${d.date}T${d.start}`);
        const ends_at = new Date(`${d.date}T${d.end}`);

        if (d.isNew) {
          await api.post(`/faculty_requests`, {
            faculty_request: {
              request_series_id: editingSeries.id,
              user_id: editingSeries.user.id,
              class_name: seriesForm.class_name,
              department: seriesForm.department,
              building: seriesForm.building,
              room_number: seriesForm.room_number,
              model_mode: editingSeries.model_mode,
              pref_skin_tone: editingSeries.pref_skin_tone,
              pref_gender: editingSeries.pref_gender,
              notes: seriesForm.notes,
              starts_at,
              ends_at
            }
          });
        } else {
          await api.patch(`/faculty_requests/${d.id}`, {
            faculty_request: { starts_at, ends_at }
          });
        }
      }

      setEditingSeries(null);
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      const messages = err.response?.data?.errors || [err.response?.data?.error] || ["Failed to save changes."];
      setEditError(Array.isArray(messages) ? messages.join(" ") : messages);
      api.get("/request_series").then(res => setAllSeries(res.data));
    }
  };

  const addSeriesDate = () => {
    setSeriesForm(prev => ({
      ...prev,
      dates: [...prev.dates, { id: `new-${Date.now()}`, status: 'pending', isNew: true, date: '', start: '', end: '' }]
    }));
  };

  const updateSeriesDate = (index, field, value) => {
    setSeriesForm(prev => ({
      ...prev,
      dates: prev.dates.map((d, i) => i === index ? { ...d, [field]: value } : d)
    }));
  };

  const removeNewSeriesDate = (tempId) => {
    setSeriesForm(prev => ({
      ...prev,
      dates: prev.dates.filter(d => d.id !== tempId)
    }));
  };

  const handleRemoveExistingDate = async (d) => {
    const isMatched = d.status === 'matched';
    const message = isMatched
      ? "Remove this matched date? The model will be released and the gig marked cancelled (billable if same-day). This cannot be undone."
      : "Remove this pending date? This cannot be undone.";
    if (!confirm(message)) return;

    try {
      await api.delete(`/faculty_requests/${d.id}`);
      setSeriesForm(prev => ({
        ...prev,
        dates: prev.dates.filter(date => date.id !== d.id)
      }));
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      alert("Failed to remove this date.");
    }
  };

  const getSeriesMeta = (s) => {
    const allRequests = s.faculty_requests || [];
    const displayRequests = (s.status === 'archived' ? allRequests : allRequests.filter(r => r.status !== 'archived'))
      .slice()
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const matchedCount = allRequests.filter(r => r.status === 'matched').length;
    const pendingCount = allRequests.filter(r => r.status === 'pending').length;
    const archivedCount = allRequests.filter(r => r.status === 'archived').length;

    return { allRequests, displayRequests, matchedCount, pendingCount, archivedCount };
  };

  const renderDateRow = (req, showBadge, isSingle) => (
    <div key={req.id} className="small text-muted mb-1">
      {showBadge && req.status === 'matched' && (
        <Badge bg="success" className="me-2" style={{ fontSize: '0.65em' }}>Matched</Badge>
      )}
      {showBadge && req.status === 'pending' && (
        <Badge bg="warning" text="dark" className="me-2" style={{ fontSize: '0.65em' }}>Pending</Badge>
      )}
      {showBadge && req.status === 'archived' && (
        <Badge bg="secondary" className="me-2" style={{ fontSize: '0.65em' }}>Cancelled</Badge>
      )}
      <i className="bi bi-calendar3 me-1"></i>
      {formatDateShort(req.starts_at)} &bull; {formatTime(req.starts_at)} &ndash; {formatTime(req.ends_at)}
      {req.status === 'matched' && req.gig?.art_model_availability?.user && (
        <>
          {' ('}
          {req.gig.art_model_availability.user.first_name} {req.gig.art_model_availability.user.last_name}
          {') '}
          {!isSingle && (
            <i
              role="button"
              className="bi bi-arrow-repeat text-primary ms-1"
              title="Find a different model for this date"
              onClick={() => handleFindNewModel(req)}
            ></i>
          )}
        </>
      )}
      {req.status === 'pending' && (
        <>
          {' ('}
          <span
            role="button"
            className="text-primary text-decoration-underline"
            onClick={() => navigate(`/gigs/new/${req.id}`)}
          >
            Find Match
          </span>
          {')'}
        </>
      )}
    </div>
  );

  const renderActionButtons = (s, showAction, matchedCount) => {
    const activeCount = s.faculty_requests?.filter(r => r.status !== 'archived').length || 0;
    const isSingle = activeCount <= 1;

    return (
      <>
        {showAction && matchedCount === 0 && (
          <Button size="sm" variant="outline-primary" onClick={() => navigate(`/gigs/new/${s.id}?type=series`)}>
            Find Match
          </Button>
        )}
        {matchedCount > 0 && (
          <Button size="sm" variant="outline-warning" onClick={() => handleReleaseRemaining(s.id)}>
            Release Model and Rematch
          </Button>
        )}
        {s.status !== 'archived' && (
          <Button size="sm" variant="outline-secondary" onClick={() => openEditSeriesModal(s)}>
            {isSingle ? "Edit Gig" : "Edit Series"}
          </Button>
        )}
        {s.status !== 'archived' && (
          <Button size="sm" variant="outline-danger" onClick={() => handleCancelSeries(s.id)}>
            {isSingle ? "Cancel Gig" : "Cancel Series"}
          </Button>
        )}
      </>
    );
  };

  const renderSeriesCard = (s, showAction, showActionColumn = true) => {
    const { allRequests, displayRequests, matchedCount, pendingCount, archivedCount } = getSeriesMeta(s);
    const faculty = s.user;
    const isSingle = allRequests.filter(r => r.status !== 'archived').length <= 1;

    return (
      <div key={s.id} className="card mb-3 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="fw-bold">{s.class_name}</div>
              <div className="d-flex gap-1 flex-wrap mt-1">
                {s.department && <Badge bg="secondary" style={{ fontSize: '0.7em' }}>{s.department}</Badge>}
                {allRequests.filter(r => r.status !== 'archived').length > 1 && (
                  <Badge bg="info" text="dark" style={{ fontSize: '0.7em' }}>
                    {allRequests.filter(r => r.status !== 'archived').length} dates
                  </Badge>
                )}
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
                </div>
              )}
            </div>
            {s.model_mode === 'nude'
              ? <Badge bg="danger">Nude</Badge>
              : <Badge bg="success">Clothed</Badge>}
          </div>

          <div className="mb-2">
            {displayRequests.map(req => renderDateRow(req, matchedCount > 0 && pendingCount > 0, isSingle))}
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
          {showActionColumn && (
            <div className="d-flex flex-column gap-2">
              {renderActionButtons(s, showAction, matchedCount)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDesktopTable = (seriesList, showAction, showActionColumn = true) => (
    <div className="d-none d-md-block">
      <Table hover responsive className="shadow-sm bg-white align-middle mb-0">
        <thead className="bg-light">
          <tr>
            <th>Date(s)</th>
            <th>Class / Dept</th>
            <th>Faculty</th>
            <th>Reqs</th>
            {showActionColumn && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {seriesList.length === 0 ? (
            <tr>
              <td colSpan={showActionColumn ? 5 : 4} className="text-center py-3 text-muted">None.</td>
            </tr>
          ) : (
            seriesList.map(s => {
              const { allRequests, displayRequests, matchedCount, pendingCount, archivedCount } = getSeriesMeta(s);
              const faculty = s.user;
              const isSingle = allRequests.filter(r => r.status !== 'archived').length <= 1;

              return (
                <tr key={s.id}>
                  <td>
                    {displayRequests.map(req => renderDateRow(req, matchedCount > 0 && pendingCount > 0, isSingle))}
                  </td>
                  <td>
                    <div className="fw-bold">{s.class_name}</div>
                    <div className="d-flex gap-1 flex-wrap mt-1">
                      {s.department && <Badge bg="secondary" style={{ fontSize: '0.7em' }}>{s.department}</Badge>}
                      {allRequests.filter(r => r.status !== 'archived').length > 1 && (
                        <Badge bg="info" text="dark" style={{ fontSize: '0.7em' }}>
                          {allRequests.filter(r => r.status !== 'archived').length} dates
                        </Badge>
                      )}
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
                  {showActionColumn && (
                    <td>
                      <div className="d-flex flex-column gap-2">
                        {renderActionButtons(s, showAction, matchedCount)}
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

  const renderSection = (seriesList, showAction, showActionColumn = true) => (
    <>
      {renderDesktopTable(seriesList, showAction, showActionColumn)}
      <div className="d-md-none">
        {seriesList.length === 0
          ? <p className="text-center text-muted py-3">None.</p>
          : seriesList.map(s => renderSeriesCard(s, showAction, showActionColumn))}
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

      <div className="p-3 border-bottom border-info mb-4 d-flex align-items-end date-filter-box">
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
        {renderSection(archived, false, false)}
      </div>

      <Modal show={!!editingSeries} onHide={() => setEditingSeries(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Series</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {seriesForm.dates.some(d => d.status === 'matched') && (
            <Alert variant="warning" className="small">
              <strong>⚠️ THIS SERIES INCLUDES CONFIRMED GIGS.</strong><br />
              Only edit confirmed modeling gigs by request, and only for unusual circumstances (campus closures, emergencies, etc.). Make sure both faculty and the model are aware of the change and they've agreed to any changes before saving. If a new time conflicts with another confirmed gig for that model, saving will be blocked.
            </Alert>
          )}
          {editError && (
            <Alert variant="danger" dismissible onClose={() => setEditError('')}>
              {editError}
            </Alert>
          )}

          <Row>
            <Col md={7}>
              <Form.Group className="mb-3">
                <Form.Label>Class Name</Form.Label>
                <Form.Control
                  value={seriesForm.class_name}
                  onChange={e => setSeriesForm(prev => ({ ...prev, class_name: e.target.value }))}
                />
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Select
                  value={seriesForm.department}
                  onChange={e => setSeriesForm(prev => ({ ...prev, department: e.target.value }))}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Building</Form.Label>
                <Form.Select
                  value={seriesForm.building}
                  onChange={e => setSeriesForm(prev => ({ ...prev, building: e.target.value }))}
                >
                  {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Room Number</Form.Label>
                <Form.Control
                  value={seriesForm.room_number}
                  onChange={e => setSeriesForm(prev => ({ ...prev, room_number: e.target.value }))}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={seriesForm.notes}
              onChange={e => setSeriesForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </Form.Group>

          <hr />
          <Form.Label className="fw-bold">Dates</Form.Label>
          {seriesForm.dates.map((d, i) => (
            <Row key={d.id} className="align-items-center mb-2 g-2">
              <Col xs={12} md={2}>
                {d.status === 'matched'
                  ? <Badge bg="success">Matched</Badge>
                  : <Badge bg="warning" text="dark">Pending</Badge>}
              </Col>
              <Col xs={6} md={4}>
                <Form.Control
                  type="date"
                  value={d.date}
                  onChange={e => updateSeriesDate(i, 'date', e.target.value)}
                />
              </Col>
              <Col xs={3} md={3}>
                <Form.Control
                  type="time"
                  value={d.start}
                  onChange={e => updateSeriesDate(i, 'start', e.target.value)}
                  onBlur={e => updateSeriesDate(i, 'start', roundToNearest5(e.target.value))}
                />
              </Col>
              <Col xs={3} md={2}>
                <Form.Control
                  type="time"
                  value={d.end}
                  onChange={e => updateSeriesDate(i, 'end', e.target.value)}
                  onBlur={e => updateSeriesDate(i, 'end', roundToNearest5(e.target.value))}
                />
              </Col>
              <Col xs={12} md={1}>
                {d.isNew ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-danger p-0"
                    onClick={() => removeNewSeriesDate(d.id)}
                    title="Discard this unsaved date"
                  >
                    <i className="bi bi-x-lg"></i>
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-danger p-0"
                    onClick={() => handleRemoveExistingDate(d)}
                    title="Remove this date"
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                )}
              </Col>
            </Row>
          ))}
          <Button variant="outline-primary" size="sm" className="mt-2" onClick={addSeriesDate}>
            <i className="bi bi-plus-lg me-1"></i>Add Date
          </Button>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEditingSeries(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveSeriesEdit}>Save Changes</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default AllRequests;