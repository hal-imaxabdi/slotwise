import { useEffect, useRef, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import {
  createUnavailablePeriod,
  deleteUnavailablePeriod,
  listUnavailablePeriods,
} from '../api/endpoints.ts';
import type { CreateUnavailablePeriodInput, UnavailablePeriod } from '../api/types.ts';

export const PAGE_SIZE = 50;

export type UnavailablePeriodsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      periods: UnavailablePeriod[];
      hasMore: boolean;
      loadingMore: boolean;
      loadMoreError: string | null;
    };

/**
 * Closures starting on or after `from` (a Jakarta date, YYYY-MM-DD), newest first,
 * paged by "load more". The server sends no total, so a short page means the end.
 */
export function useUnavailablePeriods(from: string): {
  state: UnavailablePeriodsState;
  retry: () => void;
  loadMore: () => Promise<void>;
  create: (input: CreateUnavailablePeriodInput) => Promise<UnavailablePeriod>;
  remove: (id: string) => Promise<void>;
} {
  const [state, setState] = useState<UnavailablePeriodsState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Bumped whenever page 1 is (re)requested; late "load more" replies are dropped.
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const controller = new AbortController();
    void listUnavailablePeriods({ from, limit: PAGE_SIZE, offset: 0 }, controller.signal).then(
      (periods) => {
        if (!controller.signal.aborted) {
          setState({
            kind: 'ready',
            periods,
            hasMore: periods.length === PAGE_SIZE,
            loadingMore: false,
            loadMoreError: null,
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
  }, [from, attempt]);

  /** Shows the loading state again, for the "Try again" button. */
  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  /** Appends the next page. Failures keep the list and set loadMoreError. */
  async function loadMore(): Promise<void> {
    if (state.kind !== 'ready' || state.loadingMore || !state.hasMore) {
      return;
    }
    const gen = generation.current;
    const offset = state.periods.length;
    setState({ ...state, loadingMore: true, loadMoreError: null });
    try {
      const next = await listUnavailablePeriods({ from, limit: PAGE_SIZE, offset });
      if (gen !== generation.current) {
        return;
      }
      setState((prev) =>
        prev.kind !== 'ready'
          ? prev
          : {
              ...prev,
              periods: [
                ...prev.periods,
                ...next.filter((p) => !prev.periods.some((q) => q.id === p.id)),
              ],
              hasMore: next.length === PAGE_SIZE,
              loadingMore: false,
            },
      );
    } catch (err) {
      if (gen !== generation.current) {
        return;
      }
      setState((prev) =>
        prev.kind !== 'ready'
          ? prev
          : { ...prev, loadingMore: false, loadMoreError: describeApiError(err) },
      );
    }
  }

  /** Creates a closure, then re-fetches page 1 in the background. Rethrows failures. */
  async function create(input: CreateUnavailablePeriodInput): Promise<UnavailablePeriod> {
    const created = await createUnavailablePeriod(input);
    setAttempt((n) => n + 1);
    return created;
  }

  /** Deletes a closure, then re-fetches page 1 in the background. Rethrows failures. */
  async function remove(id: string): Promise<void> {
    await deleteUnavailablePeriod(id);
    setAttempt((n) => n + 1);
  }

  return { state, retry, loadMore, create, remove };
}
