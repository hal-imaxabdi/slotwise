import { ApiError, NetworkError, createApiError } from './errors.ts';

const API_BASE = '/api';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}

// Held in memory only: never in localStorage, so injected scripts cannot persist it.
// After a page reload it is recovered from GET /auth/me.
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET' && csrfToken !== null) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  let response: Response;
  let text: string;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
    text = await response.text();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new NetworkError(error);
  }

  let body: unknown = null;
  let parsed = true;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      parsed = false;
    }
  }

  if (!response.ok) {
    throw createApiError(response.status, parsed ? body : null, response.headers.get('Retry-After'));
  }
  if (response.status === 204 || text.length === 0) {
    return undefined as T;
  }
  if (!parsed) {
    throw new ApiError(response.status, 'The server sent an invalid response');
  }
  return body as T;
}
