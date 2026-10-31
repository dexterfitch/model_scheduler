/**
 * Tests for the Directory.
 */

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserDirectory from './UserDirectory';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

describe('UserDirectory', () => {
  it('leaves out the Pronouns badge when a model has not entered any', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu', pronouns: 'they/them', skin_tone: 'Light', gender_identity: 'Woman' },
      { id: 2, role: 'model', first_name: 'Sam', last_name: 'Marsh', email: 'smarsh@mica.edu', pronouns: '', skin_tone: 'Dark', gender_identity: 'Man' }
    ] });
    render(<MemoryRouter><UserDirectory /></MemoryRouter>);

    expect((await screen.findAllByText('Pronouns: they/them')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^Pronouns:\s*$/)).toHaveLength(0);
  });

  it('lists retired models after the others, marked Retired, and counts only active models', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Ana', last_name: 'Retired', email: 'ar@mica.edu', skin_tone: 'Light', gender_identity: 'Woman', retired_at: '2026-10-01T00:00:00Z' },
      { id: 2, role: 'model', first_name: 'Ben', last_name: 'Active', email: 'ba@mica.edu', skin_tone: 'Dark', gender_identity: 'Man' }
    ] });
    render(<MemoryRouter><UserDirectory /></MemoryRouter>);

    expect(await screen.findByRole('tab', { name: 'Models (1)' })).toBeInTheDocument();
    const table = screen.getAllByRole('table')[0];
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Ben Active');
    expect(rows[1]).toHaveTextContent('Ana Retired');
    expect(within(rows[1]).getByText('Retired')).toBeInTheDocument();
  });

  it('leaves out people whose data was removed', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Removed', last_name: 'Person', email: 'removed-1@removed.invalid', removed_at: '2026-10-01T00:00:00Z' },
      { id: 2, role: 'faculty', first_name: 'Removed', last_name: 'Person', email: 'removed-2@removed.invalid', removed_at: '2026-10-01T00:00:00Z' }
    ] });
    render(<MemoryRouter><UserDirectory /></MemoryRouter>);

    expect(await screen.findByRole('tab', { name: 'Models (0)' })).toBeInTheDocument();
    expect(screen.queryAllByText(/Removed Person/)).toHaveLength(0);
  });

  it('shows body type as a plain badge, the same height as the others', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu', skin_tone: 'Light', gender_identity: 'Woman', body_type: 'Fat' }
    ] });
    render(<MemoryRouter><UserDirectory /></MemoryRouter>);

    const [badge] = await screen.findAllByText('Fat Build');
    expect(badge.querySelector('svg')).toBeNull();
  });
});
