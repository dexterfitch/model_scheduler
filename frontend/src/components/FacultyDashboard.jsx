/**
 * My Classes, for faculty: their classes on Upcoming and Past tabs, New Request
 * (whose dates can repeat weekly), a calendar subscription link, and editing or
 * cancelling dates and classes that aren't booked. Past classes are read-only.
 * Faculty never see which model is booked.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Alert, Tabs, Tab } from "react-bootstrap";
import styles from "./FacultyDashboard.module.css";
import api from "../services/api";
import { useDialog } from "./DialogProvider";
import { formatSkinTone, formatGenderPreference, formatBodyType, formatGenitalia, formatModelCount, extractErrorMessages, formatPreferenceSummary } from "../utils/formatters";
import { roundToNearest5, formatTime, formatDateWithWeekday, validateBusinessHours, firstStartsAt, formatTimeForInput, newClassTimes, endAfterStart, weeklyDatesAfter } from "../utils/time";
import { DEPARTMENTS, BUILDINGS } from "../utils/constants";
import ModelPreferenceFields from "./ModelPreferenceFields";
import {
  DEFAULT_MODEL_PREFERENCES, DEFAULT_SLOT_STATE, applyPreferenceChange, modelSlotsPayload, slotFormState
} from "../utils/modelPreferences";
import StatusToast from "./StatusToast";
import CalendarLinkButton from "./CalendarLinkButton";

const PREFERENCE_KEYS = Object.keys(DEFAULT_MODEL_PREFERENCES);
/** Just the preference fields of a class. */
const pickPreferences = (obj) =>
  Object.fromEntries(PREFERENCE_KEYS.map(k => [k, obj[k] ?? DEFAULT_MODEL_PREFERENCES[k]]));

/** Whether a class has different preferences for each model. */
const hasModelSlots = (s) => (s.model_slots || []).length > 0;

const MAX_DATES = 50;

/** A new date row, starting 9 to 11 AM. */
const emptyDate = () => {
  const { start, end } = newClassTimes();
  return { date: "", start_time: start, end_time: end };
};

/** The My Classes page. */
function FacultyDashboard({ user }) {
  const { confirm, notify } = useDialog();
  const [series, setSeries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [editFormData, setEditFormData] = useState({ starts_at: "", starts_time: "", ends_time: "" });
  const [editError, setEditError] = useState('');
  const [editingSeries, setEditingSeries] = useState(null);
  const [classFormData, setClassFormData] = useState({
    class_name: "", department: "", building: "", room_number: "",
    ...DEFAULT_MODEL_PREFERENCES, notes: ""
  });
  const [classError, setClassError] = useState('');
  const [addingDateSeriesId, setAddingDateSeriesId] = useState(null);
  const [newDateForm, setNewDateForm] = useState({ date: '', start_time: '', end_time: '' });
  const [addDateError, setAddDateError] = useState(''); 

  const [formData, setFormData] = useState({
    class_name: "",
    department: "",
    building: "",
    ...DEFAULT_MODEL_PREFERENCES,
    ...DEFAULT_SLOT_STATE,
    notes: "",
    room_number: ""
  });

  const [dates, setDates] = useState([emptyDate()]);
  const [repeatUntil, setRepeatUntil] = useState('');
  const [repeatMessage, setRepeatMessage] = useState('');
  const [view, setView] = useState('upcoming');

  /** Loads the faculty member's classes, in date order. */
  const fetchSeries = useCallback(() => {
    api.get(`/request_series`)
      .then((res) => {
        const sorted = res.data.sort((a, b) => firstStartsAt(a) - firstStartsAt(b));
        setSeries(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching series:", err);
        setSubmitError("Error fetching requests. Please try again.");
      });
  }, []);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries, user.id]);

  /** Saves a typed change in New Request. */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  /** Saves a preference change in New Request. */
  const handlePreferenceChange = (name, value) => {
    setFormData(prev => applyPreferenceChange(prev, name, value));
  };

  /** Saves a preference change in Edit Class. */
  const handleClassPreferenceChange = (name, value) => {
    setClassFormData(prev => applyPreferenceChange(prev, name, value));
  };

  /** A date row with one field changed; changing the start moves the end with it. */
  const withTime = (d, field, value) => field === 'start_time'
    ? { ...d, start_time: value, end_time: endAfterStart(d.start_time, d.end_time, value) }
    : { ...d, [field]: value };

  /** Changes one date row in New Request. */
  const handleDateChange = (index, field, value) => {
    setDates(prev => prev.map((d, i) => i === index ? withTime(d, field, value) : d));
  };

  /** Rounds a date row's time to 5 minutes when the field is left. */
  const handleDateBlur = (index, field, value) => {
    if (field === 'start_time' || field === 'end_time') {
      const cleaned = roundToNearest5(value);
      setDates(prev => prev.map((d, i) => i === index ? withTime(d, field, cleaned) : d));
    }
  };

  const focusDateIndex = useRef(null);
  useEffect(() => {
    if (focusDateIndex.current === null) return;
    document.getElementById(`new-date-${focusDateIndex.current}-date`)?.focus();
    focusDateIndex.current = null;
  }, [dates]);

  /** Adds a date row and moves focus to its Date field. */
  const addDate = () => {
    focusDateIndex.current = dates.length;
    setDates(prev => [...prev, emptyDate()]);
  };

  /** Removes a date row and moves focus to the date before it. */
  const removeDate = (index) => {
    if (dates.length === 1) return;
    focusDateIndex.current = Math.max(index - 1, 0);
    setDates(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Adds a date for every week after the latest chosen date, up to Repeat weekly
   * until, at that date's times. Weeks already listed are skipped, and a class
   * never gets more than MAX_DATES dates.
   */
  const handleRepeatWeekly = () => {
    const pattern = dates.filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date)).pop();
    if (!pattern) return setRepeatMessage('Choose the first date, then repeat it.');
    if (!repeatUntil) return setRepeatMessage('Choose the last date to repeat until.');

    const listed = new Set(dates.map(d => d.date));
    const weeks = weeklyDatesAfter(pattern.date, repeatUntil).filter(day => !listed.has(day));
    const added = weeks.slice(0, Math.max(MAX_DATES - dates.length, 0));
    setDates(prev => [...prev, ...added.map(day => ({ date: day, start_time: pattern.start_time, end_time: pattern.end_time }))]);

    if (added.length === 0) return setRepeatMessage('No new weeks to add.');
    const capped = added.length < weeks.length ? ` (a class can have at most ${MAX_DATES} dates)` : '';
    setRepeatMessage(`Added ${added.length} weekly date${added.length === 1 ? '' : 's'}${capped}.`);
  };

  /** Sends New Request: the class, its dates and its preferences. */
  const handleSubmit = (e) => {
    e.preventDefault();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 4);

    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      const inputDate = new Date(d.date + "T00:00:00");

      if (inputDate <= today) {
        setSubmitError(`Date ${i + 1}: Requests must be for a future date (tomorrow or later).`);
        return;
      }
      if (inputDate > maxDate) {
        setSubmitError(`Date ${i + 1}: Cannot be more than 4 months in advance.`);
        return;
      }

      const startDateTime = new Date(`${d.date}T${d.start_time}`);
      const endDateTime = new Date(`${d.date}T${d.end_time}`);
      const hoursError = validateBusinessHours(d.start_time, d.end_time);
      if (hoursError) {
        setSubmitError(`Date ${i + 1}: Classes ${hoursError.charAt(0).toLowerCase()}${hoursError.slice(1)}`);
        return;
      }
      if (endDateTime <= startDateTime) {
        setSubmitError(`Date ${i + 1}: End time must be after start time.`);
        return;
      }
    }

    const payload = {
      request_series: {
        class_name: formData.class_name,
        department: formData.department,
        building: formData.building,
        ...pickPreferences(formData),
        notes: formData.notes,
        room_number: formData.room_number
      },
      dates: dates.map(d => ({
        date: d.date,
        start_time: d.start_time,
        end_time: d.end_time
      })),
      model_slots: modelSlotsPayload(formData)
    };

    api.post("/request_series", payload)
      .then(() => {
        setSubmitSuccess('Request submitted successfully!');
        setShowModal(false);
        fetchSeries();
        setFormData({
          class_name: "", department: "", building: "",
          ...DEFAULT_MODEL_PREFERENCES, ...DEFAULT_SLOT_STATE, notes: "", room_number: ""
        });
        setDates([emptyDate()]);
        setRepeatUntil('');
        setRepeatMessage('');
      })
      .catch((err) => {
        console.error(err);
        setSubmitError(extractErrorMessages(err, "Error submitting request. Please try again."));
      });
  };

  /** Cancels one date, after confirming. */
  const handleCancelDate = async (req) => {
    const booked = (req.confirmed_gigs || []).length > 0;
    const confirmed = await confirm({
      title: `Cancel ${formatDateWithWeekday(req.starts_at)}?`,
      message: booked
        ? 'The model booked for this date will be released. The rest of the class stays as it is.'
        : 'Only this date is cancelled. The rest of the class stays as it is.',
      confirmLabel: 'Cancel Date',
      cancelLabel: 'Keep Date',
      danger: true
    });
    if (!confirmed) return;

    api.delete(`/faculty_requests/${req.id}`)
      .then(() => {
        setSubmitSuccess("Date cancelled.");
        fetchSeries();
      })
      .catch((err) => notify({ title: "Couldn't cancel this date", message: extractErrorMessages(err, 'Please try again.') }));
  };

  /** Cancels the whole class, after confirming. */
  const handleCancelSeries = async (seriesId) => {
    const confirmed = await confirm({
      title: 'Cancel this class?',
      message: 'All of its dates will be cancelled, and any booked models released.',
      confirmLabel: 'Cancel Class',
      cancelLabel: 'Keep Class',
      danger: true
    });
    if (!confirmed) return;

    api.delete(`/request_series/${seriesId}`)
      .then(() => {
        setSubmitSuccess("Class cancelled.");
        fetchSeries();
      })
      .catch((err) => notify({ title: "Couldn't cancel this class", message: extractErrorMessages(err, 'Please try again.') }));
  };

  /** Opens Edit Date with the date's day and times. */
  const openEditModal = (req) => {
    const start = new Date(req.starts_at);
    const end = new Date(req.ends_at);
    /** Two-digit number for dates. */
    const pad = (n) => n.toString().padStart(2, '0');

    setEditingRequest(req);
    setEditFormData({
      starts_at: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      starts_time: formatTimeForInput(start),
      ends_time: formatTimeForInput(end)
    });
    setEditError('');
    setShowEditModal(true);
  };

  /** Saves a change in Edit Date. */
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  /** Saves Edit Date, after checking the hours. */
  const handleEditSubmit = (e) => {
    e.preventDefault();

    const startDateTime = new Date(`${editFormData.starts_at}T${editFormData.starts_time}`);
    const endDateTime = new Date(`${editFormData.starts_at}T${editFormData.ends_time}`);

    if (endDateTime <= startDateTime) {
      setEditError("End time must be after start time.");
      return;
    }

    const hoursError = validateBusinessHours(editFormData.starts_time, editFormData.ends_time);
    if (hoursError) {
      setEditError(`Classes ${hoursError.charAt(0).toLowerCase()}${hoursError.slice(1)}`);
      return;
    }

    api.patch(`/faculty_requests/${editingRequest.id}`, {
      faculty_request: { starts_at: startDateTime, ends_at: endDateTime }
    })
      .then(() => {
        setSubmitSuccess('Date updated successfully!');
        setShowEditModal(false);
        fetchSeries();
      })
      .catch((err) => {
        console.error(err);
        setEditError(extractErrorMessages(err, "Error updating request. Please try again."));
      });
  };

  /** Opens Edit Class with the class's details and preferences. */
  const openClassModal = (s) => {
    setEditingSeries(s);
    setClassFormData({
      class_name: s.class_name || "",
      department: s.department || "",
      building: s.building || "",
      room_number: s.room_number || "",
      ...pickPreferences(s),
      ...slotFormState(s),
      notes: s.notes || ""
    });
    setClassError('');
  };

  /** Saves a typed change in Edit Class. */
  const handleClassInputChange = (e) => {
    const { name, value } = e.target;
    setClassFormData(prev => ({ ...prev, [name]: value }));
  };

  /** Saves Edit Class for every remaining date. */
  const handleClassSubmit = (e) => {
    e.preventDefault();
    api.patch(`/request_series/${editingSeries.id}`, {
      request_series: {
        class_name: classFormData.class_name,
        department: classFormData.department,
        building: classFormData.building,
        room_number: classFormData.room_number,
        ...pickPreferences(classFormData),
        notes: classFormData.notes
      },
      model_slots: modelSlotsPayload(classFormData)
    })
      .then(() => {
        setSubmitSuccess('Class updated for every date!');
        setEditingSeries(null);
        fetchSeries();
      })
      .catch((err) => {
        console.error(err);
        setClassError(extractErrorMessages(err, "Error updating class. Please try again."));
      });
  };

  /** Opens the Add Date form on a class card. */
  const openAddDateForm = (seriesId) => {
    setAddingDateSeriesId(seriesId);
    setNewDateForm(emptyDate());
    setAddDateError('');
  };

  /** Changes the Add Date form; the end time follows the start. */
  const handleAddDateChange = (field, value) => {
    setNewDateForm(prev => withTime(prev, field, value));
  };

  /** Rounds the Add Date times to 5 minutes when a field is left. */
  const handleAddDateBlur = (field, value) => {
    if (field === 'start_time' || field === 'end_time') {
      setNewDateForm(prev => withTime(prev, field, roundToNearest5(value)));
    }
  };

  /** Adds the date to the class, after checking it. */
  const handleAddDateSubmit = async (series) => {
    setAddDateError('');
    const { date, start_time, end_time } = newDateForm;
    if (!date || !start_time || !end_time) {
      setAddDateError("All fields are required.");
      return;
    }

    const starts_at = new Date(`${date}T${start_time}`);
    const ends_at = new Date(`${date}T${end_time}`);

    try {
      await api.post('/faculty_requests', {
        faculty_request: {
          request_series_id: series.id,
          class_name: series.class_name,
          department: series.department,
          building: series.building,
          room_number: series.room_number,
          ...pickPreferences(series),
          notes: series.notes,
          starts_at,
          ends_at
        }
      });
      setAddingDateSeriesId(null);
      setSubmitSuccess("Date added!");
      fetchSeries();
    } catch (err) {
      setAddDateError(extractErrorMessages(err, "Failed to add date."));
    }
  };

  /** Whether a date has finished. */
  const hasEnded = (req) => new Date(req.ends_at) < new Date();
  /** A class's dates that weren't cancelled. */
  const liveDates = (s) => (s.faculty_requests || []).filter(r => r.status !== 'archived');
  /** When a class's last date ends. */
  const lastEndsAt = (s) => Math.max(...liveDates(s).map(r => new Date(r.ends_at).getTime()));
  const pastSeries = series
    .filter(s => liveDates(s).length > 0 && liveDates(s).every(hasEnded))
    .sort((a, b) => lastEndsAt(b) - lastEndsAt(a));
  const upcomingSeries = series.filter(s => liveDates(s).some(r => !hasEnded(r)));

  /** One class card. Past classes are read-only; dates that already happened lose their buttons. */
  const renderClassCard = (s, past) => {
    const requests = (s.faculty_requests || [])
      .filter(r => r.status !== 'archived')
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const firstReq = requests[0];
    if (!firstReq) return null;

    return (
      <Col md={6} lg={4} key={s.id} className="mb-4">
        <Card className={`h-100 shadow-sm border-0 ${styles.card}`}>
          <Card.Header className={`text-white fw-bold ${past ? 'bg-secondary' : s.status === 'matched' ? 'bg-success' : 'bg-warning'}`}>
            {past
              ? 'Finished'
              : s.status === 'matched'
                ? ((s.models_needed || 1) > 1 ? 'Models Confirmed' : 'Model Confirmed')
                : 'Pending'}
            {requests.length > 1 && (
              <Badge bg="light" text="dark" className="ms-2">{requests.length} dates</Badge>
            )}
          </Card.Header>
          <Card.Body>
            <div className="d-flex justify-content-between align-items-start">
              <Card.Title>{s.class_name}</Card.Title>
              {s.department && <Badge bg="secondary" className="small">{s.department}</Badge>}
            </div>

            <div className="mb-2">
              {requests.map((req, idx) => {
                const ended = hasEnded(req);
                return (
                <div key={req.id} className={idx > 0 ? "mt-1 pt-1 border-top" : ""}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold">{formatDateWithWeekday(req.starts_at)}</div>
                      <div className="text-muted small">{formatTime(req.starts_at)} - {formatTime(req.ends_at)}</div>
                      {(() => {
                        const booked = req.confirmed_gigs || [];
                        const needed = req.models_needed || 1;
                        if (booked.length === 0) return null;
                        const contact = booked.find(g => g.confirmed_by?.email)?.confirmed_by;
                        return (
                          <div>
                            {req.status === 'matched'
                              ? <Badge bg="success">{needed > 1 ? `All ${needed} Models Confirmed` : 'Model Confirmed'}</Badge>
                              : <Badge bg="warning" text="dark">{booked.length} of {needed} Models Confirmed</Badge>}
                            <br />
                            {contact?.email && !ended && (
                              <a
                                href={`mailto:${contact.email}?subject=${encodeURIComponent(`Edit request: ${s.class_name} (${formatDateWithWeekday(req.starts_at)})`)}&body=${encodeURIComponent(`Hi ${contact.first_name},\n\nI need to make a change to my confirmed request for ${s.class_name} on ${formatDateWithWeekday(req.starts_at)} at ${formatTime(req.starts_at)}.\n\nDetails:\n`)}`}
                                className="small"
                                title={`Email ${contact.first_name} about this date`}
                              >
                                <small>Need to edit? Contact {contact.email}</small>
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="d-flex gap-1">
                      {ended && !past && <Badge bg="light" text="dark" className="border">Already happened</Badge>}
                      {!ended && req.status === 'pending' && (req.confirmed_gigs || []).length === 0 && (
                        <Button variant="outline-secondary" size="sm" onClick={() => openEditModal(req)}>
                          <i className="bi bi-pencil" aria-hidden="true"></i> Edit Date
                        </Button>
                      )}
                      {!ended && req.status !== 'archived' && (
                        <Button variant="outline-danger" size="sm" onClick={() => handleCancelDate(req)}>
                          <i className="bi bi-x-lg" aria-hidden="true"></i> Cancel Date
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
              
              {!past && s.status === 'pending' && (
                <div className="mt-2 pt-2 border-top">
                  {addingDateSeriesId === s.id ? (
                    <div className="p-2 bg-light rounded border">
                      {addDateError && (
                        <Alert variant="danger" dismissible onClose={() => setAddDateError('')} className="py-2 small">
                          {addDateError}
                        </Alert>
                      )}
                      <Row className="g-2">
                        <Form.Group as={Col} xs={12} sm={4} controlId={`add-date-${s.id}-date`}>
                          <Form.Label className="small mb-1">Date</Form.Label>
                          <Form.Control
                            type="date"
                            size="sm"
                            value={newDateForm.date}
                            onChange={e => handleAddDateChange('date', e.target.value)}
                          />
                        </Form.Group>
                        <Form.Group as={Col} xs={6} sm={4} controlId={`add-date-${s.id}-start`}>
                          <Form.Label className="small mb-1">Start</Form.Label>
                          <Form.Control
                            type="time" step={300} min="00:00"
                            size="sm"
                            value={newDateForm.start_time}
                            onChange={e => handleAddDateChange('start_time', e.target.value)}
                            onBlur={e => handleAddDateBlur('start_time', e.target.value)}
                          />
                        </Form.Group>
                        <Form.Group as={Col} xs={6} sm={4} controlId={`add-date-${s.id}-end`}>
                          <Form.Label className="small mb-1">End</Form.Label>
                          <Form.Control
                            type="time" step={300} min="00:00"
                            size="sm"
                            value={newDateForm.end_time}
                            onChange={e => handleAddDateChange('end_time', e.target.value)}
                            onBlur={e => handleAddDateBlur('end_time', e.target.value)}
                          />
                        </Form.Group>
                      </Row>
                      <div className="d-flex justify-content-end gap-2 mt-2">
                        <Button variant="secondary" size="sm" onClick={() => setAddingDateSeriesId(null)}>Cancel</Button>
                        <Button variant="primary" size="sm" onClick={() => handleAddDateSubmit(s)}>Add</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline-primary" size="sm" onClick={() => openAddDateForm(s.id)}>
                      <i className="bi bi-plus-circle me-1"></i> Add Date
                    </Button>
                  )}
                </div>
              )}
              {(s.building || s.room_number) && (
                <div className="text-muted small mt-1 pt-1 border-top">
                  <i className="bi bi-door-open me-1"></i>
                  {s.building}{s.building && s.room_number && " "}{s.room_number}
                </div>
              )}
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              {s.model_mode === 'nude'
                ? <Badge bg="danger">Nude Required</Badge>
                : <Badge bg="success">Clothed</Badge>}
              {!hasModelSlots(s) && s.pref_skin_tone !== 'Any' && <Badge bg="light" text="dark" className="border">{formatSkinTone(s.pref_skin_tone)}</Badge>}
              {(s.models_needed || 1) > 1 && <Badge bg="primary">{formatModelCount(s.models_needed)}</Badge>}
              {!hasModelSlots(s) && s.pref_gender !== 'Any' && <Badge bg="light" text="dark" className="border">Gender: {formatGenderPreference(s)}</Badge>}
              {!hasModelSlots(s) && s.pref_body_type && s.pref_body_type !== 'Any' && <Badge bg="light" text="dark" className="border">{formatBodyType(s.pref_body_type)}</Badge>}
              {!hasModelSlots(s) && s.model_mode === 'nude' && s.pref_genitalia && s.pref_genitalia !== 'Any' && <Badge bg="light" text="dark" className="border">{formatGenitalia(s.pref_genitalia)}</Badge>}
            </div>
            {hasModelSlots(s) && (
              <ul className="list-unstyled small mb-3">
                {s.model_slots.map(slot => (
                  <li key={slot.position}>
                    <strong>Model {slot.position}:</strong> {formatPreferenceSummary(slot, s.model_mode)}
                  </li>
                ))}
              </ul>
            )}

            {s.notes && (
              <div className="mt-1 text-muted small fst-italic">
                <i className="bi bi-journal-text"></i>:&nbsp;&nbsp;{s.notes}
              </div>
            )}

            {!past && s.status !== 'archived' && !requests.some(r => (r.confirmed_gigs || []).length > 0) && (
              <Button
                variant="outline-secondary"
                size="sm"
                className="w-100 mt-2"
                onClick={() => openClassModal(s)}
              >
                <i className="bi bi-pencil me-1" aria-hidden="true"></i>Edit Class
              </Button>
            )}
            {!past && s.status !== 'archived' && (
              <Button
                variant="outline-danger"
                size="sm"
                className="w-100 mt-2"
                onClick={() => handleCancelSeries(s.id)}
              >
                Cancel Class
              </Button>
            )}
          </Card.Body>
        </Card>
      </Col>
    );
  };

  return (
    <Container className={`py-4 ${styles.container}`}>
      <StatusToast message={submitSuccess} onClose={() => setSubmitSuccess('')} />

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h2>My Classes</h2>
          <p className="text-muted mb-2">Manage your model needs. Once a model is booked, only an admin can change that class.</p>
          <CalendarLinkButton />
        </div>
        <div className={`d-grid d-md-block {styles.requestBtn}`}>
          <Button
            className={styles.requestBtn}
            variant="primary" size="lg"
            onClick={() => {
              setShowModal(true);
              setSubmitError('');
              setSubmitSuccess('');
            }}>
            + New Request
          </Button>
        </div>
      </div>
      <div className="rainbow-bar mb-4"></div>

      {series.length === 0 && !loading && (
        <Alert variant="info">You haven't requested any models yet. Click "New Request" to start.</Alert>
      )}

      {series.length > 0 && (
        <Tabs activeKey={view} onSelect={(key) => setView(key)} id="my-classes-tabs" className="mb-3" transition={false} mountOnEnter unmountOnExit>
          <Tab eventKey="upcoming" title={`Upcoming (${upcomingSeries.length})`}>
            {upcomingSeries.length === 0 && (
              <p className="text-muted">No upcoming classes. Choose New Request to ask for a model.</p>
            )}
            <Row>{upcomingSeries.map(s => renderClassCard(s, false))}</Row>
          </Tab>
          <Tab eventKey="past" title={`Past (${pastSeries.length})`}>
            {pastSeries.length === 0 && <p className="text-muted">No past classes yet.</p>}
            <Row>{pastSeries.map(s => renderClassCard(s, true))}</Row>
          </Tab>
        </Tabs>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Request a Model</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {submitError && (
            <Alert variant="danger" dismissible onClose={() => setSubmitError('')}>
              {submitError}
            </Alert>
          )}
          <Form onSubmit={handleSubmit}>
            <Row>
              <Form.Group as={Col} md={6} className="mb-3" controlId="new-class-name">
                <Form.Label>Class Name</Form.Label>
                <Form.Control required name="class_name" value={formData.class_name} onChange={handleInputChange} placeholder="e.g. Figure Drawing 101" />
              </Form.Group>
              <Form.Group as={Col} md={6} className="mb-3" controlId="new-department">
                <Form.Label>Department</Form.Label>
                <Form.Select required name="department" value={formData.department} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Form.Select>
              </Form.Group>
            </Row>

            <Row>
              <Form.Group as={Col} md={4} className="mb-3" controlId="new-building">
                <Form.Label>Building</Form.Label>
                <Form.Select required name="building" value={formData.building} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group as={Col} md={4} className="mb-3" controlId="new-room">
                <Form.Label>Room Number</Form.Label>
                <Form.Control name="room_number" value={formData.room_number} onChange={handleInputChange} placeholder="e.g. 413" />
              </Form.Group>
            </Row>

            <hr />

            <h5 className="mb-2">Dates & Times</h5>

            {dates.map((d, index) => (
              <div key={index} className="p-3 mb-2 bg-light rounded border" role="group" aria-labelledby={`new-date-${index}-heading`}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small id={`new-date-${index}-heading`} className="fw-bold text-muted">Date {index + 1}</small>
                  {dates.length > 1 && (
                    <Button variant="outline-danger" size="sm" type="button" onClick={() => removeDate(index)} aria-label={`Remove date ${index + 1}`} title="Remove this date">
                      <i className="bi bi-trash" aria-hidden="true"></i>
                    </Button>
                  )}
                </div>
                <Row>
                  <Form.Group as={Col} md={4} className="mb-2" controlId={`new-date-${index}-date`}>
                    <Form.Label className="small">Date</Form.Label>
                    <Form.Control
                      required
                      type="date"
                      value={d.date}
                      onChange={e => handleDateChange(index, 'date', e.target.value)}
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={4} className="mb-2" controlId={`new-date-${index}-start`}>
                    <Form.Label className="small">Start Time</Form.Label>
                    <Form.Control
                      required
                      type="time" step={300} min="00:00"
                      value={d.start_time}
                      onChange={e => handleDateChange(index, 'start_time', e.target.value)}
                      onBlur={e => handleDateBlur(index, 'start_time', e.target.value)}
                    />
                  </Form.Group>
                  <Form.Group as={Col} md={4} className="mb-2" controlId={`new-date-${index}-end`}>
                    <Form.Label className="small">End Time</Form.Label>
                    <Form.Control
                      required
                      type="time" step={300} min="00:00"
                      value={d.end_time}
                      onChange={e => handleDateChange(index, 'end_time', e.target.value)}
                      onBlur={e => handleDateBlur(index, 'end_time', e.target.value)}
                    />
                  </Form.Group>
                </Row>
              </div>
            ))}

            <Button variant="outline-primary" size="sm" type="button" onClick={addDate} className="mb-2">
              <i className="bi bi-plus-circle me-1" aria-hidden="true"></i> Add Another Date
            </Button>

            <div className="d-flex flex-wrap align-items-end gap-2 mb-1">
              <Form.Group controlId="new-repeat-until">
                <Form.Label className="small mb-1">Repeat weekly until</Form.Label>
                <Form.Control size="sm" type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} />
              </Form.Group>
              <Button variant="outline-primary" size="sm" type="button" onClick={handleRepeatWeekly}>
                <i className="bi bi-arrow-repeat me-1" aria-hidden="true"></i> Add Weekly Dates
              </Button>
            </div>
            <div role="status" className="small text-muted mb-2">{repeatMessage}</div>

            <hr />
            <h5>Model Preferences</h5>
            <ModelPreferenceFields values={formData} onChange={handlePreferenceChange} />

            <Form.Group className="mb-3" controlId="new-notes">
              <Form.Label>Notes for Admin</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="e.g. Prefer a model with longer hair for this portrait session..."
              />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
              <Button variant="primary" type="submit">Submit Request</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Date</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError && (
            <Alert variant="danger" dismissible onClose={() => setEditError('')}>
              {editError}
            </Alert>
          )}
          <p className="small text-muted">
            To change the class name, room or model preferences for every date, use <strong>Edit Class</strong> on the class card.
          </p>
          <Form onSubmit={handleEditSubmit}>
            <Row>
              <Form.Group as={Col} md={4} className="mb-3" controlId="edit-date">
                <Form.Label>Date</Form.Label>
                <Form.Control required type="date" name="starts_at" value={editFormData.starts_at} onChange={handleEditInputChange} />
              </Form.Group>
              <Form.Group as={Col} md={4} className="mb-3" controlId="edit-start">
                <Form.Label>Start Time</Form.Label>
                <Form.Control required type="time" step={300} min="00:00" name="starts_time" value={editFormData.starts_time} onChange={handleEditInputChange} />
              </Form.Group>
              <Form.Group as={Col} md={4} className="mb-3" controlId="edit-end">
                <Form.Label>End Time</Form.Label>
                <Form.Control required type="time" step={300} min="00:00" name="ends_time" value={editFormData.ends_time} onChange={handleEditInputChange} />
              </Form.Group>
            </Row>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Close</Button>
              <Button variant="primary" type="submit">Save Changes</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={!!editingSeries} onHide={() => setEditingSeries(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Class</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {classError && (
            <Alert variant="danger" dismissible onClose={() => setClassError('')}>
              {classError}
            </Alert>
          )}
          <p className="small text-muted">Changes here apply to every date of this class.</p>
          <Form onSubmit={handleClassSubmit}>
            <Row>
              <Form.Group as={Col} md={6} className="mb-3" controlId="class-name">
                <Form.Label>Class Name</Form.Label>
                <Form.Control required name="class_name" value={classFormData.class_name} onChange={handleClassInputChange} />
              </Form.Group>
              <Form.Group as={Col} md={6} className="mb-3" controlId="class-department">
                <Form.Label>Department</Form.Label>
                <Form.Select required name="department" value={classFormData.department} onChange={handleClassInputChange}>
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Form.Select>
              </Form.Group>
            </Row>

            <Row>
              <Form.Group as={Col} md={4} className="mb-3" controlId="class-building">
                <Form.Label>Building</Form.Label>
                <Form.Select required name="building" value={classFormData.building} onChange={handleClassInputChange}>
                  <option value="">-- Select --</option>
                  {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group as={Col} md={4} className="mb-3" controlId="class-room">
                <Form.Label>Room Number</Form.Label>
                <Form.Control name="room_number" value={classFormData.room_number} onChange={handleClassInputChange} placeholder="e.g. 413" />
              </Form.Group>
            </Row>

            <hr />
            <h5>Model Preferences</h5>
            <ModelPreferenceFields values={classFormData} onChange={handleClassPreferenceChange} />

            <Form.Group className="mb-3" controlId="class-notes">
              <Form.Label>Notes for Admin</Form.Label>
              <Form.Control as="textarea" rows={3} name="notes" value={classFormData.notes} onChange={handleClassInputChange} />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setEditingSeries(null)}>Close</Button>
              <Button variant="primary" type="submit">Save Changes</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default FacultyDashboard;
