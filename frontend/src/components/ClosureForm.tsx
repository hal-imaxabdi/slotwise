import { useId, useRef, useState, type FormEvent } from 'react';
import { describeApiError } from '../api/describeError.ts';
import type { CreateUnavailablePeriodInput } from '../api/types.ts';
import { formatMinute, jakartaToUtcIso } from '../lib/closures.ts';

const START_MINUTES = Array.from({ length: 48 }, (_, i) => i * 30);
const END_MINUTES = Array.from({ length: 48 }, (_, i) => (i + 1) * 30);
const DEFAULT_START = '540';
const DEFAULT_END = '1020';

interface Props {
  onCreate: (input: CreateUnavailablePeriodInput) => Promise<unknown>;
}

export function ClosureForm({ onCreate }: Props) {
  const uid = useId();
  const dateRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLSelectElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [date, setDate] = useState('');
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setStatus(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Choose a date.');
      dateRef.current?.focus();
      return;
    }
    const startMinute = Number(start);
    const endMinute = Number(end);
    if (endMinute <= startMinute) {
      setError('End time must be after the start time.');
      endRef.current?.focus();
      return;
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 1) {
      setError('Enter a reason (1-200 characters).');
      reasonRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await onCreate({
        starts_at: jakartaToUtcIso(date, startMinute),
        ends_at: jakartaToUtcIso(date, endMinute),
        reason: trimmedReason,
      });
      setDate('');
      setStart(DEFAULT_START);
      setEnd(DEFAULT_END);
      setReason('');
      setStatus('Closure added.');
      dateRef.current?.focus();
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      aria-label="Add a closure"
    >
      <p>Times are in Asia/Jakarta. A closure blocks booking for everyone.</p>
      <div>
        <label htmlFor={`${uid}-date`}>Date</label>
        <input
          id={`${uid}-date`}
          ref={dateRef}
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
          }}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-start`}>Start time</label>
        <select
          id={`${uid}-start`}
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
          }}
        >
          {START_MINUTES.map((m) => (
            <option key={m} value={m}>
              {formatMinute(m)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-end`}>End time</label>
        <select
          id={`${uid}-end`}
          ref={endRef}
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
          }}
        >
          {END_MINUTES.map((m) => (
            <option key={m} value={m}>
              {formatMinute(m)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-reason`}>Reason</label>
        <input
          id={`${uid}-reason`}
          ref={reasonRef}
          value={reason}
          maxLength={200}
          onChange={(e) => {
            setReason(e.target.value);
          }}
        />
      </div>
      {error !== null && <p role="alert">{error}</p>}
      {status !== null && <p role="status">{status}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add closure'}
      </button>
    </form>
  );
}
