/**
 * Tests for My Profile.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Profile from './Profile';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { patch: vi.fn() } }));

const model = {
  id: 10, role: 'model', first_name: 'Jordan', last_name: 'Ellis',
  gender_identity: 'Woman', skin_tone: 'Medium',
  willing_to_model_nude: true, body_type: 'Average', genitalia: 'Intersex'
};

/** Shows the profile for a person. */
function renderProfile(user, setCurrentUser = vi.fn()) {
  const utils = render(
    <MemoryRouter>
      <Profile currentUser={user} setCurrentUser={setCurrentUser} />
    </MemoryRouter>
  );
  return { ...utils, setCurrentUser };
}

/** A dropdown by its name. */
const select = (container, name) => container.querySelector(`select[name="${name}"]`);

beforeEach(() => vi.clearAllMocks());

describe('Profile', () => {
  it('clears genitalia when a model unchecks posing nude', async () => {
    api.patch.mockResolvedValue({ data: model });
    const { container } = renderProfile(model);

    await userEvent.click(screen.getByLabelText('I am willing to model nude'));
    expect(select(container, 'genitalia')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(api.patch).toHaveBeenCalledWith('/users/10', {
      user: expect.objectContaining({ willing_to_model_nude: false, genitalia: '' })
    });
  });

  it("doesn't bring back the old answer if they re-check the box", async () => {
    const { container } = renderProfile(model);
    const box = screen.getByLabelText('I am willing to model nude');
    await userEvent.click(box);
    await userEvent.click(box);
    expect(select(container, 'genitalia')).toHaveValue('');
  });

  it('saves the profile and updates the signed-in user', async () => {
    api.patch.mockResolvedValue({ data: { ...model, body_type: 'Fat' } });
    const { setCurrentUser } = renderProfile(model);

    await userEvent.click(screen.getByRole('radio', { name: 'Fat' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(api.patch).toHaveBeenCalledWith('/users/10', { user: expect.objectContaining({ body_type: 'Fat' }) });
    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    expect(screen.getByRole('button', { name: 'Back to home' })).toBeInTheDocument();
    expect(setCurrentUser).toHaveBeenCalledWith(expect.objectContaining({ body_type: 'Fat' }));
  });

  it('shows an error when saving fails', async () => {
    api.patch.mockRejectedValue({});
    renderProfile(model);
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(await screen.findByText('Failed to update profile.')).toBeInTheDocument();
  });

  it('hides model-only fields from faculty', () => {
    renderProfile({ id: 1, role: 'faculty', first_name: 'Priya', last_name: 'Nair' });
    expect(screen.queryByRole('radiogroup', { name: 'Body Type' })).toBeNull();
    expect(screen.queryByText('Model Details')).toBeNull();
  });

  it("explains why the server refused the save", async () => {
    api.patch.mockRejectedValue({ response: { data: { errors: ["You're booked for 2 nude sessions; cancel those first."] } } });
    renderProfile(model);
    await userEvent.click(screen.getByLabelText('I am willing to model nude'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(await screen.findByText(/booked for 2 nude sessions/)).toBeInTheDocument();
  });
  
  it('puts back the saved answers when the server refuses the change', async () => {
    api.patch.mockRejectedValue({ response: { data: { errors: ["You're booked for 2 nude sessions; cancel those first."] } } });
    renderProfile(model);
    const nude = screen.getByLabelText('I am willing to model nude');
    await userEvent.click(nude);
    expect(nude).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await screen.findByText(/booked for 2 nude sessions/);
    expect(nude).toBeChecked();
    expect(screen.getByLabelText('Genitalia')).toHaveValue('Intersex');
  });

  it('brings a refused save’s reason into view and moves focus to it, even when scrolled down', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    api.patch.mockRejectedValue({ response: { data: { errors: ["You're booked for 4 nude sessions; cancel those first."] } } });
    renderProfile(model);
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('booked for 4 nude sessions');
    expect(scrolled).toHaveBeenCalled();
    expect(alert).toHaveFocus();
    delete Element.prototype.scrollIntoView;
  });

  it('brings Profile saved into view too', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    api.patch.mockResolvedValue({ data: model });
    renderProfile(model);
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    expect(scrolled).toHaveBeenCalled();
    delete Element.prototype.scrollIntoView;
  });

  it('explains to models why they are asked personal questions, but not to faculty', () => {
    const { unmount } = renderProfile(model);
    expect(screen.getByRole('button', { name: 'Why are we asking?' })).toBeInTheDocument();
    unmount();
    renderProfile({ id: 1, role: 'faculty', first_name: 'Priya', last_name: 'Nair' });
    expect(screen.queryByRole('button', { name: 'Why are we asking?' })).toBeNull();
  });

  it('labels every field so screen readers can announce them', () => {
    renderProfile(model);
    for (const label of [/First Name/, /Last Name/, /Phone Number/, /Stage Name/, /Pronouns/, 'Gender *']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('lets a model choose a skin tone as a radio button and saves it', async () => {
    api.patch.mockResolvedValue({ data: { ...model, skin_tone: 'Dark' } });
    renderProfile(model);

    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(api.patch).toHaveBeenCalledWith('/users/10', { user: expect.objectContaining({ skin_tone: 'Dark' }) });
  });
});
