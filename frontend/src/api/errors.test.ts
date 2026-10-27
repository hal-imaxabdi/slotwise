import { describe, expect, it } from 'vitest';
import {
  ApiError,
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  createApiError,
} from './errors.ts';

describe('createApiError', () => {
  it('uses the detail string as the message', () => {
    const err = createApiError(401, { detail: 'Invalid email or password' }, null);
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid email or password');
  });

  it('maps 403, 404 and 409 to their own classes', () => {
    expect(createApiError(403, { detail: 'Forbidden' }, null)).toBeInstanceOf(ForbiddenError);
    expect(createApiError(404, { detail: 'Not found' }, null)).toBeInstanceOf(NotFoundError);
    const conflict = createApiError(409, { detail: 'That time slot is no longer available' }, null);
    expect(conflict).toBeInstanceOf(ConflictError);
    expect(conflict.message).toBe('That time slot is no longer available');
  });

  it('falls back to a generic ApiError when there is no usable body', () => {
    const err = createApiError(500, null, null);
    expect(err.constructor).toBe(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Request failed (500)');
  });

  it('reads Retry-After seconds on 429', () => {
    const err = createApiError(429, { detail: 'Too many failed login attempts. Try again later.' }, '900');
    expect(err).toBeInstanceOf(RateLimitError);
    if (!(err instanceof RateLimitError)) {
      throw err;
    }
    expect(err.retryAfterSeconds).toBe(900);
  });

  it('sets retryAfterSeconds to null when the header is missing or not a number', () => {
    const missing = createApiError(429, { detail: 'slow down' }, null);
    const garbage = createApiError(429, { detail: 'slow down' }, 'soon');
    if (!(missing instanceof RateLimitError) || !(garbage instanceof RateLimitError)) {
      throw new Error('expected RateLimitError');
    }
    expect(missing.retryAfterSeconds).toBeNull();
    expect(garbage.retryAfterSeconds).toBeNull();
  });

  it('builds field errors for 422 validation bodies', () => {
    const body = {
      detail: [
        { type: 'uuid_parsing', loc: ['body', 'service_id'], msg: 'Input should be a valid UUID' },
        { type: 'missing', loc: ['body', 'starts_at'], msg: 'Field required' },
      ],
    };
    const err = createApiError(422, body, null);
    expect(err).toBeInstanceOf(ValidationError);
    if (!(err instanceof ValidationError)) {
      throw err;
    }
    expect(err.message).toBe('Some of the submitted values are invalid');
    expect(err.fieldErrors).toEqual([
      { field: 'service_id', message: 'Input should be a valid UUID' },
      { field: 'starts_at', message: 'Field required' },
    ]);
  });
});

describe('NetworkError', () => {
  it('is not an ApiError because there is no HTTP status', () => {
    const err = new NetworkError(new TypeError('Failed to fetch'));
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err.message).toBe('Could not reach the server');
  });
});
