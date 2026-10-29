import { useState } from 'react';
import type { AppointmentStatus } from '../api/types.ts';
import { StaffAppointmentList } from '../components/StaffAppointmentList.tsx';
import { StaffBookingForm } from '../components/StaffBookingForm.tsx';
import type { StaffFilters } from '../hooks/useStaffAppointments.ts';
import { useServices } from '../hooks/useServices.ts';
import { todayInJakarta } from '../lib/dates.ts';

const STATUS_OPTIONS: ReadonlyArray<{ value: AppointmentStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'booked', label: 'Booked' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface DateRange {
  from: string;
  to: string;
}

// Reads the clock outside the component body: it is only called from a
// lazy state initializer, never during render.
function readClock(): Date {
  return new Date();
}

function initialRange(): DateRange {
  const today = todayInJakarta(readClock());
  return { from: today, to: today };
}

function parseStatus(value: string): AppointmentStatus | '' {
  const match = STATUS_OPTIONS.find((option) => option.value === value);
  return match === undefined ? '' : match.value;
}

export function StaffPage() {
  const services = useServices();
  const [range, setRange] = useState(initialRange);
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [showBooking, setShowBooking] = useState(false);
  // Bumped after a staff booking so the list below reloads from page 1.
  const [listVersion, setListVersion] = useState(0);

  const sState = services.state;
  if (sState.kind === 'error') {
    return (
      <div role="alert" className="alert alert--error">
        <p>{sState.message}</p>
        <button
          type="button"
          onClick={() => {
            services.retry();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  if (sState.kind === 'loading') {
    return (
      <p role="status" className="loading">
        Loading...
      </p>
    );
  }

  const serviceNames = new Map<string, string>(
    sState.services.map((s): [string, string] => [s.id, s.name]),
  );
  const rangeInvalid = range.from !== '' && range.to !== '' && range.from > range.to;
  const filters: StaffFilters = { from: range.from, to: range.to, status };

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Staff</h1>
          <p className="page-lead">Review appointments and book on behalf of customers.</p>
        </div>
        <button
          type="button"
          className="btn--primary"
          aria-expanded={showBooking}
          onClick={() => {
            setShowBooking((open) => !open);
          }}
        >
          Book for a customer
        </button>
      </div>
      {showBooking && (
        <StaffBookingForm
          services={sState.services}
          onBooked={() => {
            setListVersion((n) => n + 1);
          }}
        />
      )}
      <fieldset className="staff-filters">
        <legend>Filter appointments</legend>
        <div className="staff-filter">
          <label htmlFor="staff-from">From</label>
          <input
            id="staff-from"
            type="date"
            value={range.from}
            onChange={(event) => {
              const value = event.target.value;
              setRange((r) => ({ ...r, from: value }));
            }}
          />
        </div>
        <div className="staff-filter">
          <label htmlFor="staff-to">To</label>
          <input
            id="staff-to"
            type="date"
            value={range.to}
            onChange={(event) => {
              const value = event.target.value;
              setRange((r) => ({ ...r, to: value }));
            }}
          />
        </div>
        <div className="staff-filter">
          <label htmlFor="staff-status">Status</label>
          <select
            id="staff-status"
            value={status}
            onChange={(event) => {
              setStatus(parseStatus(event.target.value));
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <p className="staff-filter-hint">
        Dates and times are in Asia/Jakarta time. Appointments are listed newest first. Clear a date
        to remove that limit.
      </p>
      {rangeInvalid ? (
        <p role="alert" className="alert alert--warning">
          The From date must not be after the To date.
        </p>
      ) : (
        <StaffAppointmentList
          key={`${range.from}|${range.to}|${status}|${listVersion}`}
          filters={filters}
          serviceNames={serviceNames}
        />
      )}
    </section>
  );
}
