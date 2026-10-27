import { describe, expect, it } from 'vitest';
import { describeApiError } from './describeError.ts';
import { ApiError, NetworkError, RateLimitError } from './errors.ts';

describe('describeApiError', () => {
  it('converts Retry-After seconds to minutes for 429', () => {
    expect(describeApiError(new RateLimitError('x', 900))).toBe(
      'Too many attempts. Please try again in 15 minutes.',
    );
  });

  it('rounds up and uses the singular for under a minute', () => {
    expect(describeApiError(new RateLimitError('x', 30))).toBe(
      'Too many attempts. Please try again in 1 minute.',
    );
  });

  it('handles a missing Retry-After', () => {
    expect(describeApiError(new RateLimitError('x', null))).toBe(
      'Too many attempts. Please try again later.',
    );
  });

  it('describes network failures', () => {
    expect(describeApiError(new NetworkError())).toContain('Could not reach the server');
  });

  it('uses the server message for other API errors', () => {
    expect(describeApiError(new ApiError(500, 'Boom'))).toBe('Boom');
  });

  it('falls back to a generic message for unknown values', () => {
    expect(describeApiError('weird')).toBe('Something went wrong. Please try again.');
  });
});
