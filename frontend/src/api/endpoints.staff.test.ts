import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './client.ts';
import { listStaffAppointments } from './endpoints.ts';

vi.mock('./client.ts');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(request).mockResolvedValue([]);
});

describe('listStaffAppointments', () => {
  it('sends every filter as a query parameter', async () => {
    const controller = new AbortController();
    await listStaffAppointments(
      { from: '2026-10-28', to: '2026-10-29', status: 'booked', limit: 21, offset: 40 },
      controller.signal,
    );
    expect(request).toHaveBeenCalledWith(
      '/staff/appointments?from=2026-10-28&to=2026-10-29&status=booked&limit=21&offset=40',
      { signal: controller.signal },
    );
  });

  it('leaves out empty filters', async () => {
    const controller = new AbortController();
    await listStaffAppointments(
      { from: '', to: '', status: '', limit: 21, offset: 0 },
      controller.signal,
    );
    expect(request).toHaveBeenCalledWith('/staff/appointments?limit=21&offset=0', {
      signal: controller.signal,
    });
  });
});
