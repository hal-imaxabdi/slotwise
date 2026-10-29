import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listBusinessHours, replaceBusinessHours } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { BusinessHour } from '../api/types.ts';
import { useBusinessHours } from './useBusinessHours.ts';

vi.mock('../api/endpoints.ts');

const MON: BusinessHour = { id: 'h1', weekday: 0, open_minute: 540, close_minute: 1020 };
const TUE: BusinessHour = { id: 'h2', weekday: 1, open_minute: 600, close_minute: 960 };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useBusinessHours', () => {
  it('starts loading, then holds the week', async () => {
    vi.mocked(listBusinessHours).mockResolvedValue([MON]);
    const { result } = renderHook(() => useBusinessHours());
    expect(result.current.state).toEqual({ kind: 'loading' });
    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'ready', hours: [MON] });
    });
    expect(listBusinessHours).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('reports a load error and recovers with retry', async () => {
    vi.mocked(listBusinessHours)
      .mockRejectedValueOnce(new ApiError(500, 'Server exploded'))
      .mockResolvedValueOnce([MON]);
    const { result } = renderHook(() => useBusinessHours());
    await waitFor(() => {
      expect(result.current.state).toEqual(
        expect.objectContaining({
          kind: 'error',
          message: expect.stringContaining('Server exploded') as string,
        }),
      );
    });
    act(() => {
      result.current.retry();
    });
    expect(result.current.state).toEqual({ kind: 'loading' });
    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'ready', hours: [MON] });
    });
  });

  it('replace sets the state from the response without refetching', async () => {
    vi.mocked(listBusinessHours).mockResolvedValue([MON]);
    vi.mocked(replaceBusinessHours).mockResolvedValue([MON, TUE]);
    const { result } = renderHook(() => useBusinessHours());
    await waitFor(() => {
      expect(result.current.state.kind).toBe('ready');
    });
    await act(async () => {
      await result.current.replace(1, [{ open_minute: 600, close_minute: 960 }]);
    });
    expect(replaceBusinessHours).toHaveBeenCalledWith(1, {
      intervals: [{ open_minute: 600, close_minute: 960 }],
    });
    expect(result.current.state).toEqual({ kind: 'ready', hours: [MON, TUE] });
    expect(listBusinessHours).toHaveBeenCalledTimes(1);
  });

  it('replace rethrows a failure and keeps the current hours', async () => {
    vi.mocked(listBusinessHours).mockResolvedValue([MON]);
    const failure = new ApiError(409, '2 active appointment(s) would fall outside these hours');
    vi.mocked(replaceBusinessHours).mockRejectedValue(failure);
    const { result } = renderHook(() => useBusinessHours());
    await waitFor(() => {
      expect(result.current.state.kind).toBe('ready');
    });
    await expect(result.current.replace(0, [])).rejects.toBe(failure);
    expect(result.current.state).toEqual({ kind: 'ready', hours: [MON] });
  });
});
