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