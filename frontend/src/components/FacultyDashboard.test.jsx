import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacultyDashboard from './FacultyDashboard';
import api from '../services/api';
import { daysFromNow } from '../test/dates';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

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
    render(<FacultyDashboard user={{ id: 1 }} />);
    expect(await screen.findByText('2 models')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 Models Confirmed')).toBeInTheDocument();
  });

  it('only offers Edit Date on dates nobody is booked on yet', async () => {
    render(<FacultyDashboard user={{ id: 1 }} />);
    await screen.findByText('Figure Drawing I');
    expect(screen.getAllByRole('button', { name: 'Edit Date' })).toHaveLength(1);
  });

  it('shows the fallback message when the server sends no explanation', async () => {
    api.post.mockRejectedValue({});
    render(<FacultyDashboard user={{ id: 1 }} />);
    await submitNewRequest();
    expect(await screen.findByText('Error submitting request. Please try again.')).toBeInTheDocument();
  });

  it("shows the server's explanation when there is one", async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Date #1 (Nov 9): Starts at must be in the future' } } });
    render(<FacultyDashboard user={{ id: 1 }} />);
    await submitNewRequest();
    expect(await screen.findByText(/Date #1 \(Nov 9\)/)).toBeInTheDocument();
  });

  it('labels the New Request form, including the remove button on each date', async () => {
    render(<FacultyDashboard user={{ id: 1 }} />);
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
    render(<FacultyDashboard user={{ id: 1 }} />);
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
    render(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Class' }));
    const modal = await screen.findByRole('dialog');

    for (const label of ['Class Name', 'Department', 'Building', 'Room Number', 'Notes for Admin']) {
      expect(within(modal).getByLabelText(label)).toBeInTheDocument();
    }
    const name = within(modal).getByLabelText('Class Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Anatomy Lab');
    await userEvent.click(within(modal).getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/request_series/2', {
      request_series: expect.objectContaining({ class_name: 'Anatomy Lab', department: 'Drawing' })
    });
  });

  it("doesn't offer Edit Class once a model is booked, since only an admin can change it then", async () => {
    render(<FacultyDashboard user={{ id: 1 }} />);
    await screen.findByText('Figure Drawing I');
    expect(screen.queryByRole('button', { name: 'Edit Class' })).toBeNull();
  });
});