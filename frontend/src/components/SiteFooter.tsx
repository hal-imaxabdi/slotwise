import { Link } from 'react-router';
import { APP_NAME, GITHUB_ISSUES_URL, GITHUB_URL } from '../lib/site.ts';
import { BrandMark } from './icons.tsx';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__about">
          <Link to="/" className="brand">
            <BrandMark className="brand-mark" />
            {APP_NAME}
          </Link>
          <p>Open-source online booking for independent service businesses.</p>
        </div>
        <nav aria-label="Product" className="site-footer__col">
          <h2>Product</h2>
          <Link to="/#product">Features</Link>
          <Link to="/#day">How it works</Link>
          <Link to="/#demo">Live demo</Link>
        </nav>
        <nav aria-label="Company" className="site-footer__col">
          <h2>Company</h2>
          <Link to="/#faq">FAQ</Link>
          <a href={GITHUB_ISSUES_URL}>Contact</a>
          <a href={GITHUB_URL}>GitHub repository</a>
        </nav>
        <nav aria-label="Legal" className="site-footer__col">
          <h2>Legal</h2>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/cookies">Cookie Policy</Link>
        </nav>
      </div>
      <p className="site-footer__fine">
        © 2026 {APP_NAME}. Built for independent shops everywhere.
      </p>
    </footer>
  );
}
