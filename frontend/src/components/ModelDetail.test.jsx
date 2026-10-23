import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ModelDetail from './ModelDetail';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
// A stand-in calendar with one button that picks a date, like clicking an empty day
vi.mock('./SharedCalendar', () => ({
  default: ({ onDateSelect }) => (
    <button onClick={() => onDateSelect({ startStr: '2099-01-05' })}>Pick a date</button>
  )
}));

const jordan = { id: 5, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu',
  skin_tone: 'Medium', gender_identity: 'Non-binary', willing_to_model_nude: false };

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => Promise.resolve({ data: url === '/users/5' ? jordan : [] }));
});

describe("ModelDetail (admin's view of a model)", () => {
  it("explains why the server wouldn't save an availability slot", async () => {
    api.post.mockRejectedValue({ response: { data: { errors: ['Overlaps another availability slot'] } } });
    render(
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
});