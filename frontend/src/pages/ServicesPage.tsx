import { Link } from 'react-router';
import { useServices } from '../hooks/useServices.ts';
import { ClockIcon } from '../components/icons.tsx';
import { formatDuration, formatIdr } from '../lib/format.ts';

export function ServicesPage() {
  const { state, retry } = useServices();

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Services</h1>
          <p className="page-lead">
            Choose a service, pick a time that suits you and book it in a minute.
          </p>
        </div>
      </div>
      {state.kind === 'loading' && (
        <>
          <p role="status" className="loading">
            Loading services...
          </p>
          <div className="skeleton-grid" aria-hidden="true">
            <span className="skeleton skeleton-card" />
            <span className="skeleton skeleton-card" />
            <span className="skeleton skeleton-card" />
          </div>
        </>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="alert alert--error">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' && state.services.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">No services are available right now.</p>
          <p>Please check back soon.</p>
        </div>
      )}
      {state.kind === 'ready' && state.services.length > 0 && (
        <ul className="service-list">
          {state.services.map((service) => (
            <li key={service.id} className="service-card">
              <h2>{service.name}</h2>
              <p className="service-desc">{service.description}</p>
              <p className="service-meta">
                <span>
                  <ClockIcon className="icon" />
                  {formatDuration(service.duration_minutes)}
                </span>
                <span className="service-price">{formatIdr(service.price_idr)}</span>
              </p>
              <Link
                to={`/services/${service.id}/book`}
                className="btn btn--primary btn--block"
                aria-label={`Book ${service.name}`}
              >
                Book
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
