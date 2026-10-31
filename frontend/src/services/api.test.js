/**
 * Tests for the API connection: the token header and signing out on a rejected token.
 */

import api, { API_URL } from './api';

/** A fake network that answers with the request it was sent. */
const echo = async (config) => ({ data: config, status: 200, statusText: 'OK', headers: {}, config });

beforeEach(() => localStorage.clear());

describe('api (backend connection)', () => {
  it('sends the login token with every request', async () => {
    localStorage.setItem('token', 'abc123');
    const { data: sent } = await api.get('/me', { adapter: echo });
    expect(sent.headers.Authorization).toBe('Bearer abc123');
  });

  it('keeps a token header the caller set itself', async () => {
    localStorage.setItem('token', 'current');
    const { data: sent } = await api.get('/me', { adapter: echo, headers: { Authorization: 'Bearer earlier' } });
    expect(sent.headers.Authorization).toBe('Bearer earlier');
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
    /** A fake network that rejects the token. */
    const expired = async (config) => Promise.reject({ response: { status: 401 }, config });

    await expect(api.get('/gigs', { adapter: expired })).rejects.toBeTruthy();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener('pose-pool:signed-out', heard);
  });

  it("doesn't, for a request marked quiet (like sending an old sign-out again)", async () => {
    localStorage.setItem('token', 'current');
    const heard = vi.fn();
    window.addEventListener('pose-pool:signed-out', heard);
    /** A fake network that rejects the token. */
    const expired = async (config) => Promise.reject({ response: { status: 401 }, config });

    await expect(api.delete('/logout', { adapter: expired, quiet: true })).rejects.toBeTruthy();
    expect(heard).not.toHaveBeenCalled();
    window.removeEventListener('pose-pool:signed-out', heard);
  });

  it("doesn't, when nobody was signed in to begin with", async () => {
    const heard = vi.fn();
    window.addEventListener('pose-pool:signed-out', heard);
    /** A fake network that rejects the token. */
    const expired = async (config) => Promise.reject({ response: { status: 401 }, config });

    await expect(api.get('/me', { adapter: expired })).rejects.toBeTruthy();
    expect(heard).not.toHaveBeenCalled();
    window.removeEventListener('pose-pool:signed-out', heard);
  });
});
