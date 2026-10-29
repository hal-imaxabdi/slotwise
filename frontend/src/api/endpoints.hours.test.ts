import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './client.ts';
import { listBusinessHours, replaceBusinessHours } from './endpoints.ts';

vi.mock('./client.ts');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(request).mockResolvedValue([]);
});

describe('listBusinessHours', () => {
  it('GETs the whole week and passes the abort signal', async () => {
    const controller = new AbortController();
    await listBusinessHours(controller.signal);
    expect(request).toHaveBeenCalledWith('/admin/business-hours', {
      signal: controller.signal,
    });
  });
});

describe('replaceBusinessHours', () => {
  it('PUTs the intervals to the weekday route', async () => {
    const intervals = [
      { open_minute: 540, close_minute: 720 },
      { open_minute: 780, close_minute: 1020 },
    ];
    await replaceBusinessHours(2, { intervals });
    expect(request).toHaveBeenCalledWith('/admin/business-hours/2', {
      method: 'PUT',
      body: { intervals },
    });
  });

  it('sends an empty list to close the day, including weekday 0', async () => {
    await replaceBusinessHours(0, { intervals: [] });
    expect(request).toHaveBeenCalledWith('/admin/business-hours/0', {
      method: 'PUT',
      body: { intervals: [] },
    });
  });

  it('returns the whole week from the server', async () => {
    const week = [{ id: 'h1', weekday: 1, open_minute: 540, close_minute: 1020 }];
    vi.mocked(request).mockResolvedValue(week);
    await expect(replaceBusinessHours(1, { intervals: [] })).resolves.toEqual(week);
  });
});
