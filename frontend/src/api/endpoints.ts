import { request, setCsrfToken } from './client.ts';
import { UnauthorizedError } from './errors.ts';
import type {
  AdminService,
  Appointment,
  AuthOut,
  BusinessHour,
  ChangePasswordInput,
  ChangePasswordResult,
  CreateAdminServiceInput,
  CreateAppointmentInput,
  CreateStaffAppointmentInput,
  ReplaceBusinessHoursInput,
  Service,
  SlotsResponse,
  StaffAppointment,
  StaffAppointmentQuery,
  StaffCustomer,
  UpdateAdminServiceInput,
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

const CUSTOMER_SEARCH_LIMIT = 20;

/** Staff-only. An empty query lists the first customers by name. */
export function searchCustomers(query: string, signal?: AbortSignal): Promise<StaffCustomer[]> {
  const params = new URLSearchParams();
  if (query !== '') {
    params.set('q', query);
  }
  params.set('limit', String(CUSTOMER_SEARCH_LIMIT));
  return request<StaffCustomer[]>(`/staff/customers?${params.toString()}`, { signal });
}

// The response has the appointment fields (plus customer_id and created_by_id).
export function createStaffAppointment(input: CreateStaffAppointmentInput): Promise<Appointment> {
  return request<Appointment>('/staff/appointments', { method: 'POST', body: input });
}

/** Admin-only. `active` undefined lists every service; true or false filters. */
export function listAdminServices(
  active: boolean | undefined,
  signal?: AbortSignal,
): Promise<AdminService[]> {
  const query = active === undefined ? '' : `?active=${String(active)}`;
  return request<AdminService[]>(`/admin/services${query}`, { signal });
}

export function createAdminService(input: CreateAdminServiceInput): Promise<AdminService> {
  return request<AdminService>('/admin/services', { method: 'POST', body: input });
}

export function updateAdminService(
  id: string,
  changes: UpdateAdminServiceInput,
): Promise<AdminService> {
  return request<AdminService>(`/admin/services/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: changes,
  });
}

export function deactivateAdminService(id: string): Promise<AdminService> {
  return request<AdminService>(`/admin/services/${encodeURIComponent(id)}/deactivate`, {
    method: 'POST',
  });
}

export function activateAdminService(id: string): Promise<AdminService> {
  return request<AdminService>(`/admin/services/${encodeURIComponent(id)}/activate`, {
    method: 'POST',
  });
}

/** Admin-only. Every interval for the whole week, ordered by weekday then opening time. */
export function listBusinessHours(signal?: AbortSignal): Promise<BusinessHour[]> {
  return request<BusinessHour[]>('/admin/business-hours', { signal });
}

/** Admin-only. Replaces one weekday and returns the whole week's intervals. */
export function replaceBusinessHours(
  weekday: number,
  input: ReplaceBusinessHoursInput,
): Promise<BusinessHour[]> {
  return request<BusinessHour[]>(`/admin/business-hours/${String(weekday)}`, {
    method: 'PUT',
    body: input,
  });
}
