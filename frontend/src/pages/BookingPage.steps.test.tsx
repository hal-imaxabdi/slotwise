import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSlots, listServices } from '../api/endpoints.ts';
import { BookingPage } from './BookingPage.tsx';

vi.mock('../api/endpoints.ts');
vi.mock('../lib/dates.ts', () => ({ todayInJakarta: () => '2026-10-27' }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listServices).mockResolvedValue([
    {
      id: 's1',
      name: 'Classic Haircut',
      description: 'A classic cut.',
      duration_minutes: 60,
      price_idr: 150000,
    },
  ]);
  vi.mocked(getSlots).mockResolvedValue({
    service_id: 's1',
    date: '2026-10-27',
    timezone: 'Asia/Jakarta',
    duration_minutes: 60,
    slots: [{ starts_at: '2026-10-27T02:00:00Z', local_time: '09:00' }],
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/services/s1/book']}>
      <Routes>
        <Route path="/services/:serviceId/book" element={<BookingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BookingPage progress and summary', () => {
  it('marks "Pick a time" as the current step until a time is chosen', async () => {
    renderPage();
    await screen.findByRole('button', { name: '09:00' });
    const steps = within(screen.getByRole('list', { name: 'Booking progress' }));
    expect(steps.getByText('Pick a time')).toHaveAttribute('aria-current', 'step');
    expect(steps.getByText('Choose a date')).not.toHaveAttribute('aria-current');
    expect(steps.getByText('Confirm')).not.toHaveAttribute('aria-current');
  });

  it('moves to "Confirm" and shows a summary of the booking after choosing a time', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    const steps = within(screen.getByRole('list', { name: 'Booking progress' }));
    expect(steps.getByText('Confirm')).toHaveAttribute('aria-current', 'step');
    const form = within(screen.getByRole('form', { name: 'Booking details' }));
    expect(form.getByText('Selected time: 09:00')).toBeInTheDocument();
    expect(form.getByText('Tuesday, October 27, 2026')).toBeInTheDocument();
    expect(form.getByText('Classic Haircut')).toBeInTheDocument();
    expect(form.getByText('Rp 150.000')).toBeInTheDocument();
  });
});
