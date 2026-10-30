import api, { API_URL } from './api';

// Instead of a real network call, echo back the request that would have been sent
const echo = async (config) => ({ data: config, status: 200, statusText: 'OK', headers: {}, config });

beforeEach(() => localStorage.clear());

describe('api (backend connection)', () => {
  it('sends the login token with every request', async () => {
    localStorage.setItem('token', 'abc123');
    const { data: sent } = await api.get('/me', { adapter: echo });
    expect(sent.headers.Authorization).toBe('Bearer abc123');
  });

  it('sends no token header when nobody is logged in', async () => {
    const { data: sent } = await api.get('/me', { adapter: echo });
    expect(sent.headers.Authorization).toBeUndefined();
  });

  it('talks to the backend address, which is the local server unless one is set', async () => {
    const { data: sent } = await api.get('/me', { adapter: echo });
    expect(sent.baseURL).toBe(API_URL);
    expect(API_URL).toBe(import.meta.env.VITE_API_URL || 'http://localhost:3000');
  });

  it('tells the app when the server says a signed-in person\'s sign-in has expired', async () => {
    localStorage.setItem('token', 'old-token');
    const heard = vi.fn();
    window.addEventListener('pose-pool:signed-out', heard);
    const expired = async (config) => Promise.reject({ response: { status: 401 }, config });

    await expect(api.get('/gigs', { adapter: expired })).rejects.toBeTruthy();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener('pose-pool:signed-out', heard);
  });

  it("doesn't, when nobody was signed in to begin with", async () => {
    const heard = vi.fn();
    window.addEventListener('pose-pool:signed-out', heard);
    const expired = async (config) => Promise.reject({ response: { status: 401 }, config });

    await expect(api.get('/me', { adapter: expired })).rejects.toBeTruthy();
    expect(heard).not.toHaveBeenCalled();
    window.removeEventListener('pose-pool:signed-out', heard);
  });
});
