import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AllGigs from './AllGigs';
import api from '../services/api';
import { daysFromNow } from '../test/dates';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const priya = { first_name: 'Priya', last_name: 'Nair' };
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
});
