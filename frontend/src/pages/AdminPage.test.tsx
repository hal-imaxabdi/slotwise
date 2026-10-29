import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage.tsx';
import { createAdminService, listAdminServices } from '../api/endpoints.ts';
import type { AdminService } from '../api/types.ts';

vi.mock('../api/endpoints.ts');

const haircut: AdminService = {
  id: 'svc-1',
  name: 'Haircut',
  description: '',
  duration_minutes: 60,
  price_idr: 50000,
  is_active: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listAdminServices).mockResolvedValue([haircut]);
});

describe('AdminPage', () => {
  it('renders the heading, filter, add toggle and the service list', async () => {
    render(<AdminPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByLabelText('Show')).toHaveValue('all');
    expect(screen.getByRole('button', { name: 'Add a service' })).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.findByText('Haircut')).toBeInTheDocument();
    expect(listAdminServices).toHaveBeenCalledWith(undefined, expect.anything());
  });

  it('refetches with the chosen status filter', async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Haircut');
    await user.selectOptions(screen.getByLabelText('Show'), 'inactive');
    await waitFor(() =>
      expect(listAdminServices).toHaveBeenLastCalledWith(false, expect.anything()),
    );
  });

  it('toggles the add form open and closed', async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Haircut');
    const toggle = screen.getByRole('button', { name: 'Add a service' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('form', { name: 'Add a service' })).toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('form', { name: 'Add a service' })).not.toBeInTheDocument();
  });

  it('reloads the list after a service is added', async () => {
    vi.mocked(createAdminService).mockResolvedValue({ ...haircut, id: 'svc-2', name: 'Massage' });
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Haircut');
    const callsBefore = vi.mocked(listAdminServices).mock.calls.length;
    vi.mocked(listAdminServices).mockResolvedValue([
      haircut,
      { ...haircut, id: 'svc-2', name: 'Massage' },
    ]);
    await user.click(screen.getByRole('button', { name: 'Add a service' }));
    await user.type(screen.getByLabelText('Name'), 'Massage');
    await user.type(screen.getByLabelText('Price (IDR)'), '150000');
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    expect(await screen.findByText('Massage')).toBeInTheDocument();
    expect(vi.mocked(listAdminServices).mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
