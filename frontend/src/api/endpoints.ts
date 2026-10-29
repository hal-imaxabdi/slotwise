import { request, setCsrfToken } from './client.ts';
import { UnauthorizedError } from './errors.ts';
import type {
  Appointment,
  AuthOut,
  ChangePasswordInput,
  ChangePasswordResult,
  CreateAppointmentInput,
  Service,
  SlotsResponse,
  StaffAppointment,
  StaffAppointmentQuery,
} from './types.ts';

export async function login(email: string, password: string): Promise<AuthOut> {
  const auth = await request<AuthOut>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setCsrfToken(auth.csrf_token);
  return auth;
}

/** Session recovery after a page reload: also restores the in-memory CSRF token. */
export async function me(signal?: AbortSignal): Promise<AuthOut> {
  const auth = await request<AuthOut>('/auth/me', { signal });
  setCsrfToken(auth.csrf_token);
  return auth;
}

// Clear the token only when the server session is gone (success, or already 401).
// On a network failure the session may still be alive, so keep the token for a retry.
async function endSession(path: string): Promise<void> {
  try {
    await request<void>(path, { method: 'POST' });
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      throw error;
    }
  }
  setCsrfToken(null);
}

export function logout(): Promise<void> {
  return endSession('/auth/logout');
}

export function logoutAll(): Promise<void> {
  return endSession('/auth/logout-all');
}

export function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  return request<ChangePasswordResult>('/auth/password', { method: 'POST', body: input });
}

export function listServices(signal?: AbortSignal): Promise<Service[]> {
  return request<Service[]>('/services', { signal });
}

export function getSlots(
  serviceId: string,
  date: string,
  signal?: AbortSignal,
): Promise<SlotsResponse> {
  const path = `/services/${encodeURIComponent(serviceId)}/slots?date=${encodeURIComponent(date)}`;
  return request<SlotsResponse>(path, { signal });
}

export function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  return request<Appointment>('/appointments', { method: 'POST', body: input });
}

export function listMyAppointments(signal?: AbortSignal): Promise<Appointment[]> {
  return request<Appointment[]>('/appointments', { signal });
}

export function cancelAppointment(id: string): Promise<Appointment> {
  return request<Appointment>(`/appointments/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}

export function rescheduleAppointment(id: string, startsAt: string): Promise<Appointment> {
  return request<Appointment>(`/appointments/${encodeURIComponent(id)}/reschedule`, {
    method: 'POST',
    body: { starts_at: startsAt },
  });
}

export function listStaffAppointments(
  query: StaffAppointmentQuery,
  signal?: AbortSignal,
): Promise<StaffAppointment[]> {
  const params = new URLSearchParams();
  if (query.from !== '') {
    params.set('from', query.from);
  }
  if (query.to !== '') {
    params.set('to', query.to);
  }
  if (query.status !== '') {
    params.set('status', query.status);
  }
  params.set('limit', String(query.limit));
  params.set('offset', String(query.offset));
  return request<StaffAppointment[]>(`/staff/appointments?${params.toString()}`, { signal });
}

// The server's response has the appointment fields but no customer name or email,
// so callers merge it into the row they already have.
export function completeAppointment(id: string): Promise<Appointment> {
  return request<Appointment>(`/staff/appointments/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
  });
}

export function markNoShow(id: string): Promise<Appointment> {
  return request<Appointment>(`/staff/appointments/${encodeURIComponent(id)}/no-show`, {
    method: 'POST',
  });
}
