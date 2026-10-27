import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AllRequests from './AllRequests';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}));

// Answer the confirmation window that opens
const confirmWith = async (buttonName) =>
  userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: buttonName }));

// A 2-model class with one model (Alex) booked so far
const faculty = { first_name: 'Priya', last_name: 'Nair' };
const series = {
  id: 1, class_name: 'Figure Drawing I', department: 'Drawing', building: 'Main', status: 'pending',
  model_mode: 'clothed', models_needed: 2, user: faculty,
  pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Any', pref_genitalia: 'Any',
  faculty_requests: [{
    id: 11, status: 'pending', models_needed: 2, user: faculty,
    starts_at: daysFromNow(12, 15), ends_at: daysFromNow(12, 17),
    confirmed_gigs: [{ id: 100, status: 'confirmed', art_model_availability: { user: { first_name: 'Alex', last_name: 'Booked' } } }]
  }]
};

function renderPage() {
  renderWithDialogs(
    <MemoryRouter initialEntries={['/requests']}>
      <Routes>
        <Route path="/requests" element={<AllRequests />} />
        <Route path="/gigs/new/:id" element={<div>Matching screen</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [series] });
  api.post.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
});

describe('AllRequests (admin requests page)', () => {
  it('shows booking progress and who is booked', async () => {
    renderPage();
    expect((await screen.findAllByText('1/2 models')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Alex Booked/).length).toBeGreaterThan(0);
  });

  it('releases just one model from a date, with a real button that names the model', async () => {
    renderPage();
    const [releaseButton] = await screen.findAllByRole('button', { name: 'Release Alex Booked from this date and find someone else' });
    expect(releaseButton.tagName).toBe('BUTTON');   // real buttons can be reached with Tab
    await userEvent.click(releaseButton);
    await confirmWith('Release Model');
    expect(api.delete).toHaveBeenCalledWith('/gigs/100');
  });

  it('releases all booked models for rematching', async () => {
    renderPage();
    const [button] = await screen.findAllByRole('button', { name: 'Release Models and Rematch' });
    await userEvent.click(button);
    await confirmWith('Release and Rematch');
    expect(api.post).toHaveBeenCalledWith('/request_series/1/release_remaining');
  });

  it('sends the admin to the matching screen to find more models', async () => {
    renderPage();
    const [button] = await screen.findAllByRole('button', { name: 'Find More Models' });
    await userEvent.click(button);
    expect(await screen.findByText('Matching screen')).toBeInTheDocument();
  });

  it("shows the server's reason when models per session can't be lowered", async () => {
    api.patch.mockRejectedValue({ response: { data: { error: "Models needed can't be lower than the 1 model(s) already booked on a date." } } });
    renderPage();
    const [editButton] = await screen.findAllByRole('button', { name: 'Edit Class' });
    await userEvent.click(editButton);

    const dialog = await screen.findByRole('dialog');
    const modelsSelect = within(dialog).getByLabelText('Number of Models');
    await userEvent.selectOptions(modelsSelect, '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/request_series/1', expect.objectContaining({
      request_series: expect.objectContaining({ models_needed: 1 })
    }));
    expect(await within(dialog).findByText(/can't be lower/)).toBeInTheDocument();
  });

  it('labels every field and button in the Edit Class window', async () => {
    renderPage();
    const [editButton] = await screen.findAllByRole('button', { name: 'Edit Class' });
    await userEvent.click(editButton);
    const dialog = await screen.findByRole('dialog');

    for (const label of ['Class Name', 'Department', 'Building', 'Room Number', 'Notes', 'Number of Models', 'Date 1', 'Start time 1', 'End time 1']) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('button', { name: 'Remove date 1' })).toBeInTheDocument();
  });

  it('flags the date a model dropped out of, and names them', async () => {
    const dropped = {
      ...series,
      faculty_requests: [{ ...series.faculty_requests[0], needs_attention: true, dropped_out_model_name: 'Jordan Ellis' }]
    };
    api.get.mockResolvedValue({ data: [dropped] });
    renderPage();
    expect((await screen.findAllByText('Needs Attention: Jordan Ellis dropped out')).length).toBeGreaterThan(0);
  });

  it("lists each model's preferences for classes that set them separately", async () => {
    const any = { pref_skin_tone: 'Any', pref_gender: 'Any', pref_genitalia: 'Any' };
    api.get.mockResolvedValue({ data: [{
      ...series,
      model_slots: [{ position: 1, ...any, pref_body_type: 'Fat' }, { position: 2, ...any, pref_body_type: 'Muscular' }]
    }] });
    renderPage();
    expect((await screen.findAllByText(/Model 2: .*Muscular Build/)).length).toBeGreaterThan(0);
  });

  it('asks before cancelling a class, and keeps it if they go back', async () => {
    renderPage();
    const [cancel] = await screen.findAllByRole('button', { name: 'Cancel Class' });

    await userEvent.click(cancel);
    await confirmWith('Keep Class');
    expect(api.delete).not.toHaveBeenCalled();

    await userEvent.click(cancel);
    await confirmWith('Cancel Class');
    expect(api.delete).toHaveBeenCalledWith('/request_series/1');
  });

  it('on phone cards, keeps the main button and tucks the rest into a More menu', async () => {
    renderPage();
    const more = await screen.findByRole('button', { name: 'More actions for Figure Drawing I' });
    const card = more.closest('.card');
    expect(within(card).getByRole('button', { name: 'Find More Models' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Cancel Class' })).toBeNull();

    await userEvent.click(more);
    expect(within(card).getByRole('button', { name: 'Release Models and Rematch' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Edit Class' })).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel Class' }));
    await confirmWith('Cancel Class');
    expect(api.delete).toHaveBeenCalledWith('/request_series/1');
  });

  it("explains why a model couldn't be released", async () => {
    api.delete.mockRejectedValue({ response: { data: { error: "This session has already started, so the model can't be released from it." } } });
    renderPage();
    const [releaseButton] = await screen.findAllByRole('button', { name: /Release Alex Booked/ });
    await userEvent.click(releaseButton);
    await confirmWith('Release Model');

    expect(await screen.findByRole('dialog', { name: "Couldn't release the model" })).toHaveTextContent('already started');
  });
});