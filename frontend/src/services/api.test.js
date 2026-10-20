import api from './api';

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

  it('talks to the backend address', async () => {
    const { data: sent } = await api.get('/me', { adapter: echo });
    expect(sent.baseURL).toBe('http://localhost:3000');
  });
});