import { useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { useAuth } from '../auth/useAuth.ts';

export function HomePage() {
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
    <main>
      <h1>Slotwise</h1>
      {user !== null && <p>{`Signed in as ${user.full_name}`}</p>}
      {error !== null && <p role="alert">{error}</p>}
      <button
        type="button"
        onClick={() => {
          void handleLogout();
        }}
      >
        Sign out
      </button>
    </main>
  );
}
