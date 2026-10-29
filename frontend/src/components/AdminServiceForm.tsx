import { useId, useRef, useState, type FormEvent } from 'react';
import { createAdminService, updateAdminService } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import { describeApiError } from '../api/describeError.ts';
import type { AdminService, UpdateAdminServiceInput } from '../api/types.ts';

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);
const MAX_PRICE = 2147483647;

interface Props {
  /** Present = edit mode; absent = create mode. */
  service?: AdminService;
  onSaved: () => void;
  onNotFound?: () => void;
  onCancel?: () => void;
}

export default function AdminServiceForm({ service, onSaved, onNotFound, onCancel }: Props) {
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [price, setPrice] = useState(service ? String(service.price_idr) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setStatus(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 120) {
      setError('Name must be 1-120 characters.');
      return;
    }
    if (!/^\d+$/.test(price.trim()) || Number(price) > MAX_PRICE) {
      setError('Price must be a whole number of IDR, 0 or more.');
      return;
    }
    const values = {
      name: trimmedName,
      description: description.trim(),
      duration_minutes: Number(duration),
      price_idr: Number(price),
    };

    let changes: UpdateAdminServiceInput | null = null;
    if (service) {
      changes = {};
      if (values.name !== service.name) changes.name = values.name;
      if (values.description !== service.description) changes.description = values.description;
      if (values.duration_minutes !== service.duration_minutes) changes.duration_minutes = values.duration_minutes;
      if (values.price_idr !== service.price_idr) changes.price_idr = values.price_idr;
      if (Object.keys(changes).length === 0) {
        setError('No changes to save.');
        return;
      }
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      if (service && changes) {
        await updateAdminService(service.id, changes);
      } else {
        await createAdminService(values);
        setName('');
        setDescription('');
        setDuration('30');
        setPrice('');
        setStatus('Service added.');
        nameRef.current?.focus();
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && onNotFound) {
        onNotFound();
        return;
      }
      setError(describeApiError(err));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={service ? `Edit ${service.name}` : 'Add a service'}>
      <div>
        <label htmlFor={`${uid}-name`}>Name</label>
        <input id={`${uid}-name`} ref={nameRef} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${uid}-desc`}>Description</label>
        <textarea id={`${uid}-desc`} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${uid}-duration`}>Duration</label>
        <select id={`${uid}-duration`} value={duration} onChange={(e) => setDuration(e.target.value)}>
          {DURATIONS.map((m) => (
            <option key={m} value={m}>{`${m} minutes`}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-price`}>Price (IDR)</label>
        <input id={`${uid}-price`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : service ? 'Save changes' : 'Add service'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      )}
    </form>
  );
}
