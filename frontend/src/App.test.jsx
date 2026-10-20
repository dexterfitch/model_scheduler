import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import api from './services/api';

vi.mock('./services/api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));

// Stand-ins for every page, so these tests focus on login, logout and routing
vi.mock('./components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: ({ onLogout }) => <div><button onClick={onLogout}>Log out</button><Outlet /></div> };
});
vi.mock('./components/LoginPage',        () => ({ default: () => <div>Login page</div> }));
vi.mock('./components/SelectRole',       () => ({ default: () => <div>Select role page</div> }));
vi.mock('./components/FacultyDashboard', () => ({ default: () => <div>Faculty dashboard</div> }));
vi.mock('./components/ModelDashboard',   () => ({ default: () => <div>Model dashboard</div> }));
vi.mock('./components/AdminDashboard',   () => ({ default: () => <div>Admin dashboard</div> }));
vi.mock('./components/AdminCalendar',    () => ({ default: () => null }));
vi.mock('./components/AllGigs',          () => ({ default: () => null }));
vi.mock('./components/AllRequests',      () => ({ default: () => null }));
vi.mock('./components/UserDirectory',    () => ({ default: () => null }));
vi.mock('./components/ModelDetail',      () => ({ default: () => null }));
vi.mock('./components/GigCreator',       () => ({ default: () => null }));
vi.mock('./components/SuperUserPanel',   () => ({ default: () => null }));
vi.mock('./components/Reports',          () => ({ default: () => null }));
vi.mock('./components/Profile',          () => ({ default: () => null }));

const faculty = { id: 5, role: 'faculty', first_name: 'Priya' };

// Pretend the browser just arrived at this address
const visit = (path) => window.history.pushState({}, '', path);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.delete.mockResolvedValue({ data: {} });
});

describe('App: login and logout', () => {
  it('finishes a Google login, keeps the token, and lands on the dashboard', async () => {
    api.get.mockImplementation((url) =>
      url === '/me' ? Promise.reject({}) : Promise.resolve({ data: faculty }));
    visit('/login_success/5?token=abc123');
    const historyBefore = window.history.length;

    render(<App />);

    expect(await screen.findByText('Faculty dashboard')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('abc123');
    expect(window.location.pathname).toBe('/');
    // Fix 8b: the token-bearing address was replaced, not left behind in history
    expect(window.history.length).toBe(historyBefore);
  });

  it('sends brand-new users to choose a role', async () => {
    api.get.mockImplementation((url) =>
      url === '/me' ? Promise.reject({}) : Promise.resolve({ data: { id: 5, role: null } }));
    visit('/login_success/5?token=abc123');

    render(<App />);
    expect(await screen.findByText('Select role page')).toBeInTheDocument();
  });

  it('returns to the login page if the login fails', async () => {
    api.get.mockRejectedValue({});
    visit('/login_success/5?token=bad');

    render(<App />);
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('logs out: tells the server, forgets the token, and shows the login page', async () => {
    localStorage.setItem('token', 'abc123');
    api.get.mockResolvedValue({ data: faculty });
    visit('/');

    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(api.delete).toHaveBeenCalledWith('/logout');
    expect(localStorage.getItem('token')).toBeNull();
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('still logs out locally if the server is unreachable', async () => {
    localStorage.setItem('token', 'abc123');
    api.get.mockResolvedValue({ data: faculty });
    api.delete.mockRejectedValue({});
    visit('/');

    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(localStorage.getItem('token')).toBeNull();
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});