import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { useAuth } from '../auth/useAuth.ts';
import { BrandMark } from '../components/icons.tsx';

const MIN_PASSWORD_LENGTH = 12;

export function RegisterPage() {
  const auth = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
    <main className="auth-main">
      <div className="auth-panel">
        <span className="brand auth-brand">
          <BrandMark className="brand-mark" />
          Slotwise
        </span>
        <div className="card auth-card">
          <h1>Create account</h1>
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
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
