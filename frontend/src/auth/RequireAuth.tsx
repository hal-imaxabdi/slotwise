import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth.ts';

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return (
      <p role="status" className="loading loading--page">
        Loading...
      </p>
    );
  }
  if (auth.status === 'error') {
    return (
      <div role="alert" className="alert alert--error">
        <p>{auth.error ?? 'Could not load your session.'}</p>
        <button type="button" onClick={auth.retry}>
          Try again
        </button>
      </div>
    );
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
