import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { useAuth } from '../auth/useAuth.ts';
import { AuthShell } from '../components/AuthShell.tsx';
import { WAKING_MESSAGE } from '../components/LoadingScreen.tsx';
import { useSlowFlag } from '../hooks/useSlowFlag.ts';

const MIN_PASSWORD_LENGTH = 12;

export function RegisterPage() {
  const auth = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const slow = useSlowFlag(pending);

  if (auth.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await auth.register(fullName.trim(), email.trim(), password);
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
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <h1>Create account</h1>
      <p className="auth-lead">
        Slotwise is a portfolio demo for a fictional barbershop. Use a made-up name and email:
        accounts are erased whenever the demo data resets.
      </p>
      <form
        className="form-stack"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <div className="field">
          <label htmlFor="full-name">Full name</label>
          <input
            id="full-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
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
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={128}
            aria-describedby="password-hint"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
          <p id="password-hint" className="field-hint">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>
        {error !== null && (
          <p role="alert" className="alert alert--error">
            {error}
          </p>
        )}
        <p className="field-hint auth-consent">
          By creating an account you agree to the <Link to="/terms">Terms</Link> and confirm you
          have read the <Link to="/privacy">Privacy Policy</Link>.
        </p>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Creating account...' : 'Create account'}
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
