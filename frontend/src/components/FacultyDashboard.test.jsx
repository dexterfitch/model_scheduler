import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacultyDashboard from './FacultyDashboard';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

// One 2-model series: the first date has a model booked, the second doesn't yet
const series = {
  id: 1, class_name: 'Figure Drawing I', department: 'Drawing', status: 'pending',
  model_mode: 'clothed', models_needed: 2,
  pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Any', pref_genitalia: 'Any',
  faculty_requests: [
    { id: 11, status: 'pending', models_needed: 2, starts_at: daysFromNow(12, 15), ends_at: daysFromNow(12, 17),
      confirmed_gigs: [{ id: 100, status: 'confirmed', confirmed_by: { first_name: 'Dex', email: 'dfitch@mica.edu' } }] },
    { id: 12, status: 'pending', models_needed: 2, starts_at: daysFromNow(19, 15), ends_at: daysFromNow(19, 17),
      confirmed_gigs: [] }
  ]
};

const nextWeek = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
})();

async function submitNewRequest() {
  await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
  const modal = await screen.findByRole('dialog');
  const field = (label) => within(modal).getByLabelText(label);
  await userEvent.type(field('Class Name'), 'Anatomy Lab');
  await userEvent.selectOptions(field('Department'), 'Drawing');
  await userEvent.selectOptions(field('Building'), 'Main');
  fireEvent.change(field('Date'), { target: { value: nextWeek } });
  fireEvent.change(field('Start Time'), { target: { value: '10:00' } });
  fireEvent.change(field('End Time'), { target: { value: '12:00' } });
  await userEvent.click(within(modal).getByRole('button', { name: 'Submit Request' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [series] });
});

describe('FacultyDashboard', () => {
  it('shows how many models the class needs and how many are booked', async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    expect(await screen.findByText('2 models')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 Models Confirmed')).toBeInTheDocument();
  });

  it('only offers Edit Date on dates nobody is booked on yet', async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await screen.findByText('Figure Drawing I');
    expect(screen.getAllByRole('button', { name: 'Edit Date' })).toHaveLength(1);
  });

  it('shows the fallback message when the server sends no explanation', async () => {
    api.post.mockRejectedValue({});
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await submitNewRequest();
    expect(await screen.findByText('Error submitting request. Please try again.')).toBeInTheDocument();
  });

  it("shows the server's explanation when there is one", async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Date #1 (Nov 9): Starts at must be in the future' } } });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await submitNewRequest();
    expect(await screen.findByText(/Date #1 \(Nov 9\)/)).toBeInTheDocument();
  });

  it('labels the New Request form, including the remove button on each date', async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
    const modal = await screen.findByRole('dialog');

    for (const label of ['Class Name', 'Department', 'Building', 'Room Number', 'Notes for Admin']) {
      expect(within(modal).getByLabelText(label)).toBeInTheDocument();
    }
    await userEvent.click(within(modal).getByRole('button', { name: /Add Another Date/ }));
    expect(within(modal).getByRole('group', { name: 'Date 2' })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Remove date 2' })).toBeInTheDocument();
  });

  it('edits just the day and times of one date', async () => {
    api.patch.mockResolvedValue({ data: {} });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Date' }));
    const modal = await screen.findByRole('dialog');

    for (const label of ['Date', 'Start Time', 'End Time']) {
      expect(within(modal).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(modal).queryByLabelText('Class Name')).toBeNull();

    fireEvent.change(within(modal).getByLabelText('Start Time'), { target: { value: '10:00' } });
    fireEvent.change(within(modal).getByLabelText('End Time'), { target: { value: '12:00' } });
    await userEvent.click(within(modal).getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/faculty_requests/12', {
      faculty_request: { starts_at: expect.any(Date), ends_at: expect.any(Date) }
    });
  });

  it('edits class details for every date at once with Edit Class', async () => {
    const unbooked = { ...series, id: 2, building: 'Main', faculty_requests: [series.faculty_requests[1]] };
    api.get.mockResolvedValue({ data: [unbooked] });
    api.patch.mockResolvedValue({ data: {} });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Class' }));
    const modal = await screen.findByRole('dialog');

    for (const label of ['Class Name', 'Department', 'Building', 'Room Number', 'Notes for Admin']) {
      expect(within(modal).getByLabelText(label)).toBeInTheDocument();
    }
    const name = within(modal).getByLabelText('Class Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Anatomy Lab');
    await userEvent.click(within(modal).getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/request_series/2', expect.objectContaining({
      request_series: expect.objectContaining({ class_name: 'Anatomy Lab', department: 'Drawing' })
    }));
  });

  it("doesn't offer Edit Class once a model is booked, since only an admin can change it then", async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await screen.findByText('Figure Drawing I');
    expect(screen.queryByRole('button', { name: 'Edit Class' })).toBeNull();
  });

  it('sends separate preferences for each model in a new request', async () => {
    api.post.mockResolvedValue({ data: {} });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
    const modal = await screen.findByRole('dialog');
    const field = (label) => within(modal).getByLabelText(label);

    await userEvent.type(field('Class Name'), 'Group Pose Lab');
    await userEvent.selectOptions(field('Department'), 'Drawing');
    await userEvent.selectOptions(field('Building'), 'Main');
    fireEvent.change(field('Date'), { target: { value: nextWeek } });
    fireEvent.change(field('Start Time'), { target: { value: '10:00' } });
    fireEvent.change(field('End Time'), { target: { value: '12:00' } });
    await userEvent.selectOptions(field('Number of Models'), '2');
    const model2 = within(modal).getByRole('group', { name: 'Model 2' });
    await userEvent.selectOptions(within(model2).getByLabelText('Body Type'), 'Fat');
    await userEvent.click(within(modal).getByRole('button', { name: 'Submit Request' }));

    expect(api.post).toHaveBeenCalledWith('/request_series', expect.objectContaining({
      model_slots: [
        expect.objectContaining({ pref_body_type: 'Any' }),
        expect.objectContaining({ pref_body_type: 'Fat' })
      ]
    }));
  });

  it('opens Edit Class with "Same for every model" on for classes saved without per-model preferences', async () => {
    const unbooked = { ...series, id: 2, building: 'Main', faculty_requests: [series.faculty_requests[1]] };
    api.get.mockResolvedValue({ data: [unbooked] });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Class' }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByLabelText('Same for every model')).toBeChecked();
  });

  it("lists each model's preferences on the class card", async () => {
    const any = { pref_skin_tone: 'Any', pref_gender: 'Any', pref_genitalia: 'Any' };
    api.get.mockResolvedValue({ data: [{
      ...series,
      model_slots: [{ position: 1, ...any, pref_body_type: 'Fat' }, { position: 2, ...any, pref_body_type: 'Muscular' }]
    }] });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);

    const line = (pattern) => (_, el) => el.tagName === 'LI' && pattern.test(el.textContent);
    expect(await screen.findByText(line(/Model 1: .*Fat Build/))).toBeInTheDocument();
    expect(screen.getByText(line(/Model 2: .*Muscular Build/))).toBeInTheDocument();
  });

  it('asks before cancelling a whole class, then cancels it', async () => {
    api.delete.mockResolvedValue({});
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Class' }));

    const dialog = await screen.findByRole('dialog', { name: 'Cancel this class?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel Class' }));

    expect(api.delete).toHaveBeenCalledWith('/request_series/1');
  });

  it('keeps the class if they choose Keep Class', async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Class' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep Class' }));
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("explains why a date couldn't be cancelled", async () => {
    api.delete.mockRejectedValue({ response: { data: { error: "This session has already started, so it can't be cancelled." } } });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    const [cancelDate] = await screen.findAllByRole('button', { name: /^Cancel$/ });
    await userEvent.click(cancelDate);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel Date' }));

    expect(await screen.findByRole('dialog', { name: "Couldn't cancel this date" }))
      .toHaveTextContent('already started');
  });
});