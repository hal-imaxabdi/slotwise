import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminServiceForm from './AdminServiceForm.tsx';
import { createAdminService, updateAdminService } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { AdminService } from '../api/types.ts';

vi.mock('../api/endpoints.ts');

const existing: AdminService = {
  id: 'svc-7',
  name: 'Haircut',
  description: 'Basic cut',
  duration_minutes: 60,
  price_idr: 50000,
  is_active: true,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AdminServiceForm (create)', () => {
  it('submits trimmed values and reports success', async () => {
    vi.mocked(createAdminService).mockResolvedValue({ ...existing, id: 'svc-8' });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<AdminServiceForm onSaved={onSaved} />);
    await user.type(screen.getByLabelText('Name'), '  Massage ');
    await user.selectOptions(screen.getByLabelText('Duration'), '90');
    await user.type(screen.getByLabelText('Price (IDR)'), '150000');
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createAdminService).toHaveBeenCalledWith({
      name: 'Massage',
      description: '',
      duration_minutes: 90,
      price_idr: 150000,
    });
    expect(screen.getByRole('status')).toHaveTextContent('Service added.');
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('rejects an empty name without calling the API', async () => {
    const user = userEvent.setup();
    render(<AdminServiceForm onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText('Price (IDR)'), '1000');
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Name must be');
    expect(createAdminService).not.toHaveBeenCalled();
  });

  it('rejects a non-integer price', async () => {
    const user = userEvent.setup();
    render(<AdminServiceForm onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText('Name'), 'X');
    await user.type(screen.getByLabelText('Price (IDR)'), '12.5');
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Price must be');
    expect(createAdminService).not.toHaveBeenCalled();
  });

  it('shows a 409 inline and keeps the values', async () => {
    vi.mocked(createAdminService).mockRejectedValue(
      new ApiError(409, 'A service with that name already exists'),
    );
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<AdminServiceForm onSaved={onSaved} />);
    await user.type(screen.getByLabelText('Name'), 'Haircut');
    await user.type(screen.getByLabelText('Price (IDR)'), '1000');
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByLabelText('Name')).toHaveValue('Haircut');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('ignores a second submit while one is in flight', async () => {
    let resolve!: (v: AdminService) => void;
    vi.mocked(createAdminService).mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<AdminServiceForm onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText('Name'), 'Facial');
    await user.type(screen.getByLabelText('Price (IDR)'), '1000');
    const button = screen.getByRole('button', { name: 'Add service' });
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(createAdminService).toHaveBeenCalledTimes(1);
    resolve(existing);
  });
});

describe('AdminServiceForm (edit)', () => {
  it('sends only changed fields', async () => {
    vi.mocked(updateAdminService).mockResolvedValue(existing);
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<AdminServiceForm service={existing} onSaved={onSaved} />);
    await user.clear(screen.getByLabelText('Price (IDR)'));
    await user.type(screen.getByLabelText('Price (IDR)'), '60000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateAdminService).toHaveBeenCalledWith('svc-7', { price_idr: 60000 });
  });

  it('does not call the API when nothing changed', async () => {
    const user = userEvent.setup();
    render(<AdminServiceForm service={existing} onSaved={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No changes');
    expect(updateAdminService).not.toHaveBeenCalled();
  });

  it('calls onNotFound on 404', async () => {
    vi.mocked(updateAdminService).mockRejectedValue(new ApiError(404, 'Service not found'));
    const onNotFound = vi.fn();
    const user = userEvent.setup();
    render(<AdminServiceForm service={existing} onSaved={vi.fn()} onNotFound={onNotFound} />);
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onNotFound).toHaveBeenCalled());
  });
});
