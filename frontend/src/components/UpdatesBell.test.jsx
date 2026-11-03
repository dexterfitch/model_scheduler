/**
 * Tests for the Updates button and list.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UpdatesBell from './UpdatesBell';
import api from '../services/api';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const booked = { id: 1, kind: 'booked', title: 'Anatomy Lab', dates: ['2026-11-03T15:00:00Z'], read_at: null, updated_at: '2026-10-30T15:00:00Z' };
const older = { id: 2, kind: 'released', title: 'Painting II', dates: ['2026-11-04T15:00:00Z'], paid: false, read_at: '2026-10-29T15:00:00Z', updated_at: '2026-10-28T15:00:00Z' };

/** Shows the button, with the fake API holding these updates. */
function renderBell(notifications, unread) {
  api.get.mockResolvedValue({ data: { notifications, unread } });
  api.post.mockResolvedValue({});
  renderWithDialogs(<MemoryRouter><UpdatesBell /></MemoryRouter>);
}

beforeAll(() => {
  window.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
});

beforeEach(() => vi.clearAllMocks());

describe('UpdatesBell', () => {
  it('says how many updates are new', async () => {
    renderBell([booked, older], 1);
    expect(await screen.findByRole('button', { name: 'Updates, 1 new' })).toBeInTheDocument();
  });

  it('is just "Updates" when nothing is new', async () => {
    renderBell([older], 0);
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledWith('/notifications'));
    expect(screen.getByRole('button', { name: 'Updates' })).toBeInTheDocument();
  });

  it('lists the updates, marks the new ones, and marks them all read', async () => {
    renderBell([booked, older], 1);
    await userEvent.click(await screen.findByRole('button', { name: 'Updates, 1 new' }));

    const panel = await screen.findByRole('dialog', { name: 'Updates' });
    const items = within(panel).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/You're booked for Anatomy Lab/);
    expect(within(items[0]).getByText('New')).toBeInTheDocument();
    expect(within(items[1]).queryByText('New')).toBeNull();
    expect(api.post).toHaveBeenCalledWith('/notifications/read');
    expect(screen.getByRole('button', { name: 'Updates' })).toBeInTheDocument();
  });

  it('says so when there are no updates yet', async () => {
    renderBell([], 0);
    await userEvent.click(await screen.findByRole('button', { name: 'Updates' }));
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('links each update to the page where it can be seen', async () => {
    renderBell([booked], 1);
    await userEvent.click(await screen.findByRole('button', { name: 'Updates, 1 new' }));
    const panel = await screen.findByRole('dialog', { name: 'Updates' });
    expect(within(panel).getByRole('link', { name: /Anatomy Lab/ })).toHaveAttribute('href', '/');
  });

  it("stays quiet if updates can't be loaded", async () => {
    api.get.mockRejectedValue(new Error('offline'));
    renderWithDialogs(<MemoryRouter><UpdatesBell /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Updates' })).toBeInTheDocument();
  });

  it('clears every update after confirming, and keeps them if you go back', async () => {
    api.delete.mockResolvedValue({});
    renderBell([booked, older], 1);
    await userEvent.click(await screen.findByRole('button', { name: 'Updates, 1 new' }));
    const panel = await screen.findByRole('dialog', { name: 'Updates' });

    await userEvent.click(within(panel).getByRole('button', { name: 'Clear All' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Clear all your updates?' })).getByRole('button', { name: 'Keep Them' }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(within(panel).getAllByRole('listitem')).toHaveLength(2);

    await userEvent.click(within(panel).getByRole('button', { name: 'Clear All' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Clear all your updates?' })).getByRole('button', { name: 'Clear All' }));
    expect(api.delete).toHaveBeenCalledWith('/notifications');
    expect(await within(panel).findByText(/Nothing yet/)).toBeInTheDocument();
  });

  it("doesn't offer Clear All when there's nothing to clear", async () => {
    renderBell([], 0);
    await userEvent.click(await screen.findByRole('button', { name: 'Updates' }));
    const panel = await screen.findByRole('dialog', { name: 'Updates' });
    expect(within(panel).queryByRole('button', { name: 'Clear All' })).toBeNull();
  });
});
