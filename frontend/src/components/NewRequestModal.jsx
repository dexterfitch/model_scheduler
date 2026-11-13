/**
 * The New Request window: a class's details, its dates (which can repeat weekly) and
 * its model preferences. Faculty use it for their own classes. Given a list of
 * faculty, it's the admin's version: it asks which faculty member the class is for,
 * and can add a faculty member without a MICA sign-in (a sock account) first.
 */

import React, { useState, useEffect, useRef } from "react";
import { Row, Col, Button, Modal, Form, Alert } from "react-bootstrap";
import api from "../services/api";
import { extractErrorMessages, byFirstName } from "../utils/formatters";
import { roundToNearest5, validateBusinessHours, weeklyDatesAfter, emptyDateRow, withDateField } from "../utils/time";
import { DEPARTMENTS, BUILDINGS } from "../utils/constants";
import ModelPreferenceFields from "./ModelPreferenceFields";
import {
  DEFAULT_MODEL_PREFERENCES, DEFAULT_SLOT_STATE, applyPreferenceChange, modelSlotsPayload
} from "../utils/modelPreferences";
import { useRevealMessage } from '../utils/revealMessage';

const MAX_DATES = 50;
const PREFERENCE_KEYS = Object.keys(DEFAULT_MODEL_PREFERENCES);
const EMPTY_CLASS = {
  class_name: "", department: "", building: "",
  ...DEFAULT_MODEL_PREFERENCES, ...DEFAULT_SLOT_STATE, notes: "", room_number: ""
};
const EMPTY_SOCK = { first_name: "", last_name: "", email: "" };
const NO_FACULTY_CHOSEN = "Choose the faculty member this class is for.";

/** A person's full name. */
const fullName = (u) => `${u.first_name} ${u.last_name}`;

/**
 * The New Request window. onCreated(owner) runs after the class is saved; owner is
 * the chosen faculty member in the admin's version. In the admin's version, faculty
 * is everyone who could own the class, and onFacultyAdded(person) runs when a
 * faculty account is added here.
 */
function NewRequestModal({ show, onHide, onCreated, faculty = null, onFacultyAdded = () => {} }) {
  const forAdmin = Array.isArray(faculty);
  const [formData, setFormData] = useState(EMPTY_CLASS);
  const [ownerId, setOwnerId] = useState('');
  const [dates, setDates] = useState([emptyDateRow()]);
  const [repeatUntil, setRepeatUntil] = useState('');
  const [repeatMessage, setRepeatMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const submitErrorRef = useRevealMessage(submitError);
  const [addingSock, setAddingSock] = useState(false);
  const [sockForm, setSockForm] = useState(EMPTY_SOCK);
  const [sockError, setSockError] = useState('');
  const sockErrorRef = useRevealMessage(sockError);

  const choosableFaculty = forAdmin
    ? faculty.filter(u => u.role === 'faculty' && !u.removed_at).sort(byFirstName)
    : [];

  /** Saves a typed change. */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  /** Saves a preference change. */
  const handlePreferenceChange = (name, value) => {
    setFormData(prev => applyPreferenceChange(prev, name, value));
  };

  /** Changes one date row. */
  const handleDateChange = (index, field, value) => {
    setDates(prev => prev.map((d, i) => i === index ? withDateField(d, field, value) : d));
  };

  /** Rounds a date row's time to 5 minutes when the field is left. */
  const handleDateBlur = (index, field, value) => {
    if (field === 'start_time' || field === 'end_time') {
      const cleaned = roundToNearest5(value);
      setDates(prev => prev.map((d, i) => i === index ? withDateField(d, field, cleaned) : d));
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
    setDates(prev => [...prev, emptyDateRow()]);
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

  /** Empties the form for the next request. */
  const reset = () => {
    setFormData(EMPTY_CLASS);
    setOwnerId('');
    setDates([emptyDateRow()]);
    setRepeatUntil('');
    setRepeatMessage('');
    setSubmitError('');
    setAddingSock(false);
    setSockForm(EMPTY_SOCK);
    setSockError('');
  };

  /** Adds a faculty account without a MICA sign-in, then chooses it. */
  const handleAddSock = () => {
    const { first_name, last_name, email } = sockForm;
    if (!first_name.trim() || !last_name.trim() || !email.trim()) {
      return setSockError('Fill in the first name, last name and email.');
    }
    setSockError('');
    api.post('/users', { user: { first_name: `🧦 ${first_name.trim()}`, last_name: last_name.trim(), email: email.trim(), role: 'faculty' } })
      .then(res => {
        onFacultyAdded(res.data);
        setOwnerId(String(res.data.id));
        setAddingSock(false);
        setSockForm(EMPTY_SOCK);
        setSubmitError(prev => prev === NO_FACULTY_CHOSEN ? '' : prev);
      })
      .catch(err => setSockError(extractErrorMessages(err, "Couldn't add this faculty member. Please try again.")));
  };

  /** Sends the request: the class, its dates and its preferences. */
  const handleSubmit = (e) => {
    e.preventDefault();

    const owner = choosableFaculty.find(u => String(u.id) === ownerId);
    if (forAdmin && !owner) {
      setSubmitError(NO_FACULTY_CHOSEN);
      return;
    }

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
        ...(owner ? { user_id: owner.id } : {}),
        class_name: formData.class_name,
        department: formData.department,
        building: formData.building,
        ...Object.fromEntries(PREFERENCE_KEYS.map(k => [k, formData[k] ?? DEFAULT_MODEL_PREFERENCES[k]])),
        notes: formData.notes,
        room_number: formData.room_number
      },
      dates: dates.map(d => ({ date: d.date, start_time: d.start_time, end_time: d.end_time })),
      model_slots: modelSlotsPayload(formData)
    };

    api.post("/request_series", payload)
      .then(() => {
        reset();
        onCreated(owner || null);
      })
      .catch((err) => {
        console.error(err);
        setSubmitError(extractErrorMessages(err, "Error submitting request. Please try again."));
      });
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Request a Model</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {submitError && (
          <Alert ref={submitErrorRef} tabIndex={-1} variant="danger" dismissible onClose={() => setSubmitError('')}>
            {submitError}
          </Alert>
        )}
        <Form onSubmit={handleSubmit}>
          {forAdmin && (
            <div className="mb-3">
              <Form.Group controlId="new-owner">
                <Form.Label>Faculty member</Form.Label>
                <Form.Select aria-required="true" value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                  <option value="">-- Choose --</option>
                  {choosableFaculty.map(u => <option key={u.id} value={u.id}>{fullName(u)}</option>)}
                </Form.Select>
                <Form.Text>They'll see the class on My Classes, and get an update about it.</Form.Text>
              </Form.Group>

              {!addingSock ? (
                <Button variant="link" className="px-0" type="button" onClick={() => setAddingSock(true)}>
                  Add Faculty Without a MICA Sign-in
                </Button>
              ) : (
                <div role="group" aria-labelledby="new-sock-heading" className="p-3 mt-2 bg-light rounded border">
                  <div id="new-sock-heading" className="fw-bold mb-1">New faculty member</div>
                  <p className="small text-muted mb-2">
                    For someone who can't sign in with a MICA Google account. Their name is marked 🧦, and admins manage their classes.
                  </p>
                  {sockError && <Alert ref={sockErrorRef} tabIndex={-1} variant="danger" className="py-2">{sockError}</Alert>}
                  <Row>
                    <Form.Group as={Col} md={4} className="mb-2" controlId="new-sock-first">
                      <Form.Label className="small">First Name</Form.Label>
                      <Form.Control value={sockForm.first_name} onChange={e => setSockForm(f => ({ ...f, first_name: e.target.value }))} />
                    </Form.Group>
                    <Form.Group as={Col} md={4} className="mb-2" controlId="new-sock-last">
                      <Form.Label className="small">Last Name</Form.Label>
                      <Form.Control value={sockForm.last_name} onChange={e => setSockForm(f => ({ ...f, last_name: e.target.value }))} />
                    </Form.Group>
                    <Form.Group as={Col} md={4} className="mb-2" controlId="new-sock-email">
                      <Form.Label className="small">Email (@mica.edu)</Form.Label>
                      <Form.Control type="email" value={sockForm.email} onChange={e => setSockForm(f => ({ ...f, email: e.target.value }))} />
                    </Form.Group>
                  </Row>
                  <div className="d-flex flex-wrap gap-2">
                    <Button variant="primary" size="sm" type="button" onClick={handleAddSock}>Add Faculty Member</Button>
                    <Button variant="outline-secondary" size="sm" type="button" onClick={() => { setAddingSock(false); setSockError(''); }}>Never Mind</Button>
                  </div>
                </div>
              )}
              <hr />
            </div>
          )}

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
            <Button variant="secondary" onClick={onHide}>Close</Button>
            <Button variant="primary" type="submit">Submit Request</Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}

export default NewRequestModal;
