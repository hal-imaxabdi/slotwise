import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSlots, rescheduleAppointment } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment, Slot, SlotsResponse } from '../api/types.ts';
import { formatAppointmentRange } from '../lib/dates.ts';
import { RescheduleForm } from './RescheduleForm.tsx';

vi.mock('../api/endpoints.ts');

const APPOINTMENT: Appointment = {
  id: 'appt-1',
  service_id: 's1',
  starts_at: '2035-03-05T03:00:00Z',
  ends_at: '2035-03-05T03:30:00Z',
  status: 'booked',
  notes: '',
  cancelled_at: null,
};

const SLOT_A: Slot = { starts_at: '2035-03-05T02:00:00Z', local_time: '09:00' };
const SLOT_CURRENT: Slot = { starts_at: '2035-03-05T03:00:00Z', local_time: '10:00' };
const SLOT_C: Slot = { starts_at: '2035-03-05T04:00:00Z', local_time: '11:00' };

const RESPONSE: SlotsResponse = {
  service_id: 's1',
  date: '2035-03-05',
  timezone: 'Asia/Jakarta',
  duration_minutes: 30,
  slots: [SLOT_A, SLOT_CURRENT, SLOT_C],
};

const OLD_RANGE = formatAppointmentRange(APPOINTMENT.starts_at, APPOINTMENT.ends_at);
const NEW_RANGE = formatAppointmentRange(SLOT_C.starts_at, '2035-03-05T04:30:00Z');

function renderForm() {
  const props = {
    appointment: APPOINTMENT,
    serviceName: 'Classic Haircut',
    onRescheduled: vi.fn(),
    onClose: vi.fn(),
    onTooLate: vi.fn(),
    onGone: vi.fn(),
    onBusyChange: vi.fn(),
  };
  render(<RescheduleForm {...props} />);
  return props;
}

async function pickAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '11:00' }));
  await user.click(screen.getByRole('button', { name: 'Confirm new time' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSlots).mockResolvedValue(RESPONSE);
});

describe('RescheduleForm', () => {
  it('starts on the appointment date and loads times for its service', async () => {
    renderForm();
    const dateInput = screen.getByLabelText('New date');
    expect(dateInput).toHaveValue('2035-03-05');
    expect(dateInput).toHaveAttribute('min');
    expect(screen.getByText(`Current time: ${OLD_RANGE}`)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument();
    expect(getSlots).toHaveBeenCalledWith('s1', '2035-03-05', expect.anything());
  });

  it('shows the new time after a pick and sends it on confirm', async () => {
    const updated: Appointment = {
      ...APPOINTMENT,
      starts_at: SLOT_C.starts_at,
      ends_at: '2035-03-05T04:30:00Z',
    };
    vi.mocked(rescheduleAppointment).mockResolvedValue(updated);
    const user = userEvent.setup();
    const props = renderForm();
    await user.click(await screen.findByRole('button', { name: '11:00' }));
    expect(screen.getByText(`New time: ${NEW_RANGE}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm new time' }));
    await waitFor(() => {
      expect(props.onRescheduled).toHaveBeenCalledWith(updated);
    });
    expect(rescheduleAppointment).toHaveBeenCalledTimes(1);
    expect(rescheduleAppointment).toHaveBeenCalledWith('appt-1', SLOT_C.starts_at);
    await waitFor(() => {
      expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    });
  });

  it('reloads the times and clears the selection when the date changes', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    expect(screen.getByRole('button', { name: 'Confirm new time' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New date'), { target: { value: '2035-03-06' } });
    expect(screen.queryByRole('button', { name: 'Confirm new time' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(getSlots).toHaveBeenLastCalledWith('s1', '2035-03-06', expect.anything());
    });
    expect(await screen.findByRole('button', { name: '09:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(getSlots).toHaveBeenCalledTimes(2);
  });

  it('refuses to confirm the current time', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(await screen.findByRole('button', { name: '10:00' }));
    expect(
      screen.getByText('That is already your current time. Choose a different one.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm new time' })).not.toBeInTheDocument();
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });

  it('on 409 shows the message, reloads the times and clears the selection', async () => {
    vi.mocked(rescheduleAppointment).mockRejectedValue(
      new ApiError(409, 'That time slot is no longer available', null),
    );
    const user = userEvent.setup();
    const props = renderForm();
    await pickAndConfirm(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That time slot is no longer available',
    );
    await waitFor(() => {
      expect(getSlots).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('button', { name: '11:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Confirm new time' })).not.toBeInTheDocument();
    expect(props.onTooLate).not.toHaveBeenCalled();
    expect(props.onGone).not.toHaveBeenCalled();
  });

  it('on 403 hands the server message to onTooLate', async () => {
    const message = 'Appointments can only be changed at least 24 hours in advance';
    vi.mocked(rescheduleAppointment).mockRejectedValue(new ApiError(403, message, null));
    const user = userEvent.setup();
    const props = renderForm();
    await pickAndConfirm(user);
    await waitFor(() => {
      expect(props.onTooLate).toHaveBeenCalledWith(message);
    });
    expect(props.onGone).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('on 404 hands the server message to onGone', async () => {
    vi.mocked(rescheduleAppointment).mockRejectedValue(
      new ApiError(404, 'Appointment not found', null),
    );
    const user = userEvent.setup();
    const props = renderForm();
    await pickAndConfirm(user);
    await waitFor(() => {
      expect(props.onGone).toHaveBeenCalledWith('Appointment not found');
    });
    expect(props.onTooLate).not.toHaveBeenCalled();
  });

  it('keeps the selection and allows a retry after a network failure', async () => {
    vi.mocked(rescheduleAppointment).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    const props = renderForm();
    await pickAndConfirm(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.getByRole('button', { name: 'Confirm new time' })).toBeEnabled();
    expect(rescheduleAppointment).toHaveBeenCalledTimes(1);
    expect(props.onTooLate).not.toHaveBeenCalled();
    expect(props.onGone).not.toHaveBeenCalled();
  });

  it('blocks a second submit and locks the form while one is in flight', async () => {
    vi.mocked(rescheduleAppointment).mockReturnValue(new Promise<Appointment>(() => undefined));
    const user = userEvent.setup();
    const props = renderForm();
    await pickAndConfirm(user);
    const busy = await screen.findByRole('button', { name: 'Rescheduling...' });
    expect(busy).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep current time' })).toBeDisabled();
    expect(screen.getByLabelText('New date')).toBeDisabled();
    expect(screen.getByRole('button', { name: '09:00' })).toBeDisabled();
    await user.click(busy);
    expect(rescheduleAppointment).toHaveBeenCalledTimes(1);
    expect(props.onBusyChange).toHaveBeenCalledWith(true);
  });

  it('calls onClose from Keep current time', async () => {
    const user = userEvent.setup();
    const props = renderForm();
    await user.click(screen.getByRole('button', { name: 'Keep current time' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
