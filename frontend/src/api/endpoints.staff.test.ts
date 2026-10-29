import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './client.ts';
import { completeAppointment, listStaffAppointments, markNoShow } from './endpoints.ts';

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

describe('staff status changes', () => {
  it('POSTs to the complete route with the id encoded', async () => {
    await completeAppointment('a/1');
    expect(request).toHaveBeenCalledWith('/staff/appointments/a%2F1/complete', {
      method: 'POST',
    });
  });

  it('POSTs to the no-show route', async () => {
    await markNoShow('a1');
    expect(request).toHaveBeenCalledWith('/staff/appointments/a1/no-show', { method: 'POST' });
  });
});
