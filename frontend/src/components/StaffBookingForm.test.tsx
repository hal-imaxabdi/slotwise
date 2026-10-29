import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaffAppointment, getSlots, searchCustomers } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment, Service, SlotsResponse } from '../api/types.ts';
import { StaffBookingForm } from './StaffBookingForm.tsx';

vi.mock('../api/endpoints.ts');

const SERVICES: Service[] = [
  { id: 's1', name: 'Haircut', description: '', duration_minutes: 30, price_idr: 50000 },
];
const SLOTS: SlotsResponse = {
  service_id: 's1',
  date: '2026-11-02',
  timezone: 'Asia/Jakarta',
  duration_minutes: 30,
  slots: [{ starts_at: '2026-11-02T02:30:00Z', local_time: '09:30' }],
};
const CREATED: Appointment = {
  id: 'a1',
  service_id: 's1',
  starts_at: '2026-11-02T02:30:00Z',
  ends_at: '2026-11-02T03:00:00Z',
  status: 'booked',
  notes: '',
  cancelled_at: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(searchCustomers).mockResolvedValue([
    { id: 'c1', email: 'alice@example.com', full_name: 'Alice Wong' },
  ]);
  vi.mocked(getSlots).mockResolvedValue(SLOTS);
});

async function fillBooking(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Search' }));
  await user.click(await screen.findByRole('button', { name: /Alice Wong/ }));
  await user.selectOptions(screen.getByLabelText('Service'), 's1');
  await user.click(await screen.findByRole('button', { name: '09:30' }));
}

describe('StaffBookingForm', () => {
  it('cannot be submitted before a customer and a time are chosen', () => {
    render(<StaffBookingForm services={SERVICES} onBooked={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Book appointment' })).toBeDisabled();
  });

  it('books for the chosen customer and reports success', async () => {
    const user = userEvent.setup();
    const onBooked = vi.fn();
    vi.mocked(createStaffAppointment).mockResolvedValue(CREATED);
    render(<StaffBookingForm services={SERVICES} onBooked={onBooked} />);

    await fillBooking(user);
    await user.click(screen.getByRole('button', { name: 'Book appointment' }));

    await waitFor(() => {
      expect(createStaffAppointment).toHaveBeenCalledWith({
        customer_id: 'c1',
        service_id: 's1',
        starts_at: '2026-11-02T02:30:00Z',
        notes: '',
      });
    });
    expect(await screen.findByText(/Booked Haircut for Alice Wong/)).toBeInTheDocument();
    expect(onBooked).toHaveBeenCalledTimes(1);
  });

  it('shows the message and reloads the times on a 409', async () => {
    const user = userEvent.setup();
    vi.mocked(createStaffAppointment).mockRejectedValue(
      new ApiError(409, 'That time slot is no longer available', null),
    );
    render(<StaffBookingForm services={SERVICES} onBooked={vi.fn()} />);

    await fillBooking(user);
    await user.click(screen.getByRole('button', { name: 'Book appointment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no longer available');
    await waitFor(() => {
      expect(getSlots).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('button', { name: 'Book appointment' })).toBeDisabled();
  });
});
