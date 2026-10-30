// One rule for whether a gig is paid, for how long, and how to describe it,
// shared by Reports, the Gig Registry, My Gigs and the Correct record window.

// Paid unless cancelled. An admin's correction (billable true or false) wins.
export const isPaid = (gig) => gig?.billable ?? (gig?.status !== 'cancelled');

// The hours really worked, when an admin corrected them, or else the booked times
export const workedTimes = (gig) => ({
  starts_at: gig?.worked_starts_at || gig?.faculty_request?.starts_at,
  ends_at: gig?.worked_ends_at || gig?.faculty_request?.ends_at,
});

// Hours, rounded to the nearest quarter hour
export const paidHours = (gig) => {
  const { starts_at, ends_at } = workedTimes(gig);
  const ms = new Date(ends_at) - new Date(starts_at);
  return Math.round((ms / 36e5) * 4) / 4;
};

export const wasCorrected = (gig) => (gig?.corrections?.length || 0) > 0;

export const payStatusLabel = (gig) => {
  if (gig.no_show) return isPaid(gig) ? 'No-show (Paid)' : 'No-show (Not paid)';
  if (gig.status === 'cancelled') return isPaid(gig) ? 'Cancelled (Billable)' : 'Cancelled';
  return isPaid(gig) ? 'Confirmed' : 'Confirmed (Not paid)';
};
