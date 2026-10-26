import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithDialogs } from '../test/render';
import { MemoryRouter } from 'react-router-dom';
import AdminCalendar from './AdminCalendar';
import api from '../services/api';
import { daysFromNow } from '../test/dates';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
// A stand-in calendar: one button per event, so tests can "click" an event
vi.mock('./SharedCalendar', () => ({
  default: ({ events, onEventClick }) => events.map(e => (
    <button key={e.id} onClick={() => onEventClick({ event: { extendedProps: e.extendedProps } })}>{e.title}</button>
  ))
}));

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
    renderWithDialogs(<MemoryRouter><AdminCalendar /></MemoryRouter>);
    const list = await screen.findByRole('region', { name: 'Upcoming Model Availability' });

    // Jordan's day appears as the two open stretches around the class
    expect(await within(list).findAllByText('Jordan Ellis')).toHaveLength(2);
    // Riley is fully booked, and Sam cancelled
    expect(within(list).queryByText('Riley Park')).toBeNull();
    expect(within(list).queryByText('Sam Woods')).toBeNull();
  });

  it("shows a booked class's details in a window, not a browser popup", async () => {
    const booked = {
      id: 300, status: 'confirmed',
      art_model_availability: { id: 10, user: jordan },
      faculty_request: {
        class_name: 'Figure Drawing I', building: 'Fox', room_number: '201',
        starts_at: daysFromNow(3, 16), ends_at: daysFromNow(3, 18),
        user: { first_name: 'Priya', last_name: 'Nair' }
      }
    };
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/gigs' ? [booked] : [] }));
    renderWithDialogs(<MemoryRouter><AdminCalendar /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: /Figure Drawing I/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Figure Drawing I' });
    expect(dialog).toHaveTextContent('Jordan Ellis');
    expect(dialog).toHaveTextContent('Priya Nair');
    expect(dialog).toHaveTextContent('Fox 201');
  });
});