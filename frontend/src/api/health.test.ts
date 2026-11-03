import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './client.ts';
import { ApiError, NetworkError, NotFoundError } from './errors.ts';
import { pingHealth, waitForServer } from './health.ts';

vi.mock('./client.ts');

const FAST = { timeoutMs: 1000, retryDelayMs: 1 };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('waitForServer', () => {
  it('resolves as soon as /health answers', async () => {
    vi.mocked(request).mockResolvedValueOnce({ status: 'ok' });
    await waitForServer(undefined, FAST);
    expect(request).toHaveBeenCalledTimes(1);
    expect(vi.mocked(request).mock.calls[0][0]).toBe('/health');
  });

  it('retries while the host is still booting', async () => {
    vi.mocked(request)
      .mockRejectedValueOnce(new NetworkError())
      .mockRejectedValueOnce(new ApiError(502, 'Bad gateway'))
      .mockRejectedValueOnce(new ApiError(503, 'Unavailable'))
      .mockResolvedValueOnce({ status: 'ok' });
    await waitForServer(undefined, FAST);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('does not retry an answer that is not about waking up', async () => {
    vi.mocked(request).mockRejectedValueOnce(new NotFoundError('Not found'));
    await waitForServer(undefined, FAST);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('gives up quietly after the timeout', async () => {
    vi.mocked(request).mockRejectedValue(new NetworkError());
    await expect(waitForServer(undefined, { timeoutMs: 30, retryDelayMs: 10 })).resolves.toBe(
      undefined,
    );
    expect(vi.mocked(request).mock.calls.length).toBeLessThan(10);
  });

  it('stops when aborted', async () => {
    vi.mocked(request).mockRejectedValue(new NetworkError());
    const controller = new AbortController();
    const waiting = waitForServer(controller.signal, { timeoutMs: 60_000, retryDelayMs: 50 });
    controller.abort();
    await expect(waiting).resolves.toBe(undefined);
  });
});

describe('pingHealth', () => {
  it('ignores failures', async () => {
    vi.mocked(request).mockRejectedValueOnce(new NetworkError());
    expect(() => {
      pingHealth();
    }).not.toThrow();
    await Promise.resolve();
  });
});
