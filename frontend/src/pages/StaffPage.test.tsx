import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listServices, listStaffAppointments } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { Service, StaffAppointment } from '../api/types.ts';
import { formatAppointmentRange, todayInJakarta } from '../lib/dates.ts';
import { StaffPage } from './StaffPage.tsx';

vi.mock('../api/endpoints.ts');

const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Classic Haircut',
    description: 'A classic cut.',
    duration_minutes: 30,
    price_idr: 75000,
  },
];

const EMPTY = 'No appointments match these filters.';

function make(id: string, overrides: Partial<StaffAppointment> = {}): StaffAppointment {
  return {
    id,
    service_id: 's1',
    starts_at: '2035-01-01T02:00:00Z',
    ends_at: '2035-01-01T02:30:00Z',
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

function renderPage() {
  return render(<StaffPage />);
}

async function listItems() {
  const region = await screen.findByRole('region', { name: 'Appointments' });
  return within(region).findAllByRole('listitem');
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listServices).mockResolvedValue(SERVICES);
});

describe('StaffPage', () => {
  it('loads today in Jakarta by default and shows customer, service, time and status', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([
      make('a1'),
      make('a2', {
        service_id: 'gone',
        customer_name: 'Budi Santoso',
        customer_email: 'budi@example.com',
        status: 'completed',
        notes: 'Prefers short sides',
      }),
    ]);
    renderPage();
    const items = await listItems();
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Ayu Lestari');
    expect(items[0]).toHaveTextContent('ayu@example.com');
    expect(items[0]).toHaveTextContent('Classic Haircut');
    expect(items[0]).toHaveTextContent(
      formatAppointmentRange('2035-01-01T02:00:00Z', '2035-01-01T02:30:00Z'),
    );
    expect(items[0]).toHaveTextContent('Status: Booked');
    expect(items[1]).toHaveTextContent('Budi Santoso');
    expect(items[1]).toHaveTextContent('Inactive service');
    expect(items[1]).toHaveTextContent('Status: Completed');
    expect(items[1]).toHaveTextContent('Notes: Prefers short sides');
    const today = todayInJakarta();
    expect(vi.mocked(listStaffAppointments).mock.calls[0]?.[0]).toEqual({
      from: today,
      to: today,
      status: '',
      limit: 21,
      offset: 0,
    });
    expect(screen.getByLabelText('From')).toHaveValue(today);
    expect(screen.getByLabelText('To')).toHaveValue(today);
  });

  it('shows an empty state', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
  });

  it('shows an error and recovers with Try again', async () => {
    vi.mocked(listStaffAppointments).mockRejectedValueOnce(new Error('boom')).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(listStaffAppointments).toHaveBeenCalledTimes(2);
  });

  it('shows the server message on 403', async () => {
    vi.mocked(listStaffAppointments).mockRejectedValue(new ApiError(403, 'Forbidden', null));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });

  it('shows a services error and loads the list after Try again', async () => {
    vi.mocked(listServices).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(listStaffAppointments).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(listStaffAppointments).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(listStaffAppointments).toHaveBeenCalledTimes(1);
  });

  it('refetches from the first page when the status filter changes', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(EMPTY);
    await user.selectOptions(screen.getByLabelText('Status'), 'booked');
    await waitFor(() => {
      expect(listStaffAppointments).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(listStaffAppointments).mock.calls[1]?.[0]).toMatchObject({
      status: 'booked',
      offset: 0,
    });
  });

  it('does not query when From is after To, and queries again once the range is valid', async () => {
    vi.mocked(listStaffAppointments).mockResolvedValue([]);
    renderPage();
    await screen.findByText(EMPTY);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2035-01-05' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The From date must not be after the To date.',
    );
    expect(screen.queryByRole('region', { name: 'Appointments' })).not.toBeInTheDocument();
    expect(listStaffAppointments).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2035-01-06' } });
    await screen.findByText(EMPTY);
    expect(listStaffAppointments).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listStaffAppointments).mock.calls[1]?.[0]).toMatchObject({
      from: '2035-01-05',
      to: '2035-01-06',
    });
  });

  it('pages forward and back, and moves focus to the heading', async () => {
    const full = Array.from({ length: 21 }, (_, i) =>
      make(`a${i}`, { customer_name: `Customer ${i}` }),
    );
    const last = [make('z1', { customer_name: 'Customer 20' })];
    vi.mocked(listStaffAppointments).mockImplementation((query) =>
      Promise.resolve(query.offset === 0 ? full : last),
    );
    const user = userEvent.setup();
    renderPage();

    const first = await listItems();
    expect(first).toHaveLength(20);
    expect(screen.queryByText('Customer 20')).not.toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Customer 20')).toBeInTheDocument();
    expect(vi.mocked(listStaffAppointments).mock.calls[1]?.[0]).toMatchObject({
      offset: 20,
      limit: 21,
    });
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Appointments', level: 2 })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('Customer 0')).toBeInTheDocument();
    expect(vi.mocked(listStaffAppointments).mock.calls[2]?.[0]).toMatchObject({ offset: 0 });
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });

  it('aborts the appointments request on unmount', async () => {
    vi.mocked(listStaffAppointments).mockReturnValue(
      new Promise<StaffAppointment[]>(() => undefined),
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(listStaffAppointments).toHaveBeenCalled();
    });
    unmount();
    expect(vi.mocked(listStaffAppointments).mock.calls[0]?.[1]?.aborted).toBe(true);
  });
});
