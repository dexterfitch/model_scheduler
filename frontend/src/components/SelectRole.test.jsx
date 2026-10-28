import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SelectRole from './SelectRole';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

function renderPage(onLogin = vi.fn()) {
  const utils = render(
    <MemoryRouter>
      <SelectRole onLogin={onLogin} userId={5} />
    </MemoryRouter>
  );
  return { ...utils, onLogin };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.post.mockResolvedValue({ data: {} });
  api.patch.mockResolvedValue({ data: {} });
  api.get.mockResolvedValue({ data: { id: 5, role: 'faculty' } });
});

describe('SelectRole (first login)', () => {
  it('signs up faculty with one click', async () => {
    const { onLogin } = renderPage();
    await userEvent.click(screen.getByRole('button', { name: /I am Faculty/ }));

    expect(api.post).toHaveBeenCalledWith('/select_role', { role: 'faculty' });
    expect(api.patch).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onLogin).toHaveBeenCalledWith({ id: 5, role: 'faculty' }));
  });

  it('saves a new model\'s profile details, including genitalia when they pose nude', async () => {
    const { container } = renderPage();
    await userEvent.click(screen.getByRole('button', { name: /I am a Model/ }));

    await userEvent.selectOptions(screen.getByLabelText('Gender *'), 'Woman');
    await userEvent.click(screen.getByRole('radio', { name: 'Medium' }));
    await userEvent.click(screen.getByLabelText('I am willing to model nude'));
    await userEvent.selectOptions(screen.getByLabelText('Genitalia'), 'Intersex');
    fireEvent.submit(container.querySelector('form'));

    await vi.waitFor(() => expect(api.patch).toHaveBeenCalledWith('/users/5', {
      user: expect.objectContaining({
        gender_identity: 'Woman', skin_tone: 'Medium', willing_to_model_nude: true, genitalia: 'Intersex'
      })
    }));
    expect(api.post).toHaveBeenCalledWith('/select_role', { role: 'model', skin_tone: 'Medium' });
  });

  it('explains to a new model why we ask personal questions', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /I am a Model/ }));
    expect(screen.getByRole('button', { name: 'Why are we asking?' })).toBeInTheDocument();
  });

  it('asks a new model to fill in the required fields', async () => {
    const { container } = renderPage();
    await userEvent.click(screen.getByRole('button', { name: /I am a Model/ }));
    fireEvent.submit(container.querySelector('form'));

    expect(await screen.findByText('Please fill in all required fields.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the role can't be set", async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Role already set' } } });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /I am Faculty/ }));

    expect(await screen.findByText('Role already set')).toBeInTheDocument();
  });

  it('labels every field on the model setup form', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /I am a Model/ }));
    for (const label of [/Stage Name/, /Pronouns/, 'Gender *', 'Body Type']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('radiogroup', { name: /Skin Tone/ })).toBeInTheDocument();
  });
});
