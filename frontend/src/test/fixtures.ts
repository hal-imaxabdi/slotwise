import type { AuthOut } from '../api/types.ts';

export const AUTH: AuthOut = {
  user: {
    id: 'u1',
    email: 'demo.customer@example.com',
    full_name: 'Demo Customer',
    role: 'customer',
  },
  csrf_token: 'csrf-abc',
};
