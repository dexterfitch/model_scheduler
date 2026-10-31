/**
 * Tests for an admin's view of one model.
 */

import { screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ModelDetail from './ModelDetail';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('./SharedCalendar', () => ({
  default: ({ events, onDateSelect, onEventClick }) => (
    <>
      <button onClick={() => onDateSelect({ startStr: '2099-01-05' })}>Pick a date</button>
      {events.map((e, i) => (
        <button key={i} onClick={() => onEventClick({ event: { id: String(e.id), extendedProps: e.extendedProps } })}>{e.title}</button>
      ))}
    </>
  )
}));

const jordan = { id: 5, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu',
  skin_tone: 'Medium', gender_identity: 'Non-binary', willing_to_model_nude: false };

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => Promise.resolve({ data: url === '/users/5' ? jordan : [] }));
});

describe('retiring a model', () => {
  /** Shows Jordan's page. */
  const openJordan = () => renderWithDialogs(
    <MemoryRouter initialEntries={['/models/5']}>
      <Routes><Route path="/models/:id" element={<ModelDetail />} /></Routes>
    </MemoryRouter>
  );

  it('retires the model after saying what that means', async () => {
    api.post.mockResolvedValue({ data: { ...jordan, retired_at: '2026-10-31T12:00:00Z' } });
    openJordan();
    await userEvent.click(await screen.findByRole('button', { name: 'Retire Model' }));

    const dialog = await screen.findByRole('dialog', { name: 'Retire Jordan Ellis?' });
    expect(dialog).toHaveTextContent(/won't be offered for classes/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retire Model' }));

    expect(api.post).toHaveBeenCalledWith('/users/5/retire');
    expect(await screen.findByText('Retired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bring Back' })).toBeInTheDocument();
  });

  it("says why when the model can't be retired yet", async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Jordan has 2 upcoming gigs. Release them first.' } } });
    openJordan();
    await userEvent.click(await screen.findByRole('button', { name: 'Retire Model' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retire Model' }));
    expect(await screen.findByText(/2 upcoming gigs/)).toBeInTheDocument();
  });

  it('brings a retired model back', async () => {
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/users/5' ? { ...jordan, retired_at: '2026-10-01T00:00:00Z' } : [] }));
    api.post.mockResolvedValue({ data: { ...jordan, retired_at: null } });
    openJordan();
    await userEvent.click(await screen.findByRole('button', { name: 'Bring Back' }));
    expect(api.post).toHaveBeenCalledWith('/users/5/reinstate');
    expect(await screen.findByRole('button', { name: 'Retire Model' })).toBeInTheDocument();
  });
});

describe("ModelDetail (admin's view of a model)", () => {
  it("lets an admin choose the day as well as the times for a model's availability", async () => {
    api.post.mockResolvedValue({ data: {} });
    renderWithDialogs(
      <MemoryRouter initialEntries={['/models/5']}>
        <Routes><Route path="/models/:id" element={<ModelDetail />} /></Routes>
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Pick a date' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2099-02-10' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Availability' }));

    const { starts_at } = api.post.mock.calls[0][1].art_model_availability;
    expect(starts_at.toLocaleDateString('en-CA')).toBe('2099-02-10');
  });

  it("explains why the server wouldn't save an availability slot", async () => {
    api.post.mockRejectedValue({ response: { data: { errors: ['Overlaps another availability slot'] } } });
    renderWithDialogs(
      <MemoryRouter initialEntries={['/models/5']}>
        <Routes><Route path="/models/:id" element={<ModelDetail />} /></Routes>
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Pick a date' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Start Time')).toHaveValue('09:00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Availability' }));

    expect(await within(dialog).findByText('Overlaps another availability slot')).toBeInTheDocument();
  });

  it('asks before releasing the model from a gig, then releases them', async () => {
    const slot = { id: 9, status: 'active', user: jordan, starts_at: daysFromNow(5, 13), ends_at: daysFromNow(5, 21) };
    const gig = { id: 90, status: 'confirmed', art_model_availability: { id: 9, user: jordan },
      faculty_request: { class_name: 'Figure Drawing I', starts_at: daysFromNow(5, 15), ends_at: daysFromNow(5, 17) } };
    api.get.mockImplementation((url) => Promise.resolve({
      data: url === '/users/5' ? jordan : url === '/gigs' ? [gig] : [slot]
    }));
    api.post.mockResolvedValue({ data: {} });
    renderWithDialogs(
      <MemoryRouter initialEntries={['/models/5']}>
        <Routes><Route path="/models/:id" element={<ModelDetail />} /></Routes>
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole('button', { name: /Confirmed Gig/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Release Model' }));
    const dialog = await screen.findByRole('dialog', { name: 'Release Jordan from this gig?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release Model' }));

    expect(api.post).toHaveBeenCalledWith('/art_model_availabilities/9/cancel', { gig_id: 90 });
  });
});
