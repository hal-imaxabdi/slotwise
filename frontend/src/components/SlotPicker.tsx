import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { getSlots } from '../api/endpoints.ts';
import type { Slot, SlotsResponse } from '../api/types.ts';
import './SlotPicker.css';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: SlotsResponse };

interface SlotPickerProps {
  serviceId: string;
  date: string;
  selected: string | null;
  onSelect: (slot: Slot) => void;
}

// The parent should remount this component (via `key`) when serviceId or date
// changes, so state always starts at "loading" for a new query.
export function SlotPicker({ serviceId, date, selected, onSelect }: SlotPickerProps) {
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
      {state.kind === 'loading' && <p role="status">Loading available times...</p>}
      {state.kind === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={handleRetry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' && state.data.slots.length === 0 && (
        <p>No times are available on this date.</p>
      )}
      {state.kind === 'ready' && state.data.slots.length > 0 && (
        <>
          <p className="slot-note">{`Times are in ${state.data.timezone}.`}</p>
          <ul className="slot-list" aria-label="Available times">
            {state.data.slots.map((slot) => (
              <li key={slot.starts_at}>
                <button
                  type="button"
                  aria-pressed={selected === slot.starts_at}
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
