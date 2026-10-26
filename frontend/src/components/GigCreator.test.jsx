import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GigCreator from './GigCreator';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { formatDateWithWeekday } from '../utils/time';
import { renderWithDialogs } from '../test/render';

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
  renderWithDialogs(
    <MemoryRouter initialEntries={['/gigs/new/1']}>
      <Routes><Route path="/gigs/new/:requestId" element={<GigCreator />} /></Routes>
    </MemoryRouter>
  );
}

// Click Book Model, then confirm in the window that opens
async function bookAndConfirm() {
  await userEvent.click(await screen.findByRole('button', { name: 'Book Model' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Confirm Booking' }));
}

beforeEach(() => {
  vi.clearAllMocks();
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

    await bookAndConfirm();
    expect(api.post).toHaveBeenCalledWith('/gigs', {
      gig: { faculty_request_id: 1, art_model_availability_id: 2 }
    });
  });

  it("asks before booking, and books nothing if they go back", async () => {
    fakeBackend(2);
    renderMatchingScreen();

    await userEvent.click(await screen.findByRole('button', { name: 'Book Model' }));
    expect(await screen.findByRole('dialog', { name: 'Book Blair Free?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go Back' }));

    expect(api.post).not.toHaveBeenCalled();
  });

  it('stays open after a booking when the class still needs more models', async () => {
    fakeBackend(3);
    renderMatchingScreen();

    await bookAndConfirm();
    expect(await screen.findByText(/still needs more models/i)).toBeInTheDocument();
  });

  it('confirms and wraps up once the last spot is filled', async () => {
    fakeBackend(2);
    renderMatchingScreen();

    await bookAndConfirm();
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
    renderWithDialogs(
      <MemoryRouter initialEntries={['/gigs/new/1?type=series']}>
        <Routes><Route path="/gigs/new/:requestId" element={<GigCreator />} /></Routes>
      </MemoryRouter>
    );

    // \b so "Nov 1" doesn't also match "Nov 15"
    const soonerRow = await screen.findByText(new RegExp(`${formatDateWithWeekday(sooner)}\\b`));
    const laterRow = screen.getByText(new RegExp(`${formatDateWithWeekday(later)}\\b`));
    // The sooner date comes first on the page
    expect(soonerRow.compareDocumentPosition(laterRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe('classes with preferences for each model', () => {
    const any = { pref_skin_tone: 'Any', pref_gender: 'Any', pref_genitalia: 'Any' };
    const casey = { id: 12, first_name: 'Casey', last_name: 'Strong', willing_to_model_nude: false,
                    skin_tone: 'Medium', gender_identity: 'Man', body_type: 'Muscular' };

    function seriesBackend({ bookedSlot } = {}) {
      const date = { id: 31, status: 'pending', models_needed: 2, starts_at: daysFromNow(12, 15), ends_at: daysFromNow(12, 17) };
      const series = {
        id: 1, class_name: 'Group Pose Lab', status: 'pending', model_mode: 'clothed', models_needed: 2,
        ...any, pref_body_type: 'Any', user: { first_name: 'Priya', last_name: 'Nair' },
        model_slots: [{ position: 1, ...any, pref_body_type: 'Fat' }, { position: 2, ...any, pref_body_type: 'Muscular' }],
        faculty_requests: [date]
      };
      const gigs = bookedSlot ? [{
        id: 200, status: 'confirmed', model_slot_position: bookedSlot,
        faculty_request: date, art_model_availability: { id: 1, user: alex }
      }] : [];
      api.get.mockImplementation((url) => Promise.resolve({ data:
        url === '/request_series' ? [series]
        : url === '/art_model_availabilities' ? [slot(1, alex), slot(2, blair), slot(3, casey)]
        : gigs
      }));
      renderWithDialogs(
        <MemoryRouter initialEntries={['/gigs/new/1?type=series']}>
          <Routes><Route path="/gigs/new/:requestId" element={<GigCreator />} /></Routes>
        </MemoryRouter>
      );
    }

    it("shows each model's preferences on the class", async () => {
      seriesBackend();
      // Each slot is one line: "Model 1: Any Skintone, Any, Fat Build"
      const line = (pattern) => (_, el) => el.tagName === 'LI' && pattern.test(el.textContent);
      expect(await screen.findByText(line(/Model 1: .*Fat Build/))).toBeInTheDocument();
      expect(screen.getByText(line(/Model 2: .*Muscular Build/))).toBeInTheDocument();
    });

    it('ranks the model who fits an open slot first, and says which slot', async () => {
      seriesBackend();
      const [first] = await screen.findAllByRole('heading', { level: 5 });
      expect(first).toHaveTextContent('Casey Strong');
      expect(screen.getByText('Best fit: Model 2')).toBeInTheDocument();
    });

    it('only ranks against slots that are still open, and shows who fills the rest', async () => {
      seriesBackend({ bookedSlot: 2 });   // Alex already fills the Muscular slot
      expect(await screen.findByText(/Alex Booked \(Model 2\)/)).toBeInTheDocument();
      expect(screen.queryByText('Best fit: Model 2')).toBeNull();
    });
  });
});