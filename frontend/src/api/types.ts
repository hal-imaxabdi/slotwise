export type Role = 'customer' | 'staff' | 'admin';

export type AppointmentStatus = 'booked' | 'cancelled' | 'completed' | 'no_show';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

export interface AuthOut {
  user: User;
  csrf_token: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_idr: number;
}

export interface Slot {
  starts_at: string;
  local_time: string;
}

export interface SlotsResponse {
  service_id: string;
  date: string;
  timezone: string;
  duration_minutes: number;
  slots: Slot[];
}

export interface Appointment {
  id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string;
  cancelled_at: string | null;
}

export interface CreateAppointmentInput {
  service_id: string;
  starts_at: string;
  notes?: string;
}

export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResult {
  other_sessions_revoked: number;
}

export interface StaffAppointment extends Appointment {
  customer_id: string;
  created_by_id: string | null;
  customer_email: string;
  customer_name: string;
}

/** Empty string means "no filter" for from, to and status. Dates are Jakarta days (YYYY-MM-DD). */
export interface StaffAppointmentQuery {
  from: string;
  to: string;
  status: AppointmentStatus | '';
  limit: number;
  offset: number;
}

/** Minimal customer record returned by the staff customer search. */
export interface StaffCustomer {
  id: string;
  email: string;
  full_name: string;
}

export interface CreateStaffAppointmentInput {
  customer_id: string;
  service_id: string;
  starts_at: string;
  notes?: string;
}

/** Admin view of a service: the public fields plus whether it can still be booked. */
export interface AdminService extends Service {
  is_active: boolean;
}

export interface CreateAdminServiceInput {
  name: string;
  description: string;
  duration_minutes: number;
  price_idr: number;
}

/** Send only the fields that changed. Never send null: the server rejects it. */
export type UpdateAdminServiceInput = Partial<CreateAdminServiceInput>;

/** One open interval, in minutes after midnight (Asia/Jakarta), on a 30-minute grid. */
export interface BusinessInterval {
  open_minute: number;
  close_minute: number;
}

/** weekday: 0 = Monday ... 6 = Sunday. */
export interface BusinessHour extends BusinessInterval {
  id: string;
  weekday: number;
}

/** Replaces one weekday. An empty list closes the day. At most 8 intervals. */
export interface ReplaceBusinessHoursInput {
  intervals: BusinessInterval[];
}

/** Timestamps are UTC ISO strings. */
export interface UnavailablePeriod {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  created_by_id: string;
}

/** Both times must be on the 30-minute grid, end after start. Reason is 1-200 chars. */
export interface CreateUnavailablePeriodInput {
  starts_at: string;
  ends_at: string;
  reason: string;
}

/** from/to are Jakarta-local dates (YYYY-MM-DD), inclusive. Server default limit is 50, max 200. */
export interface ListUnavailablePeriodsParams {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
