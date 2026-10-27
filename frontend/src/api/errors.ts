export interface FieldError {
  field: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string, body: unknown = null) {
    super(401, message, body);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string, body: unknown = null) {
    super(403, message, body);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, body: unknown = null) {
    super(404, message, body);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, body: unknown = null) {
    super(409, message, body);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends ApiError {
  readonly fieldErrors: FieldError[];

  constructor(message: string, fieldErrors: FieldError[], body: unknown = null) {
    super(422, message, body);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class RateLimitError extends ApiError {
  readonly retryAfterSeconds: number | null;

  constructor(message: string, retryAfterSeconds: number | null, body: unknown = null) {
    super(429, message, body);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** The request never produced an HTTP response (offline, DNS, server down). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Could not reach the server', { cause });
    this.name = 'NetworkError';
  }
}

function extractMessage(status: number, body: unknown): string {
  if (isRecord(body)) {
    const detail = body.detail;
    if (typeof detail === 'string' && detail.length > 0) {
      return detail;
    }
    if (Array.isArray(detail)) {
      return 'Some of the submitted values are invalid';
    }
  }
  return `Request failed (${status})`;
}

function extractFieldErrors(body: unknown): FieldError[] {
  if (!isRecord(body) || !Array.isArray(body.detail)) {
    return [];
  }
  const result: FieldError[] = [];
  for (const item of body.detail as unknown[]) {
    if (!isRecord(item) || !Array.isArray(item.loc) || typeof item.msg !== 'string') {
      continue;
    }
    // loc looks like ["body", "service_id"] or ["path", "appointment_id"]; drop the first part.
    const parts = (item.loc as unknown[]).slice(1).map((part) => String(part));
    result.push({ field: parts.join('.'), message: item.msg });
  }
  return result;
}

/** Retry-After as whole seconds, or null if absent or not a plain integer. */
export function parseRetryAfter(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

export function createApiError(
  status: number,
  body: unknown,
  retryAfterHeader: string | null,
): ApiError {
  const message = extractMessage(status, body);
  switch (status) {
    case 401:
      return new UnauthorizedError(message, body);
    case 403:
      return new ForbiddenError(message, body);
    case 404:
      return new NotFoundError(message, body);
    case 409:
      return new ConflictError(message, body);
    case 422:
      return new ValidationError(message, extractFieldErrors(body), body);
    case 429:
      return new RateLimitError(message, parseRetryAfter(retryAfterHeader), body);
    default:
      return new ApiError(status, message, body);
  }
}
