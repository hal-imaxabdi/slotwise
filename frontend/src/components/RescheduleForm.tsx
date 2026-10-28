import { useRef, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { rescheduleAppointment } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment } from '../api/types.ts';
import { formatAppointmentRange, todayInJakarta } from '../lib/dates.ts';
import { SlotPicker } from './SlotPicker.tsx';
import './RescheduleForm.css';

const JAKARTA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Module-level helpers keep clock-style Date work out of the component body.
function jakartaDateOf(iso: string): string {
  return JAKARTA_DATE.format(new Date(iso));
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

interface RescheduleFormProps {
  appointment: Appointment;
  serviceName: string;
  onRescheduled: (updated: Appointment) => void;
  onClose: () => void;
  onTooLate: (message: string) => void;
  onGone: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
}

export function RescheduleForm({
  appointment,
  serviceName,
  onRescheduled,
  onClose,
  onTooLate,
  onGone,
  onBusyChange,
}: RescheduleFormProps) {
  const [minDate] = useState(() => todayInJakarta());
  const [date, setDate] = useState(() => jakartaDateOf(appointment.starts_at));
  const [selected, setSelected] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const durationMs = Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at);
  const dateUsable = date !== '' && date >= minDate;
  const unchanged =
    selected !== null && Date.parse(selected) === Date.parse(appointment.starts_at);
  const dateId = `reschedule-date-${appointment.id}`;

  function handleDateChange(value: string) {
    setDate(value);
    setSelected(null);
    setError(null);
  }

  async function handleConfirm() {
    if (selected === null || unchanged || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    onBusyChange(true);
    setError(null);
    try {
      const updated = await rescheduleAppointment(appointment.id, selected);
      onRescheduled(updated);
    } catch (err) {
      const message = describeApiError(err);
      if (err instanceof ApiError && err.status === 403) {
        onTooLate(message);
      } else if (err instanceof ApiError && err.status === 404) {
        onGone(message);
      } else if (err instanceof ApiError && err.status === 409) {
        // Slot taken (or state changed): show why, reload the times, clear the choice.
        setError(message);
        setSelected(null);
        setReloads((n) => n + 1);
      } else {
        setError(message);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  return (
    <div role="group" aria-label={`Reschedule ${serviceName}`} className="reschedule">
      <p>{`Current time: ${formatAppointmentRange(appointment.starts_at, appointment.ends_at)}`}</p>
      <div>
        <label htmlFor={dateId}>New date</label>{' '}
        <input
          id={dateId}
          type="date"
          value={date}
          min={minDate}
          disabled={submitting}
          onChange={(event) => {
            handleDateChange(event.target.value);
          }}
        />
      </div>
      {dateUsable ? (
        <SlotPicker
          key={`${date}:${reloads}`}
          serviceId={appointment.service_id}
          date={date}
          selected={selected}
          disabled={submitting}
          onSelect={(slot) => {
            setSelected(slot.starts_at);
            setError(null);
          }}
        />
      ) : (
        <p>Choose today or a later date to see available times.</p>
      )}
      {error !== null && <p role="alert">{error}</p>}
      {selected !== null && unchanged && (
        <p>That is already your current time. Choose a different one.</p>
      )}
      {selected !== null && !unchanged && (
        <>
          <p>{`New time: ${formatAppointmentRange(selected, addMs(selected, durationMs))}`}</p>
          <div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {submitting ? 'Rescheduling...' : 'Confirm new time'}
            </button>
          </div>
        </>
      )}
      <div>
        <button type="button" disabled={submitting} onClick={onClose}>
          Keep current time
        </button>
      </div>
    </div>
  );
}
