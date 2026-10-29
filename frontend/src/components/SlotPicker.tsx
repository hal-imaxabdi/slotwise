import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { getSlots } from '../api/endpoints.ts';
import type { Slot, SlotsResponse } from '../api/types.ts';
import { CalendarOffIcon, ClockIcon } from './icons.tsx';

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: SlotsResponse };

interface SlotPickerProps {
  serviceId: string;
  date: string;
  selected: string | null;
  onSelect: (slot: Slot) => void;
  disabled?: boolean;
}

// The parent should remount this component (via `key`) when serviceId or date
// changes, so state always starts at "loading" for a new query.
export function SlotPicker({
  serviceId,
  date,
  selected,
  onSelect,
  disabled = false,
}: SlotPickerProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void getSlots(serviceId, date, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'ready', data });
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
  }, [serviceId, date, attempt]);

  function handleRetry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  return (
    <div>
      {state.kind === 'loading' && (
        <>
          <p role="status" className="loading">
            Loading available times...
          </p>
          <div className="slot-skeletons" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="skeleton" />
            ))}
          </div>
        </>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="alert alert--error">
          <p>{state.message}</p>
          <button type="button" onClick={handleRetry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' && state.data.slots.length === 0 && (
        <div className="empty-state slots-empty">
          <CalendarOffIcon className="empty-icon" />
          <p className="empty-title">No times are available on this date.</p>
          <p>Try another date.</p>
        </div>
      )}
      {state.kind === 'ready' && state.data.slots.length > 0 && (
        <>
          <p className="slot-note">
            <ClockIcon className="icon" />
            {`Times are in ${state.data.timezone}.`}
          </p>
          <ul className="slot-list" aria-label="Available times">
            {state.data.slots.map((slot) => (
              <li key={slot.starts_at}>
                <button
                  type="button"
                  aria-pressed={selected === slot.starts_at}
                  disabled={disabled}
                  onClick={() => {
                    onSelect(slot);
                  }}
                >
                  {slot.local_time}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
