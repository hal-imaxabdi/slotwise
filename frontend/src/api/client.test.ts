import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCsrfToken, request, setCsrfToken } from './client.ts';
import {
  ApiError,
  ConflictError,
  NetworkError,
  RateLimitError,
  UnauthorizedError,
} from './errors.ts';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function lastCall(): { url: string; init: RequestInit; headers: Record<string, string> } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) {
    throw new Error('fetch was not called');
  }
  const init = call[1] ?? {};
  return { url: String(call[0]), init, headers: (init.headers ?? {}) as Record<string, string> };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setCsrfToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

describe('request', () => {
  it('sends GET with credentials, under /api, without body or CSRF header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: '1' }]));
    const result = await request<{ id: string }[]>('/services');
    const { url, init, headers } = lastCall();
    expect(result).toEqual([{ id: '1' }]);
    expect(url).toBe('/api/services');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });

  it('sends a JSON body and the CSRF header on POST', async () => {
    setCsrfToken('tok-123');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }, 201));
    await request('/appointments', { method: 'POST', body: { service_id: 'a', notes: '' } });
    const { init, headers } = lastCall();
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ service_id: 'a', notes: '' }));
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-CSRF-Token']).toBe('tok-123');
  });

  it('omits the CSRF header on a non-GET request when no token is held (login)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request('/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } });
    expect(lastCall().headers['X-CSRF-Token']).toBeUndefined();
    expect(getCsrfToken()).toBeNull();
  });

  it('never sends the CSRF header on GET, even when a token is held', async () => {
    setCsrfToken('tok-123');
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await request('/appointments');
    expect(lastCall().headers['X-CSRF-Token']).toBeUndefined();
  });

  it('returns undefined for a 204 response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await request<void>('/auth/logout', { method: 'POST' });
    expect(result).toBeUndefined();
  });

  it('throws UnauthorizedError with the server message on 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Invalid email or password' }, 401));
    const promise = request('/auth/login', { method: 'POST', body: {} });
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError);
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Invalid email or password' }, 401));
    await expect(request('/auth/me')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
  });

  it('throws RateLimitError carrying Retry-After on 429', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Too many failed login attempts. Try again later.' }, 429, {
        'Retry-After': '900',
      }),
    );
    const error = await request('/auth/login', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterSeconds).toBe(900);
  });

  it('throws ConflictError on 409', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'That time slot is no longer available' }, 409),
    );
    const error = await request('/appointments', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).message).toBe('That time slot is no longer available');
  });

  it('wraps a failed fetch in NetworkError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(request('/services')).rejects.toBeInstanceOf(NetworkError);
  });

  it('lets an AbortError pass through unchanged', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValueOnce(abort);
    const error = await request('/services').catch((e: unknown) => e);
    expect(error).toBe(abort);
    expect(error).not.toBeInstanceOf(NetworkError);
  });

  it('throws ApiError when a successful response is not valid JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 200 }));
    const error = await request('/services').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('The server sent an invalid response');
  });

  it('uses a generic message when an error response is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await request('/services').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).message).toBe('Request failed (502)');
  });
});
