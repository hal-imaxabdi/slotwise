import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { useAuth } from '../auth/useAuth.ts';

export function AppLayout() {
  const { user, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setError(null);
    try {
      await logout();
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  return (
    <div>
      <header className="app-header">
        <span className="brand">Slotwise</span>
        <nav aria-label="Main">
          <NavLink to="/services">Services</NavLink>
          <NavLink to="/appointments">My appointments</NavLink>
        </nav>
        <div className="app-user">
          {user !== null && <span>{user.full_name}</span>}
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      {error !== null && (
        <p role="alert" className="app-error">
          {error}
        </p>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
