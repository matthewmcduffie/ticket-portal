import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Track an in-flight refresh so parallel 401s only call /auth/refresh once
let refreshing = null;

api.interceptors.response.use(
  res => res,
  async err => {
    const status = err.response?.status;
    const url    = err.config?.url ?? '';

    // Only attempt refresh for 401s from protected endpoints.
    // Login, me-probe, and refresh itself are excluded — they handle their
    // own auth state and must not trigger the retry loop.
    const isAuthEndpoint =
      url.endsWith('/auth/login') ||
      url.endsWith('/auth/me')    ||
      url.endsWith('/auth/refresh');

    if (status === 401 && !isAuthEndpoint) {
      if (!refreshing) {
        refreshing = api.post('/auth/refresh').finally(() => { refreshing = null; });
      }
      try {
        await refreshing;
        return api(err.config);
      } catch {
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;
