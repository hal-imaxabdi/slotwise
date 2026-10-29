import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { listAdminServices } from '../api/endpoints.ts';
import type { AdminService } from '../api/types.ts';

export type AdminServiceFilter = 'all' | 'active' | 'inactive';

export type AdminServicesState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; services: AdminService[] };

function toActiveParam(filter: AdminServiceFilter): boolean | undefined {
  if (filter === 'all') {
    return undefined;
  }
  return filter === 'active';
}

/**
 * Loads the admin service list. Mount it under key={filter}: a new filter
 * means a new instance that starts in the loading state.
 */
export function useAdminServices(filter: AdminServiceFilter): {
  state: AdminServicesState;
  retry: () => void;
  refresh: () => void;
} {
  const [state, setState] = useState<AdminServicesState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void listAdminServices(toActiveParam(filter), controller.signal).then(
      (services) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'ready', services });
        }
      },
      (err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'error', message: describeApiError(err) });
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [filter, attempt]);

  /** Shows the loading state again, for the "Try again" button. */
  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  /** Re-fetches in the background and keeps the current list on screen meanwhile. */
  function refresh() {
    setAttempt((n) => n + 1);
  }

  return { state, retry, refresh };
}
