import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCsrfToken, setCsrfToken } from './client.ts';
import {
  cancelAppointment,
  changePassword,
  createAppointment,
  getSlots,
  listMyAppointments,
  listServices,
  login,
  logout,
  me,
  rescheduleAppointment,
} from './endpoints.ts';
import { NetworkError } from './errors.ts';

const fetchMock = vi.fn<typeof fetch>();

const AUTH = {
  user: { id: 'u1', email: 'demo.customer@example.com', full_name: 'Demo Customer', role: 'customer' },
  csrf_token: 'csrf-abc',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

describe('auth endpoints', () => {
  it('login posts credentials and stores the CSRF token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(AUTH));
    const result = await login('demo.customer@example.com', 'secret-pass-1');
    const { url, init } = lastCall();
    expect(url).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({ email: 'demo.customer@example.com', password: 'secret-pass-1' }),
    );
    expect(result).toEqual(AUTH);
    expect(getCsrfToken()).toBe('csrf-abc');
  });

  it('me restores the CSRF token after a reload', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(AUTH));
    await me();
    expect(lastCall().url).toBe('/api/auth/me');
    expect(getCsrfToken()).toBe('csrf-abc');
  });

  it('logout clears the CSRF token on success', async () => {
    setCsrfToken('tok');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await logout();
    expect(lastCall().url).toBe('/api/auth/logout');
    expect(lastCall().headers['X-CSRF-Token']).toBe('tok');
    expect(getCsrfToken()).toBeNull();
  });

  it('logout clears the CSRF token when the session is already gone (401)', async () => {
    setCsrfToken('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Not authenticated' }, 401));
    await expect(logout()).resolves.toBeUndefined();
    expect(getCsrfToken()).toBeNull();
  });

  it('logout keeps the CSRF token on a network failure so a retry still works', async () => {
    setCsrfToken('tok');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(logout()).rejects.toBeInstanceOf(NetworkError);
    expect(getCsrfToken()).toBe('tok');
  });

  it('changePassword posts both fields and returns the revoked count', async () => {
    setCsrfToken('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ other_sessions_revoked: 2 }));
    const result = await changePassword({
      current_password: 'old-password-1',
      new_password: 'new-password-123',
    });
    const { url, init } = lastCall();
    expect(url).toBe('/api/auth/password');
    expect(init.body).toBe(
      JSON.stringify({ current_password: 'old-password-1', new_password: 'new-password-123' }),
    );
    expect(result).toEqual({ other_sessions_revoked: 2 });
  });
});

describe('customer endpoints', () => {
  it('listServices and listMyAppointments use the right paths', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await listServices();
    expect(lastCall().url).toBe('/api/services');
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await listMyAppointments();
    expect(lastCall().url).toBe('/api/appointments');
  });

  it('getSlots encodes the service id and passes the date as a query parameter', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ service_id: 'x', date: '2026-10-29', timezone: 'Asia/Jakarta', duration_minutes: 30, slots: [] }),
    );
    await getSlots('abc/def', '2026-10-29');
    expect(lastCall().url).toBe('/api/services/abc%2Fdef/slots?date=2026-10-29');
  });

  it('createAppointment posts the body with the CSRF header', async () => {
    setCsrfToken('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ap1' }, 201));
    await createAppointment({ service_id: 's1', starts_at: '2026-10-29T02:00:00Z', notes: '' });
    const { url, init, headers } = lastCall();
    expect(url).toBe('/api/appointments');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({ service_id: 's1', starts_at: '2026-10-29T02:00:00Z', notes: '' }),
    );
    expect(headers['X-CSRF-Token']).toBe('tok');
  });

  it('cancelAppointment posts to the cancel path with no body', async () => {
    setCsrfToken('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ap1', status: 'cancelled' }));
    await cancelAppointment('ap1');
    const { url, init, headers } = lastCall();
    expect(url).toBe('/api/appointments/ap1/cancel');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['X-CSRF-Token']).toBe('tok');
  });

  it('rescheduleAppointment posts starts_at', async () => {
    setCsrfToken('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'ap1' }));
    await rescheduleAppointment('ap1', '2026-10-30T03:00:00Z');
    const { url, init } = lastCall();
    expect(url).toBe('/api/appointments/ap1/reschedule');
    expect(init.body).toBe(JSON.stringify({ starts_at: '2026-10-30T03:00:00Z' }));
  });
});
