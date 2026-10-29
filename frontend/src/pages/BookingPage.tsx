import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useParams } from 'react-router';
import { describeApiError } from '../api/describeError.ts';
import { createAppointment } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Slot } from '../api/types.ts';
import { CheckCircleIcon, ChevronLeftIcon } from '../components/icons.tsx';
import { SlotPicker } from '../components/SlotPicker.tsx';
import { useServices } from '../hooks/useServices.ts';
import { todayInJakarta } from '../lib/dates.ts';
import { formatDuration, formatIdr, formatLongDate } from '../lib/format.ts';

const NOTES_MAX = 500;
const BUSINESS_TIMEZONE = 'Asia/Jakarta';

interface Booked {
  serviceName: string;
  date: string;
  time: string;
}

export function BookingPage() {
  const { serviceId } = useParams();
  const { state, retry } = useServices();
  const [today] = useState(() => todayInJakarta());
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const inFlight = useRef(false);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="loading">
        Loading...
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <div role="alert" className="alert alert--error">
        <p>{state.message}</p>
        <button type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  const service = state.services.find((s) => s.id === serviceId);
  if (service === undefined) {
    return (
      <section className="empty-state">
        <h1>Service not found</h1>
        <p>This service is not available.</p>
        <Link to="/services" className="btn btn--primary">
          Back to services
        </Link>
      </section>
    );
  }

  const dateOk = date >= today;

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    setDate(event.target.value);
    setSlot(null);
    setSubmitError(null);
  }

  function handleSelect(chosen: Slot) {
    setSlot(chosen);
    setSubmitError(null);
  }

  function handleBookAnother() {
    setBooked(null);
    setSlot(null);
    setNotes('');
    setSubmitError(null);
    setRefreshKey((n) => n + 1);
  }

  const handleSubmit = async () => {
    if (slot === null || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createAppointment({
        service_id: service.id,
        starts_at: slot.starts_at,
        notes: notes.trim(),
      });
      setBooked({ serviceName: service.name, date, time: slot.local_time });
    } catch (error) {
      setSubmitError(describeApiError(error));
      if (error instanceof ApiError && error.status === 409) {
        // Someone else took the time: drop the selection and reload the list.
        setSlot(null);
        setRefreshKey((n) => n + 1);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (booked !== null) {
    return (
      <section className="card confirmed">
        <CheckCircleIcon className="confirmed-icon" />
        <h1>Booking confirmed</h1>
        <p>{`${booked.serviceName} on ${booked.date} at ${booked.time} (${BUSINESS_TIMEZONE}).`}</p>
        <div className="btn-row">
          <Link to="/appointments" className="btn btn--primary">
            My appointments
          </Link>
          <button type="button" onClick={handleBookAnother}>
            Book another time
          </button>
          <Link to="/services" className="btn btn--quiet">
            Back to services
          </Link>
        </div>
      </section>
    );
  }

  const step = slot !== null ? 3 : dateOk ? 2 : 1;
  const stepClass = (n: number) => (n < step ? 'is-done' : n === step ? 'is-current' : '');
  const stepCurrent = (n: number) => (n === step ? 'step' : undefined);

  return (
    <section className="booking">
      <Link to="/services" className="back-link">
        <ChevronLeftIcon className="icon" />
        Back to services
      </Link>
      <div className="page-header">
        <div>
          <h1>{`Book ${service.name}`}</h1>
          <p className="booking-summary">{`${formatDuration(service.duration_minutes)} - ${formatIdr(service.price_idr)}`}</p>
        </div>
      </div>
      <ol className="steps" aria-label="Booking progress">
        <li className={stepClass(1)} aria-current={stepCurrent(1)}>
          Choose a date
        </li>
        <li className={stepClass(2)} aria-current={stepCurrent(2)}>
          Pick a time
        </li>
        <li className={stepClass(3)} aria-current={stepCurrent(3)}>
          Confirm
        </li>
      </ol>
      <div className="card">
        <div className="field date-field">
          <label htmlFor="booking-date">Date</label>
          <input
            id="booking-date"
            type="date"
            min={today}
            value={date}
            disabled={submitting}
            onChange={handleDateChange}
          />
        </div>
        {date === '' && <p className="hint">Choose a date to see available times.</p>}
        {date !== '' && !dateOk && (
          <p role="alert" className="alert alert--warning">
            Choose today or a later date.
          </p>
        )}
      </div>
      {submitError !== null && (
        <p role="alert" className="alert alert--error">
          {submitError}
        </p>
      )}
      {dateOk && (
        <div className="card">
          <h2 className="card-title">Pick a time</h2>
          <p className="card-lead">{formatLongDate(date)}</p>
          <SlotPicker
            key={`${service.id}:${date}:${refreshKey}`}
            serviceId={service.id}
            date={date}
            selected={slot === null ? null : slot.starts_at}
            onSelect={handleSelect}
            disabled={submitting}
          />
        </div>
      )}
      {slot !== null && (
        <form
          className="card booking-form"
          aria-label="Booking details"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <p role="status">{`Selected time: ${slot.local_time}`}</p>
          <dl className="booking-details">
            <dt>Service</dt>
            <dd>{service.name}</dd>
            <dt>Date</dt>
            <dd>{formatLongDate(date)}</dd>
            <dt>Duration</dt>
            <dd>{formatDuration(service.duration_minutes)}</dd>
            <dt>Price</dt>
            <dd>{formatIdr(service.price_idr)}</dd>
          </dl>
          <div className="field">
            <label htmlFor="booking-notes">Notes (optional)</label>
            <textarea
              id="booking-notes"
              rows={3}
              maxLength={NOTES_MAX}
              value={notes}
              disabled={submitting}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
            <p className="char-count booking-count">{`${notes.length}/${NOTES_MAX}`}</p>
          </div>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Booking...' : 'Confirm booking'}
          </button>
        </form>
      )}
    </section>
  );
}
