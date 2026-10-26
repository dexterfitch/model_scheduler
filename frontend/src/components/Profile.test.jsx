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

function renderProfile(user, setCurrentUser = vi.fn()) {
  const utils = render(
    <MemoryRouter>
      <Profile currentUser={user} setCurrentUser={setCurrentUser} />
    </MemoryRouter>
  );
  return { ...utils, setCurrentUser };
}

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
    const { container, setCurrentUser } = renderProfile(model);

    await userEvent.selectOptions(select(container, 'body_type'), 'Fat');
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(api.patch).toHaveBeenCalledWith('/users/10', { user: expect.objectContaining({ body_type: 'Fat' }) });
    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    // Stays on the page with a way back, instead of leaving on a timer
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
    const { container } = renderProfile({ id: 1, role: 'faculty', first_name: 'Priya', last_name: 'Nair' });
    expect(select(container, 'body_type')).toBeNull();
    expect(screen.queryByText('Model Details')).toBeNull();
  });

  it("explains why the server refused the save", async () => {
    api.patch.mockRejectedValue({ response: { data: { errors: ["You're booked for 2 nude sessions; cancel those first."] } } });
    renderProfile(model);
    await userEvent.click(screen.getByLabelText('I am willing to model nude'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(await screen.findByText(/booked for 2 nude sessions/)).toBeInTheDocument();
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