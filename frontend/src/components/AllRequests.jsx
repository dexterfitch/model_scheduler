import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Badge, Form, InputGroup, Button, Row, Col, Modal, Alert, Dropdown } from "react-bootstrap";
import api from "../services/api";
import styles from "./AllRequests.module.css";
import { useDialog } from "./DialogProvider";
import { formatModelCount, extractErrorMessages, formatPreferenceSummary } from "../utils/formatters";
import { roundToNearest5, formatTime, formatDateShort, firstStartsAt } from "../utils/time";
import { DEPARTMENTS, BUILDINGS, MAX_MODELS_PER_REQUEST } from "../utils/constants";

function AllRequests() {
  const navigate = useNavigate();
  const { confirm, notify } = useDialog();
  const sameDayNote = "Releases on the day of a class are still paid.";
  const [allSeries, setAllSeries] = useState([]);
  const [search, setSearch] = useState("");
  const today = new Date();
  const [filterStart, setFilterStart] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA')
  );
  const [filterEnd, setFilterEnd] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('en-CA')
  );
  // Which dates to show: 'upcoming' (the default), 'past', or a date 'range'
  const [when, setWhen] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState('all');

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
        const dates = s.faculty_requests || [];
        const now = new Date();
        // Upcoming: a date hasn't finished yet. Past: every date has finished.
        if (when === 'upcoming') return dates.some(r => new Date(r.ends_at) >= now);
        if (when === 'past') return dates.length > 0 && dates.every(r => new Date(r.ends_at) < now);
        const from = new Date(filterStart + "T00:00:00");
        const to = new Date(filterEnd + "T23:59:59");
        return dates.some(r => new Date(r.starts_at) >= from && new Date(r.starts_at) <= to);
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
      // Past classes show the most recent first
      .sort((a, b) => when === 'past' ? firstStartsAt(b) - firstStartsAt(a) : firstStartsAt(a) - firstStartsAt(b));
  };

  const pending = filterSeries('pending');
  const matched = filterSeries('matched');
  const archived = filterSeries('archived').reverse();

  const [editingSeries, setEditingSeries] = useState(null);
  const [seriesForm, setSeriesForm] = useState({
    class_name: '', department: '', building: '', room_number: '', notes: '', models_needed: 1, dates: []
  });
  const [editError, setEditError] = useState('');

  const handleReleaseRemaining = async (seriesId) => {
    const confirmed = await confirm({
      title: 'Release models and rematch?',
      message: `Every booked model on this class's remaining dates is released, and those dates go back to pending so you can book someone new. ${sameDayNote}`,
      confirmLabel: 'Release and Rematch',
      cancelLabel: 'Keep Bookings',
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.post(`/request_series/${seriesId}/release_remaining`);
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      notify({ title: "Couldn't release the models", message: extractErrorMessages(err, 'Please try again.') });
    }
  };

  const handleCancelSeries = async (seriesId, isSingle) => {
    const confirmed = await confirm({
      title: 'Cancel this class?',
      message: isSingle
        ? `The date is cancelled and any booked model released. ${sameDayNote}`
        : `All of its dates are cancelled and any booked models released. ${sameDayNote}`,
      confirmLabel: 'Cancel Class',
      cancelLabel: 'Keep Class',
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.delete(`/request_series/${seriesId}`);
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      notify({ title: "Couldn't cancel this class", message: extractErrorMessages(err, 'Please try again.') });
    }
  };

  const handleFindNewModel = async (gig) => {
    const modelName = `${gig.art_model_availability?.user?.first_name} ${gig.art_model_availability?.user?.last_name}`;
    const confirmed = await confirm({
      title: `Release ${modelName} from this date?`,
      message: `Their spot opens up so you can book someone else, and their availability stays as it is. ${sameDayNote}`,
      confirmLabel: 'Release Model',
      cancelLabel: 'Keep Booking',
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.delete(`/gigs/${gig.id}`);
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      notify({ title: "Couldn't release the model", message: extractErrorMessages(err, 'Please try again.') });
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
      models_needed: s.models_needed || 1,
      dates: activeRequests.map(r => {
        const startDate = new Date(r.starts_at);
        const endDate = new Date(r.ends_at);
        return {
          id: r.id,
          status: r.status,
          booked: r.confirmed_gigs?.length || 0,
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
          notes: seriesForm.notes,
          models_needed: seriesForm.models_needed
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
              pref_body_type: editingSeries.pref_body_type,
              pref_genitalia: editingSeries.pref_genitalia,
              models_needed: seriesForm.models_needed,
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
      setEditError(extractErrorMessages(err, "Failed to save changes."));
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
    const isMatched = d.status === 'matched' || d.booked > 0;
    const confirmed = await confirm({
      title: 'Remove this date?',
      message: isMatched
        ? `The date is removed from the class and the booked model released. ${sameDayNote} This can't be undone.`
        : "The date is removed from the class. This can't be undone.",
      confirmLabel: 'Remove Date',
      cancelLabel: 'Keep Date',
      danger: true
    });
    if (!confirmed) return;

    try {
      await api.delete(`/faculty_requests/${d.id}`);
      setSeriesForm(prev => ({
        ...prev,
        dates: prev.dates.filter(date => date.id !== d.id)
      }));
      api.get("/request_series").then(res => setAllSeries(res.data));
    } catch (err) {
      notify({ title: "Couldn't remove this date", message: extractErrorMessages(err, 'Please try again.') });
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
    const bookedCount = allRequests
      .filter(r => r.status !== 'archived')
      .reduce((sum, r) => sum + (r.confirmed_gigs?.length || 0), 0);

    return { allRequests, displayRequests, matchedCount, pendingCount, archivedCount, bookedCount };
  };

  const renderPreferenceSummary = (s, separator) => {
    const parts = [];
    if ((s.models_needed || 1) > 1) parts.push(<strong key="count">{formatModelCount(s.models_needed)}</strong>);
    if (s.model_slots?.length > 0) {
      // Faculty set preferences for each model separately
      s.model_slots.forEach(slot => parts.push(`Model ${slot.position}: ${formatPreferenceSummary(slot, s.model_mode, { onlySet: true })}`));
    } else {
      parts.push(formatPreferenceSummary(s, s.model_mode, { onlySet: true }));
    }
    return parts.map((p, i) => (
      <React.Fragment key={i}>{i > 0 && separator}{p}</React.Fragment>
    ));
  };

  const renderDateRow = (req, showBadge, isSingle) => (
    <div key={req.id} className="small text-muted mb-1">
      {showBadge && req.status === 'matched' && (
        <Badge bg="success" className={`me-2 ${styles.badge}`}>Matched</Badge>
      )}
      {showBadge && req.status === 'pending' && (
        <Badge bg="warning" text="dark" className={`me-2 ${styles.badge}`}>Pending</Badge>
      )}
      {showBadge && req.status === 'archived' && (
        <Badge bg="secondary" className={`me-2 ${styles.badge}`}>Cancelled</Badge>
      )}
      <i className="bi bi-calendar3 me-1"></i>
      {formatDateShort(req.starts_at)} &bull; {formatTime(req.starts_at)} &ndash; {formatTime(req.ends_at)}
      {(req.models_needed || 1) > 1 && req.status !== 'archived' && (
        <Badge bg="light" text="dark" className={`ms-2 border ${styles.badge}`}>
          {(req.confirmed_gigs || []).length}/{req.models_needed} models
        </Badge>
      )}
      {req.needs_attention && req.status !== 'archived' && (
        <Badge bg="danger" className={`ms-2 ${styles.badge}`}>
          Needs Attention: {req.dropped_out_model_name || 'a model'} dropped out
        </Badge>
      )}
      {req.status !== 'archived' && (req.confirmed_gigs || []).length > 0 && (
        <>
          {' ('}
          {req.confirmed_gigs.map((gig, i) => (
            <React.Fragment key={gig.id}>
              {i > 0 && ', '}
              {gig.art_model_availability?.user?.first_name} {gig.art_model_availability?.user?.last_name}
              {(!isSingle || (req.models_needed || 1) > 1) && (
                <button
                  type="button"
                  className="btn btn-link p-0 ms-1 align-baseline text-primary"
                  title="Release this model from only this date and find someone else"
                  aria-label={`Release ${gig.art_model_availability?.user?.first_name} ${gig.art_model_availability?.user?.last_name} from this date and find someone else`}
                  onClick={() => handleFindNewModel(gig)}
                >
                  <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
                </button>
              )}
            </React.Fragment>
          ))}
          {') '}
        </>
      )}
      {req.status === 'pending' && showBadge && (
        <>
          {' ('}
          <button
            type="button"
            className="btn btn-link p-0 align-baseline"
            onClick={() => navigate(`/gigs/new/${req.id}`)}
          >
            Find Model
          </button>
          {')'}
        </>
      )}
    </div>
  );

  const renderActionButtons = (s, showAction, matchedCount, bookedCount) => {
    const activeCount = s.faculty_requests?.filter(r => r.status !== 'archived').length || 0;
    const isSingle = activeCount <= 1;

    return (
      <div className="d-flex flex-column gap-1">
        {showAction && matchedCount === 0 && (
          <Button size="sm" variant="outline-primary" onClick={() => navigate(`/gigs/new/${s.id}?type=series`)}>
            {bookedCount > 0 ? "Find More Models" : "Find Model"}
          </Button>
        )}
        {bookedCount > 0 && (
          <Button size="sm" variant="outline-warning" onClick={() => handleReleaseRemaining(s.id)}>
            {(s.models_needed || 1) > 1 ? "Release Models and Rematch" : "Release Model and Rematch"}
          </Button>
        )}
        {s.status !== 'archived' && (
          <div className="d-flex gap-1">
            <Button size="sm" variant="outline-secondary" className="flex-fill" onClick={() => openEditSeriesModal(s)}>
              Edit Class
            </Button>
            <Button size="sm" variant="outline-danger" className="flex-fill" onClick={() => handleCancelSeries(s.id, isSingle)}>
              Cancel Class
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Phone cards: the main button, plus a More menu for everything else
  const renderCardActions = (s, showAction, matchedCount, bookedCount) => {
    const activeCount = s.faculty_requests?.filter(r => r.status !== 'archived').length || 0;
    const isSingle = activeCount <= 1;
    const showFind = showAction && matchedCount === 0;
    const showRelease = bookedCount > 0;
    const showEdit = s.status !== 'archived';
    if (!showFind && !showRelease && !showEdit) return null;

    return (
      <div className="d-flex gap-2">
        {showFind && (
          <Button size="sm" variant="outline-primary" className="flex-fill" onClick={() => navigate(`/gigs/new/${s.id}?type=series`)}>
            {bookedCount > 0 ? "Find More Models" : "Find Model"}
          </Button>
        )}
        {(showRelease || showEdit) && (
          <Dropdown align="end" className={showFind ? undefined : 'flex-fill'}>
            <Dropdown.Toggle size="sm" variant="outline-secondary" className={showFind ? undefined : 'w-100'} aria-label={`More actions for ${s.class_name}`}>
              More
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {showRelease && (
                <Dropdown.Item as="button" onClick={() => handleReleaseRemaining(s.id)}>
                  {(s.models_needed || 1) > 1 ? "Release Models and Rematch" : "Release Model and Rematch"}
                </Dropdown.Item>
              )}
              {showEdit && (
                <>
                  <Dropdown.Item as="button" onClick={() => openEditSeriesModal(s)}>Edit Class</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item as="button" className="text-danger" onClick={() => handleCancelSeries(s.id, isSingle)}>Cancel Class</Dropdown.Item>
                </>
              )}
            </Dropdown.Menu>
          </Dropdown>
        )}
      </div>
    );
  };

  const renderSeriesInfo = (s, showAction, allRequests) => {
    const activeCount = allRequests.filter(r => r.status !== 'archived').length;

    return (
      <>
        <div className="small text-muted mt-1">
          <span className="fst-italic">{s.department}</span>
          {s.department && activeCount > 1 && " · "}
           {activeCount > 1 && `${activeCount} dates`}
        </div>
        {(s.building || s.room_number) && (
          <div className="small text-muted mt-1">
            <i className="bi bi-door-open me-1"></i>
            {s.building}{s.building && s.room_number && " "}{s.room_number}
          </div>
        )}
      </>
    );
  };

  const renderSeriesCard = (s, showAction, showActionColumn = true) => {
    const { allRequests, displayRequests, matchedCount, pendingCount, bookedCount } = getSeriesMeta(s);
    const faculty = s.user;
    const isSingle = allRequests.filter(r => r.status !== 'archived').length <= 1;

    return (
      <div key={s.id} className="card mb-3 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="fw-bold">{s.class_name}</div>
              {renderSeriesInfo(s, showAction, allRequests)}
            </div>
            {s.model_mode === 'nude'
              ? <Badge bg="danger">Nude</Badge>
              : <Badge bg="success">Clothed</Badge>}
          </div>

          <div className="mb-2">
            {displayRequests.map(req => renderDateRow(req, matchedCount > 0 && pendingCount > 0, isSingle))}
          </div>

          <div className="small text-muted mb-1">
            Faculty: {faculty?.first_name} {faculty?.last_name}
          </div>
          <div className="small text-muted mb-2">
            {renderPreferenceSummary(s, ', ')}
          </div>
          {s.notes && (
            <div className="small text-muted fst-italic mb-2 border rounded p-2">
              <i className="bi bi-journal-text me-1"></i>{s.notes}
            </div>
          )}
          {showActionColumn && renderCardActions(s, showAction, matchedCount, bookedCount)}
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
              const { allRequests, displayRequests, matchedCount, pendingCount, bookedCount } = getSeriesMeta(s);
              const faculty = s.user;
              const isSingle = allRequests.filter(r => r.status !== 'archived').length <= 1;

              return (
                <tr key={s.id}>
                  <td>
                    {displayRequests.map(req => renderDateRow(req, matchedCount > 0 && pendingCount > 0, isSingle))}
                  </td>
                  <td>
                    <div className="fw-bold">{s.class_name}</div>
                    {renderSeriesInfo(s, showAction, allRequests)}
                  </td>
                  <td>{faculty?.first_name} {faculty?.last_name}</td>
                  <td>
                    {s.model_mode === 'nude'
                      ? <span className="text-danger fw-bold">Nude</span>
                      : <span className="text-success fw-bold">Clothed</span>}
                    <small className="text-muted d-block">
                      {renderPreferenceSummary(s, <br />)}
                    </small>
                    {s.notes && (
                      <small className="text-muted fst-italic d-block">
                        <i className="bi bi-journal-text me-1"></i>{s.notes}
                      </small>
                    )}
                  </td>
                  {showActionColumn && (
                    <td>
                      {renderActionButtons(s, showAction, matchedCount, bookedCount)}
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

      {/* Two kinds of filter: what state a class is in (left), and which dates to
          show (right on wider screens, under a dividing line on phones) */}
      <div className="py-3 border-bottom border-info mb-4 date-filter-box">
        <div className="d-flex flex-column flex-md-row flex-md-wrap justify-content-md-between align-items-md-start gap-3">
          <div role="group" aria-labelledby="requests-status-label">
            <div id="requests-status-label" className="filter-group-label">Status</div>
            <div className="d-flex flex-wrap gap-2">
              {[['all', 'All', 'dark'], ['pending', 'Pending', 'warning'], ['matched', 'Matched', 'success'], ['archived', 'Cancelled', 'secondary']].map(([key, label, color]) => (
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

          <div role="group" aria-labelledby="requests-dates-label" className="filter-dates">
            <div id="requests-dates-label" className="filter-group-label">Dates</div>
            <div className="d-flex flex-wrap gap-2">
              {[['upcoming', 'Upcoming'], ['past', 'Past'], ['range', 'Date Range']].map(([key, label]) => (
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
                <Form.Group as={Col} xs={6} controlId="requests-from">
                  <Form.Label className="small fw-bold mb-1">From</Form.Label>
                  <Form.Control type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
                </Form.Group>
                <Form.Group as={Col} xs={6} controlId="requests-to">
                  <Form.Label className="small fw-bold mb-1">To</Form.Label>
                  <Form.Control type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
                </Form.Group>
              </Row>
            )}
          </div>
        </div>
      </div>

      {(statusFilter === 'all' || statusFilter === 'pending') && (
        <div className="mb-4">
          <h5 className="fw-bold text-warning mb-2">Pending ({pending.length})</h5>
          {renderSection(pending, true)}
        </div>
      )}

      {(statusFilter === 'all' || statusFilter === 'matched') && (
        <div className="mb-4">
          <h5 className="fw-bold text-success mb-2">Matched ({matched.length})</h5>
          {renderSection(matched, false)}
        </div>
      )}

      {(statusFilter === 'all' || statusFilter === 'archived') && (
        <div className="mb-4">
          <h5 className="fw-bold text-secondary mb-2">Cancelled ({archived.length})</h5>
          {renderSection(archived, false, false)}
        </div>
      )}

      <Modal show={!!editingSeries} onHide={() => setEditingSeries(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Class</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {seriesForm.dates.some(d => d.status === 'matched' || d.booked > 0) && (
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
              <Form.Group className="mb-3" controlId="edit-class-name">
                <Form.Label>Class Name</Form.Label>
                <Form.Control
                  value={seriesForm.class_name}
                  onChange={e => setSeriesForm(prev => ({ ...prev, class_name: e.target.value }))}
                />
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group className="mb-3" controlId="edit-department">
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
              <Form.Group className="mb-3" controlId="edit-building">
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
              <Form.Group className="mb-3" controlId="edit-room">
                <Form.Label>Room Number</Form.Label>
                <Form.Control
                  value={seriesForm.room_number}
                  onChange={e => setSeriesForm(prev => ({ ...prev, room_number: e.target.value }))}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3" controlId="edit-notes">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={seriesForm.notes}
              onChange={e => setSeriesForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </Form.Group>

          <Form.Group className="mb-3" style={{ maxWidth: '220px' }} controlId="edit-models-needed">
            <Form.Label>Number of Models</Form.Label>
            <Form.Select
              value={seriesForm.models_needed}
              onChange={e => setSeriesForm(prev => ({ ...prev, models_needed: Number(e.target.value) }))}
            >
              {Array.from({ length: MAX_MODELS_PER_REQUEST }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Raising this reopens matched dates for more models.
            </Form.Text>
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
                  aria-label={`Date ${i + 1}`}
                  value={d.date}
                  onChange={e => updateSeriesDate(i, 'date', e.target.value)}
                />
              </Col>
              <Col xs={3} md={3}>
                <Form.Control
                  type="time"
                  aria-label={`Start time ${i + 1}`}
                  value={d.start}
                  onChange={e => updateSeriesDate(i, 'start', e.target.value)}
                  onBlur={e => updateSeriesDate(i, 'start', roundToNearest5(e.target.value))}
                />
              </Col>
              <Col xs={3} md={2}>
                <Form.Control
                  type="time"
                  aria-label={`End time ${i + 1}`}
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
                    aria-label={`Discard date ${i + 1}`}
                  >
                    <i className="bi bi-x-lg" aria-hidden="true"></i>
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-danger p-0"
                    onClick={() => handleRemoveExistingDate(d)}
                    title="Remove this date"
                    aria-label={`Remove date ${i + 1}`}
                  >
                    <i className="bi bi-trash" aria-hidden="true"></i>
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
