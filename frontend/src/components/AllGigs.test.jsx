/**
 * Tests for the Gig Registry: filters, search, corrections and the phone cards.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AllGigs from './AllGigs';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { formatTime } from '../utils/time';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const priya = { first_name: 'Priya', last_name: 'Nair' };
/** A gig for a model. */
const gig = (id, model, extra = {}) => ({
  id, status: 'confirmed', billable: null,
  art_model_availability: { user: model },
  faculty_request: {
    request_series_id: 1, class_name: 'Figure Drawing I', department: 'Drawing', model_mode: 'clothed', user: priya,
    starts_at: daysFromNow(5 + id, 15), ends_at: daysFromNow(5 + id, 17)
  },
  ...extra
});
const gigs = [
  gig(1, { first_name: 'Jordan', last_name: 'Ellis' }),
  gig(2, { first_name: 'Sam', last_name: 'Marsh' }, { status: 'cancelled', billable: true }),
];

/** The table's rows as lists of cell text. */
const tableRows = (table) => within(table).getAllByRole('row').slice(1)
  .map(r => within(r).getAllByRole('cell').map(c => c.textContent));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: gigs });
});

describe('AllGigs (Gig Registry)', () => {
  it('gives date, time, class, faculty, model and status their own columns', async () => {
    render(<AllGigs />);
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent))
      .toEqual(['Date', 'Time', 'Class', 'Faculty', 'Model', 'Status']);
    await within(table).findByText('Jordan Ellis');
  });

  it('puts each gig on its own row, with its status spelled out', async () => {
    render(<AllGigs />);
    const table = await screen.findByRole('table');
    await within(table).findByText('Jordan Ellis');
    const rows = tableRows(table);

    expect(rows).toHaveLength(2);
    expect(rows[0][4]).toBe('Jordan Ellis');
    expect(rows[0][5]).toBe('Confirmed');
    expect(rows[1][4]).toBe('Sam Marsh');
    expect(rows[1][5]).toBe('Cancelled (Billable)');
    expect(rows[0][3]).toBe('Priya Nair');
  });

  it('labels the date filter fields', async () => {
    render(<AllGigs />);
    await userEvent.click(await screen.findByRole('button', { name: 'Date Range' }));
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('keeps the status filters and the date filters in separate, named groups, like Requests', async () => {
    render(<AllGigs />);
    await screen.findAllByText('Jordan Ellis');
    const status = screen.getByRole('group', { name: 'Status' });
    const dates = screen.getByRole('group', { name: 'Dates' });
    expect(within(status).getAllByRole('button').map(b => b.textContent.trim())).toEqual(['All', 'Confirmed', 'Cancelled']);
    expect(within(dates).getAllByRole('button').map(b => b.textContent.trim())).toEqual(['All Dates', 'Upcoming', 'Past', 'Date Range']);
    expect(within(status).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dates).getByRole('button', { name: 'All Dates' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows only past or only upcoming gigs', async () => {
    const lastWeek = gig(3, { first_name: 'Riley', last_name: 'Okafor' });
    lastWeek.faculty_request = { ...lastWeek.faculty_request, starts_at: daysFromNow(-7, 15), ends_at: daysFromNow(-7, 17) };
    api.get.mockResolvedValue({ data: [...gigs, lastWeek] });
    render(<AllGigs />);
    const table = await screen.findByRole('table');
    await within(table).findByText('Riley Okafor');

    await userEvent.click(screen.getByRole('button', { name: 'Past' }));
    expect(tableRows(table).map(r => r[4])).toEqual(['Riley Okafor']);

    await userEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    expect(tableRows(table).map(r => r[4])).toEqual(['Jordan Ellis', 'Sam Marsh']);
  });

  it('finds gigs by model, faculty or class, ignoring extra spaces', async () => {
    render(<AllGigs />);
    const table = await screen.findByRole('table');
    await within(table).findByText('Jordan Ellis');
    await userEvent.type(screen.getByRole('textbox', { name: /Search/ }), ' jordan ellis ');
    expect(tableRows(table).map(r => r[4])).toEqual(['Jordan Ellis']);
  });

  it('spells out corrected gigs: no-shows and gigs set to not paid', async () => {
    const noShow = gig(3, { first_name: 'Riley', last_name: 'Okafor' }, { status: 'cancelled', billable: false, no_show: true });
    const unpaid = gig(4, { first_name: 'Devon', last_name: 'Price' }, { billable: false });
    api.get.mockResolvedValue({ data: [noShow, unpaid] });
    render(<AllGigs />);
    const table = await screen.findByRole('table');
    await within(table).findByText('Riley Okafor');
    expect(tableRows(table).map(r => r[5])).toEqual(['No-show (Not paid)', 'Confirmed (Not paid)']);
  });

  describe('correcting a past gig', () => {
    const jordan = { id: 1, first_name: 'Jordan', last_name: 'Ellis', role: 'model' };
    const lastWeek = gig(5, jordan);
    lastWeek.faculty_request = { ...lastWeek.faculty_request, class_name: 'Gesture Drawing', starts_at: daysFromNow(-7, 15), ends_at: daysFromNow(-7, 17) };
    const nextWeek = gig(6, { first_name: 'Sofia', last_name: 'Marsh' });

    beforeEach(() => api.get.mockImplementation((url) => Promise.resolve({ data: url === '/gigs' ? [lastWeek, nextWeek] : [] })));

    it('offers Make Correction on gigs whose class has started, and not on later ones', async () => {
      render(<AllGigs />);
      expect((await screen.findAllByRole('button', { name: /^Make Correction for Jordan Ellis on / })).length).toBeGreaterThan(0);
      expect(screen.queryAllByRole('button', { name: /^Make Correction for Sofia Marsh/ })).toHaveLength(0);
    });

    it('opens the same Correct the record window as Requests', async () => {
      render(<AllGigs />);
      const [button] = await screen.findAllByRole('button', { name: /^Make Correction for Jordan Ellis on / });
      await userEvent.click(button);
      const dialog = await screen.findByRole('dialog', { name: 'Correct the record' });
      expect(dialog).toHaveTextContent('Gesture Drawing');
      expect(dialog).toHaveTextContent('Jordan Ellis');
    });

    it('reloads the registry after a correction is saved', async () => {
      api.post.mockResolvedValue({ data: {} });
      render(<AllGigs />);
      const [button] = await screen.findAllByRole('button', { name: /^Make Correction for Jordan Ellis on / });
      await userEvent.click(button);
      await userEvent.click(await screen.findByRole('radio', { name: "Jordan didn't show up (not paid)" }));
      await userEvent.click(screen.getByRole('button', { name: 'Save Correction' }));

      expect(api.post).toHaveBeenCalledWith('/gigs/5/corrections', { correction: { kind: 'no_show' } });
      await vi.waitFor(() => expect(api.get.mock.calls.filter(([url]) => url === '/gigs').length).toBe(2));
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('shows the hours really worked when they were corrected, with the booked hours underneath', async () => {
    const longer = gig(7, { first_name: 'Jordan', last_name: 'Ellis' }, {
      worked_starts_at: daysFromNow(12, 15), worked_ends_at: daysFromNow(12, 18)
    });
    api.get.mockResolvedValue({ data: [longer] });
    render(<AllGigs />);
    const table = await screen.findByRole('table');
    await within(table).findByText('Jordan Ellis');
    const time = tableRows(table)[0][1];
    expect(time).toContain(`${formatTime(daysFromNow(12, 15))} – ${formatTime(daysFromNow(12, 18))}`);
    expect(time).toContain(`booked ${formatTime(longer.faculty_request.starts_at)} – ${formatTime(longer.faculty_request.ends_at)}`);
  });
});
