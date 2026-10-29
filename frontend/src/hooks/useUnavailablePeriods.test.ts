import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUnavailablePeriod,
  deleteUnavailablePeriod,
  listUnavailablePeriods,
} from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { UnavailablePeriod } from '../api/types.ts';
import { PAGE_SIZE, useUnavailablePeriods } from './useUnavailablePeriods.ts';
import type { UnavailablePeriodsState } from './useUnavailablePeriods.ts';

vi.mock('../api/endpoints.ts');

const FROM = '2026-11-01';

function makePeriod(i: number): UnavailablePeriod {
  return {
    id: `p${String(i)}`,
    starts_at: '2026-11-02T02:00:00Z',
    ends_at: '2026-11-02T05:00:00Z',
    reason: `Closure ${String(i)}`,
    created_by_id: 'u1',
  };
}

function page(from: number, count: number): UnavailablePeriod[] {
  return Array.from({ length: count }, (_, k) => makePeriod(from + k));
}

function periodsOf(state: UnavailablePeriodsState): UnavailablePeriod[] {
  if (state.kind !== 'ready') {
    throw new Error(`expected ready, got ${state.kind}`);
  }
  return state.periods;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useUnavailablePeriods', () => {
  it('starts loading, then holds the first page', async () => {
    vi.mocked(listUnavailablePeriods).mockResolvedValue([makePeriod(1)]);
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
    expect(result.current.state).toEqual({ kind: 'loading' });
    await waitFor(() => {
      expect(result.current.state).toEqual({
        kind: 'ready',
        periods: [makePeriod(1)],
        hasMore: false,
        loadingMore: false,
        loadMoreError: null,
      });
    });
    expect(listUnavailablePeriods).toHaveBeenCalledWith(
      { from: FROM, limit: PAGE_SIZE, offset: 0 },
      expect.any(AbortSignal),
    );
  });

  it('reports a load error and recovers with retry', async () => {
    vi.mocked(listUnavailablePeriods)
      .mockRejectedValueOnce(new ApiError(500, 'Server exploded'))
      .mockResolvedValueOnce([makePeriod(1)]);
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
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
      expect(result.current.state.kind).toBe('ready');
    });
  });

  it('a full page means more; load more appends and a short page ends it', async () => {
    vi.mocked(listUnavailablePeriods)
      .mockResolvedValueOnce(page(1, PAGE_SIZE))
      .mockResolvedValueOnce(page(PAGE_SIZE + 1, 3));
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
    await waitFor(() => {
      expect(result.current.state).toEqual(expect.objectContaining({ hasMore: true }));
    });
    await act(async () => {
      await result.current.loadMore();
    });
    expect(listUnavailablePeriods).toHaveBeenLastCalledWith({
      from: FROM,
      limit: PAGE_SIZE,
      offset: PAGE_SIZE,
    });
    expect(periodsOf(result.current.state)).toHaveLength(PAGE_SIZE + 3);
    expect(result.current.state).toEqual(
      expect.objectContaining({ hasMore: false, loadingMore: false }),
    );
  });

  it('skips periods already on screen when appending', async () => {
    vi.mocked(listUnavailablePeriods)
      .mockResolvedValueOnce(page(1, PAGE_SIZE))
      .mockResolvedValueOnce([makePeriod(PAGE_SIZE), makePeriod(PAGE_SIZE + 1)]);
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
    await waitFor(() => {
      expect(result.current.state.kind).toBe('ready');
    });
    await act(async () => {
      await result.current.loadMore();
    });
    expect(periodsOf(result.current.state)).toHaveLength(PAGE_SIZE + 1);
  });

  it('a failed load more keeps the list, sets an error, and can be retried', async () => {
    vi.mocked(listUnavailablePeriods)
      .mockResolvedValueOnce(page(1, PAGE_SIZE))
      .mockRejectedValueOnce(new ApiError(500, 'Nope'))
      .mockResolvedValueOnce(page(PAGE_SIZE + 1, 1));
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
    await waitFor(() => {
      expect(result.current.state.kind).toBe('ready');
    });
    await act(async () => {
      await result.current.loadMore();
    });
    expect(periodsOf(result.current.state)).toHaveLength(PAGE_SIZE);
    expect(result.current.state).toEqual(
      expect.objectContaining({
        hasMore: true,
        loadingMore: false,
        loadMoreError: expect.stringContaining('Nope') as string,
      }),
    );
    await act(async () => {
      await result.current.loadMore();
    });
    expect(periodsOf(result.current.state)).toHaveLength(PAGE_SIZE + 1);
    expect(result.current.state).toEqual(expect.objectContaining({ loadMoreError: null }));
  });

  it('create posts the input, then re-fetches page 1 without a loading flash', async () => {
    const input = {
      starts_at: '2026-11-02T02:00:00.000Z',
      ends_at: '2026-11-02T05:00:00.000Z',
      reason: 'Holiday',
    };
    vi.mocked(listUnavailablePeriods)
      .mockResolvedValueOnce([makePeriod(1)])
      .mockResolvedValueOnce([makePeriod(2), makePeriod(1)]);
    vi.mocked(createUnavailablePeriod).mockResolvedValue(makePeriod(2));
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
    await waitFor(() => {
      expect(result.current.state.kind).toBe('ready');
    });
    await act(async () => {
      await expect(result.current.create(input)).resolves.toEqual(makePeriod(2));
    });
    expect(createUnavailablePeriod).toHaveBeenCalledWith(input);
    expect(result.current.state.kind).toBe('ready');
    await waitFor(() => {
      expect(periodsOf(result.current.state)).toHaveLength(2);
    });
    expect(listUnavailablePeriods).toHaveBeenCalledTimes(2);
  });

  it('create rethrows a failure and does not re-fetch', async () => {
    vi.mocked(listUnavailablePeriods).mockResolvedValue([makePeriod(1)]);
    const failure = new ApiError(409, '2 active appointment(s) overlap this period');
    vi.mocked(createUnavailablePeriod).mockRejectedValue(failure);
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
    await waitFor(() => {
      expect(result.current.state.kind).toBe('ready');
    });
    await expect(
      result.current.create({ starts_at: 'a', ends_at: 'b', reason: 'c' }),
    ).rejects.toBe(failure);
    expect(listUnavailablePeriods).toHaveBeenCalledTimes(1);
    expect(periodsOf(result.current.state)).toHaveLength(1);
  });

  it('remove deletes, then re-fetches page 1', async () => {
    vi.mocked(listUnavailablePeriods)
      .mockResolvedValueOnce([makePeriod(1), makePeriod(2)])
      .mockResolvedValueOnce([makePeriod(2)]);
    vi.mocked(deleteUnavailablePeriod).mockResolvedValue(undefined);
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
    await waitFor(() => {
      expect(result.current.state.kind).toBe('ready');
    });
    await act(async () => {
      await result.current.remove('p1');
    });
    expect(deleteUnavailablePeriod).toHaveBeenCalledWith('p1');
    await waitFor(() => {
      expect(periodsOf(result.current.state)).toEqual([makePeriod(2)]);
    });
  });

  it('remove rethrows a failure and keeps the list', async () => {
    vi.mocked(listUnavailablePeriods).mockResolvedValue([makePeriod(1)]);
    const failure = new ApiError(404, 'Unavailable period not found');
    vi.mocked(deleteUnavailablePeriod).mockRejectedValue(failure);
    const { result } = renderHook(() => useUnavailablePeriods(FROM));
    await waitFor(() => {
      expect(result.current.state.kind).toBe('ready');
    });
    await expect(result.current.remove('p1')).rejects.toBe(failure);
    expect(periodsOf(result.current.state)).toHaveLength(1);
  });
});
