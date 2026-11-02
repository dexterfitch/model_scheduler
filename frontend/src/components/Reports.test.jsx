/**
 * Tests for Reports: totals, paid cancellations, corrections and the print table.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reports from './Reports';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const jordan = { id: 1, first_name: 'Jordan', last_name: 'Ellis' };
const riley  = { id: 2, first_name: 'Riley',  last_name: 'Park' };
const faculty = { first_name: 'Priya', last_name: 'Nair' };

/** A gig for a model at these times. */
const gig = (model, start, end, extra = {}) => ({
  status: 'confirmed', billable: null,
  art_model_availability: { user: model },
  faculty_request: {
    starts_at: start, ends_at: end, class_name: 'Figure Drawing I',
    department: 'Drawing', model_mode: 'clothed', user: faculty
  },
  ...extra
});
/** The same gig, nude. */
const nude = (g) => ({ ...g, faculty_request: { ...g.faculty_request, model_mode: 'nude' } });

const gigs = [
  gig(jordan, '2026-11-02T15:00:00Z', '2026-11-02T17:00:00Z'),
  nude(gig(jordan, '2026-11-03T15:00:00Z', '2026-11-03T18:00:00Z')),
  gig(jordan, '2026-11-04T15:00:00Z', '2026-11-04T17:00:00Z', { status: 'cancelled', billable: true }),
  gig(jordan, '2026-11-05T15:00:00Z', '2026-11-05T17:00:00Z', { status: 'cancelled', billable: false }),
  gig(jordan, '2026-12-07T15:00:00Z', '2026-12-07T17:00:00Z'),
  gig(riley,  '2026-11-10T15:00:00Z', '2026-11-10T16:20:00Z'),
];

/** Shows Reports and runs it for a date range. */
async function runReport(start, end) {
  render(<Reports />);
  await waitForGigsToLoad();
  const startInput = screen.getByLabelText('Start Date');
  const endInput = screen.getByLabelText('End Date');
  fireEvent.change(startInput, { target: { value: start } });
  fireEvent.change(endInput, { target: { value: end } });
  await userEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
}

/** Waits for the gigs to be requested. */
const waitForGigsToLoad = () => vi.waitFor(() => expect(api.get).toHaveBeenCalled());

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: gigs });
});

describe('Reports (model hours)', () => {
  it('pays for confirmed gigs and late cancellations, but not early cancellations or other months', async () => {
    await runReport('2026-11-01', '2026-11-30');
    expect(await screen.findByText('Payable Total: 7 hrs')).toBeInTheDocument();
  });

  it('marks late cancellations as billable', async () => {
    await runReport('2026-11-01', '2026-11-30');
    expect((await screen.findAllByText(/Late Cancel — Billable/)).length).toBe(1);
  });

  it('rounds hours to the nearest quarter hour', async () => {
    await runReport('2026-11-01', '2026-11-30');
    expect(await screen.findByText('Payable Total: 1.25 hrs')).toBeInTheDocument();
  });

  it('prints a table whose columns match their headings, with a status and totals', async () => {
    await runReport('2026-11-01', '2026-11-30');
    const table = await screen.findByRole('table');

    const headings = within(table).getAllByRole('columnheader').map(h => h.textContent);
    expect(headings).toEqual(['Model', 'Department', 'Date', 'Time', 'Mode', 'Status', 'Hours']);

    const rows = within(table).getAllByRole('row').slice(1)
      .map(r => within(r).getAllByRole('cell').map(c => c.textContent));

    const lateCancel = rows.find(r => r[5] === 'Late cancel (billable)');
    expect(lateCancel[4]).toBe('Clothed');
    expect(lateCancel[6]).toBe('2');

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

  describe('after a past gig was corrected', () => {
    const corrected = { corrections: [{ id: 1, kind: 'hours', summary: 'Hours changed', user: { first_name: 'Pat', last_name: 'Reyes' } }] };
    /** Runs the report for one gig. */
    const run = async (extra) => {
      api.get.mockResolvedValue({ data: [gig(riley, '2026-11-10T15:00:00Z', '2026-11-10T17:00:00Z', extra)] });
      await runReport('2026-11-01', '2026-11-30');
    };
    /** The print table's rows as lists of cell text. */
    const printRows = async () => within(await screen.findByRole('table')).getAllByRole('row').slice(1)
      .map(r => within(r).getAllByRole('cell').map(c => c.textContent));

    it('pays the hours really worked, and says the record was corrected', async () => {
      await run({ worked_starts_at: '2026-11-10T15:00:00Z', worked_ends_at: '2026-11-10T16:30:00Z', ...corrected });
      expect(await screen.findByText('Payable Total: 1.5 hrs')).toBeInTheDocument();
      expect((await printRows())[0][5]).toBe('Confirmed (corrected)');
    });

    it('leaves out a gig that was set to not paid', async () => {
      await run({ billable: false, ...corrected });
      expect(await screen.findByText('No gigs found in this date range.')).toBeInTheDocument();
    });

    it('leaves out a no-show', async () => {
      await run({ status: 'cancelled', billable: false, no_show: true, ...corrected });
      expect(await screen.findByText('No gigs found in this date range.')).toBeInTheDocument();
    });

    it('pays a no-show that was set back to paid, and labels it', async () => {
      await run({ status: 'cancelled', billable: true, no_show: true, ...corrected });
      expect(await screen.findByText('Payable Total: 2 hrs')).toBeInTheDocument();
      expect((await printRows())[0][5]).toBe('No-show (paid, corrected)');
    });
  });
});

describe('downloading the report as a spreadsheet', () => {
  let saved;
  beforeEach(() => {
    saved = null;
    URL.createObjectURL = vi.fn((blob) => { saved = blob; return 'blob:report'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('downloads every paid gig in the range as a CSV file named for the dates', async () => {
    api.get.mockResolvedValue({ data: gigs });
    await runReport('2026-11-01', '2026-11-30');
    await userEvent.click(await screen.findByRole('button', { name: 'Download CSV' }));

    expect(URL.createObjectURL).toHaveBeenCalled();
    const text = await saved.text();
    const lines = text.replace(/^\ufeff/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Model,Department,Class,Faculty,Date,Time,Mode,Status,Hours');
    expect(lines).toHaveLength(5);
    expect(lines.some(l => l.startsWith('Jordan Ellis,Drawing,Figure Drawing I,Priya Nair,') && l.endsWith(',Nude,Confirmed,3'))).toBe(true);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("isn't offered before a report is run", () => {
    api.get.mockResolvedValue({ data: gigs });
    render(<Reports />);
    expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull();
  });
});
