/**
 * Tests for the admin Dashboard: pending classes and today's gigs.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import api from '../services/api';
import { daysFromNow } from '../test/dates';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

/** A class needing some models, with some already booked. */
const classNeeding = (needed, booked, overrides = {}) => ({
  id: 1, class_name: 'Group Pose Lab', models_needed: needed, status: 'pending',
  user: { first_name: 'Priya', last_name: 'Nair' },
  faculty_requests: [{
    id: 11, status: 'pending', models_needed: needed,
    starts_at: daysFromNow(3, 15), ends_at: daysFromNow(3, 17),
    confirmed_gigs: Array.from({ length: booked }, (_, i) => ({ id: 100 + i, status: 'confirmed' }))
  }],
  ...overrides
});

/** Shows the Dashboard with these classes. */
function renderWith(series) {
  api.get.mockImplementation((url) => Promise.resolve({ data: url === '/request_series' ? series : [] }));
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
}

beforeEach(() => vi.clearAllMocks());

describe('AdminDashboard', () => {
  it('shows how many models are booked on a partly filled group session', async () => {
    renderWith([classNeeding(2, 1)]);
    expect(await screen.findByText('1/2 models booked')).toBeInTheDocument();
  });

  it("shows the count on a group session nobody's booked yet, too", async () => {
    renderWith([classNeeding(3, 0)]);
    expect(await screen.findByText('0/3 models booked')).toBeInTheDocument();
  });

  it("doesn't show a count for classes that need just one model", async () => {
    renderWith([classNeeding(1, 0)]);
    await screen.findByText('Group Pose Lab');
    expect(screen.queryByText(/models booked/)).toBeNull();
  });

  it("lists today's evening classes in Today's Schedule, and not tomorrow's", async () => {
    /** A time some days from now. */
    const at = (daysAhead, hour, minute = 0) => {
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    };
    /** A confirmed gig. */
    const gig = (id, class_name, starts_at, ends_at) => ({
      id, status: 'confirmed',
      faculty_request: { class_name, starts_at, ends_at, model_mode: 'clothed', user: { first_name: 'Priya', last_name: 'Nair' } },
      art_model_availability: { user: { first_name: 'Jordan', last_name: 'Ellis' } }
    });
    api.get.mockImplementation((url) => Promise.resolve({
      data: url === '/gigs'
        ? [gig(1, 'Evening Life Drawing', at(0, 20, 30), at(0, 22)), gig(2, 'Tomorrow Morning Class', at(1, 9), at(1, 11))]
        : []
    }));
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

    expect(await screen.findByText('Evening Life Drawing')).toBeInTheDocument();
    expect(screen.queryByText('Tomorrow Morning Class')).toBeNull();
  });
});
