import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { cancelAppointment } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment, AppointmentStatus } from '../api/types.ts';
import { CalendarIcon } from '../components/icons.tsx';
import { RescheduleForm } from '../components/RescheduleForm.tsx';
import { useMyAppointments } from '../hooks/useMyAppointments.ts';
import { useServices } from '../hooks/useServices.ts';
import { canChangeAppointment, formatAppointmentRange } from '../lib/dates.ts';

const BUSINESS_TIMEZONE = 'Asia/Jakarta';
const CHANGE_HINT =
  'Appointments can only be cancelled or rescheduled at least 24 hours before they start.';
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
};

// Element ids used to move keyboard focus after a panel opens or closes.
const HEADING_ID = 'appointments-heading';
const cancelButtonId = (id: string) => `cancel-btn-${id}`;
const rescheduleButtonId = (id: string) => `reschedule-btn-${id}`;
const confirmGroupId = (id: string) => `cancel-confirm-${id}`;

// Reads the clock outside the component body: it is only called from a
// lazy state initializer and from event handlers, never during render.
function readClock(): Date {
  return new Date();
}

interface Panel {
  id: string;
  kind: 'cancel' | 'reschedule';
}

interface ItemProps {
  appointment: Appointment;
  serviceName: string;
  showActions: boolean;
  allowed: boolean;
  canReschedule: boolean;
  confirming: boolean;
  rescheduling: boolean;
  busy: boolean;
  reschedulePanel: ReactNode;
  onAsk: () => void;
  onReschedule: () => void;
  onKeep: () => void;
  onConfirm: () => void;
}

function AppointmentItem({
  appointment,
  serviceName,
  showActions,
  allowed,
  canReschedule,
  confirming,
  rescheduling,
  busy,
  reschedulePanel,
  onAsk,
  onReschedule,
  onKeep,
  onConfirm,
}: ItemProps) {
  const when = formatAppointmentRange(appointment.starts_at, appointment.ends_at);
  const hintId = `change-hint-${appointment.id}`;
  return (
    <li className={`appointment appointment--${appointment.status}`}>
      <div className="appointment-head">
        <h3>{serviceName}</h3>
        <p className={`status-pill status-pill--${appointment.status}`}>
          {`Status: ${STATUS_LABELS[appointment.status]}`}
        </p>
      </div>
      <p className="appt-when">
        <CalendarIcon className="icon" />
        {when}
      </p>
      {appointment.notes !== '' && <p className="appt-notes">{`Notes: ${appointment.notes}`}</p>}
      {showActions && !confirming && !rescheduling && (
        <div className="item-actions">
          <button
            id={cancelButtonId(appointment.id)}
            className="btn--sm"
            type="button"
            disabled={!allowed || busy}
            aria-label={`Cancel ${serviceName} on ${when}`}
            aria-describedby={allowed ? undefined : hintId}
            onClick={onAsk}
          >
            Cancel
          </button>
          {canReschedule && (
            <button
              id={rescheduleButtonId(appointment.id)}
              className="btn--sm"
              type="button"
              disabled={!allowed || busy}
              aria-label={`Reschedule ${serviceName} on ${when}`}
              aria-describedby={allowed ? undefined : hintId}
              onClick={onReschedule}
            >
              Reschedule
            </button>
          )}
          {!allowed && (
            <p id={hintId} className="appointment-hint">
              {CHANGE_HINT}
            </p>
          )}
        </div>
      )}
      {showActions && confirming && (
        <div
          className="confirm-panel"
          id={confirmGroupId(appointment.id)}
          role="group"
          tabIndex={-1}
          aria-label={`Confirm cancellation of ${serviceName}`}
        >
          <p>Cancel this appointment?</p>
          <div className="btn-row">
            <button
              type="button"
              className="btn--danger btn--sm"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? 'Cancelling...' : 'Yes, cancel appointment'}
            </button>
            <button type="button" className="btn--sm" disabled={busy} onClick={onKeep}>
              Keep appointment
            </button>
          </div>
        </div>
      )}
      {showActions && rescheduling && reschedulePanel}
    </li>
  );
}

export function AppointmentsPage() {
  const services = useServices();
  const mine = useMyAppointments();
  const [now, setNow] = useState(readClock);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Id of the element that should receive focus after the next render.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) {
      return;
    }
    pendingFocus.current = null;
    document.getElementById(id)?.focus();
  });

  const sState = services.state;
  const aState = mine.state;

  if (sState.kind === 'error' || aState.kind === 'error') {
    const message =
      sState.kind === 'error' ? sState.message : aState.kind === 'error' ? aState.message : '';
    return (
      <div role="alert" className="alert alert--error">
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
    return (
      <p role="status" className="loading">
        Loading...
      </p>
    );
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

  const busy = submitting || formBusy;

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
      setPanel(null);
      setNotice('Appointment cancelled.');
      pendingFocus.current = HEADING_ID;
    } catch (error) {
      setActionError(describeApiError(error));
      if (error instanceof ApiError && error.status === 403) {
        // Server says it is too late (or forbidden): re-read the clock, keep the session.
        setPanel(null);
        setNow(readClock());
        pendingFocus.current = HEADING_ID;
      } else if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        // Our list is stale: resync with the server.
        setPanel(null);
        setNow(readClock());
        mine.refresh();
        pendingFocus.current = HEADING_ID;
      } else {
        // Panel stays open for a retry; the clicked button was disabled, so refocus the panel.
        pendingFocus.current = confirmGroupId(appointment.id);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleRescheduled = (updated: Appointment) => {
    mine.replace(updated);
    setPanel(null);
    setNotice('Appointment rescheduled.');
    pendingFocus.current = HEADING_ID;
  };

  const handleTooLate = (message: string) => {
    setActionError(message);
    setPanel(null);
    setNow(readClock());
    pendingFocus.current = HEADING_ID;
  };

  const handleGone = (message: string) => {
    setActionError(message);
    setPanel(null);
    setNow(readClock());
    mine.refresh();
    pendingFocus.current = HEADING_ID;
  };

  const renderItem = (a: Appointment, showActions: boolean) => {
    const open = panel !== null && panel.id === a.id ? panel.kind : null;
    const rescheduling = open === 'reschedule';
    return (
      <AppointmentItem
        key={a.id}
        appointment={a}
        serviceName={nameOf(a)}
        showActions={showActions}
        allowed={canChangeAppointment(a.starts_at, now)}
        canReschedule={names.has(a.service_id)}
        confirming={open === 'cancel'}
        rescheduling={rescheduling}
        busy={busy}
        reschedulePanel={
          rescheduling ? (
            <RescheduleForm
              appointment={a}
              serviceName={nameOf(a)}
              onRescheduled={handleRescheduled}
              onClose={() => {
                pendingFocus.current = rescheduleButtonId(a.id);
                setPanel(null);
              }}
              onTooLate={handleTooLate}
              onGone={handleGone}
              onBusyChange={setFormBusy}
            />
          ) : null
        }
        onAsk={() => {
          setActionError(null);
          setNotice(null);
          pendingFocus.current = confirmGroupId(a.id);
          setPanel({ id: a.id, kind: 'cancel' });
        }}
        onReschedule={() => {
          setActionError(null);
          setNotice(null);
          setPanel({ id: a.id, kind: 'reschedule' });
        }}
        onKeep={() => {
          pendingFocus.current = cancelButtonId(a.id);
          setPanel(null);
        }}
        onConfirm={() => {
          void handleCancel(a);
        }}
      />
    );
  };

  return (
    <section>
      <div className="page-header">
        <div>
          <h1 id={HEADING_ID} tabIndex={-1}>
            My appointments
          </h1>
          <p className="page-lead">Your upcoming bookings and your history.</p>
        </div>
        <Link to="/services" className="btn btn--primary">
          Book a service
        </Link>
      </div>
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
      {appointments.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">You have no appointments yet.</p>
          <p>Pick a service and choose a time that works for you.</p>
          <Link to="/services" className="btn btn--primary">
            Browse services
          </Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="upcoming-heading" className="appointments-section">
            <h2 id="upcoming-heading">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="hint">No upcoming appointments.</p>
            ) : (
              <ul className="appointment-list">{upcoming.map((a) => renderItem(a, true))}</ul>
            )}
          </section>
          {history.length > 0 && (
            <section aria-labelledby="history-heading" className="appointments-section">
              <h2 id="history-heading">Past and cancelled</h2>
              <ul className="appointment-list">{history.map((a) => renderItem(a, false))}</ul>
            </section>
          )}
        </>
      )}
      <p className="tz-note">{`Times are shown in ${BUSINESS_TIMEZONE} time.`}</p>
    </section>
  );
}
