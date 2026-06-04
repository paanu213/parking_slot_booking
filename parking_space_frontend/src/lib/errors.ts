/**
 * Typed error wrapping the API's `{ error: { code, message, details } }`
 * response shape. Throwable from anywhere; safe to JSON-stringify.
 */
export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, opts?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts?.status;
    this.code = opts?.code;
    this.details = opts?.details;
  }
}

/** Best-effort error→string conversion for toast/banner display. */
export const errorMessage = (err: unknown): string => {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Something went wrong. Please try again.';
};
