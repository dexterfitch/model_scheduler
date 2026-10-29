import React from 'react';
import { Badge } from 'react-bootstrap';
import { formatDateWithWeekday, formatTimeShort } from '../utils/time';

// Every upcoming date the model is booked for in the same class, soonest first,
// so a gig's window shows the whole booking and not just the date clicked.
function GigDates({ gig, gigs = [], forAdmin = false }) {
  const seriesId = gig?.faculty_request?.request_series_id;
  const now = new Date();
  const dates = (seriesId
    ? gigs.filter(g =>
        g.status === 'confirmed' &&
        g.faculty_request?.request_series_id === seriesId &&
        (g.id === gig.id || new Date(g.faculty_request.starts_at) > now))
    : [gig]
  ).sort((a, b) => new Date(a.faculty_request.starts_at) - new Date(b.faculty_request.starts_at));
  if (!dates.some(g => g.id === gig.id)) dates.unshift(gig);

  const whose = forAdmin ? "This model's" : 'Your';
  const heading = dates.length > 1 ? `${whose} ${dates.length} dates for this class` : `${whose} date`;
  const headingId = `gig-dates-${gig.id}`;

  return (
    <div className="mb-3">
      <h3 className="h6 fw-bold mb-2" id={headingId}>{heading}</h3>
      <ul className="list-unstyled mb-0 border rounded" aria-labelledby={headingId}>
        {dates.map((g, i) => {
          const current = g.id === gig.id;
          return (
            <li key={g.id} aria-current={current ? 'true' : undefined}
              className={`d-flex flex-wrap align-items-center gap-2 px-3 py-2 ${i > 0 ? 'border-top' : ''} ${current ? 'bg-light' : ''}`}>
              <span className={current ? 'fw-bold' : ''}>{formatDateWithWeekday(g.faculty_request.starts_at)}</span>
              <span className="text-muted">{formatTimeShort(g.faculty_request.starts_at)} – {formatTimeShort(g.faculty_request.ends_at)}</span>
              {current && <Badge bg="dark" className="ms-auto">This date</Badge>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default GigDates;
