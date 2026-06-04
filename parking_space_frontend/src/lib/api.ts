import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/lib/config';
import { ApiError } from '@/lib/errors';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// ---------------------------------------------------------------------------
// Refresh-on-401
//
// One in-flight refresh promise is shared across concurrent requests so we
// don't fire N refresh calls when N requests fail at once. Failed refresh
// rejects the queue and the caller sees a typed ApiError.
// ---------------------------------------------------------------------------

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const REFRESH_PATH = '/auth/refresh';
const SKIP_REFRESH_PATHS = new Set(['/auth/login', '/auth/register', REFRESH_PATH]);

let refreshPromise: Promise<void> | null = null;

const refreshOnce = () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post(REFRESH_PATH)
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const toApiError = (err: AxiosError<{ error?: { code?: string; message?: string; details?: unknown } }>) => {
  const data = err.response?.data?.error;
  return new ApiError(data?.message ?? err.message ?? 'Request failed', {
    status: err.response?.status,
    code: data?.code,
    details: data?.details,
  });
};

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError<{ error?: { code?: string; message?: string; details?: unknown } }>) => {
    const original = err.config as RetryConfig | undefined;
    const status = err.response?.status;
    const url = original?.url ?? '';

    if (status === 401 && original && !original._retried && !SKIP_REFRESH_PATHS.has(url)) {
      original._retried = true;
      try {
        await refreshOnce();
        return api(original);
      } catch {
        // fall through to typed error
      }
    }

    return Promise.reject(toApiError(err));
  },
);
