import axios from 'axios';
import { readCsrfCookie } from './csrf';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Access token is kept in memory only (module-level variable), never in
// localStorage/sessionStorage — those are readable by any script on the
// page, so an XSS bug anywhere in the app would otherwise hand over a live
// access token. It's lost on full page reload by design; the refresh flow
// below re-establishes it silently using the httpOnly refresh cookie.
let accessToken = null;
let onAuthLost = () => {};

export function setAccessToken(token) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setOnAuthLost(handler) {
  onAuthLost = handler;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true // required so the httpOnly refresh_token cookie is sent
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

async function performRefresh() {
  const csrfToken = readCsrfCookie();
  const response = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true, headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {} }
  );
  setAccessToken(response.data.accessToken);
  return response.data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    // Only attempt a silent refresh once per request, and only for the
    // specific "your access token expired" case — not for wrong-password,
    // not for permission errors, and not for a refresh request that itself
    // failed (that would loop forever).
    const isExpiredAccessToken = status === 401 && (code === 'TOKEN_EXPIRED' || code === 'UNAUTHORIZED');
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (isExpiredAccessToken && !original._retry && !isRefreshCall) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? performRefresh();
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        setAccessToken(null);
        onAuthLost(); // e.g. redirect to /signin
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
