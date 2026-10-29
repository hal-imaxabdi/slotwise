import { useEffect, useRef, useState, type ReactNode } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { cancelAppointment, completeAppointment, markNoShow } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment, AppointmentStatus, StaffAppointment } from '../api/types.ts';
import { useStaffAppointments, type StaffFilters } from '../hooks/useStaffAppointments.ts';
import { formatAppointmentRange } from '../lib/dates.ts';
import { CalendarIcon } from './icons.tsx';
import { RescheduleForm } from './RescheduleForm.tsx';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
};

const HEADING_ID = 'staff-appointments-heading';
const INACTIVE_SERVICE = 'Inactive service';

type ConfirmKind = 'cancel' | 'complete' | 'no_show';
type ActionKind = ConfirmKind | 'reschedule';

interface Panel {
  id: string;
  kind: ActionKind;
}

interface ConfirmText {
  group: string;
  question: string;
  yes: string;
  busy: string;
  keep: string;
  done: string;
}

const CONFIRM: Record<ConfirmKind, ConfirmText> = {
  cancel: {
    group: 'Confirm cancellation for',
    question: 'Cancel this appointment?',
    yes: 'Yes, cancel appointment',
    busy: 'Cancelling...',
    keep: 'Keep appointment',
    done: 'Appointment cancelled.',
  },
  complete: {
    group: 'Confirm completion for',
    question: 'Mark this appointment as completed?',
    yes: 'Yes, mark completed',
    busy: 'Saving...',
    keep: 'Go back',
    done: 'Appointment marked as completed.',
  },
  no_show: {
    group: 'Confirm no-show for',
    question: 'Mark this customer as a no-show?',
    yes: 'Yes, mark no-show',
    busy: 'Saving...',
    keep: 'Go back',
    done: 'Appointment marked as no-show.',
  },
};

// Element ids used to move keyboard focus after a panel opens or closes.
const buttonId = (kind: ActionKind, id: string) => `staff-${kind}-btn-${id}`;
const confirmGroupId = (id: string) => `staff-confirm-${id}`;

// Reads the clock outside the component body: it is only called from a
// lazy state initializer and from event handlers, never during render.
function readClock(): Date {
  return new Date();
}

function perform(kind: ConfirmKind, id: string): Promise<Appointment> {
  if (kind === 'cancel') {
    return cancelAppointment(id);
  }
  if (kind === 'complete') {
    return completeAppointment(id);
  }
  return markNoShow(id);
}

interface ItemProps {
  appointment: StaffAppointment;
  serviceName: string;
  canReschedule: boolean;
  started: boolean;
  open: ActionKind | null;
  busy: boolean;
  reschedulePanel: ReactNode;
  onOpen: (kind: ActionKind) => void;
  onKeep: (kind: ActionKind) => void;
  onConfirm: (kind: ConfirmKind) => void;
}

function StaffAppointmentItem({
  appointment,
  serviceName,
  canReschedule,
  started,
  open,
  busy,
  reschedulePanel,
  onOpen,
  onKeep,
  onConfirm,
}: ItemProps) {
  const when = formatAppointmentRange(appointment.starts_at, appointment.ends_at);
  const who = appointment.customer_name;
  const isBooked = appointment.status === 'booked';
  const confirmKind: ConfirmKind | null = open !== null && open !== 'reschedule' ? open : null;
  return (
    <li className="staff-appointment">
      <div className="staff-top">
        <div className="staff-who">
          <h3>{who}</h3>
          <p>{appointment.customer_email}</p>
        </div>
        <div className="staff-what">
          <p>{serviceName}</p>
          <p className="appt-when">
            <CalendarIcon className="icon" />
            {when}
          </p>
          {appointment.notes !== '' && (
            <p className="appt-notes">{`Notes: ${appointment.notes}`}</p>
          )}
        </div>
        <p className={`status-pill status-pill--${appointment.status}`}>
          {`Status: ${STATUS_LABELS[appointment.status]}`}
        </p>
      </div>
      {isBooked && open === null && (
        <div className="item-actions">
          {started && (
            <>
              <button
                id={buttonId('complete', appointment.id)}
                className="btn--primary btn--sm"
                type="button"
                disabled={busy}
                aria-label={`Complete appointment for ${who} on ${when}`}
                onClick={() => {
                  onOpen('complete');
                }}
              >
                Complete
              </button>
              <button
                id={buttonId('no_show', appointment.id)}
                className="btn--sm"
                type="button"
                disabled={busy}
                aria-label={`Mark no-show for ${who} on ${when}`}
                onClick={() => {
                  onOpen('no_show');
                }}
              >
                Mark no-show
              </button>
            </>
          )}
          {canReschedule && (
            <>
              <button
                id={buttonId('reschedule', appointment.id)}
                className="btn--sm"
                type="button"
                disabled={busy}
                aria-label={`Reschedule appointment for ${who} on ${when}`}
                onClick={() => {
                  onOpen('reschedule');
                }}
              >
                Reschedule
              </button>
            </>
          )}
          <button
            id={buttonId('cancel', appointment.id)}
            className="btn--quiet btn--sm"
            type="button"
            disabled={busy}
            aria-label={`Cancel appointment for ${who} on ${when}`}
            onClick={() => {
              onOpen('cancel');
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {isBooked && confirmKind !== null && (
        <div
          className="confirm-panel"
          id={confirmGroupId(appointment.id)}
          role="group"
          tabIndex={-1}
          aria-label={`${CONFIRM[confirmKind].group} ${who}`}
        >
          <p>{CONFIRM[confirmKind].question}</p>
          <div className="btn-row">
            <button
              type="button"
              className={
                confirmKind === 'complete' ? 'btn--primary btn--sm' : 'btn--danger btn--sm'
              }
              disabled={busy}
              onClick={() => {
                onConfirm(confirmKind);
              }}
            >
              {busy ? CONFIRM[confirmKind].busy : CONFIRM[confirmKind].yes}
            </button>
            <button
              type="button"
              className="btn--sm"
              disabled={busy}
              onClick={() => {
                onKeep(confirmKind);
              }}
            >
              {CONFIRM[confirmKind].keep}
            </button>
          </div>
        </div>
      )}
      {isBooked && open === 'reschedule' && reschedulePanel}
    </li>
  );
}

interface Props {
  filters: StaffFilters;
  serviceNames: ReadonlyMap<string, string>;
}

export function StaffAppointmentList({ filters, serviceNames }: Props) {
  const { state, page, goToPage, retry, refresh, replace } = useStaffAppointments(filters);
  const [now, setNow] = useState(readClock);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Id of the element that should receive focus once the page is not loading.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const id = pendingFocus.current;
    if (id !== null && state.kind !== 'loading') {
      pendingFocus.current = null;
      document.getElementById(id)?.focus();
    }
  });

  const busy = submitting || formBusy;

  const move = (next: number) => {
    setPanel(null);
    setActionError(null);
    setNotice(null);
    setNow(readClock());
    pendingFocus.current = HEADING_ID;
    goToPage(next);
  };

  const handleConfirm = async (appointment: StaffAppointment, kind: ConfirmKind) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await perform(kind, appointment.id);
      replace(updated);
      setPanel(null);
      setNotice(CONFIRM[kind].done);
      pendingFocus.current = HEADING_ID;
    } catch (error) {
      setActionError(describeApiError(error));
      if (error instanceof ApiError && error.status === 403) {
        // Not allowed: show the message and keep the session.
        setPanel(null);
        pendingFocus.current = HEADING_ID;
      } else if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        // Our list is stale: resync with the server.
        setPanel(null);
        setNow(readClock());
        refresh();
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
    replace(updated);
    setPanel(null);
    setNotice('Appointment rescheduled.');
    pendingFocus.current = HEADING_ID;
  };

  const handleRescheduleForbidden = (message: string) => {
    setActionError(message);
    setPanel(null);
    pendingFocus.current = HEADING_ID;
  };

  const handleGone = (message: string) => {
    setActionError(message);
    setPanel(null);
    setNow(readClock());
    refresh();
    pendingFocus.current = HEADING_ID;
  };

  const renderItem = (a: StaffAppointment) => {
    const open = panel !== null && panel.id === a.id ? panel.kind : null;
    const serviceName = serviceNames.get(a.service_id) ?? INACTIVE_SERVICE;
    return (
      <StaffAppointmentItem
        key={a.id}
        appointment={a}
        serviceName={serviceName}
        canReschedule={serviceNames.has(a.service_id)}
        started={Date.parse(a.starts_at) <= now.getTime()}
        open={open}
        busy={busy}
        reschedulePanel={
          open === 'reschedule' ? (
            <RescheduleForm
              appointment={a}
              serviceName={serviceName}
              onRescheduled={handleRescheduled}
              onClose={() => {
                pendingFocus.current = buttonId('reschedule', a.id);
                setPanel(null);
              }}
              onTooLate={handleRescheduleForbidden}
              onGone={handleGone}
              onBusyChange={setFormBusy}
            />
          ) : null
        }
        onOpen={(kind) => {
          setActionError(null);
          setNotice(null);
          setNow(readClock());
          if (kind !== 'reschedule') {
            pendingFocus.current = confirmGroupId(a.id);
          }
          setPanel({ id: a.id, kind });
        }}
        onKeep={(kind) => {
          pendingFocus.current = buttonId(kind, a.id);
          setPanel(null);
        }}
        onConfirm={(kind) => {
          void handleConfirm(a, kind);
        }}
      />
    );
  };

  return (
    <section aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} tabIndex={-1} className="section-title">
        Appointments
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
          Loading...
        </p>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="alert alert--error">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' && (
        <>
          {state.appointments.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">
                {page === 0 ? 'No appointments match these filters.' : 'No more appointments.'}
              </p>
              {page === 0 && <p>Try a wider date range or a different status.</p>}
            </div>
          ) : (
            <ul className="staff-appointment-list">{state.appointments.map(renderItem)}</ul>
          )}
          {(page > 0 || state.hasMore) && (
            <nav aria-label="Appointment pages" className="staff-pagination">
              <button
                type="button"
                className="btn--sm"
                disabled={page === 0 || busy}
                onClick={() => move(page - 1)}
              >
                Previous
              </button>
              <span>{`Page ${page + 1}`}</span>
              <button
                type="button"
                className="btn--sm"
                disabled={!state.hasMore || busy}
                onClick={() => move(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
