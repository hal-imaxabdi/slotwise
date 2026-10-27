import { Link } from 'react-router';
import { useServices } from '../hooks/useServices.ts';
import { formatDuration, formatIdr } from '../lib/format.ts';

export function ServicesPage() {
  const { state, retry } = useServices();

  return (
    <section>
      <h1>Services</h1>
      {state.kind === 'loading' && <p role="status">Loading services...</p>}
      {state.kind === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
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
              <Link to={`/services/${service.id}/book`} aria-label={`Book ${service.name}`}>
                Book
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
