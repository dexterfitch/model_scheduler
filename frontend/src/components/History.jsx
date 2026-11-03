/**
 * History, for admins: everything people have done in the app, newest first, with
 * who did it, when, and the reason they gave. Searchable by class, person or note,
 * 100 entries at a time.
 */

import React, { useEffect, useState } from 'react';
import { Badge, Button, Container, Form, InputGroup } from 'react-bootstrap';
import api from '../services/api';
import { formatDateTime } from '../utils/time';

const PAGE = 100;

/** The History page. */
function History() {
  const [entries, setEntries] = useState(null);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      api.get('/history_entries', { params: { q: search.trim() } })
        .then(res => {
          setEntries(res.data);
          setHasMore(res.data.length === PAGE);
          setError('');
        })
        .catch(() => setError("Couldn't load History. Please try again."));
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search]);

  /** Loads the next 100 older entries. */
  const showOlder = async () => {
    try {
      const res = await api.get('/history_entries', { params: { q: search.trim(), before_id: entries[entries.length - 1].id } });
      setEntries(prev => [...prev, ...res.data]);
      setHasMore(res.data.length === PAGE);
    } catch {
      setError("Couldn't load older entries. Please try again.");
    }
  };

  return (
    <Container className="py-4">
      <h2 className="mb-1">History</h2>
      <p className="text-muted">Who changed what, and when. Reasons given when editing, cancelling or releasing are kept here.</p>

      <InputGroup className="mb-3">
        <InputGroup.Text><i className="bi bi-search" aria-hidden="true"></i></InputGroup.Text>
        <Form.Control type="search" aria-label="Search History" placeholder="Search class, person or reason..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </InputGroup>

      {error && <p className="text-danger" role="alert">{error}</p>}

      {entries === null ? (
        <p className="text-muted" role="status">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-muted">{search.trim() ? 'Nothing matches that search.' : 'Nothing recorded yet.'}</p>
      ) : (
        <ul className="list-unstyled bg-white border rounded mb-3">
          {entries.map(entry => (
            <li key={entry.id} className="px-3 py-2 border-bottom">
              <div className="small text-muted">
                {formatDateTime(entry.created_at)} · {entry.user ? `${entry.user.first_name} ${entry.user.last_name}` : 'Someone no longer in the app'}
              </div>
              <div>{entry.summary}</div>
              {entry.note && (
                <div className="small mt-1">
                  <Badge bg="secondary" className="me-1" aria-hidden="true">Note</Badge>
                  <span className="visually-hidden">Note: </span>
                  <span className="fst-italic">{entry.note}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasMore && <Button variant="outline-secondary" onClick={showOlder}>Show Older</Button>}
    </Container>
  );
}

export default History;
