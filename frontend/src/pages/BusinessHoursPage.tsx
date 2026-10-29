import { BusinessHoursDayEditor } from '../components/BusinessHoursDayEditor.tsx';
import { useBusinessHours } from '../hooks/useBusinessHours.ts';
import { WEEKDAY_NAMES } from '../lib/weekdays.ts';

export function BusinessHoursPage() {
  const { state, retry, replace } = useBusinessHours();

  return (
    <div>
      <h1>Business hours</h1>
      <p>Times are in Asia/Jakarta, in 30-minute steps. Each day is saved on its own.</p>
      {state.kind === 'loading' && <p role="status">Loading business hours…</p>}
      {state.kind === 'error' && (
        <div>
          <p role="alert">{state.message}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'ready' && (
        <section aria-labelledby="business-hours-heading">
          <h2 id="business-hours-heading">Weekly hours</h2>
          {WEEKDAY_NAMES.map((_, weekday) => (
            <BusinessHoursDayEditor
              key={weekday}
              weekday={weekday}
              intervals={state.hours
                .filter((h) => h.weekday === weekday)
                .map((h) => ({ open_minute: h.open_minute, close_minute: h.close_minute }))}
              onSave={replace}
            />
          ))}
        </section>
      )}
    </div>
  );
}
