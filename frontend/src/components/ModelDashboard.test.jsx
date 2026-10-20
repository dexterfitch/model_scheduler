import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelDashboard from './ModelDashboard';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// The calendar library needs a real browser, so a placeholder stands in for it here
vi.mock('./SharedCalendar', () => ({ default: () => <div>calendar</div> }));

const model = { id: 10, first_name: 'Jordan', willing_to_model_nude: false };

// One all-day slot holding two classes: the exact situation behind fix #7
const slot = { id: 5, status: 'active', starts_at: '2026-11-02T13:00:00Z', ends_at: '2026-11-02T21:00:00Z' };
const gig = (id, className, start, end, extra = {}) => ({
  id, status: 'confirmed', art_model_availability: slot,
  faculty_request: { id, class_name: className, model_mode: 'clothed', starts_at: start, ends_at: end },
  ...extra
});
const morning   = gig(100, 'Morning Figure Drawing', '2026-11-02T14:00:00Z', '2026-11-02T16:00:00Z');
const afternoon = gig(101, 'Afternoon Portraits',    '2026-11-02T18:00:00Z', '2026-11-02T20:00:00Z');
const lateCancel = gig(102, 'Costume Study', '2026-10-01T14:00:00Z', '2026-10-01T16:00:00Z',
  { status: 'cancelled', billable: true });

const groupCall = {
  id: 7, class_name: 'Group Pose Lab', department: 'Drawing', model_mode: 'clothed', models_needed: 3,
  faculty_requests: [{ id: 30, status: 'pending', starts_at: '2026-11-10T15:00:00Z', ends_at: '2026-11-10T17:00:00Z' }]
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
      art_model_availability: { starts_at: '2026-11-10T15:00:00Z', ends_at: '2026-11-10T17:00:00Z' }
    });
  });
});