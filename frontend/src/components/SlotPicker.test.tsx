import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSlots } from '../api/endpoints.ts';
import type { Slot, SlotsResponse } from '../api/types.ts';
import { SlotPicker } from './SlotPicker.tsx';

vi.mock('../api/endpoints.ts');

const SLOT_A: Slot = { starts_at: '2026-10-29T02:00:00Z', local_time: '09:00' };
const SLOT_B: Slot = { starts_at: '2026-10-29T02:30:00Z', local_time: '09:30' };

const RESPONSE: SlotsResponse = {
  service_id: 's1',
  date: '2026-10-29',
  timezone: 'Asia/Jakarta',
  duration_minutes: 30,
  slots: [SLOT_A, SLOT_B],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SlotPicker', () => {
  it('shows loading, then the times and the timezone', async () => {
    vi.mocked(getSlots).mockResolvedValue(RESPONSE);
    render(<SlotPicker serviceId="s1" date="2026-10-29" selected={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading available times');
    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '09:30' })).toBeInTheDocument();
    expect(screen.getByText('Times are in Asia/Jakarta.')).toBeInTheDocument();
    expect(getSlots).toHaveBeenCalledWith('s1', '2026-10-29', expect.anything());
  });

  it('marks the selected time as pressed and reports clicks', async () => {
    vi.mocked(getSlots).mockResolvedValue(RESPONSE);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <SlotPicker serviceId="s1" date="2026-10-29" selected={SLOT_A.starts_at} onSelect={onSelect} />,
    );
    expect(await screen.findByRole('button', { name: '09:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '09:30' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: '09:30' }));
    expect(onSelect).toHaveBeenCalledWith(SLOT_B);
  });

  it('shows an empty state when no times are available', async () => {
    vi.mocked(getSlots).mockResolvedValue({ ...RESPONSE, slots: [] });
    render(<SlotPicker serviceId="s1" date="2026-10-29" selected={null} onSelect={vi.fn()} />);
    expect(await screen.findByText('No times are available on this date.')).toBeInTheDocument();
  });

  it('shows an error and recovers on retry', async () => {
    vi.mocked(getSlots).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(RESPONSE);
    const user = userEvent.setup();
    render(<SlotPicker serviceId="s1" date="2026-10-29" selected={null} onSelect={vi.fn()} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getSlots).toHaveBeenCalledTimes(2);
  });

  it('aborts the request on unmount', () => {
    vi.mocked(getSlots).mockReturnValue(new Promise<SlotsResponse>(() => undefined));
    const { unmount } = render(
      <SlotPicker serviceId="s1" date="2026-10-29" selected={null} onSelect={vi.fn()} />,
    );
    const signal = vi.mocked(getSlots).mock.calls[0]?.[2];
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
