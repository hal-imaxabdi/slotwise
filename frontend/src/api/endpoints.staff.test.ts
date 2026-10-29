import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './client.ts';
import {
  completeAppointment,
  createStaffAppointment,
  listStaffAppointments,
  markNoShow,
  searchCustomers,
} from './endpoints.ts';

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

describe('searchCustomers', () => {
  it('sends the query and a limit, encoded', async () => {
    const controller = new AbortController();
    await searchCustomers('a b&c', controller.signal);
    expect(request).toHaveBeenCalledWith('/staff/customers?q=a+b%26c&limit=20', {
      signal: controller.signal,
    });
  });

  it('leaves out q when the query is empty', async () => {
    await searchCustomers('');
    expect(request).toHaveBeenCalledWith('/staff/customers?limit=20', { signal: undefined });
  });
});

describe('createStaffAppointment', () => {
  it('POSTs the booking details to /staff/appointments', async () => {
    const input = {
      customer_id: 'c1',
      service_id: 's1',
      starts_at: '2026-11-02T02:30:00Z',
      notes: 'hi',
    };
    await createStaffAppointment(input);
    expect(request).toHaveBeenCalledWith('/staff/appointments', {
      method: 'POST',
      body: input,
    });
  });
});
