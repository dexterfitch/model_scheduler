import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelDashboard from './ModelDashboard';
import api from '../services/api';
import { daysFromNow } from '../test/dates';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// The calendar library needs a real browser, so a placeholder stands in for it here
vi.mock('./SharedCalendar', () => ({ default: () => <div>calendar</div> }));

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
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  api.get.mockImplementation((url) => {
    if (url === '/gigs') return Promise.resolve({ data: [morning, afternoon, lateCancel] });
    if (url.startsWith('/art_model_availabilities')) return Promise.resolve({ data: [slot] });
    if (url === '/request_series/available_for_model') return Promise.resolve({ data: [groupCall] });
  });
  api.post.mockResolvedValue({ data: {} });
});

describe('ModelDashboard', () => {
  it('cancels the exact gig the model clicked, even when two share a slot', async () => {
    render(<ModelDashboard user={model} />);
    const matches = await screen.findAllByText('Afternoon Portraits');
    const card = matches.map(el => el.closest('.card')).find(c => c && within(c).queryByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel' }));

    expect(api.post).toHaveBeenCalledWith(
      '/art_model_availabilities/5/cancel',
      expect.objectContaining({ gig_id: 101 })
    );
  });

  it('labels late cancellations as paid', async () => {
    render(<ModelDashboard user={model} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelled' }));
    expect(screen.getByText('Cancelled (Paid — Late Cancellation)')).toBeInTheDocument();
  });

  it('shows group sessions in open calls', async () => {
    render(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    expect(await screen.findByText('Group session: 3 models')).toBeInTheDocument();
  });

  it("signs the model up for an open call's dates", async () => {
    render(<ModelDashboard user={model} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Availability' }));
    await userEvent.click(await screen.findByRole('button', { name: "I'm Available" }));

    expect(api.post).toHaveBeenCalledWith('/art_model_availabilities', {
      art_model_availability: {
        starts_at: groupCall.faculty_requests[0].starts_at,
        ends_at: groupCall.faculty_requests[0].ends_at
      }
    });
  });

  it('moves gigs that already happened to Completed, without a Cancel button', async () => {
    const lastWeek = gig(103, 'Gesture Drawing', '2026-10-14T14:00:00Z', '2026-10-14T16:00:00Z');
    api.get.mockImplementation((url) => {
      if (url === '/gigs') return Promise.resolve({ data: [lastWeek] });
      return Promise.resolve({ data: [] });
    });
    render(<ModelDashboard user={model} />);

    // Not listed with upcoming confirmed gigs
    expect(await screen.findByText('No confirmed gigs.')).toBeInTheDocument();

    // Listed under Completed, with no way to cancel it
    await userEvent.click(screen.getByRole('button', { name: 'Completed' }));
    const card = (await screen.findAllByText('Gesture Drawing'))[0].closest('.card');
    expect(within(card).getByText('Completed')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});