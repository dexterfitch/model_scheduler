/**
 * The Calendar Link button and window: a person's private link for subscribing to
 * their gigs or classes in Google, Apple or Outlook Calendar, with how to add it,
 * a copy button, and a reset for when the link has been shared.
 */

import React, { useState } from 'react';
import { Alert, Button, Form, InputGroup, Modal } from 'react-bootstrap';
import api from '../services/api';
import { useDialog } from './DialogProvider';

/** The button, and the window it opens. */
function CalendarLinkButton({ className = '' }) {
  const { confirm } = useDialog();
  const [show, setShow] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  /** Opens the window and loads the person's link (made the first time). */
  const open = async () => {
    setShow(true);
    setCopied(false);
    setError('');
    try {
      const res = await api.get('/calendar_link');
      setUrl(res.data.url);
    } catch {
      setError("Couldn't load your calendar link. Please try again.");
    }
  };

  /** Copies the link, and says so on the button. */
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Couldn't copy the link. Select it and copy it instead.");
    }
  };

  /** Makes a new link after confirming; the old one stops working. */
  const reset = async () => {
    const confirmed = await confirm({
      title: 'Reset your calendar link?',
      message: 'The old link stops working, so any calendar using it stops updating. Add the new link to your calendar instead.',
      confirmLabel: 'Reset Link',
      cancelLabel: 'Go Back',
      danger: true
    });
    if (!confirmed) return;
    try {
      const res = await api.post('/calendar_link/reset');
      setUrl(res.data.url);
      setCopied(false);
    } catch {
      setError("Couldn't reset your calendar link. Please try again.");
    }
  };

  return (
    <>
      <Button variant="outline-secondary" size="sm" className={className} onClick={open}>
        <i className="bi bi-calendar-plus me-1" aria-hidden="true"></i> Calendar Link
      </Button>

      <Modal show={show} onHide={() => setShow(false)} aria-labelledby="calendar-link-title">
        <Modal.Header closeButton>
          <Modal.Title id="calendar-link-title" as="h2" className="h5">Add to Your Calendar</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p>Subscribe to this link and your calendar app keeps your schedule up to date by itself.</p>
          <Form.Group controlId="calendar-link-url" className="mb-3">
            <Form.Label>Your private calendar link</Form.Label>
            <InputGroup>
              <Form.Control readOnly value={url} onFocus={e => e.target.select()} />
              <Button variant="outline-primary" onClick={copy} disabled={!url}>{copied ? 'Copied' : 'Copy Link'}</Button>
            </InputGroup>
          </Form.Group>
          <ul className="small ps-3">
            <li><strong>Google Calendar</strong> (on a computer): beside Other calendars, choose +, then From URL, and paste the link. Google can take several hours to show changes.</li>
            <li><strong>Apple Calendar</strong>: File, then New Calendar Subscription. On an iPhone: Settings, Calendar, Accounts, Add Account, Other, Add Subscribed Calendar.</li>
            <li><strong>Outlook</strong>: Add calendar, then Subscribe from web.</li>
          </ul>
          <p className="small text-muted mb-0">
            Anyone with this link can see your schedule. If it's been shared by mistake, reset it.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-danger" onClick={reset}>Reset Link</Button>
          <Button variant="secondary" onClick={() => setShow(false)}>Done</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default CalendarLinkButton;
