import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { listStaffAppointments } from '../api/endpoints.ts';
import type { AppointmentStatus, StaffAppointment } from '../api/types.ts';

export const STAFF_PAGE_SIZE = 20;

export interface StaffFilters {
  from: string;
  to: string;
  status: AppointmentStatus | '';
}

export type StaffAppointmentsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; appointments: StaffAppointment[]; hasMore: boolean };

/**
 * Loads one page at a time. It asks the server for one extra row: if that row
 * comes back there is a next page (the endpoint returns no total count).
 */
export function useStaffAppointments(filters: StaffFilters): {
  state: StaffAppointmentsState;
  page: number;
  goToPage: (next: number) => void;
  retry: () => void;
} {
  const { from, to, status } = filters;
  const [state, setState] = useState<StaffAppointmentsState>({ kind: 'loading' });
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void listStaffAppointments(
      { from, to, status, limit: STAFF_PAGE_SIZE + 1, offset: page * STAFF_PAGE_SIZE },
      controller.signal,
    ).then(
      (rows) => {
        if (!controller.signal.aborted) {
          setState({
            kind: 'ready',
            appointments: rows.slice(0, STAFF_PAGE_SIZE),
            hasMore: rows.length > STAFF_PAGE_SIZE,
          });
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
  }, [from, to, status, page, attempt]);

  function goToPage(next: number) {
    setState({ kind: 'loading' });
    setPage(next);
  }

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  return { state, page, goToPage, retry };
}
