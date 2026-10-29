import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUnavailablePeriod,
  deleteUnavailablePeriod,
  listUnavailablePeriods,
} from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { UnavailablePeriod } from '../api/types.ts';
import { ClosuresPage } from './ClosuresPage.tsx';

vi.mock('../api/endpoints.ts');

const HOLIDAY: UnavailablePeriod = {
  id: 'p1',
  starts_at: '2026-11-02T02:00:00Z',
  ends_at: '2026-11-02T05:00:00Z',
  reason: 'Holiday',
  created_by_id: 'u1',
};
const TRAINING: UnavailablePeriod = { ...HOLIDAY, id: 'p2', reason: 'Staff training' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ClosuresPage', () => {
  it('lists closures from today (Jakarta) with page size 50', async () => {
    vi.mocked(listUnavailablePeriods).mockResolvedValue([HOLIDAY]);
    render(<ClosuresPage />);
    expect(await screen.findByText('Holiday')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Closures', level: 1 })).toBeInTheDocument();
    expect(listUnavailablePeriods).toHaveBeenCalledWith(
      { from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string, limit: 50, offset: 0 },
      expect.any(AbortSignal),
    );
  });

  it('shows a load error and recovers with Try again', async () => {
    vi.mocked(listUnavailablePeriods)
      .mockRejectedValueOnce(new ApiError(500, 'Server exploded'))
      .mockResolvedValueOnce([HOLIDAY]);
    const user = userEvent.setup();
    render(<ClosuresPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Holiday')).toBeInTheDocument();
  });

  it('creates a closure and shows it after the list refreshes', async () => {
    vi.mocked(listUnavailablePeriods)
      .mockResolvedValueOnce([HOLIDAY])
      .mockResolvedValueOnce([TRAINING, HOLIDAY]);
    vi.mocked(createUnavailablePeriod).mockResolvedValue(TRAINING);
    const user = userEvent.setup();
    render(<ClosuresPage />);
    await screen.findByText('Holiday');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-02' } });
    await user.type(screen.getByLabelText('Reason'), 'Staff training');
    await user.click(screen.getByRole('button', { name: 'Add closure' }));
    expect(await screen.findByText('Closure added.')).toBeInTheDocument();
    expect(createUnavailablePeriod).toHaveBeenCalledWith({
      starts_at: '2026-11-02T02:00:00.000Z',
      ends_at: '2026-11-02T10:00:00.000Z',
      reason: 'Staff training',
    });
    expect(await screen.findByText('Staff training')).toBeInTheDocument();
    expect(listUnavailablePeriods).toHaveBeenCalledTimes(2);
  });

  it('shows the 409 conflict message inline and creates nothing', async () => {
    vi.mocked(listUnavailablePeriods).mockResolvedValue([]);
    vi.mocked(createUnavailablePeriod).mockRejectedValue(
      new ApiError(409, '1 active appointment(s) overlap this period; cancel or reschedule them first'),
    );
    const user = userEvent.setup();
    render(<ClosuresPage />);
    await screen.findByText('No upcoming closures.');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-02' } });
    await user.type(screen.getByLabelText('Reason'), 'Holiday');
    await user.click(screen.getByRole('button', { name: 'Add closure' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 active appointment(s) overlap');
    expect(screen.getByLabelText('Reason')).toHaveValue('Holiday');
    expect(listUnavailablePeriods).toHaveBeenCalledTimes(1);
  });

  it('deletes a closure after confirmation and refreshes the list', async () => {
    vi.mocked(listUnavailablePeriods)
      .mockResolvedValueOnce([HOLIDAY, TRAINING])
      .mockResolvedValueOnce([TRAINING]);
    vi.mocked(deleteUnavailablePeriod).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ClosuresPage />);
    await screen.findByText('Holiday');
    await user.click(screen.getByRole('button', { name: /^Delete closure: Holiday/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete closure' }));
    expect(await screen.findByText('Closure deleted.')).toBeInTheDocument();
    expect(deleteUnavailablePeriod).toHaveBeenCalledWith('p1');
    await vi.waitFor(() => {
      expect(screen.queryByText('Holiday')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Staff training')).toBeInTheDocument();
  });
});
