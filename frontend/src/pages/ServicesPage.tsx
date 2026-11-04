import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { useServices } from '../hooks/useServices.ts';
import { ArrowRightIcon, ClockIcon } from '../components/icons.tsx';
import { formatDuration, formatIdr } from '../lib/format.ts';
import { serviceImage } from '../lib/serviceImages.ts';

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
          {state.services.map((service, index) => (
            <li
              key={service.id}
              className="service-card"
              style={{ '--i': index } as CSSProperties}
            >
              <div className="service-media">
                <img
                  className="service-photo"
                  src={serviceImage(service.name)}
                  alt=""
                  width={640}
                  height={440}
                  loading="lazy"
                  decoding="async"
                />
                <span className="service-duration">
                  <ClockIcon className="icon" />
                  {formatDuration(service.duration_minutes)}
                </span>
              </div>
              <div className="service-body">
                <h2>{service.name}</h2>
                <p className="service-desc">{service.description}</p>
                <div className="service-foot">
                  <p className="service-price">{formatIdr(service.price_idr)}</p>
                  <Link
                    to={`/services/${service.id}/book`}
                    className="btn btn--primary"
                    aria-label={`Book ${service.name}`}
                  >
                    Book
                    <ArrowRightIcon className="icon" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
