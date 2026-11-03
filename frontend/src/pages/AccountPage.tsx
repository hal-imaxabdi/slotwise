import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { changePassword } from '../api/endpoints.ts';
import { useAuth } from '../auth/useAuth.ts';
import { isDemoEmail } from '../lib/demoAccounts.ts';

const MIN_PASSWORD_LENGTH = 12;

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'done'; message: string }
  | {
      kind: 'error';
      message: string;
    };

const ROLE_LABELS = { customer: 'Customer', staff: 'Staff', admin: 'Admin' } as const;

function PasswordForm() {
  const uid = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'pending') {
      return;
    }
    setStatus({ kind: 'pending' });
    try {
      const result = await changePassword({ current_password: current, new_password: next });
      setCurrent('');
      setNext('');
      const others = result.other_sessions_revoked;
      setStatus({
        kind: 'done',
        message:
          others === 0
            ? 'Password changed.'
            : `Password changed. ${others} other ${others === 1 ? 'session was' : 'sessions were'} signed out.`,
      });
    } catch (error) {
      setStatus({ kind: 'error', message: describeApiError(error) });
    }
  }

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <div className="field">
        <label htmlFor={`${uid}-current`}>Current password</label>
        <input
          id={`${uid}-current`}
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          value={current}
          onChange={(event) => {
            setCurrent(event.target.value);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor={`${uid}-new`}>New password</label>
        <input
          id={`${uid}-new`}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={128}
          aria-describedby={`${uid}-hint`}
          value={next}
          onChange={(event) => {
            setNext(event.target.value);
          }}
        />
        <p id={`${uid}-hint`} className="field-hint">
          At least {MIN_PASSWORD_LENGTH} characters. Your other devices will be signed out.
        </p>
      </div>
      {status.kind === 'done' && (
        <p role="status" className="alert alert--success">
          {status.message}
        </p>
      )}
      {status.kind === 'error' && (
        <p role="alert" className="alert alert--error">
          {status.message}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn--primary" disabled={status.kind === 'pending'}>
          {status.kind === 'pending' ? 'Changing...' : 'Change password'}
        </button>
      </div>
    </form>
  );
}

function DeleteAccount() {
  const uid = useId();
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteAccount(password);
      // Auth flips to anonymous and the app leaves this page.
    } catch (err) {
      setError(describeApiError(err));
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn--danger"
        aria-expanded={false}
        aria-controls={`${uid}-confirm`}
        onClick={() => {
          setOpen(true);
        }}
      >
        Delete my account
      </button>
    );
  }

  return (
    <form
      id={`${uid}-confirm`}
      className="confirm-panel form-stack"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <p>This can’t be undone.</p>
      <div className="field">
        <label htmlFor={`${uid}-password`}>Enter your password to confirm</label>
        <input
          id={`${uid}-password`}
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
      <div className="btn-row">
        <button type="submit" className="btn--danger" disabled={pending}>
          {pending ? 'Deleting...' : 'Delete permanently'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setPassword('');
            setError(null);
          }}
        >
          Keep my account
        </button>
      </div>
    </form>
  );
}

export function AccountPage() {
  const { user, logoutAll } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (user === null) {
    return null;
  }
  const demo = isDemoEmail(user.email);

  async function handleLogoutAll() {
    setSignOutError(null);
    try {
      await logoutAll();
    } catch (err) {
      setSignOutError(describeApiError(err));
    }
  }

  return (
    <section className="account">
      <div className="page-header">
        <div>
          <h1>Account</h1>
          <p className="page-lead">Your details, password and privacy choices.</p>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Profile</h2>
        <dl className="account-details">
          <dt>Name</dt>
          <dd>{user.full_name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>{ROLE_LABELS[user.role]}</dd>
        </dl>
      </div>

      {demo ? (
        <div className="card">
          <h2 className="card-title">Shared demo account</h2>
          <p className="card-lead">
            Everyone exploring the demo signs in with this account, so changing its password,
            signing out other sessions and deleting it are turned off. Its data resets regularly.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <h2 className="card-title">Password</h2>
            <p className="card-lead">Use a long password you don’t use anywhere else.</p>
            <PasswordForm />
          </div>

          <div className="card">
            <h2 className="card-title">Sessions</h2>
            <p className="card-lead">
              Signed in somewhere you no longer use? End every session, this one too.
            </p>
            {signOutError !== null && (
              <p role="alert" className="alert alert--error">
                {signOutError}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                void handleLogoutAll();
              }}
            >
              Sign out everywhere
            </button>
          </div>

          {user.role === 'customer' && (
            <div className="card card--danger">
              <h2 className="card-title">Delete account</h2>
              <p className="card-lead">
                Erases your name, email, password and booking notes, and cancels your upcoming
                bookings. Past visits stay in the shop’s records without your details.
              </p>
              <DeleteAccount />
            </div>
          )}
        </>
      )}
    </section>
  );
}
