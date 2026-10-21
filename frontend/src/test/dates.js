// An ISO timestamp `days` from today at `hour` UTC, so test data never goes stale
export const daysFromNow = (days, hour) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};