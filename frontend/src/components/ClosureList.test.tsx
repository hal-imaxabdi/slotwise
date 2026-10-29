import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors.ts';
import type { UnavailablePeriod } from '../api/types.ts';
import type { UnavailablePeriodsState } from '../hooks/useUnavailablePeriods.ts';
import { ClosureList } from './ClosureList.tsx';

const HOLIDAY: UnavailablePeriod = {
  id: 'p1',
  starts_at: '2026-11-02T02:00:00Z',
  ends_at: '2026-11-02T05:00:00Z',
  reason: 'Holiday',
  created_by_id: 'u1',
};
const TRAINING: UnavailablePeriod = { ...HOLIDAY, id: 'p2', reason: 'Staff training' };

function ready(
  periods: UnavailablePeriod[],
  over: Partial<Extract<UnavailablePeriodsState, { kind: 'ready' }>> = {},
): UnavailablePeriodsState {
  return {
    kind: 'ready',
    periods,
    hasMore: false,
    loadingMore: false,
    loadMoreError: null,
    ...over,
  };
}

let onRetry: ReturnType<typeof vi.fn<() => void>>;
let onLoadMore: ReturnType<typeof vi.fn<() => Promise<void>>>;
let onRemove: ReturnType<typeof vi.fn<(id: string) => Promise<void>>>;

beforeEach(() => {
  vi.resetAllMocks();
  onRetry = vi.fn<() => void>();
  onLoadMore = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  onRemove = vi.fn<(id: string) => Promise<void>>();
});

function renderList(state: UnavailablePeriodsState) {
  return render(
    <ClosureList state={state} onRetry={onRetry} onLoadMore={onLoadMore} onRemove={onRemove} />,
  );
}

function deleteButton(reason: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Delete closure: ${reason}`) });
}

describe('ClosureList states', () => {
  it('shows loading', () => {
    renderList({ kind: 'loading' });
    expect(screen.getByRole('status').textContent).toBe('Loading closures…');
  });

  it('shows an error with a working Try again', () => {
    renderList({ kind: 'error', message: 'Server exploded' });
    expect(screen.getByRole('alert').textContent).toContain('Server exploded');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows an empty message', () => {
    renderList(ready([]));
    expect(screen.getByText('No upcoming closures.')).toBeTruthy();
  });

  it('lists each closure with its Jakarta time range and reason', () => {
    renderList(ready([HOLIDAY, TRAINING]));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText(/2 Nov 2026, 09:00-12:00/)).toHaveLength(2);
    expect(screen.getByText('Holiday')).toBeTruthy();
    expect(screen.getByText('Staff training')).toBeTruthy();
  });
});

describe('ClosureList delete', () => {
  it('asks for confirmation and focuses the confirm group', () => {
    renderList(ready([HOLIDAY]));
    fireEvent.click(deleteButton('Holiday'));
    const group = screen.getByRole('group', { name: /^Confirm deletion of closure: Holiday/ });
    expect(document.activeElement).toBe(group);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('Keep closure cancels and returns focus to Delete', () => {
    renderList(ready([HOLIDAY]));
    fireEvent.click(deleteButton('Holiday'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep closure' }));
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(deleteButton('Holiday'));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('confirming deletes, shows a status and focuses the heading', async () => {
    onRemove.mockResolvedValue(undefined);
    renderList(ready([HOLIDAY]));
    fireEvent.click(deleteButton('Holiday'));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete closure' }));
    expect((await screen.findByRole('status')).textContent).toBe('Closure deleted.');
    expect(onRemove).toHaveBeenCalledWith('p1');
    expect(screen.queryByRole('group')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Closures' })),
    );
  });

  it('a 404 says so, refreshes the list and focuses the heading', async () => {
    onRemove.mockRejectedValue(new ApiError(404, 'Unavailable period not found'));
    renderList(ready([HOLIDAY]));
    fireEvent.click(deleteButton('Holiday'));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete closure' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Closure not found. The list has been refreshed.',
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Closures' }));
  });

  it('another error keeps the confirm open and refocuses it', async () => {
    onRemove.mockRejectedValue(new ApiError(500, 'Server exploded'));
    renderList(ready([HOLIDAY]));
    fireEvent.click(deleteButton('Holiday'));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete closure' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Server exploded');
    const group = screen.getByRole('group', { name: /^Confirm deletion of closure: Holiday/ });
    expect(document.activeElement).toBe(group);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('disables the buttons while deleting and ignores a second click', () => {
    onRemove.mockReturnValue(new Promise(() => undefined));
    renderList(ready([HOLIDAY, TRAINING]));
    fireEvent.click(deleteButton('Holiday'));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete closure' }));
    const busy = screen.getByRole('button', { name: 'Deleting…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect((deleteButton('Staff training') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(busy);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('ClosureList load more', () => {
  it('hides the button when there is no more', () => {
    renderList(ready([HOLIDAY]));
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('calls onLoadMore when there is more', () => {
    renderList(ready([HOLIDAY], { hasMore: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('keeps the button focusable but ignores clicks while loading', () => {
    renderList(ready([HOLIDAY], { hasMore: true, loadingMore: true }));
    const button = screen.getByRole('button', { name: 'Loading more…' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('shows a load-more error and keeps the list', () => {
    renderList(ready([HOLIDAY], { hasMore: true, loadMoreError: 'Nope' }));
    expect(screen.getByRole('alert').textContent).toBe('Nope');
    expect(screen.getByText('Holiday')).toBeTruthy();
  });

  it('moves focus to the heading when the button disappears while focused', () => {
    const { rerender } = renderList(ready([HOLIDAY], { hasMore: true }));
    screen.getByRole('button', { name: 'Load more' }).focus();
    rerender(
      <ClosureList
        state={ready([HOLIDAY, TRAINING])}
        onRetry={onRetry}
        onLoadMore={onLoadMore}
        onRemove={onRemove}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Closures' }));
  });
});
