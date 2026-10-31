/**
 * Dates for tests, relative to today so they never go stale.
 */

/** A time some days from today at this hour (UTC). */
export const daysFromNow = (days, hour) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
