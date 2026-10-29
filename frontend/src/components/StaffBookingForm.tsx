import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { createStaffAppointment } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Service, Slot, StaffCustomer } from '../api/types.ts';
import { todayInJakarta } from '../lib/dates.ts';
import { CustomerPicker } from './CustomerPicker.tsx';
import { SlotPicker } from './SlotPicker.tsx';

const NOTES_MAX = 500;
const BUSINESS_TIMEZONE = 'Asia/Jakarta';

interface StaffBookingFormProps {
  services: readonly Service[];
  onBooked: () => void;
}

export function StaffBookingForm({ services, onBooked }: StaffBookingFormProps) {
  const [today] = useState(() => todayInJakarta());
  const [customer, setCustomer] = useState<StaffCustomer | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const inFlight = useRef(false);

  const service = services.find((s) => s.id === serviceId);
  const dateOk = date >= today;

  function handleServiceChange(event: ChangeEvent<HTMLSelectElement>) {
    setServiceId(event.target.value);
    setSlot(null);
    setError(null);
    setNotice(null);
  }

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    setDate(event.target.value);
    setSlot(null);
    setError(null);
    setNotice(null);
  }

  function handleSelectCustomer(chosen: StaffCustomer) {
    setCustomer(chosen);
    setError(null);
    setNotice(null);
  }

  function handleSelectSlot(chosen: Slot) {
    setSlot(chosen);
    setError(null);
    setNotice(null);
  }

  const handleSubmit = async () => {
    if (customer === null || service === undefined || slot === null || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createStaffAppointment({
        customer_id: customer.id,
        service_id: service.id,
        starts_at: slot.starts_at,
        notes: notes.trim(),
      });
      setNotice(
        `Booked ${service.name} for ${customer.full_name} on ${date} at ${slot.local_time} (${BUSINESS_TIMEZONE}).`,
      );
      setSlot(null);
      setNotes('');
      setRefreshKey((n) => n + 1);
      onBooked();
    } catch (err) {
      setError(describeApiError(err));
      if (err instanceof ApiError && err.status === 409) {
        // The time was taken: drop the selection and reload the list.
        setSlot(null);
        setRefreshKey((n) => n + 1);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="staff-book-heading" className="card staff-book">
      <h2 id="staff-book-heading">Book for a customer</h2>
      <h3>1. Customer</h3>
      <CustomerPicker
        selectedId={customer === null ? null : customer.id}
        onSelect={handleSelectCustomer}
        disabled={submitting}
      />
      <p className="chosen">
        {customer === null ? 'No customer chosen.' : `Customer: ${customer.full_name}`}
      </p>
      <h3>2. Service and time</h3>
      <form
        className="form-stack"
        aria-label="Booking details"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="field">
          <label htmlFor="staff-book-service">Service</label>
          <select
            id="staff-book-service"
            value={serviceId}
            disabled={submitting}
            onChange={handleServiceChange}
          >
            <option value="">Choose a service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field date-field">
          <label htmlFor="staff-book-date">Date</label>
          <input
            id="staff-book-date"
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
        {service !== undefined && dateOk && (
          <SlotPicker
            key={`${service.id}:${date}:${refreshKey}`}
            serviceId={service.id}
            date={date}
            selected={slot === null ? null : slot.starts_at}
            onSelect={handleSelectSlot}
            disabled={submitting}
          />
        )}
        {slot !== null && <p className="chosen">{`Selected time: ${slot.local_time}`}</p>}
        <div className="field">
          <label htmlFor="staff-book-notes">Notes (optional)</label>
          <textarea
            id="staff-book-notes"
            rows={3}
            maxLength={NOTES_MAX}
            value={notes}
            disabled={submitting}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
          />
          <p className="char-count">{`${notes.length}/${NOTES_MAX}`}</p>
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
        <div className="form-actions">
          <button
            type="submit"
            className="btn--primary"
            disabled={submitting || customer === null || slot === null}
          >
            {submitting ? 'Booking...' : 'Book appointment'}
          </button>
        </div>
      </form>
    </section>
  );
}
