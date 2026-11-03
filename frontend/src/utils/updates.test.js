/**
 * Tests for the words shown for each update.
 */

import { updateMessage, updateLink } from './updates';
import { formatDateWithWeekday, formatTimeShort } from './time';

const nov3 = '2026-11-03T15:00:00Z';
const nov10 = '2026-11-10T15:00:00Z';
const nov17 = '2026-11-17T15:00:00Z';

/** An update of this kind about Anatomy Lab. */
const update = (kind, extra = {}) => ({ id: 1, kind, title: 'Anatomy Lab', dates: [nov3], paid: null, about: null, ...extra });

describe('updateMessage', () => {
  it('gives one date with its time', () => {
    expect(updateMessage(update('booked')))
      .toBe(`You're booked for Anatomy Lab on ${formatDateWithWeekday(nov3)} at ${formatTimeShort(nov3)}.`);
  });

  it('gives several dates as a count and a range', () => {
    expect(updateMessage(update('booked', { dates: [nov17, nov3, nov10] })))
      .toBe(`You're booked for Anatomy Lab on 3 dates, ${formatDateWithWeekday(nov3)} to ${formatDateWithWeekday(nov17)}.`);
  });

  it('says when a cancellation is still paid', () => {
    expect(updateMessage(update('date_cancelled', { paid: true }))).toMatch(/^Anatomy Lab was cancelled on .*\. You'll still be paid\.$/);
    expect(updateMessage(update('released', { paid: false }))).not.toMatch(/paid/);
  });

  it('names who dropped out, for admins', () => {
    expect(updateMessage(update('dropped_out', { about: 'Jordan Ellis' }))).toMatch(/^Jordan Ellis dropped out of Anatomy Lab on /);
  });

  it('has words for every kind of update', () => {
    for (const kind of ['booked', 'class_booked', 'released', 'date_cancelled', 'class_cancelled', 'dropped_out', 'model_cancelled', 'date_moved', 'class_edited', 'class_date_moved', 'class_date_added']) {
      expect(updateMessage(update(kind, { about: 'Jordan Ellis' }))).toContain('Anatomy Lab');
    }
  });
});

describe('error updates', () => {
  it('say what went wrong and where to look, and link to the SuperUser Panel', () => {
    const error = { id: 9, kind: 'error', title: 'RuntimeError: boom', dates: [] };
    expect(updateMessage(error)).toBe('Something went wrong in the app: RuntimeError: boom. See the Error Log in the SuperUser Panel.');
    expect(updateLink(error)).toBe('/superuser');
  });
});

describe("updates about a faculty member's class", () => {
  it('say what the coordinator changed', () => {
    expect(updateMessage(update('class_edited', { about: 'room changed from 201 to 305' })))
      .toBe('The coordinator changed Anatomy Lab: room changed from 201 to 305.');
    expect(updateMessage(update('class_date_moved'))).toMatch(/^The coordinator moved a date of Anatomy Lab: it's now on /);
    expect(updateMessage(update('class_date_added'))).toMatch(/^The coordinator added a date to Anatomy Lab: /);
  });
});

describe('updateLink', () => {
  it('sends admins to Requests for a drop-out, and everyone else to their own first page', () => {
    expect(updateLink(update('dropped_out'))).toBe('/requests');
    expect(updateLink(update('booked'))).toBe('/');
  });
});
