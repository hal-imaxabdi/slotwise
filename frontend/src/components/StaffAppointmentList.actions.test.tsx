import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelAppointment,
  completeAppointment,
  getSlots,
  listServices,
  listStaffAppointments,
  markNoShow,
} from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment, Service, StaffAppointment } from '../api/types.ts';
import { StaffPage } from '../pages/StaffPage.tsx';

vi.mock('../api/endpoints.ts');

type Slots = Awaited<ReturnType<typeof getSlots>>;

const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Classic Haircut',
    description: 'A classic cut.',
    duration_minutes: 30,
    price_idr: 75000,
  },
];

const FUTURE = { starts_at: '2035-01-01T02:00:00Z', ends_at: '2035-01-01T02:30:00Z' };
const PAST = { starts_at: '2020-01-01T02:00:00Z', ends_at: '2020-01-01T02:30:00Z' };

function make(id: string, overrides: Partial<StaffAppointment> = {}): StaffAppointment {
  return {
    id,
    service_id: 's1',
    ...FUTURE,
    status: 'booked',
    notes: '',
    cancelled_at: null,
    customer_id: 'c1',
    created_by_id: 'c1',
    customer_email: 'ayu@example.com',
    customer_name: 'Ayu Lestari',
    ...overrides,
  };
}

// What cancel/complete/no-show return: appointment fields only, no customer name or email.
function serverCopy(a: StaffAppointment, overrides: Partial<Appointment>): Appointment {
  return {
    id: a.id,
    service_id: a.service_id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: a.status,
    notes: a.notes,
    cancelled_at: a.cancelled_at,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listServices).mockResolvedValue(SERVICES);
  vi.mocked(getSlots).mockResolvedValue({
    service_id: 's1',
    date: '2035-01-01',
    timezone: 'Asia/Jakarta',
    duration_minutes: 30,
    slots: [],
  } as unknown as Slots);
});

describe('StaffAppointmentList actions', () => {
  it('offers Cancel and Reschedule, but not Complete or No-show, before the start time', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([make('a1')]);
    render(<StaffPage />);
    expect(
      await screen.findByRole('button', { name: /^Cancel appointment for Ayu Lestari/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reschedule appointment for/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Complete appointment/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mark no-show/ })).not.toBeInTheDocument();
  });

  it('offers Complete and Mark no-show only for booked appointments that have started', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([
      make('p1', PAST),
      make('p2', { ...PAST, status: 'completed', customer_name: 'Budi Santoso' }),
    ]);
    render(<StaffPage />);
    expect(
      await screen.findByRole('button', { name: /^Complete appointment for Ayu Lestari/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Mark no-show for Ayu Lestari/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Budi Santoso/ })).not.toBeInTheDocument();
  });

  it('cancels after confirmation, keeps the customer details and moves focus to the heading', async () => {
    const row = make('a1');
    vi.mocked(listStaffAppointments).mockResolvedValue([row]);
    vi.mocked(cancelAppointment).mockResolvedValue(
      serverCopy(row, { status: 'cancelled', cancelled_at: '2034-12-31T00:00:00Z' }),
    );
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(
      await screen.findByRole('button', { name: /^Cancel appointment for Ayu Lestari/ }),
    );
    expect(
      screen.getByRole('group', { name: 'Confirm cancellation for Ayu Lestari' }),
    ).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));
    expect(await screen.findByText('Appointment cancelled.')).toBeInTheDocument();
    expect(cancelAppointment).toHaveBeenCalledWith('a1');
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('Status: Cancelled')).toBeInTheDocument();
    expect(within(item).getByText('Ayu Lestari')).toBeInTheDocument();
    expect(within(item).getByText('ayu@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancel appointment/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Appointments', level: 2 })).toHaveFocus();
  });

  it('returns focus to Cancel and sends nothing when the confirmation is dismissed', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([make('a1')]);
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(
      await screen.findByRole('button', { name: /^Cancel appointment for Ayu Lestari/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Keep appointment' }));
    expect(screen.getByRole('button', { name: /^Cancel appointment for Ayu Lestari/ })).toHaveFocus();
    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it('marks an appointment completed and keeps the customer details', async () => {
    const row = make('p1', PAST);
    vi.mocked(listStaffAppointments).mockResolvedValue([row]);
    vi.mocked(completeAppointment).mockResolvedValue(serverCopy(row, { status: 'completed' }));
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(
      await screen.findByRole('button', { name: /^Complete appointment for Ayu Lestari/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Yes, mark completed' }));
    expect(await screen.findByText('Appointment marked as completed.')).toBeInTheDocument();
    expect(completeAppointment).toHaveBeenCalledWith('p1');
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('Status: Completed')).toBeInTheDocument();
    expect(within(item).getByText('ayu@example.com')).toBeInTheDocument();
  });

  it('shows the server message and refetches the list on a 409', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([make('p1', PAST)]);
    vi.mocked(markNoShow).mockRejectedValue(
      new ApiError(409, 'Appointment can no longer be changed', null),
    );
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByRole('button', { name: /^Mark no-show for Ayu Lestari/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, mark no-show' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Appointment can no longer be changed',
    );
    await waitFor(() => {
      expect(listStaffAppointments).toHaveBeenCalledTimes(2);
    });
        expect(
      screen.queryByRole('group', { name: /^Confirm no-show for/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the message on a 403 without refetching or logging out', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([make('a1')]);
    vi.mocked(cancelAppointment).mockRejectedValue(new ApiError(403, 'Forbidden', null));
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(
      await screen.findByRole('button', { name: /^Cancel appointment for Ayu Lestari/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(listStaffAppointments).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Ayu Lestari')).toBeInTheDocument();
  });

  it('sends only one request when the confirm button is clicked twice', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([make('a1')]);
    vi.mocked(cancelAppointment).mockReturnValue(new Promise<Appointment>(() => undefined));
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(
      await screen.findByRole('button', { name: /^Cancel appointment for Ayu Lestari/ }),
    );
    const yes = screen.getByRole('button', { name: 'Yes, cancel appointment' });
    await user.click(yes);
    await user.click(yes);
    expect(cancelAppointment).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancelling...' })).toBeDisabled();
  });

  it('opens the reschedule form with focus on the date and returns focus on close', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([make('a1')]);
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(
      await screen.findByRole('button', { name: /^Reschedule appointment for Ayu Lestari/ }),
    );
    expect(await screen.findByLabelText('New date')).toHaveFocus();
    await screen.findByText('No times are available on this date.');
    await user.click(screen.getByRole('button', { name: 'Keep current time' }));
    expect(
      screen.getByRole('button', { name: /^Reschedule appointment for Ayu Lestari/ }),
    ).toHaveFocus();
  });

  it('does not offer Reschedule when the service is inactive', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([make('a1', { service_id: 'gone' })]);
    render(<StaffPage />);
    expect(
      await screen.findByRole('button', { name: /^Cancel appointment for Ayu Lestari/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reschedule/ })).not.toBeInTheDocument();
  });
});
