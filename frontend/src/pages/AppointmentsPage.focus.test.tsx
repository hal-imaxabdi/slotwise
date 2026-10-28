import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelAppointment,
  getSlots,
  listMyAppointments,
  listServices,
} from '../api/endpoints.ts';
import { AppointmentsPage } from './AppointmentsPage.tsx';

vi.mock('../api/endpoints.ts');

type Services = Awaited<ReturnType<typeof listServices>>;
type Appointments = Awaited<ReturnType<typeof listMyAppointments>>;
type Slots = Awaited<ReturnType<typeof getSlots>>;

const HOUR = 3_600_000;

function makeServices(): Services {
  return [
    { id: 'svc-1', name: 'Classic Haircut', duration_minutes: 30, price_idr: 75000 },
  ] as unknown as Services;
}

// Starts 72 hours from now, well outside the 24-hour change window.
function makeAppointments(): Appointments {
  const start = Date.now() + 72 * HOUR;
  return [
    {
      id: 'appt-1',
      service_id: 'svc-1',
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(start + HOUR / 2).toISOString(),
      status: 'booked',
      notes: '',
    },
  ] as unknown as Appointments;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AppointmentsPage />
    </MemoryRouter>,
  );
}

describe('AppointmentsPage focus management', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listServices).mockResolvedValue(makeServices());
    vi.mocked(listMyAppointments).mockResolvedValue(makeAppointments());
    vi.mocked(getSlots).mockResolvedValue({
      service_id: 'svc-1',
      date: '2035-01-01',
      timezone: 'Asia/Jakarta',
      duration_minutes: 30,
      slots: [],
    } as unknown as Slots);
  });

  it('moves focus into the cancel confirmation and back to Cancel on Keep', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /^Cancel Classic Haircut on/ }));
    expect(
      screen.getByRole('group', { name: 'Confirm cancellation of Classic Haircut' }),
    ).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Keep appointment' }));
    expect(screen.getByRole('button', { name: /^Cancel Classic Haircut on/ })).toHaveFocus();
  });

  it('moves focus to the new date when rescheduling opens and back to Reschedule on close', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /^Reschedule Classic Haircut on/ }));
    expect(await screen.findByLabelText('New date')).toHaveFocus();
    await screen.findByText('No times are available on this date.');
    await user.click(screen.getByRole('button', { name: 'Keep current time' }));
    expect(screen.getByRole('button', { name: /^Reschedule Classic Haircut on/ })).toHaveFocus();
  });

  it('moves focus to the page heading after a successful cancel', async () => {
    const user = userEvent.setup();
    const [first] = makeAppointments();
    vi.mocked(cancelAppointment).mockResolvedValue({
      ...first,
      status: 'cancelled',
    } as unknown as Appointments[number]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: /^Cancel Classic Haircut on/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));
    await screen.findByText('Appointment cancelled.');
    expect(screen.getByRole('heading', { level: 1, name: 'My appointments' })).toHaveFocus();
  });
});
