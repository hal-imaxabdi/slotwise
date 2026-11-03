import { useSlowFlag } from '../hooks/useSlowFlag.ts';

export const WAKING_MESSAGE = 'Waking up the server, this can take up to a minute…';

/** Full-page loading state. If it takes long, explains the free-tier cold start. */
export function LoadingScreen({ label = 'Loading...' }: { label?: string }) {
  const slow = useSlowFlag(true);
  return (
    <div role="status" className="loading-screen">
      <p className="loading loading--page">{label}</p>
      {slow && <p className="loading-hint">{WAKING_MESSAGE}</p>}
    </div>
  );
}
