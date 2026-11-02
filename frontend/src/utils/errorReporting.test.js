/**
 * Tests for sending browser errors to the Error Log.
 */

import api from '../services/api';
import { reportError, installErrorReporting, forgetReportedErrors } from './errorReporting';

vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  api.post.mockResolvedValue({});
  forgetReportedErrors();
  localStorage.setItem('token', 'abc');
  window.history.pushState({}, '', '/gigs');
});

describe('reportError', () => {
  it('sends the message, details and page, quietly', () => {
    reportError('TypeError: x is undefined', 'at AllGigs.jsx:12');
    expect(api.post).toHaveBeenCalledWith('/error_reports',
      { message: 'TypeError: x is undefined', details: 'at AllGigs.jsx:12', path: '/gigs' }, { quiet: true });
  });

  it('sends each error once per visit, and no more than 10', () => {
    reportError('same'); reportError('same');
    for (let i = 0; i < 15; i++) reportError(`error ${i}`);
    expect(api.post).toHaveBeenCalledTimes(10);
  });

  it("sends nothing when nobody is signed in", () => {
    localStorage.removeItem('token');
    reportError('x');
    expect(api.post).not.toHaveBeenCalled();
  });

  it("never throws, even when sending fails", async () => {
    api.post.mockRejectedValue(new Error('offline'));
    expect(() => reportError('x')).not.toThrow();
  });
});

describe('installErrorReporting', () => {
  it('reports errors the page didn\'t catch, but not answers from the server', () => {
    installErrorReporting();
    window.dispatchEvent(new ErrorEvent('error', { message: 'ReferenceError: y is not defined', error: new Error('y') }));
    expect(api.post).toHaveBeenCalledWith('/error_reports', expect.objectContaining({ message: 'ReferenceError: y is not defined' }), { quiet: true });

    const rejected = new Event('unhandledrejection');
    rejected.reason = { response: { status: 422 }, message: 'Request failed' };
    window.dispatchEvent(rejected);
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
