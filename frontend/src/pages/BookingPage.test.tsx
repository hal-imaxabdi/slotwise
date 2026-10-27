import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSlots, listServices } from '../api/endpoints.ts';
import type { Service, SlotsResponse } from '../api/types.ts';
import { BookingPage } from './BookingPage.tsx';

vi.mock('../api/endpoints.ts');
vi.mock('../lib/dates.ts', () => ({ todayInJakarta: () => '2026-10-27' }));

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
  date: '2026-10-27',
  timezone: 'Asia/Jakarta',
  duration_minutes: 30,
  slots: [
    { starts_at: '2026-10-27T02:00:00Z', local_time: '09:00' },
    { starts_at: '2026-10-27T02:30:00Z', local_time: '09:30' },
  ],
};

function renderPage(path = '/services/s1/book') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/services/:serviceId/book" element={<BookingPage />} />
        <Route path="/services" element={<p>Services list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('BookingPage', () => {
  it('shows the service and loads slots for today', async () => {
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    vi.mocked(getSlots).mockResolvedValue(SLOTS);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Book Classic Haircut' })).toBeInTheDocument();
    expect(screen.getByText('30 min - Rp 75.000')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument();
    expect(getSlots).toHaveBeenCalledWith('s1', '2026-10-27', expect.anything());
  });

  it('lets the user pick a time', async () => {
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    vi.mocked(getSlots).mockResolvedValue(SLOTS);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    expect(screen.getByRole('button', { name: '09:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Selected time: 09:00')).toBeInTheDocument();
  });

  it('refetches and clears the selection when the date changes', async () => {
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    vi.mocked(getSlots).mockResolvedValue(SLOTS);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-28' } });
    await waitFor(() => {
      expect(getSlots).toHaveBeenCalledTimes(2);
    });
    expect(getSlots).toHaveBeenLastCalledWith('s1', '2026-10-28', expect.anything());
    expect(screen.queryByText('Selected time: 09:00')).not.toBeInTheDocument();
  });

  it('does not fetch slots for a past date', async () => {
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    vi.mocked(getSlots).mockResolvedValue(SLOTS);
    renderPage();
    await screen.findByRole('button', { name: '09:00' });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-26' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose today or a later date.');
    expect(getSlots).toHaveBeenCalledTimes(1);
  });

  it('shows a message for an unknown service without fetching slots', async () => {
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    renderPage('/services/nope/book');
    expect(await screen.findByText('This service is not available.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to services' })).toHaveAttribute(
      'href',
      '/services',
    );
    expect(getSlots).not.toHaveBeenCalled();
  });

  it('shows an empty state when the day has no times', async () => {
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    vi.mocked(getSlots).mockResolvedValue({ ...SLOTS, slots: [] });
    renderPage();
    expect(await screen.findByText('No times are available on this date.')).toBeInTheDocument();
  });

  it('shows an error when the services fail to load', async () => {
    vi.mocked(listServices).mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(getSlots).not.toHaveBeenCalled();
  });
});
