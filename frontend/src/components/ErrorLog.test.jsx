/**
 * Tests for the Error Log in the SuperUser Panel.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorLog from './ErrorLog';
import api from '../services/api';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));

const reports = [
  { id: 2, source: 'server', message: "NoMethodError: undefined method 'name' for nil", details: 'app/controllers/gigs_controller.rb:12', path: '/gigs', count: 3, last_seen_at: '2026-11-02T15:00:00Z', user: { first_name: 'Pat', last_name: 'Reyes' } },
  { id: 1, source: 'browser', message: 'TypeError: x is undefined', details: null, path: '/', count: 1, last_seen_at: '2026-11-01T15:00:00Z', user: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: reports });
  api.delete.mockResolvedValue({});
});

describe('ErrorLog', () => {
  it('lists each error with where it happened, how often, and for whom', async () => {
    renderWithDialogs(<ErrorLog />);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("NoMethodError: undefined method 'name' for nil");
    expect(items[0]).toHaveTextContent('Server');
    expect(items[0]).toHaveTextContent('3 times');
    expect(items[0]).toHaveTextContent('/gigs');
    expect(items[0]).toHaveTextContent('Pat Reyes');
    expect(items[1]).toHaveTextContent('Browser');
  });

  it('says so when there are none', async () => {
    api.get.mockResolvedValue({ data: [] });
    renderWithDialogs(<ErrorLog />);
    expect(await screen.findByText('No errors recorded.')).toBeInTheDocument();
  });

  it('clears the log after confirming', async () => {
    renderWithDialogs(<ErrorLog />);
    await screen.findAllByRole('listitem');
    await userEvent.click(screen.getByRole('button', { name: 'Clear Log' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear Log' }));
    expect(api.delete).toHaveBeenCalledWith('/error_reports');
    expect(await screen.findByText('No errors recorded.')).toBeInTheDocument();
  });
});
