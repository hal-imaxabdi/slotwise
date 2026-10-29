import { useEffect, useRef, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { ApiError } from '../api/errors.ts';
import type { UnavailablePeriod } from '../api/types.ts';
import type { UnavailablePeriodsState } from '../hooks/useUnavailablePeriods.ts';
import { formatAppointmentRange } from '../lib/dates.ts';

const HEADING_ID = 'closures-heading';

const deleteButtonId = (id: string) => `closure-delete-btn-${id}`;
const confirmGroupId = (id: string) => `closure-confirm-${id}`;

interface Props {
  state: UnavailablePeriodsState;
  onRetry: () => void;
  onLoadMore: () => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function describeClosure(period: UnavailablePeriod): string {
  return `${period.reason} (${formatAppointmentRange(period.starts_at, period.ends_at)})`;
}

export function ClosureList({ state, onRetry, onLoadMore, onRemove }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const hadMore = useRef(false);

  useEffect(() => {
    const id = pendingFocus.current;
    if (id !== null && state.kind !== 'loading') {
      pendingFocus.current = null;
      (document.getElementById(id) ?? document.getElementById(HEADING_ID))?.focus();
    }
    // The load-more button just disappeared while focused: keep focus in the list.
    const hasMore = state.kind === 'ready' && state.hasMore;
    if (
      hadMore.current &&
      !hasMore &&
      state.kind === 'ready' &&
      document.activeElement === document.body
    ) {
      document.getElementById(HEADING_ID)?.focus();
    }
    hadMore.current = hasMore;
  });

  async function remove(period: UnavailablePeriod) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      await onRemove(period.id);
      setConfirmId(null);
      setNotice('Closure deleted.');
      pendingFocus.current = HEADING_ID;
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status === 404
          ? 'Closure not found. The list has been refreshed.'
          : describeApiError(err),
      );
      if (err instanceof ApiError && err.status === 404) {
        // Our list is stale: resync with the server.
        setConfirmId(null);
        pendingFocus.current = HEADING_ID;
        onRetry();
      } else {
        // The panel stays open for a retry; the clicked button was disabled, so refocus.
        pendingFocus.current = confirmGroupId(period.id);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function handleLoadMore() {
    if (state.kind === 'ready' && state.loadingMore) return;
    void onLoadMore();
  }

  return (
    <section aria-labelledby={HEADING_ID} className="closures-list-section">
      <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
        Closures
      </h2>
      {notice !== null && (
        <p role="status" className="alert alert--success">
          {notice}
        </p>
      )}
      {actionError !== null && (
        <p role="alert" className="alert alert--error">
          {actionError}
        </p>
      )}
      {state.kind === 'loading' && (
        <p role="status" className="loading">
          Loading closures…
        </p>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="alert alert--error">
          <p>{state.message}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' &&
        (state.periods.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No upcoming closures.</p>
            <p>Add one on the left to block booking for a period.</p>
          </div>
        ) : (
          <>
            <ul className="closure-list">
              {state.periods.map((period) => {
                const label = describeClosure(period);
                const confirming = confirmId === period.id;
                return (
                  <li key={period.id}>
                    <p className="closure-when">
                      {formatAppointmentRange(period.starts_at, period.ends_at)}
                    </p>
                    <p className="closure-reason">{period.reason}</p>
                    {!confirming && (
                      <button
                        className="btn--sm"
                        id={deleteButtonId(period.id)}
                        type="button"
                        disabled={submitting}
                        aria-label={`Delete closure: ${label}`}
                        onClick={() => {
                          setActionError(null);
                          setNotice(null);
                          pendingFocus.current = confirmGroupId(period.id);
                          setConfirmId(period.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                    {confirming && (
                      <div
                        className="confirm-panel"
                        id={confirmGroupId(period.id)}
                        role="group"
                        tabIndex={-1}
                        aria-label={`Confirm deletion of closure: ${label}`}
                      >
                        <p>Delete this closure? Booking will be possible again for this period.</p>
                        <div className="btn-row">
                          <button
                            type="button"
                            className="btn--danger btn--sm"
                            disabled={submitting}
                            onClick={() => {
                              void remove(period);
                            }}
                          >
                            {submitting ? 'Deleting…' : 'Yes, delete closure'}
                          </button>
                          <button
                            type="button"
                            className="btn--sm"
                            disabled={submitting}
                            onClick={() => {
                              pendingFocus.current = deleteButtonId(period.id);
                              setConfirmId(null);
                            }}
                          >
                            Keep closure
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {state.loadMoreError !== null && (
              <p role="alert" className="alert alert--error">
                {state.loadMoreError}
              </p>
            )}
            {state.hasMore && (
              <button type="button" aria-disabled={state.loadingMore} onClick={handleLoadMore}>
                {state.loadingMore ? 'Loading more…' : 'Load more'}
              </button>
            )}
          </>
        ))}
    </section>
  );
}
