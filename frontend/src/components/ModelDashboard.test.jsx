import { screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelDashboard from './ModelDashboard';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { renderWithDialogs } from '../test/render';
import { formatTimeShort } from '../utils/time';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// The calendar library needs a real browser, so a placeholder stands in for it here
vi.mock('./SharedCalendar', () => ({
  default: ({ onDateSelect }) => (
    <button onClick={() => onDateSelect({ startStr: '2099-01-05' })}>Pick a date</button>
  )
}));

const model = { id: 10, first_name: 'Jordan', willing_to_model_nude: false };

// One all-day slot holding two classes: the exact situation behind fix #7
const slot = { id: 5, status: 'active', starts_at: daysFromNow(12, 13), ends_at: daysFromNow(12, 21) };
const gig = (id, className, start, end, extra = {}) => ({
  id, status: 'confirmed', art_model_availability: slot,
  faculty_request: { id, class_name: className, model_mode: 'clothed', starts_at: start, ends_at: end },
  ...extra
});
const morning   = gig(100, 'Morning Figure Drawing', daysFromNow(12, 14), daysFromNow(12, 16));
const afternoon = gig(101, 'Afternoon Portraits',    daysFromNow(12, 18), daysFromNow(12, 20));
const lateCancel = gig(102, 'Costume Study', '2026-10-01T14:00:00Z', '2026-10-01T16:00:00Z',
  { status: 'cancelled', billable: true });

const groupCall = {
  id: 7, class_name: 'Group Pose Lab', department: 'Drawing', model_mode: 'clothed', models_needed: 3,
  faculty_requests: [{ id: 30, status: 'pending', starts_at: daysFromNow(20, 15), ends_at: daysFromNow(20, 17) }]
};

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/gigs') return Promise.resolve({ data: [morning, afternoon, lateCancel] });
    if (url.startsWith('/art_model_availabilities')) return Promise.resolve({ data: [slot] });
    if (url === '/request_series/available_for_model') return Promise.resolve({ data: [groupCall] });
  });
  api.post.mockResolvedValue({ data: {} });
});

describe('ModelDashboard', () => {
  it('cancels the exact gig the model clicked, even when two share a slot', async () => {
    renderWithDialogs(<ModelDashboard user={model} />);
    const matches = await screen.findAllByText('Afternoon Portraits');
    const card = matches.map(el => el.closest('.card')).find(c => c && within(c).queryByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this gig?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel Gig' }));

    expect(api.post).toHaveBeenCalledWith(
      '/art_model_availabilities/5/cancel',
      expect.objectContaining({ gig_id: 101 })
    );
  });

  it('names the faculty member and department on each gig card', async () => {
    const taught = { ...morning, faculty_request: { ...morning.faculty_request, department: 'Drawing', user: { first_name: 'Priya', last_name: 'Nair' } } };
    api.get.mockImplementation((url) => {
      if (url === '/gigs') return Promise.resolve({ data: [taught] });
      if (url.startsWith('/art_model_availabilities')) return Promise.resolve({ data: [slot] });
      return Promise.resolve({ data: [] });
    });
    renderWithDialogs(<ModelDashboard user={model} />);
    const [title] = await screen.findAllByText('Morning Figure Drawing');
    expect(title.closest('.card')).toHaveTextContent('Priya Nair · Drawing');
  });

  it('counts upcoming gigs on the My Gigs tab, whichever filter is chosen', async () => {
    renderWithDialogs(<ModelDashboard user={model} />);
    const tab = await screen.findByRole('tab', { name: 'My Gigs (2 upcoming)' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelled' }));
    expect(tab).toHaveTextContent('My Gigs (2 upcoming)');
  });

  it('labels late cancellations as paid', async () => {
    renderWithDialogs(<ModelDashboard user={model} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelled' }));
    expect(screen.getByText('Cancelled (Paid — Late Cancellation)')).toBeInTheDocument();
  });

  it('shows group sessions in open calls', async () => {
    renderWithDialogs(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    expect(await screen.findByText('Group session: 3 models')).toBeInTheDocument();
  });

  it("signs the model up for an open call's dates", async () => {
    renderWithDialogs(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    await userEvent.click(await screen.findByRole('button', { name: "I'm Available" }));

    expect(api.post).toHaveBeenCalledWith('/art_model_availabilities', {
      art_model_availability: {
        starts_at: groupCall.faculty_requests[0].starts_at,
        ends_at: groupCall.faculty_requests[0].ends_at
      }
    });
  });

  it("explains why an open call sign-up didn't go through", async () => {
    api.post.mockRejectedValue({ response: { data: { errors: ['Starts at must be in the future'] } } });
    renderWithDialogs(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    await userEvent.click(await screen.findByRole('button', { name: "I'm Available" }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent("Couldn't add your availability");
    expect(dialog).toHaveTextContent('Starts at must be in the future');
  });

  it('moves gigs that already happened to Completed, without a Cancel button', async () => {
    const lastWeek = gig(103, 'Gesture Drawing', '2026-10-14T14:00:00Z', '2026-10-14T16:00:00Z');
    api.get.mockImplementation((url) => {
      if (url === '/gigs') return Promise.resolve({ data: [lastWeek] });
      return Promise.resolve({ data: [] });
    });
    renderWithDialogs(<ModelDashboard user={model} />);

    // Not listed with upcoming confirmed gigs
    expect(await screen.findByText('No confirmed gigs.')).toBeInTheDocument();

    // Listed under Completed, with no way to cancel it
    await userEvent.click(screen.getByRole('button', { name: 'Completed' }));
    const card = (await screen.findAllByText('Gesture Drawing'))[0].closest('.card');
    expect(within(card).getByText('Completed')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('lets the model choose the day as well as the times', async () => {
    renderWithDialogs(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Pick a date' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2099-02-10' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Availability' }));

    const { starts_at } = api.post.mock.calls[0][1].art_model_availability;
    expect(starts_at.toLocaleDateString('en-CA')).toBe('2099-02-10');
  });

  it('says when new time was joined to time the model already had', async () => {
    const starts = '2099-02-10T14:00:00Z', ends = '2099-02-10T23:00:00Z';
    api.post.mockResolvedValue({ data: { id: 9, joined: true, starts_at: starts, ends_at: ends } });
    renderWithDialogs(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Pick a date' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2099-02-10' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Availability' }));

    const message = await screen.findByText(/joined to time you'd already set/);
    expect(message).toHaveTextContent(`${formatTimeShort(starts)} to ${formatTimeShort(ends)}`);
  });

  it('adds open call dates one at a time, so dates on the same day can be joined', async () => {
    const twoDates = { ...groupCall, faculty_requests: [
      { ...groupCall.faculty_requests[0], id: 51, starts_at: '2099-03-02T14:00:00Z', ends_at: '2099-03-02T16:00:00Z' },
      { ...groupCall.faculty_requests[0], id: 52, starts_at: '2099-03-02T18:00:00Z', ends_at: '2099-03-02T20:00:00Z' },
    ] };
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/request_series/available_for_model' ? [twoDates] : [] }));
    let inFlight = 0, most = 0;
    api.post.mockImplementation(async () => {
      most = Math.max(most, ++inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return { data: {} };
    });
    renderWithDialogs(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    await userEvent.click(await screen.findByRole('button', { name: "I'm Available" }));

    await screen.findByText('Availability added for all 2 dates!');
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(most).toBe(1);
  });

  it("explains why the server wouldn't save an availability slot", async () => {
    api.post.mockRejectedValue({ response: { data: { errors: ['Overlaps another availability slot'] } } });
    renderWithDialogs(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Pick a date' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Start Time')).toHaveValue('09:00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Availability' }));

    expect(await within(dialog).findByText('Overlaps another availability slot')).toBeInTheDocument();
  });

  it('keeps the gig if the model chooses Keep Gig', async () => {
    renderWithDialogs(<ModelDashboard user={model} />);
    const matches = await screen.findAllByText('Afternoon Portraits');
    const card = matches.map(el => el.closest('.card')).find(c => c && within(c).queryByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep Gig' }));

    expect(api.post).not.toHaveBeenCalled();
  });

  it("explains why a gig couldn't be cancelled", async () => {
    api.post.mockRejectedValue({ response: { data: { error: "This session has already started, so it can't be cancelled." } } });
    renderWithDialogs(<ModelDashboard user={model} />);
    const matches = await screen.findAllByText('Afternoon Portraits');
    const card = matches.map(el => el.closest('.card')).find(c => c && within(c).queryByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel Gig' }));

    expect(await screen.findByRole('dialog', { name: "Couldn't cancel" })).toHaveTextContent('already started');
  });
});
