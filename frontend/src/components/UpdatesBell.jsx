/**
 * The Updates button in the navigation bar, with how many updates are new, and the
 * list it opens: what changed in the person's gigs or classes. Opening the list
 * marks everything read. Updates are checked every two minutes and whenever the
 * person comes back to the tab.
 */

import React, { useEffect, useState } from 'react';
import { Badge, Button, Offcanvas } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { updateMessage, updateLink } from '../utils/updates';
import { formatDateShort } from '../utils/time';

const CHECK_EVERY_MS = 2 * 60 * 1000;

/** The Updates button and list. onNavigate runs when an update's link is followed. */
function UpdatesBell({ onNavigate }) {
  const [updates, setUpdates] = useState([]);
  const [unread, setUnread] = useState(0);
  const [show, setShow] = useState(false);
  const [newIds, setNewIds] = useState(new Set());

  useEffect(() => {
    /** Loads the person's updates; quietly keeps the old ones if that doesn't work. */
    const load = () => api.get('/notifications')
      .then(res => {
        setUpdates(res.data?.notifications || []);
        setUnread(res.data?.unread || 0);
      })
      .catch(() => {});

    load();
    const timer = setInterval(load, CHECK_EVERY_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, []);

  /** Opens the list, remembering which updates were new, and marks them all read. */
  const open = async () => {
    setNewIds(new Set(updates.filter(u => !u.read_at).map(u => u.id)));
    setShow(true);
    if (unread === 0) return;
    setUnread(0);
    try {
      await api.post('/notifications/read');
    } catch {
      return;
    }
  };

  /** Closes the list. */
  const close = () => setShow(false);

  return (
    <>
      <Button
        variant="outline-light"
        size="sm"
        aria-label={unread ? `Updates, ${unread} new` : 'Updates'}
        title="Updates"
        onClick={open}
      >
        <i className="bi bi-bell" aria-hidden="true"></i>
        {unread > 0 && <Badge bg="warning" text="dark" pill className="ms-1" aria-hidden="true">{unread}</Badge>}
      </Button>

      <Offcanvas show={show} onHide={close} placement="end" aria-labelledby="updates-title">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title id="updates-title" as="h2" className="h5">Updates</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {updates.length === 0 ? (
            <p className="text-muted">Nothing yet. Changes to your gigs and classes will show up here.</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {updates.map(update => (
                <li key={update.id} className={`border-bottom py-2 ${newIds.has(update.id) ? 'fw-semibold' : ''}`}>
                  <Link
                    to={updateLink(update)}
                    className="text-reset text-decoration-none d-block"
                    onClick={() => { close(); onNavigate?.(); }}
                  >
                    {newIds.has(update.id) && <Badge bg="warning" text="dark" className="me-2">New</Badge>}
                    {updateMessage(update)}
                  </Link>
                  <div className="small text-muted fw-normal">{formatDateShort(update.updated_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default UpdatesBell;
