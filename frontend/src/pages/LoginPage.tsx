import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { waitForServer } from '../api/health.ts';
import { useAuth } from '../auth/useAuth.ts';
import { AuthShell } from '../components/AuthShell.tsx';
import { WAKING_MESSAGE } from '../components/LoadingScreen.tsx';
import { useSlowFlag } from '../hooks/useSlowFlag.ts';
import { safeRedirectPath } from './loginRedirect.ts';

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const slow = useSlowFlag(pending);

  const state: unknown = location.state;
  const from = safeRedirectPath(
    typeof state === 'object' && state !== null && 'from' in state ? state.from : undefined,
  );

  // The form shows while the session check runs: on a cold start that check can take a minute.
  if (auth.status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await waitForServer();
      await auth.login(email.trim(), password);
      // On success auth.status flips to "authenticated" and we redirect above.
    } catch (err) {
      setError(describeApiError(err));
      setPending(false);
    }
  }

  return (
    <AuthShell
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <h1>Sign in</h1>
      <p className="auth-lead">Welcome back. Book, change or manage your appointments.</p>
      <form
        className="form-stack"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
        </div>
        {error !== null && (
          <p role="alert" className="alert alert--error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Signing in...' : 'Sign in'}
        </button>
        {slow && (
          <p role="status" className="loading-hint">
            {WAKING_MESSAGE}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
