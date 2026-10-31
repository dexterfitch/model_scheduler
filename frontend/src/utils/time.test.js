/**
 * Tests for splitting free time around gigs, and the class time defaults.
 */

import { availabilityEvents, formatTimeForInput, newClassTimes, endAfterStart } from './time';
import { CALENDAR_COLORS } from './constants';

const slot = { id: 7, status: 'active', starts_at: '2026-11-02T14:00:00Z', ends_at: '2026-11-02T22:00:00Z' };
/** A gig at these times. */
const gigAt = (id, start, end, extra = {}) => ({
  id, status: 'confirmed', art_model_availability: { id: 7 },
  faculty_request: { starts_at: start, ends_at: end, building: 'Fox', room_number: '201' },
  ...extra
});
/** Calendar pieces as title, start and end. */
const summary = (events) => events.map(e => [e.title, new Date(e.start).toISOString(), new Date(e.end).toISOString()]);

describe('availabilityEvents', () => {
  it('shows an unbooked block as one Free event', () => {
    const [event] = availabilityEvents(slot, []);
    expect(event).toEqual(expect.objectContaining({ title: 'Free', backgroundColor: CALENDAR_COLORS.green }));
    expect(summary([event])).toEqual([['Free', '2026-11-02T14:00:00.000Z', '2026-11-02T22:00:00.000Z']]);
  });

  it("shows the gig at the class's real times, with the time around it free", () => {
    const events = availabilityEvents(slot, [gigAt(1, '2026-11-02T15:00:00Z', '2026-11-02T17:00:00Z')]);
    expect(summary(events)).toEqual([
      ['Free',                    '2026-11-02T14:00:00.000Z', '2026-11-02T15:00:00.000Z'],
      ['Confirmed Gig — Fox 201', '2026-11-02T15:00:00.000Z', '2026-11-02T17:00:00.000Z'],
      ['Free',                    '2026-11-02T17:00:00.000Z', '2026-11-02T22:00:00.000Z'],
    ]);
    expect(events[1].backgroundColor).toBe(CALENDAR_COLORS.blue);
  });

  it('handles two gigs in one block', () => {
    const events = availabilityEvents(slot, [
      gigAt(2, '2026-11-02T19:00:00Z', '2026-11-02T22:00:00Z'),
      gigAt(1, '2026-11-02T14:00:00Z', '2026-11-02T16:00:00Z'),
    ]);
    expect(events.map(e => e.title)).toEqual(['Confirmed Gig — Fox 201', 'Free', 'Confirmed Gig — Fox 201']);
  });

  it('ignores cancelled gigs and gigs from other blocks', () => {
    const events = availabilityEvents(slot, [
      gigAt(1, '2026-11-02T15:00:00Z', '2026-11-02T17:00:00Z', { status: 'cancelled' }),
      gigAt(2, '2026-11-02T15:00:00Z', '2026-11-02T17:00:00Z', { art_model_availability: { id: 99 } }),
    ]);
    expect(events.map(e => e.title)).toEqual(['Free']);
  });

  it('shows a cancelled block as Cancelled, in grey', () => {
    const [event] = availabilityEvents({ ...slot, status: 'cancelled' }, []);
    expect(event).toEqual(expect.objectContaining({ title: 'Cancelled', backgroundColor: CALENDAR_COLORS.grey }));
  });

  it('can call free time something else, like Available on the admin view', () => {
    const [event] = availabilityEvents(slot, [], { freeLabel: 'Available' });
    expect(event.title).toBe('Available');
  });

  it('keeps the whole block in each event, so clicking any part edits the block', () => {
    const events = availabilityEvents(slot, [gigAt(1, '2026-11-02T15:00:00Z', '2026-11-02T17:00:00Z')]);
    for (const e of events) {
      expect(e.id).toBe(7);
      expect(e.extendedProps.starts_at).toBe(slot.starts_at);
    }
  });
});

describe('formatTimeForInput', () => {
  it('rounds a saved time to the nearest 5 minutes for the time pickers', () => {
    expect(formatTimeForInput(new Date(2026, 10, 2, 20, 59))).toBe('21:00');
    expect(formatTimeForInput(new Date(2026, 10, 2, 10, 2))).toBe('10:00');
    expect(formatTimeForInput(new Date(2026, 10, 2, 10, 3))).toBe('10:05');
  });

  it('never rounds past the end of the day', () => {
    expect(formatTimeForInput(new Date(2026, 10, 2, 23, 58))).toBe('23:55');
  });
});

describe('class times', () => {
  it('start a new date at 9:00 AM, for 2 hours', () => {
    expect(newClassTimes()).toEqual({ start: '09:00', end: '11:00' });
  });

  it('move the end along with the start, 2 hours later', () => {
    expect(endAfterStart('09:00', '11:00', '13:30')).toBe('15:30');
  });

  it("keep an end time someone chose themselves, as long as it's still after the start", () => {
    expect(endAfterStart('09:00', '12:00', '10:00')).toBe('12:00');
    expect(endAfterStart('09:00', '12:00', '12:30')).toBe('14:30');
  });

  it('never set the end after 10:00 PM', () => {
    expect(endAfterStart('09:00', '11:00', '21:00')).toBe('22:00');
  });
});
