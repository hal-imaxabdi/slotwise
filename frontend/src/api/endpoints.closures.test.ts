import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './client.ts';
import {
  createUnavailablePeriod,
  deleteUnavailablePeriod,
  listUnavailablePeriods,
} from './endpoints.ts';

vi.mock('./client.ts');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(request).mockResolvedValue([]);
});

describe('listUnavailablePeriods', () => {
  it('GETs with no query string by default and passes the signal', async () => {
    const controller = new AbortController();
    await listUnavailablePeriods({}, controller.signal);
    expect(request).toHaveBeenCalledWith('/staff/unavailable-periods', {
      signal: controller.signal,
    });
  });

  it('sends from, to, limit and offset, including offset 0', async () => {
    await listUnavailablePeriods({
      from: '2026-11-01',
      to: '2026-11-30',
      limit: 50,
      offset: 0,
    });
    expect(request).toHaveBeenCalledWith(
      '/staff/unavailable-periods?from=2026-11-01&to=2026-11-30&limit=50&offset=0',
      { signal: undefined },
    );
  });
});

describe('createUnavailablePeriod', () => {
  it('POSTs the input and returns the created period', async () => {
    const input = {
      starts_at: '2026-11-02T02:00:00.000Z',
      ends_at: '2026-11-02T05:00:00.000Z',
      reason: 'Holiday',
    };
    const created = { id: 'p1', created_by_id: 'u1', ...input };
    vi.mocked(request).mockResolvedValue(created);
    await expect(createUnavailablePeriod(input)).resolves.toEqual(created);
    expect(request).toHaveBeenCalledWith('/staff/unavailable-periods', {
      method: 'POST',
      body: input,
    });
  });
});

describe('deleteUnavailablePeriod', () => {
  it('DELETEs the encoded id', async () => {
    vi.mocked(request).mockResolvedValue(undefined);
    await deleteUnavailablePeriod('a/b');
    expect(request).toHaveBeenCalledWith('/staff/unavailable-periods/a%2Fb', {
      method: 'DELETE',
    });
  });
});
