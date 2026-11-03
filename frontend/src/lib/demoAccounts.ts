import type { Role } from '../api/types.ts';

/** The shared demo logins. The passwords are public on purpose (see backend/app/demo.py). */
export interface DemoAccount {
  role: Role;
  label: string;
  email: string;
  password: string;
  /** Where the tour starts after signing in. */
  startPath: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    role: 'customer',
    label: 'Client',
    email: 'demo.customer@example.com',
    password: 'demo-customer-2026',
    startPath: '/services',
  },
  {
    role: 'staff',
    label: 'Staff',
    email: 'staff@barbershop.example',
    password: 'demo-staff-2026',
    startPath: '/staff',
  },
  {
    role: 'admin',
    label: 'Owner',
    email: 'admin@barbershop.example',
    password: 'demo-admin-2026',
    startPath: '/admin',
  },
];

export function isDemoEmail(email: string): boolean {
  return DEMO_ACCOUNTS.some((account) => account.email === email.toLowerCase());
}
