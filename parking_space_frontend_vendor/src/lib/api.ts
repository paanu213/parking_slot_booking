import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  withCredentials: true,
});

let isRefreshing = false;
let waitQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

const drainQueue = (err: unknown) => {
  waitQueue.forEach((p) => (err ? p.reject(err) : p.resolve()));
  waitQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Only intercept 401s; skip the refresh endpoint itself and already-retried requests
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request to retry once the ongoing refresh completes
      return new Promise<void>((resolve, reject) => {
        waitQueue.push({ resolve, reject });
      }).then(() => api(original));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      await api.post('/auth/refresh');
      drainQueue(null);
      return api(original);
    } catch (refreshError) {
      drainQueue(refreshError);
      if (window.location.pathname !== '/login') {
        // Preserve the page they were on so the login flow can send them back.
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?returnTo=${returnTo}`;
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
