import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppointment, getSlots, listServices } from '../api/endpoints.ts';
import { BookingPage } from './BookingPage.tsx';

vi.mock('../api/endpoints.ts');
vi.mock('../lib/dates.ts', () => ({ todayInJakarta: () => '2026-10-27' }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('BookingPage confirmation', () => {
  it('links to My appointments after a booking', async () => {
    vi.mocked(listServices).mockResolvedValue([
      {
        id: 's1',
        name: 'Classic Haircut',
        description: 'A classic cut.',
        duration_minutes: 30,
        price_idr: 75000,
      },
    ]);
    vi.mocked(getSlots).mockResolvedValue({
      service_id: 's1',
      date: '2026-10-27',
      timezone: 'Asia/Jakarta',
      duration_minutes: 30,
      slots: [{ starts_at: '2026-10-27T02:00:00Z', local_time: '09:00' }],
    });
    vi.mocked(createAppointment).mockResolvedValue({
      id: 'a1',
      service_id: 's1',
      starts_at: '2026-10-27T02:00:00Z',
      ends_at: '2026-10-27T02:30:00Z',
      status: 'booked',
      notes: '',
      cancelled_at: null,
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/services/s1/book']}>
        <Routes>
          <Route path="/services/:serviceId/book" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(await screen.findByRole('heading', { name: 'Booking confirmed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My appointments' })).toHaveAttribute(
      'href',
      '/appointments',
    );
  });
});
