/**
 * Times and dates: formatting, rounding, business hours, class times, and splitting
 * free time around bookings.
 */

import { CALENDAR_COLORS } from './constants';

/** A time rounded to the nearest 5 minutes. */
export const roundToNearest5 = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m;
  const rounded = Math.round(totalMins / 5) * 5;
  const newH = Math.floor(rounded / 60);
  const newM = rounded % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
};

/** The earliest live date of a class, for putting classes in order. */
export const firstStartsAt = (series) => {
  const all = series?.faculty_requests || [];
  const live = all.filter(r => r.status !== 'archived');
  const times = (live.length ? live : all).map(r => new Date(r.starts_at).getTime());
  return times.length ? Math.min(...times) : Infinity;
};

/** A time like 09:00 AM. */
export const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** A date like Nov 3, 2026. */
export const formatDateShort = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** A date like Tue, Nov 3. */
export const formatDateWithWeekday = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** A date and time together. */
export const formatDateTime = (d) => new Date(d).toLocaleString([], {
  weekday: 'short', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

/** A time like 9:00 AM. */
export const formatTimeShort = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** A date like 11/3/2026. */
export const formatDateNumeric = (d) => new Date(d).toLocaleDateString();

/** Why times fall outside 8:00 AM to 10:00 PM, or null if they don't. */
export const validateBusinessHours = (startTime, endTime) => {
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);

  if (startHour < 8 || startHour >= 22) {
    return "Must start between 8:00 AM and 10:00 PM.";
  }
  if (endHour > 22 || (endHour === 22 && endTime.split(':')[1] !== "00")) {
    return "Must end by 10:00 PM.";
  }
  return null;
};

/** The message after saving free time, saying so when it was joined to time already set. */
export const availabilitySavedMessage = (saved, fallback, { forAdmin = false } = {}) => {
  if (!saved?.joined) return fallback;
  const hours = `${formatTimeShort(saved.starts_at)} to ${formatTimeShort(saved.ends_at)}`;
  return forAdmin
    ? `Availability saved, and joined to time the model had already set: they're free ${hours} that day.`
    : `Availability saved, and joined to time you'd already set: you're free ${hours} that day.`;
};

const CLASS_HOURS = 2;
const LATEST_END = 22 * 60;
/**
 * Every date one week apart after the first, up to and including the last, as
 * YYYY-MM-DD. Counted on calendar days, so daylight saving changes don't shift them.
 */
export const weeklyDatesAfter = (first, last) => {
  if (!first || !last) return [];
  const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const end = toDay(last);
  const dates = [];
  for (let day = toDay(first) + 7 * 864e5; day <= end; day += 7 * 864e5) {
    dates.push(new Date(day).toISOString().slice(0, 10));
  }
  return dates;
};

/** Minutes since midnight for a time like 09:30. */
const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** A time like 09:30 for minutes since midnight. */
const toTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
/** Two hours later, no later than 10:00 PM. */
const twoHoursAfter = (t) => toTime(Math.min(toMinutes(t) + CLASS_HOURS * 60, LATEST_END));

/** The times a new class date starts with: 9 to 11 AM. */
export const newClassTimes = () => ({ start: '09:00', end: twoHoursAfter('09:00') });

/**
 * The end time after the start changes: two hours later, unless someone chose the end and it's
 * still after the start.
 */
export const endAfterStart = (oldStart, oldEnd, newStart) => {
  if (!newStart) return oldEnd;
  const followedStart = !oldEnd || !oldStart || oldEnd === twoHoursAfter(oldStart);
  if (followedStart || toMinutes(oldEnd) <= toMinutes(newStart)) return twoHoursAfter(newStart);
  return oldEnd;
};

/** A saved time as a time field shows it, rounded to the nearest 5 minutes (never past 23:55). */
export const formatTimeForInput = (date) => {
  const minutes = Math.min(Math.round((date.getHours() * 60 + date.getMinutes()) / 5) * 5, 23 * 60 + 55);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

/** Whether a block of free time covers the whole class. */
export const availabilityCoversRequest = (avail, req) => {
  const availStart = new Date(avail.starts_at);
  const availEnd = new Date(avail.ends_at);
  const reqStart = new Date(req.starts_at);
  const reqEnd = new Date(req.ends_at);
  return availStart <= reqStart && availEnd >= reqEnd;
};

/** Whether a model has a booking overlapping the given time, other than the ones excluded. */
export const hasSchedulingConflict = (confirmedGigs, userId, reqStart, reqEnd, excludeGigId) => {
  return confirmedGigs.some(g => {
    if (g.art_model_availability.user.id !== userId) return false;
    if (excludeGigId(g)) return false;
    const gigStart = new Date(g.faculty_request.starts_at);
    const gigEnd = new Date(g.faculty_request.ends_at);
    return gigStart < reqEnd && gigEnd > reqStart;
  });
};

/** The booked gig in a block of free time, if any. */
export const findActiveGigForAvailability = (gigsList, availabilityId) => {
  return gigsList.find(g =>
    g.art_model_availability.id === availabilityId && g.status === 'confirmed'
  );
};

/**
 * A block of free time as calendar pieces: free stretches around its booked gigs, or one cancelled
 * piece.
 */
export const availabilityEvents = (availability, gigs, { freeLabel = 'Free' } = {}) => {
  /** One calendar piece of the block. */
  const piece = (kind, title, start, end, backgroundColor) => ({
    id: availability.id, kind, title, start, end, backgroundColor, display: 'block',
    extendedProps: { ...availability }
  });

  if (availability.status !== 'active') {
    return [piece('cancelled', 'Cancelled', availability.starts_at, availability.ends_at, CALENDAR_COLORS.grey)];
  }

  const booked = gigs
    .filter(g => g.status === 'confirmed' && g.art_model_availability.id === availability.id)
    .sort((a, b) => new Date(a.faculty_request.starts_at) - new Date(b.faculty_request.starts_at));

  const events = [];
  let cursor = new Date(availability.starts_at);
  const blockEnd = new Date(availability.ends_at);

  booked.forEach(gig => {
    const gigStart = new Date(gig.faculty_request.starts_at);
    const gigEnd = new Date(gig.faculty_request.ends_at);
    if (gigStart > cursor) events.push(piece('free', freeLabel, cursor.toISOString(), gigStart.toISOString(), CALENDAR_COLORS.green));
    const location = [gig.faculty_request.building, gig.faculty_request.room_number].filter(Boolean).join(' ');
    events.push(piece('gig', `Confirmed Gig${location ? ` — ${location}` : ''}`, gig.faculty_request.starts_at, gig.faculty_request.ends_at, CALENDAR_COLORS.blue));
    if (gigEnd > cursor) cursor = gigEnd;
  });

  if (cursor < blockEnd) events.push(piece('free', freeLabel, cursor.toISOString(), blockEnd.toISOString(), CALENDAR_COLORS.green));
  return events;
};
