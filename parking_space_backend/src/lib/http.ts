export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const BadRequest = (msg: string, details?: unknown) =>
  new HttpError(400, msg, 'BAD_REQUEST', details);
export const Unauthorized = (msg = 'Unauthorized') => new HttpError(401, msg, 'UNAUTHORIZED');
export const Forbidden = (msg = 'Forbidden') => new HttpError(403, msg, 'FORBIDDEN');
export const NotFound = (msg = 'Not found') => new HttpError(404, msg, 'NOT_FOUND');
export const Conflict = (msg: string) => new HttpError(409, msg, 'CONFLICT');
export const UnprocessableEntity = (msg: string, details?: unknown) =>
  new HttpError(422, msg, 'UNPROCESSABLE', details);
export const TooMany = (msg = 'Too many requests') => new HttpError(429, msg, 'RATE_LIMITED');
export const ServerError = (msg = 'Internal error') => new HttpError(500, msg, 'SERVER_ERROR');
