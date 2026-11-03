/**
 * The admin Requests page: classes with a date in the last year (or every class, on
 * request), grouped as pending, matched and cancelled, filterable by status and dates
 * and searchable by class, faculty or department.
 * Shows who could take each pending date, offers ready emails to models, and lets
 * admins edit, cancel, release and rebook (with an optional reason, kept in History),
 * or correct the record of past dates.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Badge, Form, InputGroup, Button, Row, Col, Modal, Alert, Dropdown } from "react-bootstrap";
import api from "../services/api";
import styles from "./AllRequests.module.css";
import { useDialog } from "./DialogProvider";
import { formatModelCount, extractErrorMessages, formatPreferenceSummary } from "../utils/formatters";
import { roundToNearest5, formatTime, formatDateShort, firstStartsAt, formatTimeForInput, newClassTimes, endAfterStart, oneYearAgo } from "../utils/time";
import { DEPARTMENTS, BUILDINGS, MAX_MODELS_PER_REQUEST } from "../utils/constants";
import { payStatusLabel, wasCorrected } from "../utils/pay";
import CorrectRecordModal from "./CorrectRecordModal";
import { dateCoverage, notifyLists, notifyEmailLink } from "../utils/coverage";
import { useRevealMessage } from '../utils/revealMessage';

const REASON_LABEL = 'Reason (optional, kept in History)';

/** The Requests page. */
function AllRequests() {
  const navigate = useNavigate();
  const { confirm, notify } = useDialog();
  const sameDayNote = "Releases on the day of a class are still paid.";
  const [allSeries, setAllSeries] = useState([]);
  const [correcting, setCorrecting] = useState(null);
  const [search, setSearch] = useState("");
  const today = new Date();
  const [filterStart, setFilterStart] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA')
  );
  const [filterEnd, setFilterEnd] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('en-CA')
  );
  const [when, setWhen] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showOlder, setShowOlder] = useState(false);

  /**
   * Loads the classes with a date in the last year, or every class once older ones
   * have been asked for.
   */
  const reloadSeries = useCallback(() => {
    api.get("/request_series", { params: showOlder ? {} : { since: oneYearAgo() } })
      .then(res => setAllSeries(res.data))
      .catch(() => {});
  }, [showOlder]);

  useEffect(() => {
    reloadSeries();
  }, [reloadSeries]);

  const [pool, setPool] = useState(null);
  useEffect(() => {
    Promise.all([api.get("/users"), api.get("/art_model_availabilities"), api.get("/gigs")])
      .then(([users, availabilities, gigs]) => setPool({ models: users.data, availabilities: availabilities.data, gigs: gigs.data }))
      .catch(() => setPool(null));
  }, []);

  /**
   * Classes in one status group, after the date filter and search, in date order (most recent first
   * for Past).
   */
  const filterSeries = (statusFilter) => {
    const term = search.trim().toLowerCase();
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
        if (when === 'upcoming') return dates.some(r => new Date(r.ends_at) >= now);
        if (when === 'past') return dates.length > 0 && dates.every(r => new Date(r.ends_at) < now);
        const from = new Date(filterStart + "T00:00:00");
        const to = new Date(filterEnd + "T23:59:59");
        return dates.some(r => new Date(r.starts_at) >= from && new Date(r.starts_at) <= to);
      })
      .filter(s => {
        const className = s.class_name?.toLowerCase() || "";
        const department = s.department?.toLowerCase() || "";
        const faculty = s.user || s.faculty_requests?.[0]?.user;
        const firstName = faculty?.first_name?.toLowerCase() || "";
        const lastName = faculty?.last_name?.toLowerCase() || "";
        const fullName = `${firstName} ${lastName}`;
        return className.includes(term) || department.includes(term) ||
          firstName.includes(term) || lastName.includes(term) || fullName.includes(term);
      })
      .sort((a, b) => when === 'past' ? firstStartsAt(b) - firstStartsAt(a) : firstStartsAt(a) - firstStartsAt(b));
  };

  const pending = filterSeries('pending');
  const matched = filterSeries('matched');
  const archived = filterSeries('archived').reverse();

  const [editingSeries, setEditingSeries] = useState(null);
  const [seriesForm, setSeriesForm] = useState({
    class_name: '', department: '', building: '', room_number: '', notes: '', models_needed: 1, reason: '', dates: []
  });
  const [editError, setEditError] = useState('');
  const editErrorRef = useRevealMessage(editError);

  /** Releases every booked model from the class's remaining dates, after confirming. */
  const handleReleaseRemaining = async (seriesId) => {
    const confirmed = await confirm({
      title: 'Release models and rematch?',
      message: `Every booked model on this class's remaining dates is released, and those dates go back to pending so you can book someone new. ${sameDayNote}`,
      confirmLabel: 'Release and Rematch',
      cancelLabel: 'Keep Bookings',
      noteLabel: REASON_LABEL,
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.post(`/request_series/${seriesId}/release_remaining`, { note: confirmed.note ?? '' });
      reloadSeries();
    } catch (err) {
      notify({ title: "Couldn't release the models", message: extractErrorMessages(err, 'Please try again.') });
    }
  };

  /** Cancels the class's remaining dates, after confirming. */
  const handleCancelSeries = async (seriesId, isSingle) => {
    const confirmed = await confirm({
      title: 'Cancel this class?',
      message: isSingle
        ? `The date is cancelled and any booked model released. ${sameDayNote}`
        : `All of its dates are cancelled and any booked models released. ${sameDayNote}`,
      confirmLabel: 'Cancel Class',
      cancelLabel: 'Keep Class',
      noteLabel: REASON_LABEL,
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.delete(`/request_series/${seriesId}`, { data: { note: confirmed.note ?? '' } });
      reloadSeries();
    } catch (err) {
      notify({ title: "Couldn't cancel this class", message: extractErrorMessages(err, 'Please try again.') });
    }
  };

  /** Releases one model from one date so someone else can be booked, after confirming. */
  const handleFindNewModel = async (gig) => {
    const modelName = `${gig.art_model_availability?.user?.first_name} ${gig.art_model_availability?.user?.last_name}`;
    const confirmed = await confirm({
      title: `Release ${modelName} from this date?`,
      message: `Their spot opens up so you can book someone else, and their availability stays as it is. ${sameDayNote}`,
      confirmLabel: 'Release Model',
      cancelLabel: 'Keep Booking',
      noteLabel: REASON_LABEL,
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.delete(`/gigs/${gig.id}`, { data: { note: confirmed.note ?? '' } });
      reloadSeries();
    } catch (err) {
      notify({ title: "Couldn't release the model", message: extractErrorMessages(err, 'Please try again.') });
    }
  };

  /** Opens Edit Class with the class's details and its remaining dates. */
  const openEditSeriesModal = (s) => {
    const activeRequests = (s.faculty_requests || [])
      .filter(r => r.status !== 'archived')
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    /** Two-digit number for dates. */
    const pad = (n) => String(n).padStart(2, '0');

    setSeriesForm({
      class_name: s.class_name || '',
      department: s.department || '',
      building: s.building || '',
      room_number: s.room_number || '',
      notes: s.notes || '',
      models_needed: s.models_needed || 1,
      reason: '',
      dates: activeRequests.map(r => {
        const startDate = new Date(r.starts_at);
        const endDate = new Date(r.ends_at);
        return {
          id: r.id,
          status: r.status,
          booked: r.confirmed_gigs?.length || 0,
          date: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
          start: formatTimeForInput(startDate),
          end: formatTimeForInput(endDate)
        };
      })
    });
    setEditError('');
    setEditingSeries(s);
  };

  /** Saves Edit Class: the class details, changed dates and new dates. */
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
        },
        note: seriesForm.reason
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
            },
            note: seriesForm.reason
          });
        } else {
          await api.patch(`/faculty_requests/${d.id}`, {
            faculty_request: { starts_at, ends_at },
            note: seriesForm.reason
          });
        }
      }

      setEditingSeries(null);
      reloadSeries();
    } catch (err) {
      setEditError(extractErrorMessages(err, "Failed to save changes."));
      reloadSeries();
    }
  };

  /** Adds a new date row to Edit Class, starting 9 to 11 AM. */
  const addSeriesDate = () => {
    setSeriesForm(prev => ({
      ...prev,
      dates: [...prev.dates, { id: `new-${Date.now()}`, status: 'pending', isNew: true, date: '', ...newClassTimes() }]
    }));
  };

  /** Changes a date row in Edit Class; the end time follows the start. */
  const updateSeriesDate = (index, field, value) => {
    setSeriesForm(prev => ({
      ...prev,
      dates: prev.dates.map((d, i) => i !== index ? d
        : field === 'start' ? { ...d, start: value, end: endAfterStart(d.start, d.end, value) }
        : { ...d, [field]: value })
    }));
  };

  /** Removes a date row that hasn't been saved yet. */
  const removeNewSeriesDate = (tempId) => {
    setSeriesForm(prev => ({
      ...prev,
      dates: prev.dates.filter(d => d.id !== tempId)
    }));
  };

  /** Cancels a saved date from Edit Class, after confirming. */
  const handleRemoveExistingDate = async (d) => {
    const isMatched = d.status === 'matched' || d.booked > 0;
    const confirmed = await confirm({
      title: 'Remove this date?',
      message: isMatched
        ? `The date is removed from the class and the booked model released. ${sameDayNote} This can't be undone.`
        : "The date is removed from the class. This can't be undone.",
      confirmLabel: 'Remove Date',
      cancelLabel: 'Keep Date',
      noteLabel: REASON_LABEL,
      danger: true
    });
    if (!confirmed) return;

    try {
      await api.delete(`/faculty_requests/${d.id}`, { data: { note: confirmed.note ?? '' } });
      setSeriesForm(prev => ({
        ...prev,
        dates: prev.dates.filter(date => date.id !== d.id)
      }));
      reloadSeries();
    } catch (err) {
      notify({ title: "Couldn't remove this date", message: extractErrorMessages(err, 'Please try again.') });
    }
  };

  /** Whether a date has finished. */
  const hasEnded = (req) => new Date(req.ends_at) < new Date();
  /** Whether a date has started; from then on its record can only be corrected. */
  const hasStarted = (req) => new Date(req.starts_at) <= new Date();
  /** Whether every remaining date of a class has finished. */
  const isFinished = (s) => {
    const live = (s.faculty_requests || []).filter(r => r.status !== 'archived');
    return live.length > 0 && live.every(hasEnded);
  };

  /** A class's dates to show and its counts of matched, pending, cancelled and bookable dates. */
  const getSeriesMeta = (s) => {
    const allRequests = s.faculty_requests || [];
    const displayRequests = (s.status === 'archived' ? allRequests : allRequests.filter(r => r.status !== 'archived'))
      .slice()
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const matchedCount = allRequests.filter(r => r.status === 'matched').length;
    const pendingCount = allRequests.filter(r => r.status === 'pending').length;
    const archivedCount = allRequests.filter(r => r.status === 'archived').length;
    const bookedCount = allRequests
      .filter(r => r.status !== 'archived' && !hasStarted(r))
      .reduce((sum, r) => sum + (r.confirmed_gigs?.length || 0), 0);

    return { allRequests, displayRequests, matchedCount, pendingCount, archivedCount, bookedCount };
  };

  /** The class's model preferences in words, one line per model when they differ. */
  const renderPreferenceSummary = (s, separator) => {
    const parts = [];
    if ((s.models_needed || 1) > 1) parts.push(<strong key="count">{formatModelCount(s.models_needed)}</strong>);
    if (s.model_slots?.length > 0) {
      s.model_slots.forEach(slot => parts.push(`Model ${slot.position}: ${formatPreferenceSummary(slot, s.model_mode, { onlySet: true })}`));
    } else {
      parts.push(formatPreferenceSummary(s, s.model_mode, { onlySet: true }));
    }
    return parts.map((p, i) => (
      <React.Fragment key={i}>{i > 0 && separator}{p}</React.Fragment>
    ));
  };

  /**
   * The tag saying who could take a pending date: no models free, none matching, or how many match.
   */
  const renderCoverage = (req, s) => {
    if (!pool || !s) return null;
    const { free, matching } = dateCoverage(req, s, pool);
    if (free.length === 0) return <Badge bg="danger" className={`ms-2 ${styles.badge}`}>No models free</Badge>;
    if (matching.length === 0) {
      return <Badge bg="warning" text="dark" className={`ms-2 ${styles.badge}`}>No matching models free · {free.length} free</Badge>;
    }
    return <Badge bg="light" text="dark" className={`ms-2 border ${styles.badge}`}>{matching.length} matching free</Badge>;
  };

  /** The class's dates that still need a model and haven't started. */
  const openDates = (s) => (s.faculty_requests || [])
    .filter(r => r.status === 'pending' && !hasStarted(r))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  /** Open dates where no matching model is free. */
  const uncoveredDates = (s) => pool
    ? openDates(s).filter(d => dateCoverage(d, s, pool).matching.length === 0)
    : [];

  /**
   * The Notify Models choices: a ready email to the models who match, or to every model willing to
   * pose that way.
   */
  const renderNotifyItems = (s) => {
    const { matching, all } = notifyLists(s, pool.models);
    const dates = uncoveredDates(s);
    const everyone = s.model_mode === 'nude' ? 'All models willing to pose nude' : 'All models';
    /** One email choice, or a plain line when nobody is on its list. */
    const item = (label, people) => people.length === 0
      ? <Dropdown.ItemText key={label} className="text-muted">{label} (0)</Dropdown.ItemText>
      : (
        <Dropdown.Item key={label} href={notifyEmailLink(s, dates, people, window.location.origin)}>
          {label} ({people.length})
        </Dropdown.Item>
      );
    return [item('Models who match', matching), item(everyone, all)];
  };
  /** Whether a class has a date worth emailing models about. */
  const canNotify = (s) => uncoveredDates(s).length > 0;

  /**
   * Everyone on the record of a date that started, how they're paid, and a Make Correction link for
   * each.
   */
  const renderPastGigs = (req, s) => {
    const onRecord = req.gigs ?? req.confirmed_gigs ?? [];
    if (onRecord.length === 0) return <div className="ms-3">No model was booked.</div>;
    return (
      <ul className="list-unstyled ms-3 mb-0">
        {onRecord.map(gig => {
          const name = [gig.art_model_availability?.user?.first_name, gig.art_model_availability?.user?.last_name].filter(Boolean).join(' ');
          return (
            <li key={gig.id}>
              {name} &middot; {payStatusLabel(gig)}
              {gig.worked_starts_at && ` · worked ${formatTime(gig.worked_starts_at)} – ${formatTime(gig.worked_ends_at)}`}
              {wasCorrected(gig) && ' · corrected'}
              <button
                type="button"
                className="btn btn-link p-0 ms-2 align-baseline"
                aria-label={`Make Correction for ${name} on ${formatDateShort(req.starts_at)}`}
                onClick={() => setCorrecting({ gig, date: req, series: s })}
              >
                Make Correction
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  /** One date of a class: status, time, booked models or record, tags and links. */
  const renderDateRow = (req, showBadge, isSingle, s) => (
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
      {hasEnded(req) && req.status !== 'archived' && (
        <Badge bg="secondary" className={`me-2 ${styles.badge}`}>Past</Badge>
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
      {req.status !== 'archived' && hasStarted(req) && renderPastGigs(req, s)}
      {req.status !== 'archived' && !hasStarted(req) && (req.confirmed_gigs || []).length > 0 && (
        req.confirmed_gigs.map(gig => (
          <div key={gig.id} className="ms-3 mt-1 d-flex flex-wrap align-items-baseline column-gap-2">
            <span className="text-nowrap">
              <i className="bi bi-person me-1" aria-hidden="true"></i>
              {gig.art_model_availability?.user?.first_name} {gig.art_model_availability?.user?.last_name}
            </span>
            {(!isSingle || (req.models_needed || 1) > 1) && !hasEnded(req) && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 align-baseline"
                title="Release this model from only this date and find someone else"
                aria-label={`Release ${gig.art_model_availability?.user?.first_name} ${gig.art_model_availability?.user?.last_name} from this date and find someone else`}
                onClick={() => handleFindNewModel(gig)}
              >
                Release
              </button>
            )}
          </div>
        ))
      )}
      {req.status === 'pending' && !hasStarted(req) && renderCoverage(req, s)}
      {req.status === 'pending' && showBadge && !hasEnded(req) && (
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

  /** The class's buttons on wider screens. */
  const renderActionButtons = (s, showAction, matchedCount, bookedCount) => {
    if (isFinished(s)) return <span className="text-muted small">Finished. Use Make Correction next to a date to fix its record.</span>;
    const activeCount = s.faculty_requests?.filter(r => r.status !== 'archived').length || 0;
    const isSingle = activeCount <= 1;

    return (
      <div className="d-flex flex-column gap-1">
        {showAction && matchedCount === 0 && (
          <Button size="sm" variant="outline-primary" onClick={() => navigate(`/gigs/new/${s.id}?type=series`)}>
            {bookedCount > 0 ? "Find More Models" : "Find Model"}
          </Button>
        )}
        {canNotify(s) && (
          <Dropdown>
            <Dropdown.Toggle size="sm" variant="outline-secondary" className="w-100">Notify Models</Dropdown.Toggle>
            <Dropdown.Menu>{renderNotifyItems(s)}</Dropdown.Menu>
          </Dropdown>
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

  /** The class's buttons on phones: the main one, with the rest in a More menu. */
  const renderCardActions = (s, showAction, matchedCount, bookedCount) => {
    if (isFinished(s)) return <div className="text-muted small">Finished. Use Make Correction next to a date to fix its record.</div>;
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
              {canNotify(s) && (
                <>
                  <Dropdown.Header>Notify models</Dropdown.Header>
                  {renderNotifyItems(s)}
                  <Dropdown.Divider />
                </>
              )}
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

  /** The class's department, number of dates and room. */
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

  /** One class as a card, for phones. */
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
            {displayRequests.map(req => renderDateRow(req, matchedCount > 0 && pendingCount > 0, isSingle, s))}
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

  /** A group of classes as a table, for wider screens. */
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
                    {displayRequests.map(req => renderDateRow(req, matchedCount > 0 && pendingCount > 0, isSingle, s))}
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

  /** A group of classes: the table on wider screens, cards on phones. */
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
            aria-label="Search class, faculty or department"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

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

      {when !== 'upcoming' && !showOlder && (
        <p className="small text-muted mt-n2 mb-3">
          Showing classes from the last 12 months.{' '}
          <Button variant="link" size="sm" className="p-0 align-baseline" onClick={() => setShowOlder(true)}>
            Show older classes
          </Button>
        </p>
      )}

      {(statusFilter === 'all' || statusFilter === 'pending') && (
        <div className="mb-4">
          <h5 className="fw-bold text-warning mb-2">Pending ({pending.length})</h5>
          {renderSection(pending, true, when !== 'past')}
        </div>
      )}

      {(statusFilter === 'all' || statusFilter === 'matched') && (
        <div className="mb-4">
          <h5 className="fw-bold text-success mb-2">Matched ({matched.length})</h5>
          {renderSection(matched, false, when !== 'past')}
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
            <Alert ref={editErrorRef} tabIndex={-1} variant="danger" dismissible onClose={() => setEditError('')}>
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
                  type="time" step={300} min="00:00"
                  aria-label={`Start time ${i + 1}`}
                  value={d.start}
                  onChange={e => updateSeriesDate(i, 'start', e.target.value)}
                  onBlur={e => updateSeriesDate(i, 'start', roundToNearest5(e.target.value))}
                />
              </Col>
              <Col xs={3} md={2}>
                <Form.Control
                  type="time" step={300} min="00:00"
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

          <Form.Group className="mt-4" controlId="edit-reason">
            <Form.Label>Reason for these changes (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              maxLength={500}
              value={seriesForm.reason}
              onChange={e => setSeriesForm(prev => ({ ...prev, reason: e.target.value }))}
            />
            <Form.Text>Kept in History with the changes you save.</Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEditingSeries(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveSeriesEdit}>Save Changes</Button>
        </Modal.Footer>
      </Modal>
      {correcting && (
        <CorrectRecordModal
          {...correcting}
          onClose={() => setCorrecting(null)}
          onSaved={() => {
            setCorrecting(null);
            reloadSeries();
          }}
        />
      )}
    </Container>
  );
}

export default AllRequests;
