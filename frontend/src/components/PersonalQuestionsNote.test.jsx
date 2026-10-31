/**
 * Tests for the Why are we asking? note.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonalQuestionsNote from './PersonalQuestionsNote';

describe('PersonalQuestionsNote', () => {
  it('starts closed, and opens to explain why we ask and who sees the answers', async () => {
    render(<PersonalQuestionsNote />);
    const toggle = screen.getByRole('button', { name: 'Why are we asking?' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Faculty never see/)).toBeNull();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/match you with art classes/)).toBeVisible();
    expect(screen.getByText(/Prefer not to say/)).toBeVisible();
    expect(screen.getByText(/Faculty never see/)).toBeVisible();
  });

  it('closes again', async () => {
    render(<PersonalQuestionsNote />);
    const toggle = screen.getByRole('button', { name: 'Why are we asking?' });
    await userEvent.click(toggle);
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Faculty never see/)).toBeNull();
  });
});
