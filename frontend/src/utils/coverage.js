// Who could take a pending date, for the Requests page: models who are free for
// the whole date, which of them fit what the faculty asked for, and the email
// that invites models to sign up.
import { availabilityCoversRequest, hasSchedulingConflict, formatDateWithWeekday, formatTimeShort } from './time';

const isSet = (value) => value && value !== 'Any';

// Willing to pose the way the class needs
export const willingFor = (user, mode) => mode !== 'nude' || !!user.willing_to_model_nude;

// Every preference the faculty set must match. "Any" fits everyone; a model who
// preferred not to say doesn't match a preference that was set.
export const fitsPreferences = (user, prefs, mode) =>
  (!isSet(prefs.pref_skin_tone) || user.skin_tone === prefs.pref_skin_tone) &&
  (!isSet(prefs.pref_gender) || user.gender_identity === prefs.pref_gender) &&
  (!isSet(prefs.pref_body_type) || user.body_type === prefs.pref_body_type) &&
  (mode !== 'nude' || !isSet(prefs.pref_genitalia) || user.genitalia === prefs.pref_genitalia);

// Fits the class's preferences, or one of its open spots when each model has their own
const fitsClass = (user, series, openSlots) => {
  const slots = series.model_slots || [];
  if (slots.length === 0) return fitsPreferences(user, series, series.model_mode);
  return openSlots(slots).some(slot => fitsPreferences(user, slot, series.model_mode));
};

const modelsOnly = (users) => (users || []).filter(u => u?.role === 'model');

export const dateCoverage = (date, series, { models, availabilities, gigs }) => {
  const confirmed = (gigs || []).filter(g => g?.status === 'confirmed' && g.art_model_availability?.user && g.faculty_request);
  const bookedHere = (date.confirmed_gigs || []);
  const start = new Date(date.starts_at);
  const end = new Date(date.ends_at);

  const free = modelsOnly(models).filter(user =>
    willingFor(user, series.model_mode) &&
    !bookedHere.some(g => g.art_model_availability?.user?.id === user.id) &&
    (availabilities || []).some(a => a?.status === 'active' && a.user?.id === user.id && availabilityCoversRequest(a, date)) &&
    !hasSchedulingConflict(confirmed, user.id, start, end, g => g.faculty_request.id === date.id)
  );

  const takenSpots = new Set(bookedHere.map(g => g.model_slot_position));
  const openSlots = (slots) => slots.filter(s => !takenSpots.has(s.position));
  const matching = free.filter(user => fitsClass(user, series, openSlots));
  return { free, matching };
};

// Who to email about a class: models who fit it, and everyone willing to pose that way
export const notifyLists = (series, users) => {
  const all = modelsOnly(users).filter(u => u.email && willingFor(u, series.model_mode));
  const matching = all.filter(u => fitsClass(u, series, slots => slots));
  return { matching, all };
};

// A ready-to-send email in the coordinator's own mail app, with the models in
// BCC so they don't see each other's addresses
export const notifyEmailLink = (series, dates, recipients, appUrl) => {
  const where = [series.building, series.room_number].filter(Boolean).join(' ');
  const mode = series.model_mode === 'nude' ? 'Nude' : 'Clothed';
  const lines = dates.map(d =>
    `- ${formatDateWithWeekday(d.starts_at)}, ${formatTimeShort(d.starts_at)} – ${formatTimeShort(d.ends_at)}${where ? `, ${where}` : ''}`);
  const subject = `Model needed: ${series.class_name}, ${formatDateWithWeekday(dates[0].starts_at)}`;
  const body = [
    'Hi,',
    '',
    `We're looking for a model for ${series.class_name}${series.department ? ` (${series.department})` : ''}, ${mode}:`,
    '',
    ...lines,
    '',
    "If you can do any of these, open Pose Pool and choose I'm Available on this class under Open Calls:",
    appUrl,
    '',
    'Thank you!',
  ].join('\n');
  const bcc = recipients.map(r => r.email).join(',');
  return `mailto:?bcc=${bcc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
