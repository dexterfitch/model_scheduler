import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));

function renderLayout(user, { onLogout = vi.fn(), refreshUser = vi.fn() } = {}) {
  render(
    <MemoryRouter>
      <Layout currentUser={user} onLogout={onLogout} refreshUser={refreshUser} />
    </MemoryRouter>
  );
  return { onLogout, refreshUser };
}

const admin   = { id: 1, role: 'admin',   first_name: 'Dex' };
const faculty = { id: 2, role: 'faculty', first_name: 'Priya' };
const model   = { id: 3, role: 'model',   first_name: 'Jordan' };

beforeEach(() => vi.clearAllMocks());

describe('Layout (navigation)', () => {
  it('gives admins the full admin menu, without the SuperUser Panel', () => {
    renderLayout(admin);
    for (const name of ['Requests', 'Gigs', 'Calendar', 'Directory', 'Reports']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'SuperUser Panel' })).toBeNull();
  });

  it('adds the SuperUser Panel for superusers', () => {
    renderLayout({ ...admin, superuser: true });
    expect(screen.getByRole('link', { name: 'SuperUser Panel' })).toBeInTheDocument();
  });

  it('shows faculty only their classes, none of the admin pages', () => {
    renderLayout(faculty);
    expect(screen.getByRole('link', { name: 'My Classes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Directory' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull();
  });

  it('shows models their schedule and profile, none of the admin pages', () => {
    renderLayout(model);
    expect(screen.getByRole('link', { name: 'My Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Directory' })).toBeNull();
  });

  it('lets an undercover superuser switch back to admin', async () => {
    api.post.mockResolvedValue({ data: { ...admin, superuser: true } });
    const { refreshUser } = renderLayout({ ...model, superuser: true });

    expect(screen.getByText(/SUPERUSER MODE/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore Admin Role' }));

    expect(api.post).toHaveBeenCalledWith('/users/3/promote', { role: 'admin' });
    expect(refreshUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('logs out when Logout is clicked', async () => {
    const { onLogout } = renderLayout(faculty);
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(onLogout).toHaveBeenCalled();
  });
  
  it('gives the bug report button a name screen readers can announce', () => {
    renderLayout(faculty);
    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
  });
});