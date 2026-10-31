/**
 * Tests for the list of dates in a gig's window.
 */

import { render, screen, within } from '@testing-library/react';
import GigDates from './GigDates';
import { daysFromNow } from '../test/dates';
import { formatDateWithWeekday, formatTimeShort } from '../utils/time';

/** A booking in the test class some days from now. */
const booking = (id, days, extra = {}) => ({
  id, status: 'confirmed',
  faculty_request: { id: id + 100, request_series_id: 5, class_name: 'Illustration Portfolio',
    starts_at: daysFromNow(days, 13), ends_at: daysFromNow(days, 15) },
  ...extra,
});

const first = booking(1, 10);
const second = booking(2, 8);
const cancelled = booking(3, 12, { status: 'cancelled' });
const past = booking(4, -3);
const otherClass = { ...booking(5, 9), faculty_request: { ...booking(5, 9).faculty_request, request_series_id: 99 } };

describe('GigDates', () => {
  it("lists every upcoming date the model is booked for in the class, soonest first", () => {
    render(<GigDates gig={first} gigs={[first, second, cancelled, past, otherClass]} />);
    const list = screen.getByRole('list', { name: /Your 2 dates for this class/ });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(formatDateWithWeekday(second.faculty_request.starts_at));
    expect(items[1]).toHaveTextContent(formatDateWithWeekday(first.faculty_request.starts_at));
  });

  it('marks the date that was clicked', () => {
    render(<GigDates gig={first} gigs={[first, second]} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'true');
    expect(items[1]).toHaveTextContent('This date');
    expect(items[0]).not.toHaveTextContent('This date');
  });

  it('shows times the way the rest of the app does', () => {
    render(<GigDates gig={first} gigs={[first]} />);
    const { starts_at, ends_at } = first.faculty_request;
    expect(screen.getByRole('listitem')).toHaveTextContent(`${formatTimeShort(starts_at)} – ${formatTimeShort(ends_at)}`);
  });

  it('shows a one-off gig as a single date', () => {
    const oneOff = { ...first, faculty_request: { ...first.faculty_request, request_series_id: null } };
    render(<GigDates gig={oneOff} gigs={[oneOff, second]} />);
    expect(screen.getByRole('list', { name: 'Your date' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('can be worded for an admin looking at a model', () => {
    render(<GigDates gig={first} gigs={[first, second]} forAdmin />);
    expect(screen.getByRole('list', { name: /This model's 2 dates for this class/ })).toBeInTheDocument();
  });
});
