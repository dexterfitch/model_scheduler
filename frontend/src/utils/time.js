import { CALENDAR_COLORS } from './constants';

export const roundToNearest5 = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m;
  const rounded = Math.round(totalMins / 5) * 5;
  const newH = Math.floor(rounded / 60);
  const newM = rounded % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
};

// The earliest date of a class, for putting classes in order. The server sends a
// class's dates in no set order (an edited date often comes back last), so look at
// all of them. Archived dates only count when the class has nothing else.
export const firstStartsAt = (series) => {
  const all = series?.faculty_requests || [];
  const live = all.filter(r => r.status !== 'archived');
  const times = (live.length ? live : all).map(r => new Date(r.starts_at).getTime());
  return times.length ? Math.min(...times) : Infinity;
};

export const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDateShort = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const formatDateWithWeekday = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export const formatDateTime = (d) => new Date(d).toLocaleString([], {
  weekday: 'short', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

export const formatTimeShort = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const formatDateNumeric = (d) => new Date(d).toLocaleDateString();

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

// What to say after availability is saved. The server joins new time to free
// time the model already has that overlaps or meets it, and says so with "joined".
// Admins see "the model" in place of "you".
export const availabilitySavedMessage = (saved, fallback, { forAdmin = false } = {}) => {
  if (!saved?.joined) return fallback;
  const hours = `${formatTimeShort(saved.starts_at)} to ${formatTimeShort(saved.ends_at)}`;
  return forAdmin
    ? `Availability saved, and joined to time the model had already set: they're free ${hours} that day.`
    : `Availability saved, and joined to time you'd already set: you're free ${hours} that day.`;
};

export const formatTimeForInput = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export const availabilityCoversRequest = (avail, req) => {
  const availStart = new Date(avail.starts_at);
  const availEnd = new Date(avail.ends_at);
  const reqStart = new Date(req.starts_at);
  const reqEnd = new Date(req.ends_at);
  return availStart <= reqStart && availEnd >= reqEnd;
};

export const hasSchedulingConflict = (confirmedGigs, userId, reqStart, reqEnd, excludeGigId) => {
  return confirmedGigs.some(g => {
    if (g.art_model_availability.user.id !== userId) return false;
    if (excludeGigId(g)) return false;
    const gigStart = new Date(g.faculty_request.starts_at);
    const gigEnd = new Date(g.faculty_request.ends_at);
    return gigStart < reqEnd && gigEnd > reqStart;
  });
};

export const findActiveGigForAvailability = (gigsList, availabilityId) => {
  return gigsList.find(g =>
    g.art_model_availability.id === availabilityId && g.status === 'confirmed'
  );
};

// Calendar events for one availability block: each confirmed gig at the class's
// real start and end, and the time around it as free. Every piece keeps the
// block's id and details, so clicking any part still opens that block.
export const availabilityEvents = (availability, gigs, { freeLabel = 'Free' } = {}) => {
  // kind is 'free', 'gig' or 'cancelled', for code that needs just one of them
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
