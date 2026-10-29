import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors.ts';
import type { CreateUnavailablePeriodInput } from '../api/types.ts';
import { ClosureForm } from './ClosureForm.tsx';

let onCreate: ReturnType<typeof vi.fn<(input: CreateUnavailablePeriodInput) => Promise<unknown>>>;

beforeEach(() => {
  vi.resetAllMocks();
  onCreate = vi.fn<(input: CreateUnavailablePeriodInput) => Promise<unknown>>();
});

function field(label: string): HTMLInputElement & HTMLSelectElement {
  return screen.getByLabelText(label) as HTMLInputElement & HTMLSelectElement;
}

function fill(date: string, reason: string) {
  fireEvent.change(field('Date'), { target: { value: date } });
  fireEvent.change(field('Reason'), { target: { value: reason } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Add closure' }));
}

describe('ClosureForm', () => {
  it('starts with 09:00 to 17:00 and empty date and reason', () => {
    render(<ClosureForm onCreate={onCreate} />);
    expect(field('Date').value).toBe('');
    expect(field('Start time').value).toBe('540');
    expect(field('End time').value).toBe('1020');
    expect(field('Reason').value).toBe('');
  });

  it('offers 30-minute steps: start up to 23:30, end up to 24:00', () => {
    render(<ClosureForm onCreate={onCreate} />);
    const starts = Array.from(field('Start time').options).map((o) => o.text);
    const ends = Array.from(field('End time').options).map((o) => o.text);
    expect(starts).toHaveLength(48);
    expect(starts[0]).toBe('00:00');
    expect(starts[47]).toBe('23:30');
    expect(ends[0]).toBe('00:30');
    expect(ends[47]).toBe('24:00');
  });

  it('requires a date and focuses it', () => {
    render(<ClosureForm onCreate={onCreate} />);
    fireEvent.change(field('Reason'), { target: { value: 'Holiday' } });
    submit();
    expect(screen.getByRole('alert').textContent).toBe('Choose a date.');
    expect(document.activeElement).toBe(field('Date'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('requires the end to be after the start and focuses the end select', () => {
    render(<ClosureForm onCreate={onCreate} />);
    fill('2026-11-02', 'Holiday');
    fireEvent.change(field('End time'), { target: { value: '540' } });
    submit();
    expect(screen.getByRole('alert').textContent).toBe('End time must be after the start time.');
    expect(document.activeElement).toBe(field('End time'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('requires a non-blank reason and focuses it', () => {
    render(<ClosureForm onCreate={onCreate} />);
    fill('2026-11-02', '   ');
    submit();
    expect(screen.getByRole('alert').textContent).toBe('Enter a reason (1-200 characters).');
    expect(document.activeElement).toBe(field('Reason'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('sends Jakarta times as UTC with a trimmed reason', async () => {
    onCreate.mockResolvedValue({});
    render(<ClosureForm onCreate={onCreate} />);
    fill('2026-11-02', '  Holiday  ');
    submit();
    await screen.findByRole('status');
    expect(onCreate).toHaveBeenCalledWith({
      starts_at: '2026-11-02T02:00:00.000Z',
      ends_at: '2026-11-02T10:00:00.000Z',
      reason: 'Holiday',
    });
  });

  it('on success shows a status, resets the form and focuses the date', async () => {
    onCreate.mockResolvedValue({});
    render(<ClosureForm onCreate={onCreate} />);
    fill('2026-11-02', 'Holiday');
    fireEvent.change(field('Start time'), { target: { value: '600' } });
    submit();
    expect((await screen.findByRole('status')).textContent).toBe('Closure added.');
    expect(field('Date').value).toBe('');
    expect(field('Reason').value).toBe('');
    expect(field('Start time').value).toBe('540');
    expect(document.activeElement).toBe(field('Date'));
  });

  it('shows a server error inline and keeps the entered values', async () => {
    onCreate.mockRejectedValue(
      new ApiError(409, '2 active appointment(s) overlap this period; cancel or reschedule them first'),
    );
    render(<ClosureForm onCreate={onCreate} />);
    fill('2026-11-02', 'Holiday');
    submit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('2 active appointment(s) overlap');
    expect(field('Date').value).toBe('2026-11-02');
    expect(field('Reason').value).toBe('Holiday');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('disables the button while the request is pending', () => {
    onCreate.mockReturnValue(new Promise(() => undefined));
    render(<ClosureForm onCreate={onCreate} />);
    fill('2026-11-02', 'Holiday');
    submit();
    const button = screen.getByRole('button', { name: 'Adding…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
