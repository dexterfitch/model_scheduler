/**
 * Sends errors the page didn't catch to the Error Log, so SuperUsers hear about
 * problems people run into. Only while someone is signed in, each error once per
 * visit, at most 10 per visit, and never errors that are just answers from the
 * server (those are shown on the page already).
 */

import api from '../services/api';

const MAX_PER_VISIT = 10;
const sent = new Set();

/** Sends one error, unless it was already sent or the visit's limit is reached. */
export function reportError(message, details) {
  if (!localStorage.getItem('token')) return;
  const text = String(message || 'Unknown error').slice(0, 500);
  if (sent.has(text) || sent.size >= MAX_PER_VISIT) return;
  sent.add(text);
  api.post('/error_reports', { message: text, details: String(details || '').slice(0, 4000), path: window.location.pathname }, { quiet: true })
    .catch(() => {});
}

/** Reports script errors and unhandled promise failures from now on. */
export function installErrorReporting() {
  window.addEventListener('error', (event) => reportError(event.message, event.error?.stack));
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason?.response || reason?.isAxiosError) return;
    reportError(reason?.message || String(reason), reason?.stack);
  });
}

/** Forgets which errors were sent, so tests start fresh. */
export const forgetReportedErrors = () => sent.clear();
