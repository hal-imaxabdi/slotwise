import { useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { waitForServer } from '../api/health.ts';
import type { Role } from '../api/types.ts';
import { useAuth } from '../auth/useAuth.ts';
import type { DemoAccount } from '../lib/demoAccounts.ts';
import { useSlowFlag } from './useSlowFlag.ts';

/** Which control started the sign-in, so only that one shows progress and errors. */
export type DemoSource = 'preview' | 'cards';

export type DemoState =
  | { kind: 'idle' }
  | { kind: 'pending'; role: Role; source: DemoSource }
  | { kind: 'error'; role: Role; source: DemoSource; message: string };

/**
 * One-click demo sign-in. It is the normal login flow (same cookie, CSRF token and
 * throttling as anyone); it only waits for a sleeping API host first.
 * `target` is where the page should go once the session is live.
 */
export function useDemoLogin() {
  const { login } = useAuth();
  const [state, setState] = useState<DemoState>({ kind: 'idle' });
  const [target, setTarget] = useState<string | null>(null);
  const slow = useSlowFlag(state.kind === 'pending');

  async function start(account: DemoAccount, source: DemoSource = 'cards') {
    if (state.kind === 'pending') {
      return;
    }
    setState({ kind: 'pending', role: account.role, source });
    setTarget(account.startPath);
    try {
      await waitForServer();
      await login(account.email, account.password);
    } catch (error) {
      setTarget(null);
      setState({ kind: 'error', role: account.role, source, message: describeApiError(error) });
    }
  }

  return { state, target, slow, start };
}
