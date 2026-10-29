import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateAdminService,
  deactivateAdminService,
  listAdminServices,
} from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { AdminService } from '../api/types.ts';
import { AdminServiceList } from './AdminServiceList.tsx';

vi.mock('../api/endpoints.ts');

function make(id: string, overrides: Partial<AdminService> = {}): AdminService {
  return {
    id,
    name: 'Classic Haircut',
    description: 'A classic cut.',
    duration_minutes: 30,
    price_idr: 75000,
    is_active: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AdminServiceList', () => {
  it('lists services with status, duration and price', async () => {
    vi.mocked(listAdminServices).mockResolvedValue([
      make('a'),
      make('b', { name: 'Hair Coloring', is_active: false, duration_minutes: 120, price_idr: 150000 }),
    ]);
    render(<AdminServiceList filter="all" />);
    expect(await screen.findByRole('heading', { name: 'Classic Haircut' })).toBeInTheDocument();
    expect(screen.getByText('Status: Active')).toBeInTheDocument();
    expect(screen.getByText('Status: Inactive')).toBeInTheDocument();
    expect(screen.getByText('120 minutes')).toBeInTheDocument();
    expect(screen.getByText(/75[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/150[.,]000/)).toBeInTheDocument();
    expect(listAdminServices).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
  });

  it('asks the server for only active services when the filter is active', async () => {
    vi.mocked(listAdminServices).mockResolvedValue([]);
    render(<AdminServiceList filter="active" />);
    expect(await screen.findByText('No services match this filter.')).toBeInTheDocument();
    expect(listAdminServices).toHaveBeenCalledWith(true, expect.any(AbortSignal));
  });

  it('deactivates after confirmation, refetches and moves focus to the heading', async () => {
    vi.mocked(listAdminServices)
      .mockResolvedValueOnce([make('a')])
      .mockResolvedValueOnce([make('a', { is_active: false })]);
    vi.mocked(deactivateAdminService).mockResolvedValue(make('a', { is_active: false }));
    const user = userEvent.setup();
    render(<AdminServiceList filter="all" />);
    await user.click(await screen.findByRole('button', { name: 'Deactivate Classic Haircut' }));
    expect(
      screen.getByRole('group', { name: 'Confirm deactivation of Classic Haircut' }),
    ).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Yes, deactivate service' }));
    expect(await screen.findByText('Classic Haircut deactivated.')).toBeInTheDocument();
    expect(deactivateAdminService).toHaveBeenCalledWith('a');
    await waitFor(() => {
      expect(listAdminServices).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Status: Inactive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Services', level: 2 })).toHaveFocus();
  });

  it('returns focus to Deactivate and sends nothing when the confirmation is dismissed', async () => {
    vi.mocked(listAdminServices).mockResolvedValue([make('a')]);
    const user = userEvent.setup();
    render(<AdminServiceList filter="all" />);
    await user.click(await screen.findByRole('button', { name: 'Deactivate Classic Haircut' }));
    await user.click(screen.getByRole('button', { name: 'Keep service' }));
    expect(screen.getByRole('button', { name: 'Deactivate Classic Haircut' })).toHaveFocus();
    expect(deactivateAdminService).not.toHaveBeenCalled();
  });

  it('activates an inactive service immediately', async () => {
    vi.mocked(listAdminServices)
      .mockResolvedValueOnce([make('a', { is_active: false })])
      .mockResolvedValueOnce([make('a')]);
    vi.mocked(activateAdminService).mockResolvedValue(make('a'));
    const user = userEvent.setup();
    render(<AdminServiceList filter="all" />);
    await user.click(await screen.findByRole('button', { name: 'Activate Classic Haircut' }));
    expect(await screen.findByText('Classic Haircut activated.')).toBeInTheDocument();
    expect(activateAdminService).toHaveBeenCalledWith('a');
    expect(await screen.findByText('Status: Active')).toBeInTheDocument();
  });

  it('shows the server message and refetches the list on a 404', async () => {
    vi.mocked(listAdminServices).mockResolvedValue([make('a')]);
    vi.mocked(deactivateAdminService).mockRejectedValue(
      new ApiError(404, 'Service not found', null),
    );
    const user = userEvent.setup();
    render(<AdminServiceList filter="all" />);
    await user.click(await screen.findByRole('button', { name: 'Deactivate Classic Haircut' }));
    await user.click(screen.getByRole('button', { name: 'Yes, deactivate service' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Service not found');
    await waitFor(() => {
      expect(listAdminServices).toHaveBeenCalledTimes(2);
    });
    expect(
      screen.queryByRole('group', { name: /^Confirm deactivation of/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the message on a 403 without refetching', async () => {
    vi.mocked(listAdminServices).mockResolvedValue([make('a')]);
    vi.mocked(deactivateAdminService).mockRejectedValue(new ApiError(403, 'Forbidden', null));
    const user = userEvent.setup();
    render(<AdminServiceList filter="all" />);
    await user.click(await screen.findByRole('button', { name: 'Deactivate Classic Haircut' }));
    await user.click(screen.getByRole('button', { name: 'Yes, deactivate service' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    expect(listAdminServices).toHaveBeenCalledTimes(1);
  });

  it('sends only one request when the confirm button is clicked twice', async () => {
    vi.mocked(listAdminServices).mockResolvedValue([make('a')]);
    vi.mocked(deactivateAdminService).mockReturnValue(new Promise<AdminService>(() => undefined));
    const user = userEvent.setup();
    render(<AdminServiceList filter="all" />);
    await user.click(await screen.findByRole('button', { name: 'Deactivate Classic Haircut' }));
    const yes = screen.getByRole('button', { name: 'Yes, deactivate service' });
    await user.click(yes);
    await user.click(yes);
    expect(deactivateAdminService).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Deactivating...' })).toBeDisabled();
  });

  it('shows a load error and recovers with Try again', async () => {
    vi.mocked(listAdminServices)
      .mockRejectedValueOnce(new ApiError(500, 'Server exploded', null))
      .mockResolvedValueOnce([make('a')]);
    const user = userEvent.setup();
    render(<AdminServiceList filter="all" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Classic Haircut' })).toBeInTheDocument();
  });
});
