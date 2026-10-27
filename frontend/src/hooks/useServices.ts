import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { listServices } from '../api/endpoints.ts';
import type { Service } from '../api/types.ts';

export type ServicesState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; services: Service[] };

export function useServices(): { state: ServicesState; retry: () => void } {
  const [state, setState] = useState<ServicesState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void listServices(controller.signal).then(
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
  }, [attempt]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  return { state, retry };
}
