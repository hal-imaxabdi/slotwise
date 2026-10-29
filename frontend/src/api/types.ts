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
