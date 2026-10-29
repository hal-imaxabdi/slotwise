import { useEffect, useRef, useState } from 'react';
import { describeApiError } from '../api/describeError.ts';
import { activateAdminService, deactivateAdminService } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { AdminService } from '../api/types.ts';
import { useAdminServices, type AdminServiceFilter } from '../hooks/useAdminServices.ts';

const HEADING_ID = 'admin-services-heading';

const PRICE_FORMAT = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

type Action = 'activate' | 'deactivate';

// Element ids used to move keyboard focus after a panel opens or closes.
const deactivateButtonId = (id: string) => `admin-service-deactivate-btn-${id}`;
const activateButtonId = (id: string) => `admin-service-activate-btn-${id}`;
const confirmGroupId = (id: string) => `admin-service-confirm-${id}`;

interface ItemProps {
  service: AdminService;
  confirming: boolean;
  busy: boolean;
  onActivate: () => void;
  onAskDeactivate: () => void;
  onKeep: () => void;
  onConfirmDeactivate: () => void;
}

function AdminServiceItem({
  service,
  confirming,
  busy,
  onActivate,
  onAskDeactivate,
  onKeep,
  onConfirmDeactivate,
}: ItemProps) {
  return (
    <li className="admin-service">
      <h3>{service.name}</h3>
      {service.description !== '' && <p>{service.description}</p>}
      <p>{`${service.duration_minutes} minutes`}</p>
      <p>{PRICE_FORMAT.format(service.price_idr)}</p>
      <p>{`Status: ${service.is_active ? 'Active' : 'Inactive'}`}</p>
      {!service.is_active && (
        <button
          id={activateButtonId(service.id)}
          type="button"
          disabled={busy}
          aria-label={`Activate ${service.name}`}
          onClick={onActivate}
        >
          Activate
        </button>
      )}
      {service.is_active && !confirming && (
        <button
          id={deactivateButtonId(service.id)}
          type="button"
          disabled={busy}
          aria-label={`Deactivate ${service.name}`}
          onClick={onAskDeactivate}
        >
          Deactivate
        </button>
      )}
      {service.is_active && confirming && (
        <div
          id={confirmGroupId(service.id)}
          role="group"
          tabIndex={-1}
          aria-label={`Confirm deactivation of ${service.name}`}
        >
          <p>Deactivate this service? It will stop appearing for new bookings.</p>
          <button type="button" disabled={busy} onClick={onConfirmDeactivate}>
            {busy ? 'Deactivating...' : 'Yes, deactivate service'}
          </button>{' '}
          <button type="button" disabled={busy} onClick={onKeep}>
            Keep service
          </button>
        </div>
      )}
    </li>
  );
}

interface Props {
  filter: AdminServiceFilter;
}

/** Mount with key={filter} (and any other reload trigger) so a change starts fresh. */
export function AdminServiceList({ filter }: Props) {
  const { state, retry, refresh } = useAdminServices(filter);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Id of the element that should receive focus once the list is not loading.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const id = pendingFocus.current;
    if (id !== null && state.kind !== 'loading') {
      pendingFocus.current = null;
      document.getElementById(id)?.focus();
    }
  });

  const run = async (service: AdminService, action: Action) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      if (action === 'deactivate') {
        await deactivateAdminService(service.id);
      } else {
        await activateAdminService(service.id);
      }
      setConfirmId(null);
      setNotice(
        action === 'deactivate' ? `${service.name} deactivated.` : `${service.name} activated.`,
      );
      pendingFocus.current = HEADING_ID;
      refresh();
    } catch (error) {
      setActionError(describeApiError(error));
      if (error instanceof ApiError && error.status === 403) {
        // Not allowed: show the message and keep the session.
        setConfirmId(null);
        pendingFocus.current = HEADING_ID;
      } else if (error instanceof ApiError && error.status === 404) {
        // Our list is stale: resync with the server.
        setConfirmId(null);
        pendingFocus.current = HEADING_ID;
        refresh();
      } else {
        // The panel stays open for a retry; the clicked button was disabled, so refocus.
        pendingFocus.current =
          action === 'deactivate' ? confirmGroupId(service.id) : activateButtonId(service.id);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} tabIndex={-1}>
        Services
      </h2>
      {notice !== null && <p role="status">{notice}</p>}
      {actionError !== null && <p role="alert">{actionError}</p>}
      {state.kind === 'loading' && <p role="status">Loading...</p>}
      {state.kind === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' &&
        (state.services.length === 0 ? (
          <p>No services match this filter.</p>
        ) : (
          <ul className="admin-service-list">
            {state.services.map((service) => (
              <AdminServiceItem
                key={service.id}
                service={service}
                confirming={confirmId === service.id}
                busy={submitting}
                onActivate={() => {
                  void run(service, 'activate');
                }}
                onAskDeactivate={() => {
                  setActionError(null);
                  setNotice(null);
                  pendingFocus.current = confirmGroupId(service.id);
                  setConfirmId(service.id);
                }}
                onKeep={() => {
                  pendingFocus.current = deactivateButtonId(service.id);
                  setConfirmId(null);
                }}
                onConfirmDeactivate={() => {
                  void run(service, 'deactivate');
                }}
              />
            ))}
          </ul>
        ))}
    </section>
  );
}
