/**
 * Tests for the SuperUser Panel: roles, sock accounts and clearing test data.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SuperUserPanel from './SuperUserPanel';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { renderWithDialogs } from '../test/render';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));


const me      = { id: 1, role: 'admin',   superuser: true, first_name: 'Dex',   last_name: 'Fitch', email: 'dfitch@mica.edu', skin_tone: 'Medium' };
const priya   = { id: 2, role: 'faculty', first_name: 'Priya', last_name: 'Nair', email: 'pnair@mica.edu' };
const otherAdmin = { id: 3, role: 'admin', first_name: 'Sam', last_name: 'Lee', email: 'slee@mica.edu' };

/** Shows the panel for a SuperUser. */
function renderPanel(user = me) {
  return renderWithDialogs(
    <MemoryRouter initialEntries={['/superuser']}>
      <Routes>
        <Route path="/superuser" element={<SuperUserPanel currentUser={user} refreshUser={vi.fn()} />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/** A person's row in the table. */
async function rowFor(email) {
  const [cell] = await screen.findAllByText(email);
  return cell.closest('tr');
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [me, priya, otherAdmin] });
  api.post.mockResolvedValue({ data: {} });
});

describe('SuperUserPanel', () => {
  it('sends regular admins away', async () => {
    renderPanel({ ...me, superuser: false });
    expect(await screen.findByText('Home')).toBeInTheDocument();
  });

  it('changes another user\'s role', async () => {
    renderPanel();
    const row = await rowFor('pnair@mica.edu');
    await userEvent.click(within(row).getByRole('button', { name: 'Admin' }));
    expect(api.post).toHaveBeenCalledWith('/users/2/promote', { role: 'admin' });
  });

  it('only offers superuser status to admins', async () => {
    renderPanel();
    const facultyRow = await rowFor('pnair@mica.edu');
    expect(within(facultyRow).queryByRole('button', { name: /Make SuperUser/ })).toBeNull();

    const adminRow = await rowFor('slee@mica.edu');
    await userEvent.click(within(adminRow).getByRole('button', { name: /Make SuperUser/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Make Sam Lee a SuperUser?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Make SuperUser' }));
    expect(api.post).toHaveBeenCalledWith('/users/3/promote_to_superuser');
  });

  it("doesn't offer role buttons on your own row", async () => {
    renderPanel();
    const row = await rowFor('dfitch@mica.edu');
    expect(within(row).getByText("That's you")).toBeInTheDocument();
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('creates a sock account for an offline model', async () => {
    renderPanel();
    await screen.findAllByText('pnair@mica.edu');

    await userEvent.type(screen.getByLabelText('First Name'), 'Sam');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Rivera');
    await userEvent.type(screen.getByLabelText(/Email/), 'srivera@mica.edu');
    await userEvent.selectOptions(screen.getByLabelText('Gender'), 'Woman');
    await userEvent.click(screen.getByRole('button', { name: 'Create Sock Account' }));

    expect(api.post).toHaveBeenCalledWith('/users', {
      user: expect.objectContaining({ first_name: '🧦 Sam', last_name: 'Rivera', email: 'srivera@mica.edu', role: 'model' })
    });
    expect(await screen.findByText('Sock account created successfully!')).toBeInTheDocument();
  });

  it("shows the server's reason when a sock account can't be created", async () => {
    api.post.mockRejectedValue({ response: { data: { errors: ['Email has already been taken'] } } });
    renderPanel();
    await screen.findAllByText('pnair@mica.edu');

    await userEvent.type(screen.getByLabelText('First Name'), 'Sam');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Rivera');
    await userEvent.type(screen.getByLabelText(/Email/), 'pnair@mica.edu');
    await userEvent.selectOptions(screen.getByLabelText('Gender'), 'Woman');
    await userEvent.click(screen.getByRole('button', { name: 'Create Sock Account' }));

    expect(await screen.findByText('Email has already been taken')).toBeInTheDocument();
  });

  it('lets a sock account prefer not to say a skin tone', async () => {
    renderPanel();
    const options = [...(await screen.findByLabelText('Skin Tone')).options].map(o => o.value);
    expect(options).toContain('Prefer not to say');
  });

  it('names every control in the availability manager', async () => {
    const jordan = { id: 4, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu' };
    const slot = { id: 50, starts_at: daysFromNow(3, 15), ends_at: daysFromNow(3, 17), status: 'open' };
    api.get.mockImplementation((url) => Promise.resolve({
      data: url === '/users' ? [me, priya, jordan]
          : url.startsWith('/art_model_availabilities') ? [slot]
          : []
    }));
    renderPanel();

    await screen.findByRole('option', { name: /Jordan Ellis/ });
    await userEvent.selectOptions(screen.getByLabelText('Select Model'), '4');

    expect(await screen.findByRole('button', { name: /Delete availability/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '+ Add Slot' }));
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('End')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove new slot 1' })).toBeInTheDocument();
  });

  it('explains why switching your own role failed', async () => {
    api.post.mockRejectedValue({ response: { data: { errors: ['Email must be a MICA email address'] } } });
    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Become Model' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Email must be a MICA email address');
  });

  it("explains why changing someone else's role failed", async () => {
    api.post.mockRejectedValue({ response: { data: { errors: ['Email must be a MICA email address'] } } });
    renderPanel();
    const row = await rowFor('pnair@mica.edu');
    await userEvent.click(within(row).getByRole('button', { name: 'Admin' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Email must be a MICA email address');
  });

  it('asks for a skin tone before switching someone without one to model', async () => {
    renderPanel();
    const row = await rowFor('pnair@mica.edu');
    await userEvent.click(within(row).getByRole('button', { name: 'Model' }));

    const dialog = await screen.findByRole('dialog', { name: 'Choose a skin tone for Priya Nair' });
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Dark' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Switch to Model' }));

    expect(api.post).toHaveBeenCalledWith('/users/2/promote', { role: 'model', skin_tone: 'Dark' });
  });

  it('asks for your own skin tone if you become a model without one', async () => {
    api.post.mockResolvedValue({ data: { ...me, role: 'model' } });
    renderPanel({ ...me, skin_tone: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Become Model' }));

    const dialog = await screen.findByRole('dialog', { name: 'Choose your skin tone' });
    expect(within(dialog).getByRole('button', { name: 'Switch to Model' })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Light' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Switch to Model' }));

    expect(api.post).toHaveBeenCalledWith('/users/1/promote', { role: 'model', skin_tone: 'Light' });
  });

  it('says how to switch back after becoming a model', async () => {
    api.post.mockResolvedValue({ data: { ...me, role: 'model' } });
    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Become Model' }));

    expect(await screen.findByRole('dialog', { name: "You're now using the app as a model" }))
      .toHaveTextContent('Restore Admin Role');
  });

  describe('clearing my test data', () => {
    const counts = { classes: 1, dates: 2, availability: 2, real_classes_booked: 1 };
    /** Sets how much test data the fake API reports. */
    const withCounts = (c) => api.get.mockImplementation((url) =>
      Promise.resolve({ data: url === '/test_data' ? c : [me, priya, otherAdmin] }));

    it('says exactly what will be cleared before doing anything, and Keep It changes nothing', async () => {
      withCounts(counts);
      renderPanel();
      await userEvent.click(await screen.findByRole('button', { name: 'Clear My Test Data' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('1 class (2 dates)');
      expect(dialog).toHaveTextContent('2 availability blocks');
      expect(dialog).toHaveTextContent('1 real class you were booked into as a model goes back to needing a model');
      expect(dialog).toHaveTextContent("Nobody else's classes or availability are touched.");
      await userEvent.click(within(dialog).getByRole('button', { name: 'Keep It' }));
      expect(api.delete).not.toHaveBeenCalled();
    });

    it('clears it once confirmed, and says what was cleared', async () => {
      withCounts(counts);
      api.delete.mockResolvedValue({ data: counts });
      renderPanel();
      await userEvent.click(await screen.findByRole('button', { name: 'Clear My Test Data' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear Test Data' }));
      expect(api.delete).toHaveBeenCalledWith('/test_data');
      expect(await screen.findByText('Cleared 1 class and 2 availability blocks.')).toBeInTheDocument();
    });

    it("says so when there's nothing to clear", async () => {
      withCounts({ classes: 0, dates: 0, availability: 0, real_classes_booked: 0 });
      renderPanel();
      await userEvent.click(await screen.findByRole('button', { name: 'Clear My Test Data' }));
      expect(await screen.findByRole('dialog')).toHaveTextContent("You don't have any test classes or availability.");
      expect(api.delete).not.toHaveBeenCalled();
    });
  });
});

describe("removing a person's data", () => {
  it('removes the data after a warning, and marks the row', async () => {
    api.post.mockResolvedValue({ data: { ...priya, first_name: 'Removed', last_name: 'Person', email: 'removed-2@removed.invalid', removed_at: '2026-10-31T12:00:00Z' } });
    renderPanel();
    const row = await rowFor('pnair@mica.edu');
    await userEvent.click(within(row).getByRole('button', { name: 'Remove Data' }));

    const dialog = await screen.findByRole('dialog', { name: "Remove Priya Nair's data?" });
    expect(dialog).toHaveTextContent(/can't be undone/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Data' }));

    expect(api.post).toHaveBeenCalledWith('/users/2/remove_data');
    const updated = await rowFor('removed-2@removed.invalid');
    expect(within(updated).getByText('Data removed')).toBeInTheDocument();
    expect(within(updated).queryByRole('button', { name: 'Remove Data' })).toBeNull();
  });

  it("isn't offered for the SuperUser themselves or other SuperUsers", async () => {
    api.get.mockResolvedValue({ data: [me, priya, { ...otherAdmin, superuser: true }] });
    renderPanel();
    expect(within(await rowFor('dfitch@mica.edu')).queryByRole('button', { name: 'Remove Data' })).toBeNull();
    expect(within(await rowFor('slee@mica.edu')).queryByRole('button', { name: 'Remove Data' })).toBeNull();
  });

  it("says why when the data can't be removed yet", async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Priya has 1 upcoming class. Cancel it first.' } } });
    renderPanel();
    await userEvent.click(within(await rowFor('pnair@mica.edu')).getByRole('button', { name: 'Remove Data' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove Data' }));
    expect(await screen.findByText(/1 upcoming class/)).toBeInTheDocument();
  });
});
