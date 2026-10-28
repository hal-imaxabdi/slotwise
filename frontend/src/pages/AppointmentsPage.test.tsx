import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelAppointment,
  getSlots,
  listMyAppointments,
  listServices,
  rescheduleAppointment,
} from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment, Service, SlotsResponse } from '../api/types.ts';
import { formatAppointmentRange } from '../lib/dates.ts';
import { AppointmentsPage } from './AppointmentsPage.tsx';

vi.mock('../api/endpoints.ts');

const HOUR = 3_600_000;
const HINT =
  'Appointments can only be cancelled or rescheduled at least 24 hours before they start.';
const TOO_LATE = 'Appointments can only be changed at least 24 hours in advance';

const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Classic Haircut',
    description: 'A classic cut.',
    duration_minutes: 30,
    price_idr: 75000,
  },
];

const SLOTS: SlotsResponse = {
  service_id: 's1',
  date: '2035-01-01',
  timezone: 'Asia/Jakarta',
  duration_minutes: 30,
  slots: [{ starts_at: '2035-01-01T02:00:00Z', local_time: '09:00' }],
};

function at(hours: number): string {
  return new Date(Date.now() + hours * HOUR).toISOString();
}

function make(id: string, startHours: number, overrides: Partial<Appointment> = {}): Appointment {
  return {
    id,
    service_id: 's1',
    starts_at: at(startHours),
    ends_at: at(startHours + 0.5),
    status: 'booked',
    notes: '',
    cancelled_at: null,
    ...overrides,
  };
}

const FAR = make('far', 72);
const NEAR = make('near', 2);
const PAST = make('past', -48, { status: 'completed' });
const CANCELLED = make('cancelled', 96, { status: 'cancelled', cancelled_at: at(-1) });
const MOVED: Appointment = {
  ...FAR,
  starts_at: '2035-01-01T02:00:00Z',
  ends_at: '2035-01-01T02:30:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/appointments']}>
      <AppointmentsPage />
    </MemoryRouter>,
  );
}

async function upcomingItems() {
  const region = await screen.findByRole('region', { name: 'Upcoming' });
  return within(region).getAllByRole('listitem');
}

async function openReschedule(user: ReturnType<typeof userEvent.setup>) {
  const up = await upcomingItems();
  await user.click(within(up[0]).getByRole('button', { name: /^Reschedule / }));
}

async function pickAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '09:00' }));
  await user.click(screen.getByRole('button', { name: 'Confirm new time' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listServices).mockResolvedValue(SERVICES);
  vi.mocked(getSlots).mockResolvedValue(SLOTS);
});

describe('AppointmentsPage', () => {
  it('lists upcoming soonest first and history newest first with status labels', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR, PAST, NEAR, CANCELLED]);
    renderPage();
    const up = await upcomingItems();
    expect(up).toHaveLength(2);
    expect(up[0]).toHaveTextContent(formatAppointmentRange(NEAR.starts_at, NEAR.ends_at));
    expect(up[0]).toHaveTextContent('Classic Haircut');
    expect(up[1]).toHaveTextContent(formatAppointmentRange(FAR.starts_at, FAR.ends_at));
    const hist = within(screen.getByRole('region', { name: 'Past and cancelled' })).getAllByRole(
      'listitem',
    );
    expect(hist).toHaveLength(2);
    expect(hist[0]).toHaveTextContent(
      formatAppointmentRange(CANCELLED.starts_at, CANCELLED.ends_at),
    );
    expect(hist[0]).toHaveTextContent('Status: Cancelled');
    expect(hist[1]).toHaveTextContent('Status: Completed');
  });

  it('shows an empty state with a link to the services', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('You have no appointments yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse services' })).toHaveAttribute(
      'href',
      '/services',
    );
  });

  it('shows an error and recovers with Try again', async () => {
    vi.mocked(listMyAppointments).mockRejectedValueOnce(new Error('boom')).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('You have no appointments yet.')).toBeInTheDocument();
    expect(listMyAppointments).toHaveBeenCalledTimes(2);
  });

  it('handles an appointment whose service is no longer listed', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([make('orphan', 120, { service_id: 'gone' })]);
    renderPage();
    const up = await upcomingItems();
    expect(up[0]).toHaveTextContent('Service no longer available');
    expect(within(up[0]).queryByRole('button', { name: /^Reschedule / })).not.toBeInTheDocument();
  });

  it('disables Cancel and Reschedule with an explanation inside the 24-hour window', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR, NEAR]);
    renderPage();
    const up = await upcomingItems();
    const nearCancel = within(up[0]).getByRole('button', { name: /^Cancel / });
    expect(nearCancel).toBeDisabled();
    expect(within(up[0]).getByText(HINT)).toBeInTheDocument();
    expect(nearCancel).toHaveAccessibleDescription(HINT);
    const nearReschedule = within(up[0]).getByRole('button', { name: /^Reschedule / });
    expect(nearReschedule).toBeDisabled();
    expect(nearReschedule).toHaveAccessibleDescription(HINT);
    expect(within(up[1]).getByRole('button', { name: /^Cancel / })).toBeEnabled();
    expect(within(up[1]).getByRole('button', { name: /^Reschedule / })).toBeEnabled();
  });

  it('asks for confirmation, lets the user keep it, then cancels', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR, NEAR]);
    vi.mocked(cancelAppointment).mockResolvedValue({
      ...FAR,
      status: 'cancelled',
      cancelled_at: at(0),
    });
    const user = userEvent.setup();
    renderPage();

    let up = await upcomingItems();
    await user.click(within(up[1]).getByRole('button', { name: /^Cancel / }));
    expect(screen.getByText('Cancel this appointment?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep appointment' }));
    expect(screen.queryByText('Cancel this appointment?')).not.toBeInTheDocument();
    expect(cancelAppointment).not.toHaveBeenCalled();

    up = await upcomingItems();
    await user.click(within(up[1]).getByRole('button', { name: /^Cancel / }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));

    expect(await screen.findByText('Appointment cancelled.')).toBeInTheDocument();
    expect(cancelAppointment).toHaveBeenCalledTimes(1);
    expect(cancelAppointment).toHaveBeenCalledWith('far');
    expect(await upcomingItems()).toHaveLength(1);
    const hist = within(screen.getByRole('region', { name: 'Past and cancelled' })).getAllByRole(
      'listitem',
    );
    expect(hist).toHaveLength(1);
    expect(hist[0]).toHaveTextContent('Status: Cancelled');
    expect(listMyAppointments).toHaveBeenCalledTimes(1);
  });

  it('blocks a second cancel while the first is in flight', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR]);
    vi.mocked(cancelAppointment).mockReturnValue(new Promise<Appointment>(() => undefined));
    const user = userEvent.setup();
    renderPage();
    const up = await upcomingItems();
    await user.click(within(up[0]).getByRole('button', { name: /^Cancel / }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));
    const busy = await screen.findByRole('button', { name: 'Cancelling...' });
    expect(busy).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep appointment' })).toBeDisabled();
    await user.click(busy);
    expect(cancelAppointment).toHaveBeenCalledTimes(1);
  });

  it('shows the server message on 403 without reloading or signing out', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR]);
    vi.mocked(cancelAppointment).mockRejectedValue(new ApiError(403, TOO_LATE, null));
    const user = userEvent.setup();
    renderPage();
    const up = await upcomingItems();
    await user.click(within(up[0]).getByRole('button', { name: /^Cancel / }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TOO_LATE);
    expect(screen.queryByText('Cancel this appointment?')).not.toBeInTheDocument();
    expect(await upcomingItems()).toHaveLength(1);
    expect(listMyAppointments).toHaveBeenCalledTimes(1);
  });

  it.each([
    [404, 'Appointment not found'],
    [409, 'That appointment can no longer be cancelled'],
  ])('on %i shows the message and reloads the list', async (status, message) => {
    vi.mocked(listMyAppointments).mockResolvedValueOnce([FAR]).mockResolvedValueOnce([]);
    vi.mocked(cancelAppointment).mockRejectedValue(new ApiError(status, message, null));
    const user = userEvent.setup();
    renderPage();
    const up = await upcomingItems();
    await user.click(within(up[0]).getByRole('button', { name: /^Cancel / }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(await screen.findByText('You have no appointments yet.')).toBeInTheDocument();
    expect(listMyAppointments).toHaveBeenCalledTimes(2);
  });

  it('keeps the confirmation open and allows a retry after a network failure', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR]);
    vi.mocked(cancelAppointment).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderPage();
    const up = await upcomingItems();
    await user.click(within(up[0]).getByRole('button', { name: /^Cancel / }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.getByRole('button', { name: 'Yes, cancel appointment' })).toBeEnabled();
    expect(cancelAppointment).toHaveBeenCalledTimes(1);
    expect(listMyAppointments).toHaveBeenCalledTimes(1);
  });

  it('aborts the appointments request on unmount', () => {
    vi.mocked(listMyAppointments).mockReturnValue(new Promise<Appointment[]>(() => undefined));
    const { unmount } = renderPage();
    unmount();
    expect(vi.mocked(listMyAppointments).mock.calls[0]?.[0]?.aborted).toBe(true);
  });

  it('opens the reschedule panel for an upcoming item and closes it again', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR]);
    const user = userEvent.setup();
    renderPage();
    await openReschedule(user);
    expect(screen.getByRole('group', { name: 'Reschedule Classic Haircut' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument();
    expect(getSlots).toHaveBeenCalledWith(
      's1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.anything(),
    );
    await user.click(screen.getByRole('button', { name: 'Keep current time' }));
    expect(
      screen.queryByRole('group', { name: 'Reschedule Classic Haircut' }),
    ).not.toBeInTheDocument();
    expect(rescheduleAppointment).not.toHaveBeenCalled();
  });

  it('reschedules and updates the item locally without reloading the list', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR]);
    vi.mocked(rescheduleAppointment).mockResolvedValue(MOVED);
    const user = userEvent.setup();
    renderPage();
    await openReschedule(user);
    await pickAndConfirm(user);
    expect(await screen.findByText('Appointment rescheduled.')).toBeInTheDocument();
    expect(rescheduleAppointment).toHaveBeenCalledWith('far', '2035-01-01T02:00:00Z');
    expect(
      screen.queryByRole('group', { name: 'Reschedule Classic Haircut' }),
    ).not.toBeInTheDocument();
    const up = await upcomingItems();
    expect(up).toHaveLength(1);
    expect(up[0]).toHaveTextContent(formatAppointmentRange(MOVED.starts_at, MOVED.ends_at));
    expect(listMyAppointments).toHaveBeenCalledTimes(1);
  });

  it('on 403 shows the server message, closes the panel and does not reload', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR]);
    vi.mocked(rescheduleAppointment).mockRejectedValue(new ApiError(403, TOO_LATE, null));
    const user = userEvent.setup();
    renderPage();
    await openReschedule(user);
    await pickAndConfirm(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(TOO_LATE);
    expect(
      screen.queryByRole('group', { name: 'Reschedule Classic Haircut' }),
    ).not.toBeInTheDocument();
    expect(await upcomingItems()).toHaveLength(1);
    expect(listMyAppointments).toHaveBeenCalledTimes(1);
  });

  it('on 404 shows the message, closes the panel and reloads the list', async () => {
    vi.mocked(listMyAppointments).mockResolvedValueOnce([FAR]).mockResolvedValueOnce([]);
    vi.mocked(rescheduleAppointment).mockRejectedValue(
      new ApiError(404, 'Appointment not found', null),
    );
    const user = userEvent.setup();
    renderPage();
    await openReschedule(user);
    await pickAndConfirm(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Appointment not found');
    expect(await screen.findByText('You have no appointments yet.')).toBeInTheDocument();
    expect(listMyAppointments).toHaveBeenCalledTimes(2);
  });
});
