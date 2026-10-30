import { isPaid, workedTimes, paidHours, payStatusLabel } from './pay';

const base = {
  status: 'confirmed', billable: null, no_show: false,
  faculty_request: { starts_at: '2026-10-16T14:00:00Z', ends_at: '2026-10-16T16:00:00Z' },
};

describe('pay rule', () => {
  it('pays a confirmed gig, and not a cancelled one, unless a correction says otherwise', () => {
    expect(isPaid(base)).toBe(true);
    expect(isPaid({ ...base, status: 'cancelled', billable: false })).toBe(false);
    expect(isPaid({ ...base, status: 'cancelled', billable: true })).toBe(true);
    expect(isPaid({ ...base, billable: false })).toBe(false);
  });

  it("doesn't pay a no-show unless it was set back to paid", () => {
    expect(isPaid({ ...base, status: 'cancelled', billable: false, no_show: true })).toBe(false);
    expect(isPaid({ ...base, status: 'cancelled', billable: true, no_show: true })).toBe(true);
  });

  it('uses the hours really worked when they were corrected', () => {
    const fixed = { ...base, worked_starts_at: '2026-10-16T14:00:00Z', worked_ends_at: '2026-10-16T15:30:00Z' };
    expect(workedTimes(fixed)).toEqual({ starts_at: fixed.worked_starts_at, ends_at: fixed.worked_ends_at });
    expect(paidHours(fixed)).toBe(1.5);
    expect(paidHours(base)).toBe(2);
  });

  it('describes each kind of gig in words', () => {
    expect(payStatusLabel(base)).toBe('Confirmed');
    expect(payStatusLabel({ ...base, billable: false })).toBe('Confirmed (Not paid)');
    expect(payStatusLabel({ ...base, status: 'cancelled', billable: true })).toBe('Cancelled (Billable)');
    expect(payStatusLabel({ ...base, status: 'cancelled', billable: false })).toBe('Cancelled');
    expect(payStatusLabel({ ...base, status: 'cancelled', billable: false, no_show: true })).toBe('No-show (Not paid)');
    expect(payStatusLabel({ ...base, status: 'cancelled', billable: true, no_show: true })).toBe('No-show (Paid)');
  });
});
