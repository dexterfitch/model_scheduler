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
    await userEvent.click(await screen.findByRole('button', { name: 'Filter by Date' }));
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });
});