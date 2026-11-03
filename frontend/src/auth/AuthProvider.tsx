import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { describeApiError } from '../api/describeError.ts';
import {
  deleteAccount as apiDeleteAccount,
  login as apiLogin,
  logout as apiLogout,
  logoutAll as apiLogoutAll,
  me,
  register as apiRegister,
} from '../api/endpoints.ts';
import { UnauthorizedError } from '../api/errors.ts';
import { AuthContext } from './context.ts';
import type { AuthContextValue, AuthState } from './context.ts';

const INITIAL: AuthState = { status: 'loading', user: null, error: null };
const ANONYMOUS: AuthState = { status: 'anonymous', user: null, error: null };

// The session check only settles a state that is still loading: a login that finished
// first (likely while a sleeping server wakes up) must not be overwritten.
function settle(next: AuthState) {
  return (previous: AuthState) => (previous.status === 'loading' ? next : previous);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  // Session recovery: after a reload the cookie is still valid but the CSRF token
  // (kept in memory) is gone; GET /auth/me restores both.
  useEffect(() => {
    const controller = new AbortController();

    async function recover() {
      try {
        const auth = await me(controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setState(settle({ status: 'authenticated', user: auth.user, error: null }));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          setState(settle(ANONYMOUS));
        } else {
          setState(settle({ status: 'error', user: null, error: describeApiError(error) }));
        }
      }
    }

    void recover();
    return () => {
      controller.abort();
    };
  }, [attempt]);

  const login = useCallback(async (email: string, password: string) => {
    const auth = await apiLogin(email, password);
    setState({ status: 'authenticated', user: auth.user, error: null });
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const auth = await apiRegister(fullName, email, password);
    setState({ status: 'authenticated', user: auth.user, error: null });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setState(ANONYMOUS);
  }, []);

  const logoutAll = useCallback(async () => {
    await apiLogoutAll();
    setState(ANONYMOUS);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await apiDeleteAccount(password);
    setState(ANONYMOUS);
  }, []);

  const retry = useCallback(() => {
    setState(INITIAL);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, logoutAll, deleteAccount, retry }),
    [state, login, register, logout, logoutAll, deleteAccount, retry],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
