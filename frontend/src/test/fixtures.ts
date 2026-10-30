import type { AuthContextValue } from '../auth/context.ts';
import type { AuthOut, Role } from '../api/types.ts';

export const AUTH: AuthOut = {
  user: {
    id: 'u1',
    email: 'demo.customer@example.com',
    full_name: 'Demo Customer',
    role: 'customer',
  },
  csrf_token: 'csrf-abc',
};

/** Auth context value for tests; pass null for an anonymous visitor. */
export function authValueFor(role: Role | null): AuthContextValue {
  return {
    status: role === null ? 'anonymous' : 'authenticated',
    user: role === null ? null : { ...AUTH.user, role },
    error: null,
    login: () => Promise.resolve(),
    register: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    retry: () => undefined,
  };
}
