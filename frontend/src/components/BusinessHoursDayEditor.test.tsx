import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors.ts';
import type { BusinessInterval } from '../api/types.ts';
import { BusinessHoursDayEditor } from './BusinessHoursDayEditor.tsx';

type SaveFn = (weekday: number, intervals: BusinessInterval[]) => Promise<void>;

const NINE_TO_NOON: BusinessInterval[] = [{ open_minute: 540, close_minute: 720 }];

function setup(intervals: BusinessInterval[], onSave?: SaveFn) {
  const save = vi.fn<SaveFn>(onSave ?? (() => Promise.resolve()));
  const user = userEvent.setup();
  render(<BusinessHoursDayEditor weekday={0} intervals={intervals} onSave={save} />);
  return { save, user };
}

describe('BusinessHoursDayEditor', () => {
  it('shows a closed day and lets you add the first interval', async () => {
    const { save, user } = setup([]);
    expect(screen.getByText('Closed all day.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add interval to Monday' }));
    expect(screen.getByLabelText('Monday interval 1 opens')).toHaveValue('540');
    expect(screen.getByLabelText('Monday interval 1 closes')).toHaveValue('600');
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(0, [{ open_minute: 540, close_minute: 600 }]);
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Monday hours saved.');
  });

  it('sends the intervals sorted by opening time', async () => {
    const { save, user } = setup(NINE_TO_NOON);
    await user.click(screen.getByRole('button', { name: 'Add interval to Monday' }));
    await user.selectOptions(screen.getByLabelText('Monday interval 2 opens'), '480');
    await user.selectOptions(screen.getByLabelText('Monday interval 2 closes'), '510');
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(0, [
        { open_minute: 480, close_minute: 510 },
        { open_minute: 540, close_minute: 720 },
      ]);
    });
  });

  it('rejects overlapping intervals without calling onSave', async () => {
    const { save, user } = setup(NINE_TO_NOON);
    await user.click(screen.getByRole('button', { name: 'Add interval to Monday' }));
    await user.selectOptions(screen.getByLabelText('Monday interval 2 opens'), '660');
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Intervals must not overlap.');
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an interval that closes before it opens', async () => {
    const { save, user } = setup(NINE_TO_NOON);
    await user.selectOptions(screen.getByLabelText('Monday interval 1 closes'), '540');
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Each interval must close after it opens.');
    expect(save).not.toHaveBeenCalled();
  });

  it('says so and does not call onSave when nothing changed', async () => {
    const { save, user } = setup(NINE_TO_NOON);
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No changes to save.');
    expect(save).not.toHaveBeenCalled();
  });

  it('closes the day by removing every interval', async () => {
    const { save, user } = setup(NINE_TO_NOON);
    await user.click(screen.getByRole('button', { name: 'Remove Monday interval 1' }));
    expect(screen.getByText('Closed all day.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(0, []);
    });
  });

  it('shows a server 409 inline and keeps the edited values', async () => {
    const { user } = setup(NINE_TO_NOON, () =>
      Promise.reject(
        new ApiError(409, '2 active appointment(s) would fall outside these hours'),
      ),
    );
    await user.selectOptions(screen.getByLabelText('Monday interval 1 closes'), '660');
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('active appointment(s)');
    expect(screen.getByLabelText('Monday interval 1 closes')).toHaveValue('660');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('disables Add interval at 8 intervals', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({
      open_minute: i * 120,
      close_minute: i * 120 + 60,
    }));
    setup(eight);
    expect(screen.getByRole('button', { name: 'Add interval to Monday' })).toBeDisabled();
  });

  it('sends only one request when Save is clicked twice', async () => {
    const { save, user } = setup(NINE_TO_NOON, () => new Promise<void>(() => undefined));
    await user.selectOptions(screen.getByLabelText('Monday interval 1 closes'), '780');
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    await user.click(screen.getByRole('button', { name: 'Save Monday hours' }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save Monday hours' })).toBeDisabled();
  });
});
