import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listServices, listStaffAppointments } from '../api/endpoints.ts';
import { StaffPage } from './StaffPage.tsx';

vi.mock('../api/endpoints.ts');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listServices).mockResolvedValue([]);
  vi.mocked(listStaffAppointments).mockResolvedValue([]);
});

describe('StaffPage booking panel', () => {
  it('opens and closes the booking panel', async () => {
    const user = userEvent.setup();
    render(<StaffPage />);

    const toggle = await screen.findByRole('button', { name: 'Book for a customer' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Book for a customer' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Book for a customer' })).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByRole('region', { name: 'Book for a customer' })).not.toBeInTheDocument();
  });
});
