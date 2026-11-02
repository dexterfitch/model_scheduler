/**
 * Tests for the Calendar Link button and window.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarLinkButton from './CalendarLinkButton';
import api from '../services/api';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const url = 'https://api.example.edu/calendar/abc123.ics';

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { url } });
});

describe('CalendarLinkButton', () => {
  it("opens the person's private link with how to add it", async () => {
    renderWithDialogs(<CalendarLinkButton />);
    await userEvent.click(screen.getByRole('button', { name: /Calendar Link/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Add to Your Calendar' });
    expect(api.get).toHaveBeenCalledWith('/calendar_link');
    expect(within(dialog).getByLabelText('Your private calendar link')).toHaveValue(url);
    expect(dialog).toHaveTextContent(/Google Calendar/);
    expect(dialog).toHaveTextContent(/Anyone with this link/);
  });

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithDialogs(<CalendarLinkButton />);
    await userEvent.click(screen.getByRole('button', { name: /Calendar Link/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to Your Calendar' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy Link' }));

    expect(writeText).toHaveBeenCalledWith(url);
    expect(await within(dialog).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('resets the link after confirming, and shows the new one', async () => {
    api.post.mockResolvedValue({ data: { url: 'https://api.example.edu/calendar/new456.ics' } });
    renderWithDialogs(<CalendarLinkButton />);
    await userEvent.click(screen.getByRole('button', { name: /Calendar Link/ }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Add to Your Calendar' })).getByRole('button', { name: 'Reset Link' }));

    const ask = await screen.findByRole('dialog', { name: 'Reset your calendar link?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Reset Link' }));

    expect(api.post).toHaveBeenCalledWith('/calendar_link/reset');
    expect(await screen.findByDisplayValue('https://api.example.edu/calendar/new456.ics')).toBeInTheDocument();
  });

  it("says so when the link can't be loaded", async () => {
    api.get.mockRejectedValue(new Error('offline'));
    renderWithDialogs(<CalendarLinkButton />);
    await userEvent.click(screen.getByRole('button', { name: /Calendar Link/ }));
    expect(await screen.findByText(/couldn't load your calendar link/i)).toBeInTheDocument();
  });
});
