import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { describeApiError } from '../api/describeError.ts';
import type { BusinessInterval } from '../api/types.ts';
import { WEEKDAY_NAMES } from '../lib/weekdays.ts';

const GRID_MINUTES = 30;
const MINUTES_PER_DAY = 1440;
const MAX_INTERVALS = 8;

interface Row {
  key: number;
  open: number;
  close: number;
}

interface BusinessHoursDayEditorProps {
  weekday: number;
  intervals: BusinessInterval[];
  onSave: (weekday: number, intervals: BusinessInterval[]) => Promise<void>;
}

function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function gridMinutes(from: number, to: number): number[] {
  const out: number[] = [];
  for (let minute = from; minute <= to; minute += GRID_MINUTES) {
    out.push(minute);
  }
  return out;
}

const OPEN_CHOICES = gridMinutes(0, MINUTES_PER_DAY - GRID_MINUTES);
const CLOSE_CHOICES = gridMinutes(GRID_MINUTES, MINUTES_PER_DAY);

function toSorted(rows: Row[]): BusinessInterval[] {
  return rows
    .map((r) => ({ open_minute: r.open, close_minute: r.close }))
    .sort((a, b) => a.open_minute - b.open_minute);
}

function validate(sorted: BusinessInterval[]): string | null {
  if (sorted.some((i) => i.open_minute >= i.close_minute)) {
    return 'Each interval must close after it opens.';
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].open_minute < sorted[i - 1].close_minute) {
      return 'Intervals must not overlap.';
    }
  }
  return null;
}

function sameIntervals(a: BusinessInterval[], b: BusinessInterval[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => x.open_minute === b[i].open_minute && x.close_minute === b[i].close_minute)
  );
}

export function BusinessHoursDayEditor({
  weekday,
  intervals,
  onSave,
}: BusinessHoursDayEditorProps) {
  const uid = useId();
  const dayName = WEEKDAY_NAMES[weekday];
  const nextKey = useRef(intervals.length);
  const [rows, setRows] = useState<Row[]>(() =>
    intervals.map((i, index) => ({ key: index, open: i.open_minute, close: i.close_minute })),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function edit(change: (current: Row[]) => Row[]) {
    setError(null);
    setNotice(null);
    setRows(change);
  }

  function addInterval() {
    const latestClose = rows.reduce((max, r) => Math.max(max, r.close), 0);
    const open = rows.length === 0 ? 540 : Math.min(latestClose, MINUTES_PER_DAY - GRID_MINUTES);
    const close = Math.min(open + 60, MINUTES_PER_DAY);
    const key = nextKey.current;
    nextKey.current += 1;
    edit((current) => [...current, { key, open, close }]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setError(null);
    setNotice(null);
    const sorted = toSorted(rows);
    const problem = validate(sorted);
    if (problem !== null) {
      setError(problem);
      return;
    }
    if (sameIntervals(sorted, intervals)) {
      setError('No changes to save.');
      return;
    }
    setSaving(true);
    try {
      await onSave(weekday, sorted);
      setRows(
        sorted.map((i, index) => ({ key: index, open: i.open_minute, close: i.close_minute })),
      );
      nextKey.current = sorted.length;
      setNotice(`${dayName} hours saved.`);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="hours-day"
      aria-labelledby={`${uid}-heading`}
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <h3 id={`${uid}-heading`}>{dayName}</h3>
      {rows.length === 0 ? (
        <p className="hours-closed">Closed all day.</p>
      ) : (
        <ul className="hours-intervals">
          {rows.map((row, index) => {
            const label = `${dayName} interval ${String(index + 1)}`;
            return (
              <li key={row.key}>
                <select
                  aria-label={`${label} opens`}
                  value={String(row.open)}
                  onChange={(e) => {
                    const open = Number(e.target.value);
                    edit((current) => current.map((r) => (r.key === row.key ? { ...r, open } : r)));
                  }}
                >
                  {OPEN_CHOICES.map((m) => (
                    <option key={m} value={String(m)}>
                      {formatMinute(m)}
                    </option>
                  ))}
                </select>
                <span className="hours-sep" aria-hidden="true">
                  to
                </span>
                <select
                  aria-label={`${label} closes`}
                  value={String(row.close)}
                  onChange={(e) => {
                    const close = Number(e.target.value);
                    edit((current) =>
                      current.map((r) => (r.key === row.key ? { ...r, close } : r)),
                    );
                  }}
                >
                  {CLOSE_CHOICES.map((m) => (
                    <option key={m} value={String(m)}>
                      {formatMinute(m)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn--quiet btn--sm"
                  aria-label={`Remove ${label}`}
                  onClick={() => {
                    edit((current) => current.filter((r) => r.key !== row.key));
                  }}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="hours-actions">
        <button
          type="button"
          className="btn--sm"
          aria-label={`Add interval to ${dayName}`}
          disabled={rows.length >= MAX_INTERVALS}
          onClick={addInterval}
        >
          Add interval
        </button>
        <button
          type="submit"
          className="btn--primary btn--sm"
          aria-label={`Save ${dayName} hours`}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error !== null && (
        <p role="alert" className="alert alert--error">
          {error}
        </p>
      )}
      {notice !== null && (
        <p role="status" className="alert alert--success">
          {notice}
        </p>
      )}
    </form>
  );
}
