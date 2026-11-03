import { request } from './client.ts';
import { ApiError, NetworkError } from './errors.ts';

const RETRY_DELAY_MS = 3000;
const WAKE_TIMEOUT_MS = 90_000;

/** GET /health. Also wakes the API host if it is sleeping (Render free tier). */
export function getHealth(signal?: AbortSignal): Promise<{ status: string }> {
  return request<{ status: string }>('/health', { signal });
}

/** Fire-and-forget wake-up call: failures are ignored. */
export function pingHealth(): void {
  getHealth().catch(() => undefined);
}

function isWakingUp(error: unknown): boolean {
  // While the host boots, the proxy answers 502/503/504 or the connection fails.
  return error instanceof NetworkError || (error instanceof ApiError && error.status >= 500);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Resolve once the API answers /health, retrying while it is still booting.
 * Resolves (without throwing) after the timeout too: the caller's real request then
 * reports the error the normal way.
 */
export async function waitForServer(
  signal?: AbortSignal,
  { timeoutMs = WAKE_TIMEOUT_MS, retryDelayMs = RETRY_DELAY_MS } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (signal?.aborted !== true) {
    try {
      await getHealth(signal);
      return;
    } catch (error) {
      if (!isWakingUp(error) || Date.now() + retryDelayMs > deadline) {
        return;
      }
    }
    await sleep(retryDelayMs, signal);
  }
}
