import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { useAuth } from '../auth/useAuth.ts';
import { BrandMark, CheckIcon } from '../components/icons.tsx';
import { safeRedirectPath } from './loginRedirect.ts';

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const state: unknown = location.state;
  const from = safeRedirectPath(
    typeof state === 'object' && state !== null && 'from' in state ? state.from : undefined,
  );

  if (auth.status === 'loading') {
    return (
      <main>
        <p role="status" className="loading loading--page">
          Loading...
        </p>
      </main>
    );
  }
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
      await auth.login(email.trim(), password);
      // On success auth.status flips to "authenticated" and we redirect above.
    } catch (err) {
      setError(describeApiError(err));
      setPending(false);
    }
  }

  return (
    <main className="auth-main">
      <div className="auth-aside">
        <span className="brand">
          <BrandMark className="brand-mark" />
          Slotwise
        </span>
        <div>
          <p className="auth-pitch">Appointments without the back-and-forth.</p>
          <ul className="auth-points">
            <li>
              <CheckIcon />
              <span>See which times are free before you commit.</span>
            </li>
            <li>
              <CheckIcon />
              <span>Cancel or reschedule from one place.</span>
            </li>
            <li>
              <CheckIcon />
              <span>Staff keep the schedule in sync automatically.</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="auth-panel">
        <div className="card auth-card">
          <h1>Sign in to Slotwise</h1>
          <p className="card-lead">Use the email and password for your account.</p>
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
          </form>
        </div>
      </div>
    </main>
  );
}
