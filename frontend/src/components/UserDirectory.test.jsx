/**
 * Tests for the Directory.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithDialogs } from '../test/render';
import { MemoryRouter } from 'react-router-dom';
import UserDirectory from './UserDirectory';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('UserDirectory', () => {
  it('leaves out the Pronouns badge when a model has not entered any', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu', pronouns: 'they/them', skin_tone: 'Light', gender_identity: 'Woman' },
      { id: 2, role: 'model', first_name: 'Sam', last_name: 'Marsh', email: 'smarsh@mica.edu', pronouns: '', skin_tone: 'Dark', gender_identity: 'Man' }
    ] });
    renderWithDialogs(<MemoryRouter><UserDirectory /></MemoryRouter>);

    expect((await screen.findAllByText('Pronouns: they/them')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^Pronouns:\s*$/)).toHaveLength(0);
  });

  it('lists retired models after the others, marked Retired, and counts only active models', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Ana', last_name: 'Retired', email: 'ar@mica.edu', skin_tone: 'Light', gender_identity: 'Woman', retired_at: '2026-10-01T00:00:00Z' },
      { id: 2, role: 'model', first_name: 'Ben', last_name: 'Active', email: 'ba@mica.edu', skin_tone: 'Dark', gender_identity: 'Man' }
    ] });
    renderWithDialogs(<MemoryRouter><UserDirectory /></MemoryRouter>);

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
    renderWithDialogs(<MemoryRouter><UserDirectory /></MemoryRouter>);

    expect(await screen.findByRole('tab', { name: 'Models (0)' })).toBeInTheDocument();
    expect(screen.queryAllByText(/Removed Person/)).toHaveLength(0);
  });

  it('shows body type as a plain badge, the same height as the others', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu', skin_tone: 'Light', gender_identity: 'Woman', body_type: 'Fat' }
    ] });
    renderWithDialogs(<MemoryRouter><UserDirectory /></MemoryRouter>);

    const [badge] = await screen.findAllByText('Fat Build');
    expect(badge.querySelector('svg')).toBeNull();
  });

  it('lists models and faculty alphabetically by first name, ignoring a leading emoji, with retired models after', async () => {
    const person = (id, role, first_name, last_name, extra = {}) => ({ id, role, first_name, last_name, email: `${id}@mica.edu`, skin_tone: 'Light', gender_identity: 'Woman', ...extra });
    api.get.mockResolvedValue({ data: [
      person(1, 'model', 'Sofia', 'Marsh'), person(2, 'model', 'devon', 'Price'), person(3, 'model', '\u{1F9E6} Test', 'Tester'),
      person(4, 'model', 'Jordan', 'Ellis', { retired_at: '2026-10-01T00:00:00Z' }), person(5, 'model', 'Ana', 'Zed', { retired_at: '2026-10-01T00:00:00Z' }),
      person(6, 'faculty', 'Priya', 'Nair'), person(7, 'faculty', 'Alice', 'Chen'), person(8, 'faculty', 'Marcus', 'Bell'),
    ] });
    renderWithDialogs(<MemoryRouter><UserDirectory /></MemoryRouter>);
    const [modelsTable] = await screen.findAllByRole('table');
    const names = (table) => within(table).getAllByRole('row').slice(1).map(r => r.querySelector('td').textContent.replace('Retired', '').trim());
    expect(names(modelsTable)).toEqual(['devon Price', 'Sofia Marsh', '\u{1F9E6} Test Tester', 'Ana Zed', 'Jordan Ellis']);

    await userEvent.click(screen.getByRole('tab', { name: /Faculty/ }));
    const facultyTable = screen.getAllByRole('table').find(t => within(t).queryByText('Alice Chen'));
    expect(names(facultyTable)).toEqual(['Alice Chen', 'Marcus Bell', 'Priya Nair']);
  });

  describe('retiring and bringing back from the list', () => {
    const riley = { id: 4, role: 'model', first_name: 'Riley', last_name: 'Okafor', email: 'rokafor@mica.edu', skin_tone: 'Medium', gender_identity: 'Prefer not to say' };
    /** Riley's row in the models table. */
    const rileyRow = async () => (await screen.findAllByText(/Riley Okafor/)).map(el => el.closest('tr')).find(Boolean);

    it('retires a model after confirming, and moves them to the end marked Retired', async () => {
      api.get.mockResolvedValue({ data: [riley, { ...riley, id: 5, first_name: 'Ana', email: 'a@mica.edu' }] });
      api.post.mockResolvedValue({ data: { ...riley, retired_at: '2026-11-03T15:00:00Z' } });
      renderWithDialogs(<MemoryRouter><UserDirectory /></MemoryRouter>);

      await userEvent.click(within(await rileyRow()).getByRole('button', { name: 'Retire Riley Okafor' }));
      const dialog = await screen.findByRole('dialog', { name: 'Retire Riley Okafor?' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Retire Model' }));

      expect(api.post).toHaveBeenCalledWith('/users/4/retire');
      const row = await rileyRow();
      expect(within(row).getByText('Retired')).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Bring Back Riley Okafor' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Models (1)' })).toBeInTheDocument();
      expect(await screen.findByText('Riley Okafor is retired.')).toBeInTheDocument();
    });

    it('brings a retired model back', async () => {
      api.get.mockResolvedValue({ data: [{ ...riley, retired_at: '2026-10-01T00:00:00Z' }] });
      api.post.mockResolvedValue({ data: { ...riley, retired_at: null } });
      renderWithDialogs(<MemoryRouter><UserDirectory /></MemoryRouter>);

      await userEvent.click(within(await rileyRow()).getByRole('button', { name: 'Bring Back Riley Okafor' }));
      expect(api.post).toHaveBeenCalledWith('/users/4/reinstate');
      expect(within(await rileyRow()).queryByText('Retired')).toBeNull();
    });

    it("says why when a model can't be retired yet", async () => {
      api.get.mockResolvedValue({ data: [riley] });
      api.post.mockRejectedValue({ response: { data: { error: 'Riley has 2 upcoming gigs. Release them first.' } } });
      renderWithDialogs(<MemoryRouter><UserDirectory /></MemoryRouter>);

      await userEvent.click(within(await rileyRow()).getByRole('button', { name: 'Retire Riley Okafor' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retire Model' }));
      expect(await screen.findByText(/2 upcoming gigs/)).toBeInTheDocument();
    });
  });
});
