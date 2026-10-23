import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GigCreator from './GigCreator';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { formatDateWithWeekday } from '../utils/time';

// Replace the real backend connection with a fake one
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const alex  = { id: 10, first_name: 'Alex',  last_name: 'Booked', willing_to_model_nude: false, skin_tone: 'Light', gender_identity: 'Woman' };
const blair = { id: 11, first_name: 'Blair', last_name: 'Free',   willing_to_model_nude: false, skin_tone: 'Dark',  gender_identity: 'Man' };

const makeRequest = (modelsNeeded) => ({
  id: 1, class_name: 'Figure Drawing I', status: 'pending', model_mode: 'clothed', models_needed: modelsNeeded,
  starts_at: daysFromNow(12, 15), ends_at: daysFromNow(12, 17),
  pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Any', pref_genitalia: 'Any',
  user: { first_name: 'Priya', last_name: 'Nair' }
});
const slot = (id, user) => ({ id, user, status: 'active', starts_at: daysFromNow(12, 13), ends_at: daysFromNow(12, 21) });

// The fake backend: one class, two available models, Alex already booked
function fakeBackend(modelsNeeded) {
  const request = makeRequest(modelsNeeded);
  const gigs = [{ id: 100, status: 'confirmed', faculty_request: request, art_model_availability: { id: 1, user: alex } }];
  api.get.mockImplementation((url) => {
    if (url === '/faculty_requests') return Promise.resolve({ data: [request] });
    if (url === '/art_model_availabilities') return Promise.resolve({ data: [slot(1, alex), slot(2, blair)] });
    if (url === '/gigs') return Promise.resolve({ data: gigs });
  });
  api.post.mockResolvedValue({ data: {} });
}

function renderMatchingScreen() {
  render(
    <MemoryRouter initialEntries={['/gigs/new/1']}>
      <Routes><Route path="/gigs/new/:requestId" element={<GigCreator />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('GigCreator (matching screen)', () => {
  it('lists who is booked and leaves them out of the candidates', async () => {
    fakeBackend(2);
    renderMatchingScreen();

    expect(await screen.findByText(/1\/2 booked: Alex Booked/)).toBeInTheDocument();
    const candidates = screen.getAllByRole('heading', { level: 5 }).map(h => h.textContent);
    expect(candidates.some(name => name.includes('Blair Free'))).toBe(true);
    expect(candidates.some(name => name.includes('Alex Booked'))).toBe(false);
  });

  it('books the chosen model into the class', async () => {
    fakeBackend(2);
    renderMatchingScreen();

    await userEvent.click(await screen.findByRole('button', { name: 'Book Model' }));
    expect(api.post).toHaveBeenCalledWith('/gigs', {
      gig: { faculty_request_id: 1, art_model_availability_id: 2 }
    });
  });

  it('stays open after a booking when the class still needs more models', async () => {
    fakeBackend(3);
    renderMatchingScreen();

    await userEvent.click(await screen.findByRole('button', { name: 'Book Model' }));
    expect(await screen.findByText(/still needs more models/i)).toBeInTheDocument();
  });

  it('confirms and wraps up once the last spot is filled', async () => {
    fakeBackend(2);
    renderMatchingScreen();

    await userEvent.click(await screen.findByRole('button', { name: 'Book Model' }));
    expect(await screen.findByText(/Gig confirmed/i)).toBeInTheDocument();
  });

  it("lists a series' dates in calendar order", async () => {
    const later = daysFromNow(20, 15);
    const sooner = daysFromNow(6, 15);
    const date = (id, starts_at) => ({ id, status: 'pending', models_needed: 1, starts_at, ends_at: starts_at });
    const series = {
      id: 1, class_name: 'Painting II', status: 'pending', model_mode: 'clothed', models_needed: 1,
      pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Any', pref_genitalia: 'Any',
      user: { first_name: 'Priya', last_name: 'Nair' },
      faculty_requests: [date(21, later), date(22, sooner)]   // stored out of order
    };
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/request_series' ? [series] : [] }));
    render(
      <MemoryRouter initialEntries={['/gigs/new/1?type=series']}>
        <Routes><Route path="/gigs/new/:requestId" element={<GigCreator />} /></Routes>
      </MemoryRouter>
    );

    const soonerRow = await screen.findByText(new RegExp(formatDateWithWeekday(sooner)));
    const laterRow = screen.getByText(new RegExp(formatDateWithWeekday(later)));
    // The sooner date comes first on the page
    expect(soonerRow.compareDocumentPosition(laterRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});