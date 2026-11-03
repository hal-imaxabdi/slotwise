import { useEffect, useState } from 'react';

/** After this long a request is probably waiting for the API host to wake up. */
export const SLOW_AFTER_MS = 2500;

/** True once `active` has stayed true for `delayMs`; false again as soon as it stops. */
export function useSlowFlag(active: boolean, delayMs = SLOW_AFTER_MS): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setTimeout(() => {
      setSlow(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active, delayMs]);

  return active && slow;
}
