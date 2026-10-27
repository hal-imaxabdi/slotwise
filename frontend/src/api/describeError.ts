import { ApiError, NetworkError, RateLimitError } from './errors.ts';

/** Turns any thrown value into a message that is safe to show to the user. */
export function describeApiError(error: unknown): string {
  if (error instanceof RateLimitError) {
    if (error.retryAfterSeconds === null) {
      return 'Too many attempts. Please try again later.';
    }
    const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
    const unit = minutes === 1 ? 'minute' : 'minutes';
    return `Too many attempts. Please try again in ${minutes} ${unit}.`;
  }
  if (error instanceof NetworkError) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}