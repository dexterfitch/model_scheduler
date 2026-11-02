/**
 * The Error Log in the SuperUser Panel: unexpected errors from the server and from
 * people's browsers, newest first, with how often each happened, where, and for whom.
 */

import React, { useEffect, useState } from 'react';
import { Badge, Button } from 'react-bootstrap';
import api from '../services/api';
import { useDialog } from './DialogProvider';
import { formatDateTime } from '../utils/time';

/** The log, with a button to clear it. */
function ErrorLog() {
  const { confirm } = useDialog();
  const [reports, setReports] = useState(null);

  useEffect(() => {
    api.get('/error_reports')
      .then(res => setReports(res.data))
      .catch(() => setReports([]));
  }, []);

  /** Clears the whole log, after confirming. */
  const clear = async () => {
    const confirmed = await confirm({
      title: 'Clear the Error Log?',
      message: 'Every recorded error is deleted. New errors will still be recorded.',
      confirmLabel: 'Clear Log',
      cancelLabel: 'Go Back',
      danger: true
    });
    if (!confirmed) return;
    try {
      await api.delete('/error_reports');
      setReports([]);
    } catch {
      return;
    }
  };

  return (
    <div className="card shadow mb-4">
      <div className="card-header bg-light fw-bold d-flex justify-content-between align-items-center">
        <span>Error Log</span>
        {reports?.length > 0 && <Button variant="outline-danger" size="sm" onClick={clear}>Clear Log</Button>}
      </div>
      <div className="card-body">
        {reports === null ? (
          <p className="text-muted mb-0" role="status">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-muted mb-0">No errors recorded.</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {reports.map(report => (
              <li key={report.id} className="border-bottom py-2">
                <div className="fw-semibold text-break">{report.message}</div>
                <div className="small text-muted">
                  <Badge bg={report.source === 'server' ? 'dark' : 'secondary'} className="me-2">
                    {report.source === 'server' ? 'Server' : 'Browser'}
                  </Badge>
                  {report.count > 1 ? `${report.count} times, last ` : ''}{formatDateTime(report.last_seen_at)}
                  {report.path && <> · {report.path}</>}
                  {report.user && <> · {report.user.first_name} {report.user.last_name}</>}
                </div>
                {report.details && (
                  <details className="small mt-1">
                    <summary>Details</summary>
                    <pre className="mb-0 text-wrap">{report.details}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ErrorLog;
