import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelAppointment, listMyAppointments, listServices } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Appointment, Service } from '../api/types.ts';
import { formatAppointmentRange } from '../lib/dates.ts';
import { AppointmentsPage } from './AppointmentsPage.tsx';

vi.mock('../api/endpoints.ts');

const HOUR = 3_600_000;
const HINT = 'Appointments can only be cancelled at least 24 hours before they start.';

const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Classic Haircut',
    description: 'A classic cut.',
    duration_minutes: 30,
    price_idr: 75000,
  },
];

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

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listServices).mockResolvedValue(SERVICES);
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
    expect(hist[0]).toHaveTextContent(formatAppointmentRange(CANCELLED.starts_at, CANCELLED.ends_at));
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
    vi.mocked(listMyAppointments)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue([]);
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
  });

  it('disables Cancel with an explanation inside the 24-hour window', async () => {
    vi.mocked(listMyAppointments).mockResolvedValue([FAR, NEAR]);
    renderPage();
    const up = await upcomingItems();
    const nearButton = within(up[0]).getByRole('button', { name: /^Cancel / });
    expect(nearButton).toBeDisabled();
    expect(within(up[0]).getByText(HINT)).toBeInTheDocument();
    expect(nearButton).toHaveAccessibleDescription(HINT);
    expect(within(up[1]).getByRole('button', { name: /^Cancel / })).toBeEnabled();
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
    vi.mocked(cancelAppointment).mockRejectedValue(
      new ApiError(403, 'Appointments can only be changed at least 24 hours in advance', null),
    );
    const user = userEvent.setup();
    renderPage();
    const up = await upcomingItems();
    await user.click(within(up[0]).getByRole('button', { name: /^Cancel / }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel appointment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Appointments can only be changed at least 24 hours in advance',
    );
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
});
