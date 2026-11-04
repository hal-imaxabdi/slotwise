import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { APP_NAME } from '../lib/site.ts';
import { BrandMark } from './icons.tsx';

/** Shared frame of the sign-in and sign-up pages: the logo, one card, one line below it. */
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
      </div>
    </main>
  );
}
