import { useEffect, useRef } from 'react';
import type { AppointmentStatus, StaffAppointment } from '../api/types.ts';
import { useStaffAppointments, type StaffFilters } from '../hooks/useStaffAppointments.ts';
import { formatAppointmentRange } from '../lib/dates.ts';
import './StaffAppointmentList.css';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
};

const HEADING_ID = 'staff-appointments-heading';
const INACTIVE_SERVICE = 'Inactive service';

interface ItemProps {
  appointment: StaffAppointment;
  serviceName: string;
}

function StaffAppointmentItem({ appointment, serviceName }: ItemProps) {
  return (
    <li className="staff-appointment">
      <h3>{appointment.customer_name}</h3>
      <p>{appointment.customer_email}</p>
      <p>{serviceName}</p>
      <p>{formatAppointmentRange(appointment.starts_at, appointment.ends_at)}</p>
      <p>{`Status: ${STATUS_LABELS[appointment.status]}`}</p>
      {appointment.notes !== '' && <p>{`Notes: ${appointment.notes}`}</p>}
    </li>
  );
}

interface Props {
  filters: StaffFilters;
  serviceNames: ReadonlyMap<string, string>;
}

export function StaffAppointmentList({ filters, serviceNames }: Props) {
  const { state, page, goToPage, retry } = useStaffAppointments(filters);
  // Set when the user changes page; focus moves to the heading once the new page is shown.
  const pendingFocus = useRef(false);

  useEffect(() => {
    if (pendingFocus.current && state.kind !== 'loading') {
      pendingFocus.current = false;
      document.getElementById(HEADING_ID)?.focus();
    }
  });

  const move = (next: number) => {
    pendingFocus.current = true;
    goToPage(next);
  };

  return (
    <section aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} tabIndex={-1}>
        Appointments
      </h2>
      {state.kind === 'loading' && <p role="status">Loading...</p>}
      {state.kind === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' && (
        <>
          {state.appointments.length === 0 ? (
            <p>
              {page === 0 ? 'No appointments match these filters.' : 'No more appointments.'}
            </p>
          ) : (
            <ul className="staff-appointment-list">
              {state.appointments.map((a) => (
                <StaffAppointmentItem
                  key={a.id}
                  appointment={a}
                  serviceName={serviceNames.get(a.service_id) ?? INACTIVE_SERVICE}
                />
              ))}
            </ul>
          )}
          {(page > 0 || state.hasMore) && (
            <nav aria-label="Appointment pages" className="staff-pagination">
              <button type="button" disabled={page === 0} onClick={() => move(page - 1)}>
                Previous
              </button>
              <span>{`Page ${page + 1}`}</span>
              <button type="button" disabled={!state.hasMore} onClick={() => move(page + 1)}>
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
