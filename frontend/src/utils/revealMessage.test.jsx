/**
 * Tests for bringing a message into view when it appears.
 */

import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRevealMessage } from './revealMessage';

/** A message that appears when the button is pressed, using the hook. */
function Harness({ next = 'Something went wrong.' }) {
  const [message, setMessage] = useState('');
  const ref = useRevealMessage(message);
  return (
    <>
      {message && <div ref={ref} tabIndex={-1} role="alert">{message}</div>}
      <button onClick={() => setMessage(next)}>Save</button>
    </>
  );
}

let scrolled;
beforeEach(() => {
  scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;
});
afterEach(() => {
  delete Element.prototype.scrollIntoView;
  delete window.matchMedia;
});

describe('useRevealMessage', () => {
  it('scrolls a new message into view and moves focus to it', async () => {
    render(<Harness />);
    expect(scrolled).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(scrolled).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it("doesn't animate the scroll for people who ask for reduced motion", async () => {
    window.matchMedia = (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' });
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(scrolled).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });

  it('also works for a list of messages', async () => {
    render(<Harness next={['Email is invalid', 'Skin tone must be chosen']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(scrolled).toHaveBeenCalled();
  });
});
