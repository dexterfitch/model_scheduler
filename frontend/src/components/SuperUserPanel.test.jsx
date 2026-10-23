import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SuperUserPanel from './SuperUserPanel';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const me      = { id: 1, role: 'admin',   superuser: true, first_name: 'Dex',   last_name: 'Fitch', email: 'dfitch@mica.edu' };
const priya   = { id: 2, role: 'faculty', first_name: 'Priya', last_name: 'Nair', email: 'pnair@mica.edu' };
const otherAdmin = { id: 3, role: 'admin', first_name: 'Sam', last_name: 'Lee', email: 'slee@mica.edu' };

function renderPanel(user = me) {
  return render(
    <MemoryRouter initialEntries={['/superuser']}>
      <Routes>
        <Route path="/superuser" element={<SuperUserPanel currentUser={user} refreshUser={vi.fn()} />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// The panel shows each user twice (desktop table + phone cards); use the table row
async function rowFor(email) {
  const [cell] = await screen.findAllByText(email);
  return cell.closest('tr');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
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
    await userEvent.selectOptions(screen.getByLabelText('Gender Identity'), 'Woman');
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
    await userEvent.selectOptions(screen.getByLabelText('Gender Identity'), 'Woman');
    await userEvent.click(screen.getByRole('button', { name: 'Create Sock Account' }));

    expect(await screen.findByText('Email has already been taken')).toBeInTheDocument();
  });
});