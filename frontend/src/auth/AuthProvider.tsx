import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { login as apiLogin, logout as apiLogout, me } from '../api/endpoints.ts';
import { UnauthorizedError } from '../api/errors.ts';
import { AuthContext } from './context.ts';
import type { AuthContextValue, AuthState } from './context.ts';

const INITIAL: AuthState = { status: 'loading', user: null, error: null };

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
        setState({ status: 'authenticated', user: auth.user, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          setState({ status: 'anonymous', user: null, error: null });
        } else {
          setState({ status: 'error', user: null, error: describeApiError(error) });
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

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ status: 'anonymous', user: null, error: null });
  }, []);

  const retry = useCallback(() => {
    setState(INITIAL);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, retry }),
    [state, login, logout, retry],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
