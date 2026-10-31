/**
 * Tests for the admin Calendar's list of upcoming free time.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithDialogs } from '../test/render';
import { MemoryRouter } from 'react-router-dom';
import AdminCalendar from './AdminCalendar';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { formatDateWithWeekday } from '../utils/time';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./SharedCalendar', () => ({
  default: ({ events, onEventClick }) => events.map(e => (
    <button key={e.id} onClick={() => onEventClick({ event: { extendedProps: e.extendedProps } })}>{e.title}</button>
  ))
}));

/** A model. */
const person = (id, first_name, last_name) => ({ id, first_name, last_name, willing_to_model_nude: false });
const jordan = person(1, 'Jordan', 'Ellis');
const riley  = person(2, 'Riley', 'Park');
const sam    = person(3, 'Sam', 'Woods');

/** A block of free time some days from now. */
const block = (id, user, day, from, to, status = 'active') =>
  ({ id, user, status, starts_at: daysFromNow(day, from), ends_at: daysFromNow(day, to) });
/** A booked gig inside a block of free time. */
const classIn = (availability, day, from, to) => ({
  id: availability.id * 10, status: 'confirmed',
  art_model_availability: { id: availability.id, user: availability.user },
  faculty_request: { class_name: 'Figure Drawing I', starts_at: daysFromNow(day, from), ends_at: daysFromNow(day, to) }
});

const jordansDay = block(10, jordan, 3, 14, 22);
const rileysDay  = block(11, riley, 4, 14, 16);
const samsDay    = block(12, sam, 5, 14, 22, 'cancelled');

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

    const [jordanName] = await within(list).findAllByText('Jordan Ellis');
    expect(within(list).getAllByText('Jordan Ellis')).toHaveLength(1);
    expect(within(jordanName.closest('li')).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).queryByText('Riley Park')).toBeNull();
    expect(within(list).queryByText('Sam Woods')).toBeNull();
  });

  it('groups free time by model: one card each, times in order, soonest model first', async () => {
    const later = block(20, riley, 6, 14, 16);
    const sooner = block(21, riley, 2, 14, 16);
    const jordanLater = block(22, jordan, 8, 14, 16);
    api.get.mockImplementation((url) => Promise.resolve({
      data: url === '/art_model_availabilities' ? [jordanLater, later, jordansDay, sooner] : []
    }));
    renderWithDialogs(<MemoryRouter><AdminCalendar /></MemoryRouter>);
    const list = await screen.findByRole('region', { name: 'Upcoming Model Availability' });

    const names = await within(list).findAllByText(/^(Riley Park|Jordan Ellis)$/);
    expect(names.map(n => n.textContent)).toEqual(['Riley Park', 'Jordan Ellis']);
    const cards = names.map(n => n.closest('li'));

    /** The lines of free time on a model's card. */
    const times = (card) => within(card).getAllByRole('listitem').map(li => li.textContent);
    /** How a day is written on the cards. */
    const day = (n) => formatDateWithWeekday(daysFromNow(n, 14));
    expect(times(cards[0])[0]).toContain(day(2));
    expect(times(cards[0])[1]).toContain(day(6));
    expect(times(cards[1])[0]).toContain(day(3));
    expect(times(cards[1])[1]).toContain(day(8));
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
