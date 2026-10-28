import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { cancelAppointment } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment, AppointmentStatus } from '../api/types.ts';
import { useMyAppointments } from '../hooks/useMyAppointments.ts';
import { useServices } from '../hooks/useServices.ts';
import { canChangeAppointment, formatAppointmentRange } from '../lib/dates.ts';
import './AppointmentsPage.css';

const BUSINESS_TIMEZONE = 'Asia/Jakarta';
const CANCEL_HINT = 'Appointments can only be cancelled at least 24 hours before they start.';
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
};

// Reads the clock outside the component body: it is only called from a
// lazy state initializer and from event handlers, never during render.
function readClock(): Date {
  return new Date();
}

interface ItemProps {
  appointment: Appointment;
  serviceName: string;
  showActions: boolean;
  allowed: boolean;
  confirming: boolean;
  busy: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onConfirm: () => void;
}

function AppointmentItem({
  appointment,
  serviceName,
  showActions,
  allowed,
  confirming,
  busy,
  onAsk,
  onKeep,
  onConfirm,
}: ItemProps) {
  const when = formatAppointmentRange(appointment.starts_at, appointment.ends_at);
  const hintId = `cancel-hint-${appointment.id}`;
  return (
    <li className="appointment">
      <h3>{serviceName}</h3>
      <p>{when}</p>
      <p>{`Status: ${STATUS_LABELS[appointment.status]}`}</p>
      {appointment.notes !== '' && <p>{`Notes: ${appointment.notes}`}</p>}
      {showActions && !confirming && (
        <>
          <button
            type="button"
            disabled={!allowed || busy}
            aria-label={`Cancel ${serviceName} on ${when}`}
            aria-describedby={allowed ? undefined : hintId}
            onClick={onAsk}
          >
            Cancel
          </button>
          {!allowed && (
            <p id={hintId} className="appointment-hint">
              {CANCEL_HINT}
            </p>
          )}
        </>
      )}
      {showActions && confirming && (
        <div role="group" aria-label={`Confirm cancellation of ${serviceName}`}>
          <p>Cancel this appointment?</p>
          <button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? 'Cancelling...' : 'Yes, cancel appointment'}
          </button>{' '}
          <button type="button" disabled={busy} onClick={onKeep}>
            Keep appointment
          </button>
        </div>
      )}
    </li>
  );
}

export function AppointmentsPage() {
  const services = useServices();
  const mine = useMyAppointments();
  const [now, setNow] = useState(readClock);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);

  const sState = services.state;
  const aState = mine.state;

  if (sState.kind === 'error' || aState.kind === 'error') {
    const message =
      sState.kind === 'error' ? sState.message : aState.kind === 'error' ? aState.message : '';
    return (
      <div role="alert">
        <p>{message}</p>
        <button
          type="button"
          onClick={() => {
            services.retry();
            mine.retry();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  if (sState.kind === 'loading' || aState.kind === 'loading') {
    return <p role="status">Loading...</p>;
  }

  const names = new Map<string, string>(
    sState.services.map((s): [string, string] => [s.id, s.name]),
  );
  const nameOf = (a: Appointment) => names.get(a.service_id) ?? 'Service no longer available';

  const isUpcoming = (a: Appointment) =>
    a.status === 'booked' && Date.parse(a.ends_at) > now.getTime();
  const appointments = aState.appointments;
  const upcoming = appointments
    .filter(isUpcoming)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const history = appointments
    .filter((a) => !isUpcoming(a))
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));

  const handleCancel = async (appointment: Appointment) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await cancelAppointment(appointment.id);
      mine.replace(updated);
      setConfirmingId(null);
      setNotice('Appointment cancelled.');
    } catch (error) {
      setActionError(describeApiError(error));
      if (error instanceof ApiError) {
        if (error.status === 403) {
          // Server says it is too late (or forbidden): re-read the clock, keep the session.
          setConfirmingId(null);
          setNow(readClock());
        } else if (error.status === 404 || error.status === 409) {
          // Our list is stale: resync with the server.
          setConfirmingId(null);
          setNow(readClock());
          mine.refresh();
        }
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const renderItem = (a: Appointment, showActions: boolean) => (
    <AppointmentItem
      key={a.id}
      appointment={a}
      serviceName={nameOf(a)}
      showActions={showActions}
      allowed={canChangeAppointment(a.starts_at, now)}
      confirming={confirmingId === a.id}
      busy={submitting}
      onAsk={() => {
        setActionError(null);
        setNotice(null);
        setConfirmingId(a.id);
      }}
      onKeep={() => {
        setConfirmingId(null);
      }}
      onConfirm={() => {
        void handleCancel(a);
      }}
    />
  );

  return (
    <section>
      <h1>My appointments</h1>
      {notice !== null && <p role="status">{notice}</p>}
      {actionError !== null && <p role="alert">{actionError}</p>}
      {appointments.length === 0 ? (
        <>
          <p>You have no appointments yet.</p>
          <p>
            <Link to="/services">Browse services</Link>
          </p>
        </>
      ) : (
        <>
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p>No upcoming appointments.</p>
            ) : (
              <ul className="appointment-list">{upcoming.map((a) => renderItem(a, true))}</ul>
            )}
          </section>
          {history.length > 0 && (
            <section aria-labelledby="history-heading">
              <h2 id="history-heading">Past and cancelled</h2>
              <ul className="appointment-list">{history.map((a) => renderItem(a, false))}</ul>
            </section>
          )}
        </>
      )}
      <p>{`Times are shown in ${BUSINESS_TIMEZONE} time.`}</p>
    </section>
  );
}
