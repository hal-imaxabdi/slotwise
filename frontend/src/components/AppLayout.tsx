import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { useAuth } from '../auth/useAuth.ts';
import { BrandMark } from './icons.tsx';

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
  if (pathname.startsWith('/staff/unavailable-periods')) {
    return `Closures - ${APP_NAME}`;
  }
  if (pathname.startsWith('/staff')) {
    return `Staff - ${APP_NAME}`;
  }
  if (pathname.startsWith('/admin')) {
    return `Admin - ${APP_NAME}`;
  }
  return APP_NAME;
}

function initials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
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
    <div className="app-shell">
      <a href="#main-content" className="skip-link" onClick={handleSkip}>
        Skip to main content
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/services" className="brand">
            <BrandMark className="brand-mark" />
            {APP_NAME}
          </Link>
          <nav aria-label="Main">
            <NavLink to="/services">Services</NavLink>
            <NavLink to="/appointments">My appointments</NavLink>
            {isStaff && (
              <>
                <NavLink to="/staff" end>
                  Staff
                </NavLink>
                <NavLink to="/staff/unavailable-periods">Closures</NavLink>
              </>
            )}
            {isAdmin && (
              <>
                <NavLink to="/admin" end>
                  Admin
                </NavLink>
                <NavLink to="/admin/business-hours">Business hours</NavLink>
              </>
            )}
          </nav>
          <div className="app-user">
            {user !== null && (
              <>
                <span className="avatar" aria-hidden="true">
                  {initials(user.full_name)}
                </span>
                <span className="user-name">{user.full_name}</span>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      {error !== null && (
        <p role="alert" className="app-error alert alert--error">
          {error}
        </p>
      )}
      <main id="main-content" ref={mainRef} tabIndex={-1} className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
