/**
 * Words for updates: what changed, for which class and when, as each person reads it
 * in the Updates list.
 */

import { formatDateWithWeekday, formatTimeShort } from './time';

/**
 * When an update's dates are: one date with its time, or for several, how many and
 * the first and last.
 */
const when = (dates) => {
  const sorted = [...dates].sort((a, b) => new Date(a) - new Date(b));
  if (sorted.length === 1) return `on ${formatDateWithWeekday(sorted[0])} at ${formatTimeShort(sorted[0])}`;
  return `on ${sorted.length} dates, ${formatDateWithWeekday(sorted[0])} to ${formatDateWithWeekday(sorted[sorted.length - 1])}`;
};

const STILL_PAID = " You'll still be paid.";

const MESSAGES = {
  booked: (u) => `You're booked for ${u.title} ${when(u.dates)}.`,
  class_booked: (u) => `A model is booked for ${u.title} ${when(u.dates)}.`,
  released: (u) => `You've been released from ${u.title} ${when(u.dates)}.${u.paid ? STILL_PAID : ''}`,
  date_cancelled: (u) => `${u.title} was cancelled ${when(u.dates)}.${u.paid ? STILL_PAID : ''}`,
  class_cancelled: (u) => `The coordinator cancelled ${u.title} ${when(u.dates)}.`,
  dropped_out: (u) => `${u.about} dropped out of ${u.title} ${when(u.dates)}.`,
  model_cancelled: (u) => `The model for ${u.title} cancelled ${when(u.dates)}. The coordinator will find someone else.`,
  date_moved: (u) => `${u.title} moved: it's now ${when(u.dates)}.`,
  class_edited: (u) => `The coordinator changed ${u.title}: ${u.about}.`,
  class_date_moved: (u) => `The coordinator moved a date of ${u.title}: it's now ${when(u.dates)}.`,
  class_date_added: (u) => `The coordinator added a date to ${u.title}: ${when(u.dates)}.`,
};

/** What an update says. */
export const updateMessage = (update) => {
  if (update.kind === 'error') return `Something went wrong in the app: ${update.title}. See the Error Log in the SuperUser Panel.`;
  return (MESSAGES[update.kind] || ((u) => `${u.title} changed ${when(u.dates)}.`))(update);
};

const LINKS = { dropped_out: '/requests', error: '/superuser' };

/**
 * The page where the change can be seen: Requests for a drop-out, the SuperUser
 * Panel for an error, otherwise the person's first page.
 */
export const updateLink = (update) => LINKS[update.kind] || '/';
