/**
 * Tests for History: who changed what, when and why.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import History from './History';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const pat = { first_name: 'Pat', last_name: 'Reyes' };
/** A History entry by Pat. */
const entry = (id, summary, extra = {}) => ({ id, action: 'edited', summary, note: null, created_at: '2026-11-02T20:01:00Z', user: pat, ...extra });

beforeEach(() => vi.clearAllMocks());

describe('History', () => {
  it('lists what was done, by whom, when, and the note given', async () => {
    api.get.mockResolvedValue({ data: [entry(2, 'Cancelled Anatomy Lab (1 date still to come).', { note: 'Faculty on leave' }), entry(1, 'Booked Jordan Ellis for Anatomy Lab on Tue Nov 3, 10:00 AM.')] });
    render(<History />);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Cancelled Anatomy Lab (1 date still to come).');
    expect(items[0]).toHaveTextContent('Pat Reyes');
    expect(items[0]).toHaveTextContent('Note: Faculty on leave');
    expect(items[1]).not.toHaveTextContent('Note:');
  });

  it('searches as you type', async () => {
    api.get.mockResolvedValue({ data: [] });
    render(<History />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search History' }), { target: { value: 'anatomy' } });
    await vi.waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/history_entries', { params: { q: 'anatomy' } }));
  });

  it('loads older entries on request', async () => {
    const first = Array.from({ length: 100 }, (_, i) => entry(200 - i, `Entry ${200 - i}`));
    api.get.mockResolvedValueOnce({ data: first }).mockResolvedValueOnce({ data: [entry(100, 'Entry 100')] });
    render(<History />);
    await userEvent.click(await screen.findByRole('button', { name: 'Show Older' }));
    expect(api.get).toHaveBeenLastCalledWith('/history_entries', { params: { q: '', before_id: 101 } });
    expect(await screen.findByText('Entry 100')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Older' })).toBeNull();
  });

  it('says so when nothing is recorded', async () => {
    api.get.mockResolvedValue({ data: [] });
    render(<History />);
    expect(await screen.findByText('Nothing recorded yet.')).toBeInTheDocument();
  });
});
