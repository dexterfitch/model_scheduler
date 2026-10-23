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
  const piece = (title, start, end, backgroundColor) => ({
    id: availability.id, title, start, end, backgroundColor, display: 'block',
    extendedProps: { ...availability }
  });

  if (availability.status !== 'active') {
    return [piece('Cancelled', availability.starts_at, availability.ends_at, CALENDAR_COLORS.grey)];
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
    if (gigStart > cursor) events.push(piece(freeLabel, cursor.toISOString(), gigStart.toISOString(), CALENDAR_COLORS.green));
    const location = [gig.faculty_request.building, gig.faculty_request.room_number].filter(Boolean).join(' ');
    events.push(piece(`Confirmed Gig${location ? ` — ${location}` : ''}`, gig.faculty_request.starts_at, gig.faculty_request.ends_at, CALENDAR_COLORS.blue));
    if (gigEnd > cursor) cursor = gigEnd;
  });

  if (cursor < blockEnd) events.push(piece(freeLabel, cursor.toISOString(), blockEnd.toISOString(), CALENDAR_COLORS.green));
  return events;
};