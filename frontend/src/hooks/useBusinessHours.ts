import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { listBusinessHours, replaceBusinessHours } from '../api/endpoints.ts';
import type { BusinessHour, BusinessInterval } from '../api/types.ts';

export type BusinessHoursState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; hours: BusinessHour[] };

/** Loads the whole week of business hours (admin only). */
export function useBusinessHours(): {
  state: BusinessHoursState;
  retry: () => void;
  replace: (weekday: number, intervals: BusinessInterval[]) => Promise<void>;
} {
  const [state, setState] = useState<BusinessHoursState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void listBusinessHours(controller.signal).then(
      (hours) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'ready', hours });
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

  /** Shows the loading state again, for the "Try again" button. */
  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  /**
   * Replaces one weekday. On success the state is set from the response (the whole
   * week). On failure it rethrows so the caller can show the message; state is unchanged.
   */
  async function replace(weekday: number, intervals: BusinessInterval[]): Promise<void> {
    const hours = await replaceBusinessHours(weekday, { intervals });
    setState({ kind: 'ready', hours });
  }

  return { state, retry, replace };
}
