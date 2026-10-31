/**
 * Tests for the pinned success message.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusToast from './StatusToast';

describe('StatusToast', () => {
  it('keeps an empty status area on the page, so screen readers hear each new message', () => {
    render(<StatusToast message="" onClose={() => {}} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('shows the message until it is closed', async () => {
    const onClose = vi.fn();
    render(<StatusToast message="Date cancelled." onClose={onClose} />);
    expect(screen.getByRole('status')).toHaveTextContent('Date cancelled.');
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('can hold a button alongside the message', () => {
    render(<StatusToast message="Gig confirmed." onClose={() => {}}><button>Back to Requests</button></StatusToast>);
    expect(screen.getByRole('button', { name: 'Back to Requests' })).toBeInTheDocument();
  });
});
