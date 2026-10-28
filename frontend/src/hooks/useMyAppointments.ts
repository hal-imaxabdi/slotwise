import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { listMyAppointments } from '../api/endpoints.ts';
import type { Appointment } from '../api/types.ts';

export type AppointmentsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; appointments: Appointment[] };

export function useMyAppointments(): {
  state: AppointmentsState;
  retry: () => void;
  refresh: () => void;
  replace: (updated: Appointment) => void;
} {
  const [state, setState] = useState<AppointmentsState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void listMyAppointments(controller.signal).then(
      (appointments) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'ready', appointments });
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

  // Shows the loading state while refetching.
  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  // Refetches but keeps the current list on screen until new data arrives.
  function refresh() {
    setAttempt((n) => n + 1);
  }

  function replace(updated: Appointment) {
    setState((prev) =>
      prev.kind === 'ready'
        ? {
            kind: 'ready',
            appointments: prev.appointments.map((a) => (a.id === updated.id ? updated : a)),
          }
        : prev,
    );
  }

  return { state, retry, refresh, replace };
}
