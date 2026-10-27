import { useEffect, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { listServices } from '../api/endpoints.ts';
import type { Service } from '../api/types.ts';
import { formatDuration, formatIdr } from '../lib/format.ts';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; services: Service[] };

export function ServicesPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void listServices(controller.signal).then(
      (services) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'ready', services });
        }
      },
      (err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'error', message: describeApiError(err) });
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt]);

  function handleRetry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  return (
    <section>
      <h1>Services</h1>
      {state.kind === 'loading' && <p role="status">Loading services...</p>}
      {state.kind === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={handleRetry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' && state.services.length === 0 && (
        <p>No services are available right now.</p>
      )}
      {state.kind === 'ready' && state.services.length > 0 && (
        <ul className="service-list">
          {state.services.map((service) => (
            <li key={service.id} className="service-card">
              <h2>{service.name}</h2>
              <p>{service.description}</p>
              <p className="service-meta">
                <span>{formatDuration(service.duration_minutes)}</span>
                <span>{formatIdr(service.price_idr)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
