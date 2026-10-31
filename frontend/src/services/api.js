/**
 * The connection to the API. Sends the sign-in token with every request (unless the
 * request already carries one), and tells the app (with a pose-pool:signed-out event)
 * when the server rejects a token that was sent, so the person can be signed out with
 * a message. Requests marked quiet never trigger that event.
 */

import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization && !error.config.quiet) {
      window.dispatchEvent(new CustomEvent('pose-pool:signed-out'));
    }
    return Promise.reject(error);
  }
);

export default api;
