import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCustomers } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { StaffCustomer } from '../api/types.ts';
import { CustomerPicker } from './CustomerPicker.tsx';

vi.mock('../api/endpoints.ts');

const ALICE: StaffCustomer = { id: 'c1', email: 'alice@example.com', full_name: 'Alice Wong' };
const BOB: StaffCustomer = { id: 'c2', email: 'bob@example.com', full_name: 'Bob Stone' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('CustomerPicker', () => {
  it('does not search until Search is pressed', () => {
    render(<CustomerPicker selectedId={null} onSelect={vi.fn()} />);
    expect(searchCustomers).not.toHaveBeenCalled();
  });

  it('searches, lists results and reports the chosen customer', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.mocked(searchCustomers).mockResolvedValue([ALICE, BOB]);
    render(<CustomerPicker selectedId={null} onSelect={onSelect} />);

    await user.type(screen.getByLabelText('Customer name or email'), '  ali ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(searchCustomers).toHaveBeenCalledWith('ali', expect.any(AbortSignal));
    await user.click(await screen.findByRole('button', { name: /Alice Wong/ }));
    expect(onSelect).toHaveBeenCalledWith(ALICE);
  });

  it('says when nobody matches', async () => {
    const user = userEvent.setup();
    vi.mocked(searchCustomers).mockResolvedValue([]);
    render(<CustomerPicker selectedId={null} onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No matching customers.')).toBeInTheDocument();
  });

  it('shows an error and can retry', async () => {
    const user = userEvent.setup();
    vi.mocked(searchCustomers).mockRejectedValueOnce(new ApiError(500, 'Server error', null));
    render(<CustomerPicker selectedId={null} onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    vi.mocked(searchCustomers).mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No matching customers.')).toBeInTheDocument();
    expect(searchCustomers).toHaveBeenCalledTimes(2);
  });
});
