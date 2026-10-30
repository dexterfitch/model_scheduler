import React, { useEffect, useState } from "react";
import { Modal, Alert, Form, Button, Row, Col } from "react-bootstrap";
import api from "../services/api";
import { extractErrorMessages } from "../utils/formatters";
import { formatDateWithWeekday, formatTimeShort, formatTimeForInput } from "../utils/time";
import { isPaid, payStatusLabel, paidHours, workedTimes } from "../utils/pay";

const fullName = (person) => [person?.first_name, person?.last_name].filter(Boolean).join(' ');

// Fixes the record of one model's gig on a date that already happened:
// a no-show, paid or not paid, the hours really worked, or who covered.
// Only the record and the billing report change; nobody is told or rebooked.
function CorrectRecordModal({ gig, date, series, onSaved, onClose }) {
  const model = gig.art_model_availability?.user;
  const first = model?.first_name || 'The model';
  const worked = workedTimes({ ...gig, faculty_request: date });

  const [kind, setKind] = useState('');
  const [note, setNote] = useState('');
  const [started, setStarted] = useState(formatTimeForInput(new Date(worked.starts_at)));
  const [finished, setFinished] = useState(formatTimeForInput(new Date(worked.ends_at)));
  const [standInId, setStandInId] = useState('');
  const [models, setModels] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The list of models is only needed for "someone else covered"
  useEffect(() => {
    if (kind !== 'covered_by' || models) return;
    api.get('/users')
      .then(res => setModels(res.data))
      .catch(() => setError("Couldn't load the list of models. Please try again."));
  }, [kind, models]);

  const standIns = (models || []).filter(u =>
    u.role === 'model' && u.id !== model?.id && (series?.model_mode !== 'nude' || u.willing_to_model_nude));

  const choices = [
    !gig.no_show && gig.status !== 'cancelled' && ['no_show', `${first} didn't show up (not paid)`],
    gig.no_show && ['undo_no_show', `Undo the no-show (${first} did come)`],
    // A model who worked is always paid (fewer hours is Fix the hours), so
    // paying or not only applies to a cancellation
    gig.status === 'cancelled' && !gig.no_show && (isPaid(gig)
      ? ['unpaid', 'Stop paying this cancellation']
      : ['paid', 'Pay this gig']),
    ['hours', `Fix the hours ${first} worked`],
    gig.worked_starts_at && ['reset_hours', 'Go back to the booked hours'],
    !gig.no_show && gig.status !== 'cancelled' && ['covered_by', `Someone else covered for ${first}`],
  ].filter(Boolean);

  // A time on the class's own day, as the server expects it
  const onClassDay = (time) => {
    const day = new Date(date.starts_at).toLocaleDateString('en-CA');
    return new Date(`${day}T${time}`).toISOString();
  };

  const payload = () => {
    const correction = kind === 'reset_hours' ? { kind: 'hours', reset_hours: true } : { kind };
    if (kind === 'hours') {
      correction.worked_starts_at = onClassDay(started);
      correction.worked_ends_at = onClassDay(finished);
    }
    if (kind === 'covered_by') correction.stand_in_user_id = Number(standInId);
    if (note.trim()) correction.note = note.trim();
    return { correction };
  };

  const ready = kind && (kind !== 'covered_by' || standInId) && (kind !== 'hours' || (started && finished));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/gigs/${gig.id}/corrections`, payload());
      onSaved();
    } catch (err) {
      setError(extractErrorMessages(err, "Couldn't save the correction. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const history = gig.corrections || [];

  return (
    <Modal show onHide={onClose} aria-labelledby="correct-record-title">
      <Modal.Header closeButton>
        <Modal.Title id="correct-record-title">Correct the record</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSave}>
        <Modal.Body>
          <Alert variant="warning">
            <strong>This date has already happened.</strong> Changes here only fix the record and the
            billing report. Nobody is emailed, and no one is rebooked.
          </Alert>

          <p className="mb-1"><strong>{fullName(model)}</strong> · {series?.class_name}</p>
          <p className="small text-muted">
            {formatDateWithWeekday(date.starts_at)}, booked {formatTimeShort(date.starts_at)} – {formatTimeShort(date.ends_at)}
            <br />
            Right now: {payStatusLabel(gig)}{isPaid(gig) && `, ${paidHours({ ...gig, faculty_request: date })} hrs`}
          </p>

          {history.length > 0 && (
            <>
              <h3 className="h6 fw-bold" id="correction-history">Corrections so far</h3>
              <ul className="small ps-3" aria-labelledby="correction-history">
                {history.map(c => (
                  <li key={c.id} className="mb-1">
                    {c.summary}
                    <span className="text-muted">
                      {' '}by {fullName(c.user)}{c.created_at && `, ${formatDateWithWeekday(c.created_at)}`}
                    </span>
                    {c.note && <div className="fst-italic">“{c.note}”</div>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

          <fieldset className="mb-3">
            <legend className="h6 fw-bold">What needs correcting?</legend>
            {choices.map(([value, label]) => (
              <Form.Check
                key={value}
                type="radio"
                id={`correction-${value}`}
                name="correction-kind"
                label={label}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="mb-2"
              />
            ))}
          </fieldset>

          {kind === 'hours' && (
            <Row className="g-2 mb-3">
              <Form.Group as={Col} xs={6} controlId="correction-started">
                <Form.Label>Started</Form.Label>
                <Form.Control type="time" value={started} onChange={e => setStarted(e.target.value)} required />
              </Form.Group>
              <Form.Group as={Col} xs={6} controlId="correction-finished">
                <Form.Label>Finished</Form.Label>
                <Form.Control type="time" value={finished} onChange={e => setFinished(e.target.value)} required />
              </Form.Group>
              <Form.Text className="text-muted">
                Reports pays these hours. The class keeps its booked times.
              </Form.Text>
            </Row>
          )}

          {kind === 'covered_by' && (
            <Form.Group className="mb-3" controlId="correction-stand-in">
              <Form.Label>Model who covered</Form.Label>
              <Form.Select value={standInId} onChange={e => setStandInId(e.target.value)} required>
                <option value="">Choose a model</option>
                {standIns.map(u => <option key={u.id} value={u.id}>{fullName(u)}</option>)}
              </Form.Select>
              <Form.Text className="text-muted">
                {first} is marked as a no-show and isn't paid. The model you choose is paid for this date.
              </Form.Text>
            </Form.Group>
          )}

          <Form.Group controlId="correction-note">
            <Form.Label>Note (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Alice confirmed nobody came"
            />
            <Form.Text className="text-muted">Only admins see this note.</Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="primary" type="submit" disabled={!ready || saving}>Save Correction</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default CorrectRecordModal;
