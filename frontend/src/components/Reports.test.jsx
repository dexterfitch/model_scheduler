import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reports from './Reports';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const jordan = { id: 1, first_name: 'Jordan', last_name: 'Ellis' };
const riley  = { id: 2, first_name: 'Riley',  last_name: 'Park' };
const faculty = { first_name: 'Priya', last_name: 'Nair' };

const gig = (model, start, end, extra = {}) => ({
  status: 'confirmed', billable: null,
  art_model_availability: { user: model },
  faculty_request: {
    starts_at: start, ends_at: end, class_name: 'Figure Drawing I',
    department: 'Drawing', model_mode: 'clothed', user: faculty
  },
  ...extra
});
const nude = (g) => ({ ...g, faculty_request: { ...g.faculty_request, model_mode: 'nude' } });

const gigs = [
  gig(jordan, '2026-11-02T15:00:00Z', '2026-11-02T17:00:00Z'),                                   // 2 hrs clothed
  nude(gig(jordan, '2026-11-03T15:00:00Z', '2026-11-03T18:00:00Z')),                             // 3 hrs nude
  gig(jordan, '2026-11-04T15:00:00Z', '2026-11-04T17:00:00Z', { status: 'cancelled', billable: true }),  // late cancel: paid
  gig(jordan, '2026-11-05T15:00:00Z', '2026-11-05T17:00:00Z', { status: 'cancelled', billable: false }), // early cancel: not paid
  gig(jordan, '2026-12-07T15:00:00Z', '2026-12-07T17:00:00Z'),                                   // outside the range
  gig(riley,  '2026-11-10T15:00:00Z', '2026-11-10T16:20:00Z'),                                   // 1h20m
];

async function runReport(start, end) {
  render(<Reports />);
  await waitForGigsToLoad();
  const startInput = screen.getByLabelText('Start Date');
  const endInput = screen.getByLabelText('End Date');
  fireEvent.change(startInput, { target: { value: start } });
  fireEvent.change(endInput, { target: { value: end } });
  await userEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
}

const waitForGigsToLoad = () => vi.waitFor(() => expect(api.get).toHaveBeenCalled());

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: gigs });
});

describe('Reports (model hours)', () => {
  it('pays for confirmed gigs and late cancellations, but not early cancellations or other months', async () => {
    await runReport('2026-11-01', '2026-11-30');
    // 2 clothed + 3 nude + 2 late-cancelled = 7. The early cancel and December gig don't count.
    expect(await screen.findByText('Payable Total: 7 hrs')).toBeInTheDocument();
  });

  it('marks late cancellations as billable', async () => {
    await runReport('2026-11-01', '2026-11-30');
    expect((await screen.findAllByText(/Late Cancel — Billable/)).length).toBe(1);
  });

  it('rounds hours to the nearest quarter hour', async () => {
    await runReport('2026-11-01', '2026-11-30');
    // 1 hour 20 minutes rounds to 1.25
    expect(await screen.findByText('Payable Total: 1.25 hrs')).toBeInTheDocument();
  });

  it('prints a table whose columns match their headings, with a status and totals', async () => {
    await runReport('2026-11-01', '2026-11-30');
    const table = await screen.findByRole('table');

    const headings = within(table).getAllByRole('columnheader').map(h => h.textContent);
    expect(headings).toEqual(['Model', 'Department', 'Date', 'Time', 'Mode', 'Status', 'Hours']);

    const rows = within(table).getAllByRole('row').slice(1)
      .map(r => within(r).getAllByRole('cell').map(c => c.textContent));

    // The late cancellation is labeled, and its Mode column really shows the mode
    const lateCancel = rows.find(r => r[5] === 'Late cancel (billable)');
    expect(lateCancel[4]).toBe('Clothed');
    expect(lateCancel[6]).toBe('2');

    // A total under each model, and one for the whole report (7 + 1.25)
    expect(rows).toContainEqual(['Total for Jordan Ellis', '7']);
    expect(rows).toContainEqual(['Total for Riley Park', '1.25']);
    expect(rows).toContainEqual(['Grand total', '8.25']);
  });

  it('says so when nothing falls in the range', async () => {
    await runReport('2027-01-01', '2027-01-31');
    expect(await screen.findByText('No gigs found in this date range.')).toBeInTheDocument();
  });

  it('starts with the current month filled in', async () => {
    render(<Reports />);
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    expect(screen.getByLabelText('Start Date')).toHaveValue(`${now.getFullYear()}-${month}-01`);
    expect(screen.getByLabelText('End Date')).toHaveValue(`${now.getFullYear()}-${month}-${lastDay}`);
  });

  it('asks for both dates before generating, right under the fields', async () => {
    render(<Reports />);
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    expect(screen.getByText('Please select both a start and end date.')).toBeInTheDocument();
  });
});