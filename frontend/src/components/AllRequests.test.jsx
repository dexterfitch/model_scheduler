/**
 * Tests for the admin Requests page: filters and search, editing, cancelling and
 * releasing, past dates and corrections, and who could take a pending date.
 */

import { screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AllRequests from './AllRequests';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { formatDateWithWeekday, formatTime, formatTimeShort } from '../utils/time';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}));

/** Answers the confirmation window with this button. */
const confirmWith = async (buttonName) =>
  userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: buttonName }));

const faculty = { first_name: 'Priya', last_name: 'Nair' };
const series = {
  id: 1, class_name: 'Figure Drawing I', department: 'Drawing', building: 'Main', status: 'pending',
  model_mode: 'clothed', models_needed: 2, user: faculty,
  pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Any', pref_genitalia: 'Any',
  faculty_requests: [{
    id: 11, status: 'pending', models_needed: 2, user: faculty,
    starts_at: daysFromNow(12, 15), ends_at: daysFromNow(12, 17),
    confirmed_gigs: [{ id: 100, status: 'confirmed', art_model_availability: { user: { first_name: 'Alex', last_name: 'Booked' } } }]
  }]
};

/** Shows the Requests page. */
function renderPage() {
  renderWithDialogs(
    <MemoryRouter initialEntries={['/requests']}>
      <Routes>
        <Route path="/requests" element={<AllRequests />} />
        <Route path="/gigs/new/:id" element={<div>Matching screen</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [series] });
  api.post.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
});

describe('AllRequests (admin requests page)', () => {
  it('loads classes from the last 12 months, and everything after Show older classes', async () => {
    const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    renderPage();
    await screen.findAllByText('1/2 models');
    expect(api.get).toHaveBeenCalledWith('/request_series', { params: { since: yearAgo.toLocaleDateString('en-CA') } });

    expect(screen.queryByRole('button', { name: 'Show older classes' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Past' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show older classes' }));
    await vi.waitFor(() => expect(api.get.mock.calls.filter(([url]) => url === '/request_series').pop()).toEqual(['/request_series', { params: {} }]));
  });

  it('shows booking progress and who is booked', async () => {
    renderPage();
    expect((await screen.findAllByText('1/2 models')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Alex Booked/).length).toBeGreaterThan(0);
  });

  it('releases just one model from a date, with a real button that names the model', async () => {
    renderPage();
    const [releaseButton] = await screen.findAllByRole('button', { name: 'Release Alex Booked from this date and find someone else' });
    expect(releaseButton.tagName).toBe('BUTTON');
    await userEvent.click(releaseButton);
    await confirmWith('Release Model');
    expect(api.delete).toHaveBeenCalledWith('/gigs/100', { data: { note: '' } });
  });

  it('lists each booked model on their own line with a Release button in words, not an icon', async () => {
    renderPage();
    const [releaseButton] = await screen.findAllByRole('button', { name: 'Release Alex Booked from this date and find someone else' });
    expect(releaseButton).toHaveTextContent(/^Release$/);
    const line = releaseButton.parentElement;
    expect(line).toHaveTextContent('Alex Booked');
    expect(line.tagName).toBe('DIV');
  });

  it('releases all booked models for rematching', async () => {
    renderPage();
    const [button] = await screen.findAllByRole('button', { name: 'Release Models and Rematch' });
    await userEvent.click(button);
    await confirmWith('Release and Rematch');
    expect(api.post).toHaveBeenCalledWith('/request_series/1/release_remaining', { note: '' });
  });

  it('sends the admin to the matching screen to find more models', async () => {
    renderPage();
    const [button] = await screen.findAllByRole('button', { name: 'Find More Models' });
    await userEvent.click(button);
    expect(await screen.findByText('Matching screen')).toBeInTheDocument();
  });

  it("shows the server's reason when models per session can't be lowered", async () => {
    api.patch.mockRejectedValue({ response: { data: { error: "Models needed can't be lower than the 1 model(s) already booked on a date." } } });
    renderPage();
    const [editButton] = await screen.findAllByRole('button', { name: 'Edit Class' });
    await userEvent.click(editButton);

    const dialog = await screen.findByRole('dialog');
    const modelsSelect = within(dialog).getByLabelText('Number of Models');
    await userEvent.selectOptions(modelsSelect, '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/request_series/1', expect.objectContaining({
      request_series: expect.objectContaining({ models_needed: 1 })
    }));
    expect(await within(dialog).findByText(/can't be lower/)).toBeInTheDocument();
  });

  it('lets the admin give a reason when cancelling a class, kept in History', async () => {
    renderPage();
    const [cancel] = await screen.findAllByRole('button', { name: 'Cancel Class' });
    await userEvent.click(cancel);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Reason (optional, kept in History)'), 'Faculty on leave');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel Class' }));
    expect(api.delete).toHaveBeenCalledWith('/request_series/1', { data: { note: 'Faculty on leave' } });
  });

  it('sends the reason for an edit with every change Edit Class saves', async () => {
    api.patch.mockResolvedValue({ data: {} });
    renderPage();
    const [editButton] = await screen.findAllByRole('button', { name: 'Edit Class' });
    await userEvent.click(editButton);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Reason for these changes (optional)'), 'Moved rooms');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await vi.waitFor(() => expect(api.patch).toHaveBeenCalledWith('/request_series/1', expect.objectContaining({ note: 'Moved rooms' })));
    for (const [url, body] of api.patch.mock.calls.filter(([url]) => url.startsWith('/faculty_requests/'))) {
      expect(body, url).toEqual(expect.objectContaining({ note: 'Moved rooms' }));
    }
  });

  it('labels every field and button in the Edit Class window', async () => {
    renderPage();
    const [editButton] = await screen.findAllByRole('button', { name: 'Edit Class' });
    await userEvent.click(editButton);
    const dialog = await screen.findByRole('dialog');

    for (const label of ['Class Name', 'Department', 'Building', 'Room Number', 'Notes', 'Number of Models', 'Date 1', 'Start time 1', 'End time 1']) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('button', { name: 'Remove date 1' })).toBeInTheDocument();
  });

  it('flags the date a model dropped out of, and names them', async () => {
    const dropped = {
      ...series,
      faculty_requests: [{ ...series.faculty_requests[0], needs_attention: true, dropped_out_model_name: 'Jordan Ellis' }]
    };
    api.get.mockResolvedValue({ data: [dropped] });
    renderPage();
    expect((await screen.findAllByText('Needs Attention: Jordan Ellis dropped out')).length).toBeGreaterThan(0);
  });

  it("lists each model's preferences for classes that set them separately", async () => {
    const any = { pref_skin_tone: 'Any', pref_gender: 'Any', pref_genitalia: 'Any' };
    api.get.mockResolvedValue({ data: [{
      ...series,
      model_slots: [{ position: 1, ...any, pref_body_type: 'Fat' }, { position: 2, ...any, pref_body_type: 'Muscular' }]
    }] });
    renderPage();
    expect((await screen.findAllByText(/Model 2: .*Muscular Build/)).length).toBeGreaterThan(0);
  });

  it('asks before cancelling a class, and keeps it if they go back', async () => {
    renderPage();
    const [cancel] = await screen.findAllByRole('button', { name: 'Cancel Class' });

    await userEvent.click(cancel);
    await confirmWith('Keep Class');
    expect(api.delete).not.toHaveBeenCalled();

    await userEvent.click(cancel);
    await confirmWith('Cancel Class');
    expect(api.delete).toHaveBeenCalledWith('/request_series/1', { data: { note: '' } });
  });

  it('on phone cards, keeps the main button and tucks the rest into a More menu', async () => {
    renderPage();
    const more = await screen.findByRole('button', { name: 'More actions for Figure Drawing I' });
    const card = more.closest('.card');
    expect(within(card).getByRole('button', { name: 'Find More Models' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Cancel Class' })).toBeNull();

    await userEvent.click(more);
    expect(within(card).getByRole('button', { name: 'Release Models and Rematch' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Edit Class' })).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel Class' }));
    await confirmWith('Cancel Class');
    expect(api.delete).toHaveBeenCalledWith('/request_series/1', { data: { note: '' } });
  });

  it('lists only the preferences faculty actually set', async () => {
    api.get.mockResolvedValue({ data: [{ ...series, pref_body_type: 'Muscular' }] });
    renderPage();
    expect((await screen.findAllByText(/Muscular Build/)).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Any Skintone|Gender: Any/)).toHaveLength(0);
  });

  it("makes each date's Find Model link a real button, so it works from the keyboard", async () => {
    const booked = { ...series.faculty_requests[0], id: 11, status: 'matched' };
    const open = { ...series.faculty_requests[0], id: 12, status: 'pending', confirmed_gigs: [],
                   starts_at: daysFromNow(19, 15), ends_at: daysFromNow(19, 17) };
    api.get.mockResolvedValue({ data: [{ ...series, models_needed: 1, faculty_requests: [booked, open] }] });
    renderPage();
    const links = await screen.findAllByRole('button', { name: 'Find Model' });
    for (const link of links) expect(link.tagName).toBe('BUTTON');
  });

  it('names the faculty member above the class, with no Faculty column, and gives the dates the widest column', async () => {
    renderPage();
    const [table] = await screen.findAllByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map(h => h.textContent)).toEqual(['Date(s)', 'Class', 'Reqs', 'Action']);
    const widths = headers.map(h => parseFloat(h.style.width));
    expect(widths[0]).toBe(Math.max(...widths));

    const classCell = within(table).getAllByRole('row')[1].querySelectorAll('td')[1];
    const lines = [...classCell.children].map(el => el.textContent);
    expect(lines[0]).toMatch(/Priya Nair/);
    expect(lines[1]).toBe('Figure Drawing I');
  });

  it('shows each date as its own block: day and time first, then its tags, then who is booked', async () => {
    const booked = { ...series.faculty_requests[0], id: 11, status: 'matched' };
    const open = { ...series.faculty_requests[0], id: 12, status: 'pending', confirmed_gigs: [],
                   starts_at: daysFromNow(19, 15), ends_at: daysFromNow(19, 17) };
    api.get.mockResolvedValue({ data: [{ ...series, models_needed: 1, faculty_requests: [booked, open] }] });
    renderPage();
    const [matched] = await screen.findAllByText('Matched', { selector: '.badge' });
    const block = matched.closest('[data-date-block]');
    const [dayLine, tagLine, modelLine] = block.children;

    expect(dayLine).toHaveTextContent(formatDateWithWeekday(booked.starts_at));
    expect(within(dayLine).getByText(`${formatTimeShort(booked.starts_at)} – ${formatTimeShort(booked.ends_at)}`)).toHaveClass('text-nowrap');
    expect(tagLine).toContainElement(matched);
    expect(modelLine).toHaveTextContent('Alex Booked');
    expect(block).toHaveClass('border-success');

    const [pending] = screen.getAllByText('Pending', { selector: '.badge' });
    expect(pending.closest('[data-date-block]')).toHaveClass('border-warning');
  });

  it("puts a pending date's tag and Find Model on their own line, like a booked model's Release", async () => {
    const booked = { ...series.faculty_requests[0], id: 11, status: 'matched' };
    const open = { ...series.faculty_requests[0], id: 12, status: 'pending', confirmed_gigs: [],
                   starts_at: daysFromNow(19, 15), ends_at: daysFromNow(19, 17) };
    api.get.mockResolvedValue({ data: [{ ...series, models_needed: 1, faculty_requests: [booked, open] }] });
    renderPage();
    const find = (await screen.findAllByRole('button', { name: 'Find Model' })).find(b => b.classList.contains('btn-link'));
    expect(find.parentElement.tagName).toBe('DIV');
    expect(find.parentElement.textContent).not.toMatch(/[()]/);
  });

  it("explains why a model couldn't be released", async () => {
    api.delete.mockRejectedValue({ response: { data: { error: "This session has already started, so the model can't be released from it." } } });
    renderPage();
    const [releaseButton] = await screen.findAllByRole('button', { name: /Release Alex Booked/ });
    await userEvent.click(releaseButton);
    await confirmWith('Release Model');

    expect(await screen.findByRole('dialog', { name: "Couldn't release the model" })).toHaveTextContent('already started');
  });

  describe('which dates the page shows', () => {
    const past = {
      ...series, id: 2, class_name: 'Old Portrait Class', status: 'matched',
      faculty_requests: [{ ...series.faculty_requests[0], id: 21, status: 'matched', starts_at: daysFromNow(-10, 15), ends_at: daysFromNow(-10, 17) }]
    };
    beforeEach(() => api.get.mockResolvedValue({ data: [series, past] }));

    it('opens on upcoming classes', async () => {
      renderPage();
      expect((await screen.findAllByText('Figure Drawing I')).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryAllByText('Old Portrait Class')).toHaveLength(0);
    });

    it('shows past classes a click away', async () => {
      renderPage();
      await screen.findAllByText('Figure Drawing I');
      await userEvent.click(screen.getByRole('button', { name: 'Past' }));
      expect(screen.getAllByText('Old Portrait Class').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Figure Drawing I')).toHaveLength(0);
    });

    it('can narrow to a date range, with labelled fields', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Date Range' }));
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });
  });

  it('orders classes by their earliest date, even when the server lists a later date first', async () => {
    const later = { ...series, id: 1, class_name: 'Later Class',
      faculty_requests: [{ ...series.faculty_requests[0], id: 31, starts_at: daysFromNow(5, 15), ends_at: daysFromNow(5, 17) }] };
    const earlier = { ...series, id: 2, class_name: 'Earlier Class',
      faculty_requests: [
        { ...series.faculty_requests[0], id: 41, starts_at: daysFromNow(9, 14), ends_at: daysFromNow(9, 17) },
        { ...series.faculty_requests[0], id: 42, starts_at: daysFromNow(3, 11), ends_at: daysFromNow(3, 13) },
      ] };
    api.get.mockResolvedValue({ data: [later, earlier] });
    renderPage();

    await screen.findAllByText('Earlier Class');
    const titles = screen.getAllByText(/^(Earlier|Later) Class$/).map(el => el.textContent);
    expect(titles.indexOf('Earlier Class')).toBeLessThan(titles.indexOf('Later Class'));
  });

  it('keeps the status filters and the date filters in separate, named groups', async () => {
    renderPage();
    await screen.findAllByText('Figure Drawing I');

    const status = screen.getByRole('group', { name: 'Status' });
    const dates = screen.getByRole('group', { name: 'Dates' });
    expect(within(status).getAllByRole('button').map(b => b.textContent.trim())).toEqual(['All', 'Pending', 'Matched', 'Cancelled']);
    expect(within(dates).getAllByRole('button').map(b => b.textContent.trim())).toEqual(['Upcoming', 'Past', 'Date Range']);
  });

  it('says which status filter is on', async () => {
    renderPage();
    await screen.findAllByText('Figure Drawing I');
    const status = screen.getByRole('group', { name: 'Status' });
    expect(within(status).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(status).getByRole('button', { name: 'Pending' }));
    expect(within(status).getByRole('button', { name: 'Pending' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(status).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  describe('search', () => {
    const bell = {
      ...series, id: 3, class_name: 'Sculpture Basics', department: 'Sculpture',
      user: { first_name: 'Marcus', last_name: 'Bell' },
      faculty_requests: [{ ...series.faculty_requests[0], id: 31, user: undefined, confirmed_gigs: [] }]
    };
    beforeEach(() => api.get.mockResolvedValue({ data: [series, bell] }));

    /** Searches the page for this text. */
    const searchFor = async (text) => {
      renderPage();
      await screen.findAllByText('Sculpture Basics');
      await userEvent.type(screen.getByRole('textbox', { name: /Search/ }), text);
    };

    it("finds a class by the faculty member's last name", async () => {
      await searchFor('Bell');
      expect(screen.getAllByText('Sculpture Basics').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Figure Drawing I')).toHaveLength(0);
    });

    it("finds a class by the faculty member's full name", async () => {
      await searchFor('marcus bell');
      expect(screen.getAllByText('Sculpture Basics').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Figure Drawing I')).toHaveLength(0);
    });

    it('finds a class by name or department, ignoring extra spaces', async () => {
      await searchFor('  sculpture ');
      expect(screen.getAllByText('Sculpture Basics').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Figure Drawing I')).toHaveLength(0);
    });
  });

  describe('classes that already happened', () => {
    /** A date with a model booked. */
    const booked = (id, days, name) => ({
      id, status: 'matched', models_needed: 1, starts_at: daysFromNow(days, 15), ends_at: daysFromNow(days, 17),
      confirmed_gigs: [{ id: id + 500, status: 'confirmed', art_model_availability: { user: { first_name: name, last_name: 'Model' } } }]
    });
    const finished = { ...series, id: 8, class_name: 'Gesture Drawing', status: 'matched', models_needed: 1,
      faculty_requests: [booked(81, -14, 'Jordan'), booked(82, -7, 'Jordan')] };
    const ongoing = { ...series, id: 9, class_name: 'Ongoing Class', status: 'matched', models_needed: 1,
      faculty_requests: [booked(91, -3, 'Past'), booked(92, 6, 'Future')] };

    beforeEach(() => api.get.mockResolvedValue({ data: [finished, ongoing] }));

    it('offers no actions on a class whose dates have all happened', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Past' }));
      await screen.findAllByText('Gesture Drawing');
      for (const name of [/Release/, /Edit Class/, /Cancel Class/, /Find/, /More actions/]) {
        expect(screen.queryAllByRole('button', { name })).toHaveLength(0);
      }
      expect(screen.queryAllByRole('columnheader', { name: 'Action' })).toHaveLength(0);
    });

    it('only offers to release a model from dates still to come', async () => {
      renderPage();
      await screen.findAllByText('Ongoing Class');
      expect(screen.getAllByRole('button', { name: 'Release Future Model from this date and find someone else' }).length).toBeGreaterThan(0);
      expect(screen.queryAllByRole('button', { name: 'Release Past Model from this date and find someone else' })).toHaveLength(0);
    });

    it('marks a finished class as Finished when it shows up in a date range', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Date Range' }));
      const from = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA');
      const to = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA');
      fireEvent.change(screen.getAllByLabelText('From')[0], { target: { value: from } });
      fireEvent.change(screen.getAllByLabelText('To')[0], { target: { value: to } });

      const row = screen.getAllByText('Gesture Drawing').map(el => el.closest('tr')).find(Boolean);
      expect(within(row).getByText(/Finished/)).toBeInTheDocument();
      expect(within(row).getAllByRole('button').every(b => /^Make Correction for /.test(b.getAttribute('aria-label')))).toBe(true);
    });
  });

  describe('correcting a past date', () => {
    const jordan = { id: 1, first_name: 'Jordan', last_name: 'Ellis' };
    const pastDate = {
      id: 81, status: 'matched', models_needed: 1, starts_at: daysFromNow(-7, 10), ends_at: daysFromNow(-7, 12),
      confirmed_gigs: [],
      gigs: [{ id: 300, status: 'cancelled', billable: false, no_show: true, art_model_availability: { user: jordan },
        corrections: [{ id: 1, kind: 'no_show', summary: 'Marked Jordan Ellis as a no-show (not paid)', user: { first_name: 'Pat', last_name: 'Reyes' } }] }]
    };
    const gesture = { ...series, id: 8, class_name: 'Gesture Drawing', status: 'matched', models_needed: 1, faculty_requests: [pastDate] };
    beforeEach(() => api.get.mockImplementation((url) =>
      Promise.resolve({ data: url === '/request_series' ? [gesture] : [] })));

    it("lists who was on a past date, how they're paid, and that it was corrected", async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Past' }));
      expect((await screen.findAllByText(/No-show \(Not paid\)/)).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/corrected/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Past').length).toBeGreaterThan(0);
    });

    it('tells a finished class to use the Make Correction links', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Date Range' }));
      fireEvent.change(screen.getAllByLabelText('From')[0], { target: { value: new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA') } });
      expect((await screen.findAllByText('Finished. Use Make Correction next to a date to fix its record.')).length).toBeGreaterThan(0);
    });

    it('shows the hours really worked on a past date when they were corrected', async () => {
      const longer = { ...pastDate, gigs: [{ id: 301, status: 'confirmed', billable: null, no_show: false,
        art_model_availability: { user: jordan }, worked_starts_at: daysFromNow(-7, 10), worked_ends_at: daysFromNow(-7, 13),
        corrections: [{ id: 2, kind: 'hours', summary: 'Hours changed', user: { first_name: 'Pat', last_name: 'Reyes' } }] }] };
      api.get.mockImplementation((url) => Promise.resolve({ data: url === '/request_series' ? [{ ...gesture, faculty_requests: [longer] }] : [] }));
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Past' }));
      const worked = `worked ${formatTime(daysFromNow(-7, 10))} – ${formatTime(daysFromNow(-7, 13))}`;
      expect((await screen.findAllByText(new RegExp(worked))).length).toBeGreaterThan(0);
    });

    it('opens the Correct record window for that model and date', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Past' }));
      const [button] = await screen.findAllByRole('button', { name: /^Make Correction for Jordan Ellis on / });
      await userEvent.click(button);
      expect(await screen.findByRole('dialog', { name: 'Correct the record' })).toHaveTextContent('Gesture Drawing');
    });
  });

  describe('who could take a pending date', () => {
    /** A model. */
    const person = (id, extra = {}) => ({ id, role: 'model', first_name: `Model${id}`, last_name: 'Test', email: `model${id}@mica.edu`,
      skin_tone: 'Light', gender_identity: 'Woman', body_type: 'Average', willing_to_model_nude: false, ...extra });
    /** Free time covering the whole test class day. */
    const freeAllDay = (user) => ({ id: user.id * 10, status: 'active', user,
      starts_at: daysFromNow(12, 8), ends_at: daysFromNow(12, 22) });
    const fatClass = { ...series, pref_body_type: 'Fat' };

    /** Sets what the fake API returns for classes, people and free time. */
    const load = ({ list = [fatClass], users = [], availability = [] } = {}) => api.get.mockImplementation((url) => {
      if (url === '/users') return Promise.resolve({ data: users });
      if (url.startsWith('/art_model_availabilities')) return Promise.resolve({ data: availability });
      if (url === '/gigs') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: list });
    });

    it('says when no model at all is free', async () => {
      load({ users: [person(1)] });
      renderPage();
      expect((await screen.findAllByText('No models free')).length).toBeGreaterThan(0);
    });

    it("says when models are free but none fits what the faculty asked for", async () => {
      const average = person(1);
      load({ users: [average], availability: [freeAllDay(average)] });
      renderPage();
      expect((await screen.findAllByText('No matching models free · 1 free')).length).toBeGreaterThan(0);
    });

    it('counts the matching models who are free', async () => {
      const fat1 = person(1, { body_type: 'Fat' });
      const fat2 = person(2, { body_type: 'Fat' });
      load({ users: [fat1, fat2], availability: [freeAllDay(fat1), freeAllDay(fat2)] });
      renderPage();
      expect((await screen.findAllByText('2 matching free')).length).toBeGreaterThan(0);
    });

    it('offers a ready email to the matching models, or to every model', async () => {
      const fat = person(1, { body_type: 'Fat' });
      const average = person(2);
      load({ users: [fat, average] });
      renderPage();
      const [menu] = await screen.findAllByRole('button', { name: 'Notify Models' });
      await userEvent.click(menu);

      const matching = await screen.findByRole('link', { name: 'Models who match (1)' });
      const everyone = screen.getByRole('link', { name: 'All models (2)' });
      expect(matching.getAttribute('href')).toMatch(/^mailto:\?bcc=model1@mica\.edu&/);
      expect(everyone.getAttribute('href')).toMatch(/^mailto:\?bcc=model1@mica\.edu,model2@mica\.edu&/);
      expect(decodeURIComponent(matching.getAttribute('href'))).toContain('Figure Drawing I');
    });

    it("only offers models willing to pose nude for a nude class", async () => {
      const nudeOk = person(1, { willing_to_model_nude: true });
      const clothedOnly = person(2);
      load({ list: [{ ...series, model_mode: 'nude' }], users: [nudeOk, clothedOnly] });
      renderPage();
      const [menu] = await screen.findAllByRole('button', { name: 'Notify Models' });
      await userEvent.click(menu);
      expect(await screen.findByRole('link', { name: 'All models willing to pose nude (1)' })).toBeInTheDocument();
    });

    it('only offers Notify Models when a date has no matching model free', async () => {
      const fat = person(1, { body_type: 'Fat' });
      load({ users: [fat], availability: [freeAllDay(fat)] });
      renderPage();
      await screen.findAllByText('1 matching free');
      expect(screen.queryAllByRole('button', { name: 'Notify Models' })).toHaveLength(0);
    });

    it('emails only about the dates that still have no matching model free', async () => {
      const fat = person(1, { body_type: 'Fat' });
      const covered = series.faculty_requests[0];
      const uncovered = { ...covered, id: 12, starts_at: daysFromNow(14, 15), ends_at: daysFromNow(14, 17), confirmed_gigs: [] };
      load({ list: [{ ...fatClass, faculty_requests: [covered, uncovered] }], users: [fat], availability: [freeAllDay(fat)] });
      renderPage();
      const [menu] = await screen.findAllByRole('button', { name: 'Notify Models' });
      await userEvent.click(menu);
      const body = decodeURIComponent((await screen.findByRole('link', { name: 'Models who match (1)' })).getAttribute('href'));
      expect(body).toContain(formatDateWithWeekday(uncovered.starts_at));
      expect(body).not.toContain(formatDateWithWeekday(covered.starts_at));
    });

    it("doesn't offer an email when no model fits", async () => {
      load({ users: [person(1)] });
      renderPage();
      const [menu] = await screen.findAllByRole('button', { name: 'Notify Models' });
      await userEvent.click(menu);
      expect((await screen.findAllByText('Models who match (0)')).length).toBeGreaterThan(0);
      expect(screen.queryByRole('link', { name: 'Models who match (0)' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Models who match (0)' })).toBeNull();
    });
  });

  it('starts a date added in Edit Class at 9:00 to 11:00 AM, with the end following the start', async () => {
    renderPage();
    const [edit] = await screen.findAllByRole('button', { name: 'Edit Class' });
    await userEvent.click(edit);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Add Date/ }));

    expect(within(dialog).getByLabelText('Start time 2')).toHaveValue('09:00');
    expect(within(dialog).getByLabelText('End time 2')).toHaveValue('11:00');
    fireEvent.change(within(dialog).getByLabelText('Start time 2'), { target: { value: '14:00' } });
    expect(within(dialog).getByLabelText('End time 2')).toHaveValue('16:00');
  });
});
