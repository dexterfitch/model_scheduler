/**
 * Signing out on the server, which ends every sign-in token the person has. When the
 * server can't be reached, the token is kept so the sign-out can be sent again the
 * next time the app opens or the connection comes back.
 */

import api from './api';

export const PENDING_SIGN_OUT = 'pendingSignOut';

/**
 * Tells the server to end this token's sign-in. If the server can't be reached, keeps
 * the token to try again; once the server answers, there's nothing left to send.
 */
export async function signOutOnServer(token) {
  if (!token) return;
  try {
    await api.delete('/logout', { headers: { Authorization: `Bearer ${token}` }, quiet: true });
    localStorage.removeItem(PENDING_SIGN_OUT);
  } catch (err) {
    if (err?.response) localStorage.removeItem(PENDING_SIGN_OUT);
    else localStorage.setItem(PENDING_SIGN_OUT, token);
  }
}

/** Sends a sign-out that couldn't reach the server before, if there is one. */
export const retryPendingSignOut = () => signOutOnServer(localStorage.getItem(PENDING_SIGN_OUT));

/**
 * Drops an unsent sign-out after a new sign-in. Sending it then would end the new
 * sign-in too, since the server ends every token at once.
 */
export const forgetPendingSignOut = () => localStorage.removeItem(PENDING_SIGN_OUT);
