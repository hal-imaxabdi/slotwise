import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { useAuth } from '../auth/useAuth.ts';

const APP_NAME = 'Slotwise';

function pageTitle(pathname: string): string {
  if (pathname.startsWith('/appointments')) {
    return `My appointments - ${APP_NAME}`;
  }
  if (pathname.startsWith('/services/')) {
    return `Book a service - ${APP_NAME}`;
  }
  if (pathname.startsWith('/services')) {
    return `Services - ${APP_NAME}`;
  }
  if (pathname.startsWith('/staff')) {
    return `Staff - ${APP_NAME}`;
  }
  if (pathname.startsWith('/admin')) {
    return `Admin - ${APP_NAME}`;
  }
  return APP_NAME;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const title = pageTitle(pathname);
  const isStaff = user?.role === 'staff' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    document.title = title;
  }, [title]);

  async function handleLogout() {
    setError(null);
    try {
      await logout();
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  function handleSkip(event: MouseEvent<HTMLAnchorElement>) {
    // Focus <main> directly instead of changing the URL hash under the router.
    event.preventDefault();
    mainRef.current?.focus();
  }

  return (
    <div>
      <a href="#main-content" className="skip-link" onClick={handleSkip}>
        Skip to main content
      </a>
      <header className="app-header">
        <span className="brand">{APP_NAME}</span>
        <nav aria-label="Main">
          <NavLink to="/services">Services</NavLink>
          <NavLink to="/appointments">My appointments</NavLink>
          {isStaff && <NavLink to="/staff">Staff</NavLink>}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
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
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
