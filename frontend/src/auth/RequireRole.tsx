import { Link, Outlet } from 'react-router';
import type { Role } from '../api/types.ts';
import { useAuth } from './useAuth.ts';

interface RequireRoleProps {
  allow: readonly Role[];
}

// UI convenience only: the server re-checks the role on every request.
export function RequireRole({ allow }: RequireRoleProps) {
  const { user } = useAuth();

  if (user === null || !allow.includes(user.role)) {
    return (
      <section className="empty-state">
        <h1>Not allowed</h1>
        <p>You do not have access to this page.</p>
        <Link to="/services" className="btn btn--primary">
          Back to services
        </Link>
      </section>
    );
  }
  return <Outlet />;
}
