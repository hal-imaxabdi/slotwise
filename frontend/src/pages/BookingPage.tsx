import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useParams } from 'react-router';
import type { Slot } from '../api/types.ts';
import { SlotPicker } from '../components/SlotPicker.tsx';
import { useServices } from '../hooks/useServices.ts';
import { todayInJakarta } from '../lib/dates.ts';
import { formatDuration, formatIdr } from '../lib/format.ts';

export function BookingPage() {
  const { serviceId } = useParams();
  const { state, retry } = useServices();
  const [today] = useState(() => todayInJakarta());
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot | null>(null);

  if (state.kind === 'loading') {
    return <p role="status">Loading...</p>;
  }
  if (state.kind === 'error') {
    return (
      <div role="alert">
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
      <section>
        <h1>Service not found</h1>
        <p>This service is not available.</p>
        <p>
          <Link to="/services">Back to services</Link>
        </p>
      </section>
    );
  }

  const dateOk = date >= today;

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    setDate(event.target.value);
    setSlot(null);
  }

  return (
    <section>
      <p>
        <Link to="/services">Back to services</Link>
      </p>
      <h1>{`Book ${service.name}`}</h1>
      <p>{`${formatDuration(service.duration_minutes)} - ${formatIdr(service.price_idr)}`}</p>
      <div>
        <label htmlFor="booking-date">Date</label>{' '}
        <input id="booking-date" type="date" min={today} value={date} onChange={handleDateChange} />
      </div>
      {date === '' && <p>Choose a date to see available times.</p>}
      {date !== '' && !dateOk && <p role="alert">Choose today or a later date.</p>}
      {dateOk && (
        <SlotPicker
          key={`${service.id}:${date}`}
          serviceId={service.id}
          date={date}
          selected={slot === null ? null : slot.starts_at}
          onSelect={setSlot}
        />
      )}
      {slot !== null && <p role="status">{`Selected time: ${slot.local_time}`}</p>}
    </section>
  );
}
