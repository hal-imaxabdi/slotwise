import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listBusinessHours, replaceBusinessHours } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { BusinessHour } from '../api/types.ts';
import { BusinessHoursPage } from './BusinessHoursPage.tsx';

vi.mock('../api/endpoints.ts');

const MON: BusinessHour = { id: 'h1', weekday: 0, open_minute: 540, close_minute: 1020 };
const WED: BusinessHour = { id: 'h2', weekday: 2, open_minute: 600, close_minute: 900 };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('BusinessHoursPage', () => {
  it('renders seven days with each day\'s hours', async () => {
    vi.mocked(listBusinessHours).mockResolvedValue([MON, WED]);
    render(<BusinessHoursPage />);
    expect(await screen.findByRole('heading', { name: 'Weekly hours', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    expect(screen.getByLabelText('Monday interval 1 opens')).toHaveValue('540');
    expect(screen.getByLabelText('Monday interval 1 closes')).toHaveValue('1020');
    expect(screen.getByLabelText('Wednesday interval 1 opens')).toHaveValue('600');
    expect(screen.getAllByText('Closed all day.')).toHaveLength(5);
    expect(listBusinessHours).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('shows a load error and recovers with Try again', async () => {
    vi.mocked(listBusinessHours)
      .mockRejectedValueOnce(new ApiError(500, 'Server exploded'))
      .mockResolvedValueOnce([MON]);
    const user = userEvent.setup();
    render(<BusinessHoursPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Monday interval 1 opens')).toHaveValue('540');
  });

  it('saves one day, uses the PUT response and does not refetch', async () => {
    vi.mocked(listBusinessHours).mockResolvedValue([MON, WED]);
    const updated: BusinessHour = { ...MON, close_minute: 1080 };
    vi.mocked(replaceBusinessHours).mockResolvedValue([updated, WED]);
    const user = userEvent.setup();
    render(<BusinessHoursPage />);
    await user.selectOptions(await screen.findByLabelText('Monday interval 1 closes'), '1080');
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    expect(await screen.findByText('Monday hours saved.')).toBeInTheDocument();
    expect(replaceBusinessHours).toHaveBeenCalledWith(0, {
      intervals: [{ open_minute: 540, close_minute: 1080 }],
    });
    expect(listBusinessHours).toHaveBeenCalledTimes(1);
    // The editor now compares against the saved hours, so saving again is a no-op.
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No changes to save.');
    expect(replaceBusinessHours).toHaveBeenCalledTimes(1);
  });

  it('shows a server 409 inside the day that failed', async () => {
    vi.mocked(listBusinessHours).mockResolvedValue([MON]);
    vi.mocked(replaceBusinessHours).mockRejectedValue(
      new ApiError(409, '1 active appointment(s) would fall outside these hours'),
    );
    const user = userEvent.setup();
    render(<BusinessHoursPage />);
    await user.click(await screen.findByRole('button', { name: 'Remove Monday interval 1' }));
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('active appointment(s)');
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
