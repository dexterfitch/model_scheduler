import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminCalendar from './AdminCalendar';
import api from '../services/api';
import { daysFromNow } from '../test/dates';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
// Only the availability list beside the calendar is under test here
vi.mock('./SharedCalendar', () => ({ default: () => null }));

const person = (id, first_name, last_name) => ({ id, first_name, last_name, willing_to_model_nude: false });
const jordan = person(1, 'Jordan', 'Ellis');
const riley  = person(2, 'Riley', 'Park');
const sam    = person(3, 'Sam', 'Woods');

// An availability block `day` days from now, between two hours (UTC)
const block = (id, user, day, from, to, status = 'active') =>
  ({ id, user, status, starts_at: daysFromNow(day, from), ends_at: daysFromNow(day, to) });
// A confirmed class booked into a block
const classIn = (availability, day, from, to) => ({
  id: availability.id * 10, status: 'confirmed',
  art_model_availability: { id: availability.id, user: availability.user },
  faculty_request: { class_name: 'Figure Drawing I', starts_at: daysFromNow(day, from), ends_at: daysFromNow(day, to) }
});

const jordansDay = block(10, jordan, 3, 14, 22);             // open all day, with one class in the middle
const rileysDay  = block(11, riley, 4, 14, 16);              // fully booked
const samsDay    = block(12, sam, 5, 14, 22, 'cancelled');   // the model cancelled it

beforeEach(() => {
  vi.clearAllMocks();
  const gigs = [classIn(jordansDay, 3, 16, 18), classIn(rileysDay, 4, 14, 16)];
  api.get.mockImplementation((url) => Promise.resolve({
    data: url === '/gigs' ? gigs : url === '/faculty_requests' ? [] : [jordansDay, rileysDay, samsDay]
  }));
});

describe('AdminCalendar availability list', () => {
  it('only lists time a model can actually be booked into', async () => {
    render(<MemoryRouter><AdminCalendar /></MemoryRouter>);
    const list = await screen.findByRole('region', { name: 'Upcoming Model Availability' });

    // Jordan's day appears as the two open stretches around the class
    expect(await within(list).findAllByText('Jordan Ellis')).toHaveLength(2);
    // Riley is fully booked, and Sam cancelled
    expect(within(list).queryByText('Riley Park')).toBeNull();
    expect(within(list).queryByText('Sam Woods')).toBeNull();
  });
});