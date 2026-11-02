/**
 * Tests for My Classes: New Request, editing and cancelling, the Upcoming and Past
 * tabs, time fields and keyboard focus.
 */

import { screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacultyDashboard from './FacultyDashboard';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const series = {
  id: 1, class_name: 'Figure Drawing I', department: 'Drawing', status: 'pending',
  model_mode: 'clothed', models_needed: 2,
  pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Any', pref_genitalia: 'Any',
  faculty_requests: [
    { id: 11, status: 'pending', models_needed: 2, starts_at: daysFromNow(12, 15), ends_at: daysFromNow(12, 17),
      confirmed_gigs: [{ id: 100, status: 'confirmed', confirmed_by: { first_name: 'Dex', email: 'dfitch@mica.edu' } }] },
    { id: 12, status: 'pending', models_needed: 2, starts_at: daysFromNow(19, 15), ends_at: daysFromNow(19, 17),
      confirmed_gigs: [] }
  ]
};

const nextWeek = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
})();

/** Fills in and sends a New Request. */
async function submitNewRequest() {
  await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
  const modal = await screen.findByRole('dialog');
  /** A field in the open window, by its label. */
  const field = (label) => within(modal).getByLabelText(label);
  await userEvent.type(field('Class Name'), 'Anatomy Lab');
  await userEvent.selectOptions(field('Department'), 'Drawing');
  await userEvent.selectOptions(field('Building'), 'Main');
  fireEvent.change(field('Date'), { target: { value: nextWeek } });
  fireEvent.change(field('Start Time'), { target: { value: '10:00' } });
  fireEvent.change(field('End Time'), { target: { value: '12:00' } });
  await userEvent.click(within(modal).getByRole('button', { name: 'Submit Request' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [series] });
});

describe('FacultyDashboard', () => {
  it('shows how many models the class needs and how many are booked', async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    expect(await screen.findByText('2 models')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 Models Confirmed')).toBeInTheDocument();
  });

  it('only offers Edit Date on dates nobody is booked on yet', async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await screen.findByText('Figure Drawing I');
    expect(screen.getAllByRole('button', { name: 'Edit Date' })).toHaveLength(1);
  });

  it('shows the fallback message when the server sends no explanation', async () => {
    api.post.mockRejectedValue({});
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await submitNewRequest();
    expect(await screen.findByText('Error submitting request. Please try again.')).toBeInTheDocument();
  });

  it("shows the server's explanation when there is one", async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Date #1 (Nov 9): Starts at must be in the future' } } });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await submitNewRequest();
    expect(await screen.findByText(/Date #1 \(Nov 9\)/)).toBeInTheDocument();
  });

  it("brings New Request's error into view when the server refuses it, even with the form scrolled down", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    api.post.mockRejectedValue({ response: { data: { error: 'Date #1 (Nov 9): Starts at must be in the future' } } });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await submitNewRequest();
    const alert = (await screen.findByText(/Date #1 \(Nov 9\)/)).closest('[role="alert"]');
    expect(scrolled).toHaveBeenCalled();
    expect(alert).toHaveFocus();
    delete Element.prototype.scrollIntoView;
  });

  it('labels the New Request form, including the remove button on each date', async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
    const modal = await screen.findByRole('dialog');

    for (const label of ['Class Name', 'Department', 'Building', 'Room Number', 'Notes for Admin']) {
      expect(within(modal).getByLabelText(label)).toBeInTheDocument();
    }
    await userEvent.click(within(modal).getByRole('button', { name: /Add Another Date/ }));
    expect(within(modal).getByRole('group', { name: 'Date 2' })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Remove date 2' })).toBeInTheDocument();
  });

  it('edits just the day and times of one date', async () => {
    api.patch.mockResolvedValue({ data: {} });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Date' }));
    const modal = await screen.findByRole('dialog');

    for (const label of ['Date', 'Start Time', 'End Time']) {
      expect(within(modal).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(modal).queryByLabelText('Class Name')).toBeNull();

    fireEvent.change(within(modal).getByLabelText('Start Time'), { target: { value: '10:00' } });
    fireEvent.change(within(modal).getByLabelText('End Time'), { target: { value: '12:00' } });
    await userEvent.click(within(modal).getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/faculty_requests/12', {
      faculty_request: { starts_at: expect.any(Date), ends_at: expect.any(Date) }
    });
  });

  it('edits class details for every date at once with Edit Class', async () => {
    const unbooked = { ...series, id: 2, building: 'Main', faculty_requests: [series.faculty_requests[1]] };
    api.get.mockResolvedValue({ data: [unbooked] });
    api.patch.mockResolvedValue({ data: {} });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Class' }));
    const modal = await screen.findByRole('dialog');

    for (const label of ['Class Name', 'Department', 'Building', 'Room Number', 'Notes for Admin']) {
      expect(within(modal).getByLabelText(label)).toBeInTheDocument();
    }
    const name = within(modal).getByLabelText('Class Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Anatomy Lab');
    await userEvent.click(within(modal).getByRole('button', { name: 'Save Changes' }));

    expect(api.patch).toHaveBeenCalledWith('/request_series/2', expect.objectContaining({
      request_series: expect.objectContaining({ class_name: 'Anatomy Lab', department: 'Drawing' })
    }));
  });

  it("doesn't offer Edit Class once a model is booked, since only an admin can change it then", async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await screen.findByText('Figure Drawing I');
    expect(screen.queryByRole('button', { name: 'Edit Class' })).toBeNull();
  });

  it('sends separate preferences for each model in a new request', async () => {
    api.post.mockResolvedValue({ data: {} });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
    const modal = await screen.findByRole('dialog');
    /** A field in the open window, by its label. */
    const field = (label) => within(modal).getByLabelText(label);

    await userEvent.type(field('Class Name'), 'Group Pose Lab');
    await userEvent.selectOptions(field('Department'), 'Drawing');
    await userEvent.selectOptions(field('Building'), 'Main');
    fireEvent.change(field('Date'), { target: { value: nextWeek } });
    fireEvent.change(field('Start Time'), { target: { value: '10:00' } });
    fireEvent.change(field('End Time'), { target: { value: '12:00' } });
    await userEvent.selectOptions(field('Number of Models'), '2');
    const model2 = within(modal).getByRole('group', { name: 'Model 2' });
    await userEvent.click(within(model2).getByRole('radio', { name: 'Fat' }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Submit Request' }));

    expect(api.post).toHaveBeenCalledWith('/request_series', expect.objectContaining({
      model_slots: [
        expect.objectContaining({ pref_body_type: 'Any' }),
        expect.objectContaining({ pref_body_type: 'Fat' })
      ]
    }));
  });

  it('opens Edit Class with "Same for every model" on for classes saved without per-model preferences', async () => {
    const unbooked = { ...series, id: 2, building: 'Main', faculty_requests: [series.faculty_requests[1]] };
    api.get.mockResolvedValue({ data: [unbooked] });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Class' }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByLabelText('Same for every model')).toBeChecked();
  });

  it("lists each model's preferences on the class card", async () => {
    const any = { pref_skin_tone: 'Any', pref_gender: 'Any', pref_genitalia: 'Any' };
    api.get.mockResolvedValue({ data: [{
      ...series,
      model_slots: [{ position: 1, ...any, pref_body_type: 'Fat' }, { position: 2, ...any, pref_body_type: 'Muscular' }]
    }] });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);

    /** Finds a list item whose text matches. */
    const line = (pattern) => (_, el) => el.tagName === 'LI' && pattern.test(el.textContent);
    expect(await screen.findByText(line(/Model 1: .*Fat Build/))).toBeInTheDocument();
    expect(screen.getByText(line(/Model 2: .*Muscular Build/))).toBeInTheDocument();
  });

  it('asks before cancelling a whole class, then cancels it', async () => {
    api.delete.mockResolvedValue({});
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Class' }));

    const dialog = await screen.findByRole('dialog', { name: 'Cancel this class?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel Class' }));

    expect(api.delete).toHaveBeenCalledWith('/request_series/1');
    expect(await screen.findByRole('status')).toHaveTextContent('Class cancelled.');
  });

  it('keeps the class if they choose Keep Class', async () => {
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Class' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep Class' }));
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("explains why a date couldn't be cancelled", async () => {
    api.delete.mockRejectedValue({ response: { data: { error: "This session has already started, so it can't be cancelled." } } });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    const [cancelDate] = await screen.findAllByRole('button', { name: 'Cancel Date' });
    await userEvent.click(cancelDate);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel Date' }));

    expect(await screen.findByRole('dialog', { name: "Couldn't cancel this date" }))
      .toHaveTextContent('already started');
  });

  it('orders classes by their earliest date, even when the server lists a later date first', async () => {
    const later = { ...series, id: 1, class_name: 'Later Class',
      faculty_requests: [{ ...series.faculty_requests[1], id: 31, starts_at: daysFromNow(5, 15), ends_at: daysFromNow(5, 17) }] };
    const earlier = { ...series, id: 2, class_name: 'Earlier Class',
      faculty_requests: [
        { ...series.faculty_requests[1], id: 41, starts_at: daysFromNow(9, 14), ends_at: daysFromNow(9, 17) },
        { ...series.faculty_requests[1], id: 42, starts_at: daysFromNow(3, 11), ends_at: daysFromNow(3, 13) },
      ] };
    api.get.mockResolvedValue({ data: [later, earlier] });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);

    await screen.findByText('Earlier Class');
    const titles = screen.getAllByText(/^(Earlier|Later) Class$/).map(el => el.textContent);
    expect(titles).toEqual(['Earlier Class', 'Later Class']);
  });

  describe('past classes', () => {
    /** A booked date some days ago. */
    const pastDate = (id, days) => ({ id, status: 'matched', models_needed: 1, starts_at: daysFromNow(days, 15), ends_at: daysFromNow(days, 17),
      confirmed_gigs: [{ id: id + 500, status: 'confirmed', confirmed_by: { first_name: 'Dex', email: 'dfitch@mica.edu' } }] });
    const gesture = { ...series, id: 5, class_name: 'Gesture Drawing', status: 'matched', models_needed: 1,
      faculty_requests: [pastDate(51, -14), pastDate(52, -7)] };
    const sketching = { ...series, id: 6, class_name: 'Portrait Sketching', status: 'matched', models_needed: 1,
      faculty_requests: [pastDate(61, -30)] };
    const halfway = { ...series, id: 7, class_name: 'Halfway Class', status: 'pending', models_needed: 1,
      faculty_requests: [
        { ...pastDate(71, -2) },
        { id: 72, status: 'pending', models_needed: 1, starts_at: daysFromNow(5, 15), ends_at: daysFromNow(5, 17), confirmed_gigs: [] },
      ] };

    beforeEach(() => api.get.mockResolvedValue({ data: [series, gesture, sketching, halfway] }));

    it('opens on upcoming classes, with past ones on their own tab', async () => {
      renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
      expect(await screen.findByText('Figure Drawing I')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Upcoming (2)' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByText('Gesture Drawing')).toBeNull();

      await userEvent.click(screen.getByRole('tab', { name: 'Past (2)' }));
      expect(screen.getByText('Gesture Drawing')).toBeInTheDocument();
      expect(screen.queryByText('Figure Drawing I')).toBeNull();
    });

    it('lists past classes most recent first', async () => {
      renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
      await userEvent.click(await screen.findByRole('tab', { name: 'Past (2)' }));
      const titles = screen.getAllByText(/^(Gesture Drawing|Portrait Sketching)$/).map(el => el.textContent);
      expect(titles).toEqual(['Gesture Drawing', 'Portrait Sketching']);
    });

    it('offers no way to change or cancel a past class', async () => {
      renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
      await userEvent.click(await screen.findByRole('tab', { name: 'Past (2)' }));
      const panel = screen.getByRole('tabpanel');
      for (const name of [/Edit Date/, /Cancel Date/, /Add Date/, /Edit Class/, /Cancel Class/]) {
        expect(within(panel).queryByRole('button', { name })).toBeNull();
      }
      expect(within(panel).queryByText(/Need to edit\?/)).toBeNull();
    });

    it("doesn't offer to cancel a date that already happened in an ongoing class", async () => {
      renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
      const card = (await screen.findByText('Halfway Class')).closest('.card');
      expect(within(card).getAllByRole('button', { name: /Cancel Date/ })).toHaveLength(1);
      expect(within(card).getByText('Already happened')).toBeInTheDocument();
    });
  });

  it('opens Edit Date on the nearest 5-minute mark when a saved time is between them', async () => {
    const day = new Date(); day.setDate(day.getDate() + 10);
    /** A time on the test day. */
    const at = (h, m) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString();
    const oddTime = { ...series, faculty_requests: [{ id: 21, status: 'pending', models_needed: 1,
      starts_at: at(20, 59), ends_at: at(22, 0), confirmed_gigs: [] }] };
    api.get.mockResolvedValue({ data: [oddTime] });
    renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Date' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Start Time')).toHaveValue('21:00');
  });

  describe('times on a new date', () => {
    /** Shows My Classes and opens New Request. */
    const openNewRequest = async () => {
      renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
      await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
      return within(await screen.findByRole('dialog')).getByRole('group', { name: 'Date 1' });
    };

    it('start at 9:00 to 11:00 AM instead of empty', async () => {
      const date1 = await openNewRequest();
      expect(within(date1).getByLabelText('Start Time')).toHaveValue('09:00');
      expect(within(date1).getByLabelText('End Time')).toHaveValue('11:00');
    });

    it('move the end time along when the start time changes', async () => {
      const date1 = await openNewRequest();
      fireEvent.change(within(date1).getByLabelText('Start Time'), { target: { value: '13:00' } });
      expect(within(date1).getByLabelText('End Time')).toHaveValue('15:00');
    });

    it('keep an end time the faculty member chose', async () => {
      const date1 = await openNewRequest();
      fireEvent.change(within(date1).getByLabelText('End Time'), { target: { value: '16:00' } });
      fireEvent.change(within(date1).getByLabelText('Start Time'), { target: { value: '13:00' } });
      expect(within(date1).getByLabelText('End Time')).toHaveValue('16:00');
    });

    it('start at 9:00 to 11:00 AM on a date added with Add Date, too', async () => {
      renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
      const [addDate] = await screen.findAllByRole('button', { name: /Add Date/ });
      await userEvent.click(addDate);
      expect(screen.getByLabelText('Start')).toHaveValue('09:00');
      expect(screen.getByLabelText('End')).toHaveValue('11:00');
    });
  });

  describe('adding and removing dates from the keyboard', () => {
    /** Shows My Classes and opens New Request. */
    const openNewRequest = async () => {
      renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
      await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
      return screen.findByRole('dialog');
    };
    /** Whether one element comes after another on the page. */
    const comesAfter = (a, b) => !!(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);

    it('puts Add Another Date after the last date, before the model preferences', async () => {
      const dialog = await openNewRequest();
      const add = within(dialog).getByRole('button', { name: /Add Another Date/ });
      expect(comesAfter(add, within(dialog).getByRole('group', { name: 'Date 1' }))).toBe(true);
      expect(comesAfter(within(dialog).getByLabelText('Nudity'), add)).toBe(true);

      await userEvent.click(add);
      expect(comesAfter(add, within(dialog).getByRole('group', { name: 'Date 2' }))).toBe(true);
    });

    it('moves to the new date after adding one', async () => {
      const dialog = await openNewRequest();
      await userEvent.click(within(dialog).getByRole('button', { name: /Add Another Date/ }));
      const date2 = within(dialog).getByRole('group', { name: 'Date 2' });
      expect(within(date2).getByLabelText('Date')).toHaveFocus();
    });

    it('moves to the date before after removing one', async () => {
      const dialog = await openNewRequest();
      await userEvent.click(within(dialog).getByRole('button', { name: /Add Another Date/ }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove date 2' }));
      const date1 = within(dialog).getByRole('group', { name: 'Date 1' });
      expect(within(date1).getByLabelText('Date')).toHaveFocus();
    });
  });

  describe('repeating a class every week', () => {
    /** Shows My Classes and opens New Request. */
    const openNewRequest = async () => {
      renderWithDialogs(<FacultyDashboard user={{ id: 1 }} />);
      await userEvent.click(await screen.findByRole('button', { name: /New Request/ }));
      return screen.findByRole('dialog');
    };

    it('adds a date each week until the chosen day, at the same times', async () => {
      const dialog = await openNewRequest();
      const date1 = within(dialog).getByRole('group', { name: 'Date 1' });
      fireEvent.change(within(date1).getByLabelText('Date'), { target: { value: '2026-11-03' } });
      fireEvent.change(within(date1).getByLabelText('Start Time'), { target: { value: '13:00' } });
      fireEvent.change(within(dialog).getByLabelText('Repeat weekly until'), { target: { value: '2026-11-24' } });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add Weekly Dates' }));

      const dates = within(dialog).getAllByRole('group', { name: /^Date \d+$/ });
      expect(dates.map(g => within(g).getByLabelText('Date').value)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
      expect(within(dates[3]).getByLabelText('Start Time')).toHaveValue('13:00');
      expect(within(dates[3]).getByLabelText('End Time')).toHaveValue('15:00');
      expect(within(dialog).getByRole('status')).toHaveTextContent('Added 3 weekly dates.');
    });

    it("doesn't add a week that's already listed", async () => {
      const dialog = await openNewRequest();
      fireEvent.change(within(within(dialog).getByRole('group', { name: 'Date 1' })).getByLabelText('Date'), { target: { value: '2026-11-03' } });
      await userEvent.click(within(dialog).getByRole('button', { name: /Add Another Date/ }));
      fireEvent.change(within(within(dialog).getByRole('group', { name: 'Date 2' })).getByLabelText('Date'), { target: { value: '2026-11-10' } });
      fireEvent.change(within(dialog).getByLabelText('Repeat weekly until'), { target: { value: '2026-11-17' } });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add Weekly Dates' }));

      const dates = within(dialog).getAllByRole('group', { name: /^Date \d+$/ });
      expect(dates.map(g => within(g).getByLabelText('Date').value)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17']);
    });

    it('asks for the first date before repeating', async () => {
      const dialog = await openNewRequest();
      fireEvent.change(within(dialog).getByLabelText('Repeat weekly until'), { target: { value: '2026-11-24' } });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add Weekly Dates' }));
      expect(within(dialog).getByRole('status')).toHaveTextContent('Choose the first date, then repeat it.');
      expect(within(dialog).getAllByRole('group', { name: /^Date \d+$/ })).toHaveLength(1);
    });
  });
});
