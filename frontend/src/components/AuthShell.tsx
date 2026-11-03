import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { APP_NAME } from '../lib/site.ts';
import { BrandMark } from './icons.tsx';

/** Shared frame of the sign-in and sign-up pages. */
export function AuthShell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <main className="auth-main">
      <div className="auth-panel">
        <Link to="/" className="brand auth-brand">
          <BrandMark className="brand-mark" />
          {APP_NAME}
        </Link>
        <div className="card auth-card">{children}</div>
        <p className="auth-switch">{footer}</p>
        <p className="auth-demo">
          Just looking? <Link to="/#demo">Try a one-click demo account</Link>
        </p>
        <nav aria-label="Legal" className="auth-legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/cookies">Cookies</Link>
        </nav>
      </div>
    </main>
  );
}
