import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';
import { APP_NAME } from '../lib/site.ts';
import { DemoStartButton } from './DemoStartButton.tsx';
import { BrandMark } from './icons.tsx';

/** Top bar of the public pages. `onLanding` keeps section links as in-page anchors. */
export function PublicHeader({ onLanding = false }: { onLanding?: boolean }) {
  const { status } = useAuth();
  const base = onLanding ? '' : '/';
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand">
          <BrandMark className="brand-mark" />
          {APP_NAME}
        </Link>
        <nav aria-label="Site" className="site-nav">
          <a href={`${base}#product`}>Product</a>
          <a href={`${base}#day`}>How it works</a>
        </nav>
        <div className="site-header__actions">
          {status === 'authenticated' ? (
            <Link to="/services" className="btn btn--primary">
              Open the app
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn--quiet">
                Log in
              </Link>
              <DemoStartButton className="btn site-header__cta">Try the live demo</DemoStartButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
