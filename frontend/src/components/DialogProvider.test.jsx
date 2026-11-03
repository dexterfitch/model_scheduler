/**
 * Tests for the shared confirmation and message windows.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DialogProvider, useDialog } from './DialogProvider';

/** A button that opens a window and reports the answer. */
function Asker({ open, onAnswer }) {
  const dialogs = useDialog();
  return <button onClick={async () => onAnswer(await open(dialogs))}>Ask</button>;
}

/** Shows an Asker inside the provider. */
function renderAsker(open) {
  const onAnswer = vi.fn();
  render(<DialogProvider><Asker open={open} onAnswer={onAnswer} /></DialogProvider>);
  return onAnswer;
}

/** Asks to cancel a class, as the pages do. */
const askToCancel = ({ confirm }) =>
  confirm({ title: 'Cancel this class?', message: 'All 3 dates will be cancelled.', confirmLabel: 'Cancel Class', danger: true });

describe('DialogProvider', () => {
  it('asks with clearly named buttons and resolves true when confirmed', async () => {
    const onAnswer = renderAsker(askToCancel);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    const dialog = await screen.findByRole('dialog', { name: 'Cancel this class?' });
    expect(dialog).toHaveTextContent('All 3 dates will be cancelled.');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Class' }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
  });

  it('can ask for an optional note, and resolves with it when confirmed', async () => {
    const onAnswer = renderAsker(({ confirm }) => confirm({ title: 'Cancel this class?', confirmLabel: 'Cancel Class', noteLabel: 'Reason (optional)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await userEvent.type(await screen.findByLabelText('Reason (optional)'), 'Faculty on leave');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Class' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith({ note: 'Faculty on leave' }));
  });

  it('resolves false when they go back', async () => {
    const onAnswer = renderAsker(askToCancel);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Go Back' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it('resolves false when they close the window', async () => {
    const onAnswer = renderAsker(askToCancel);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it('shows a message that closes with OK', async () => {
    const onAnswer = renderAsker(({ notify }) => notify({ title: "Couldn't save", message: 'That time overlaps another slot.' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    const dialog = await screen.findByRole('dialog', { name: "Couldn't save" });
    expect(dialog).toHaveTextContent('That time overlaps another slot.');
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalled());
  });
});
