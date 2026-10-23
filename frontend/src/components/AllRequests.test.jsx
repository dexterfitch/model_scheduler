import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AllRequests from './AllRequests';
import api from '../services/api';
import { daysFromNow } from '../test/dates';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}));

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
  render(
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
  vi.spyOn(window, 'confirm').mockReturnValue(true);
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
    expect(api.delete).toHaveBeenCalledWith('/gigs/100');
  });

  it('releases all booked models for rematching', async () => {
    renderPage();
    const [button] = await screen.findAllByRole('button', { name: 'Release Models and Rematch' });
    await userEvent.click(button);
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
    const [editButton] = await screen.findAllByRole('button', { name: 'Edit Gig' });
    await userEvent.click(editButton);

    const dialog = await screen.findByRole('dialog');
    const modelsSelect = within(dialog).getByLabelText('Models per Session');
    await userEvent.selectOptions(modelsSelect, '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/request_series/1', expect.objectContaining({
      request_series: expect.objectContaining({ models_needed: 1 })
    }));
    expect(await within(dialog).findByText(/can't be lower/)).toBeInTheDocument();
  });

  it('labels every field and button in the Edit Gig window', async () => {
    renderPage();
    const [editButton] = await screen.findAllByRole('button', { name: 'Edit Gig' });
    await userEvent.click(editButton);
    const dialog = await screen.findByRole('dialog');

    for (const label of ['Class Name', 'Department', 'Building', 'Room Number', 'Notes', 'Models per Session', 'Date 1', 'Start time 1', 'End time 1']) {
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
});