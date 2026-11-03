import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from '../api/endpoints.ts';
import { ApiError } from '../api/errors.ts';
import type { User } from '../api/types.ts';
import { AccountPage } from './AccountPage.tsx';

vi.mock('../api/endpoints.ts');

const auth = vi.hoisted(() => ({
  user: null as User | null,
  deleteAccount: vi.fn(),
  logoutAll: vi.fn(),
}));

vi.mock('../auth/useAuth.ts', () => ({ useAuth: () => auth }));

function renderAs(user: Partial<User> = {}) {
  auth.user = {
    id: 'u1',
    email: 'real@example.com',
    full_name: 'Real Person',
    role: 'customer',
    ...user,
  };
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AccountPage', () => {
  it('shows the profile', () => {
    renderAs();
    expect(screen.getByText('Real Person')).toBeInTheDocument();
    expect(screen.getByText('real@example.com')).toBeInTheDocument();
  });

  it('turns account changes off for a shared demo account', () => {
    renderAs({ email: 'demo.customer@example.com' });
    expect(screen.getByRole('heading', { name: 'Shared demo account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
  });

  it('changes the password and reports signed-out sessions', async () => {
    vi.mocked(changePassword).mockResolvedValueOnce({ other_sessions_revoked: 2 });
    const user = userEvent.setup();
    renderAs();
    await user.type(screen.getByLabelText('Current password'), 'old-password-123');
    await user.type(screen.getByLabelText('New password'), 'new-password-456');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('status')).toHaveTextContent('2 other sessions were signed out');
    expect(changePassword).toHaveBeenCalledWith({
      current_password: 'old-password-123',
      new_password: 'new-password-456',
    });
  });

  it('asks for the password before deleting, and shows a refusal', async () => {
    auth.deleteAccount.mockRejectedValueOnce(new ApiError(400, 'Password is incorrect'));
    const user = userEvent.setup();
    renderAs();
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Enter your password to confirm'), 'wrong-one');
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Password is incorrect');
    expect(auth.deleteAccount).toHaveBeenCalledWith('wrong-one');
  });

  it('can back out of deleting', async () => {
    const user = userEvent.setup();
    renderAs();
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.click(screen.getByRole('button', { name: 'Keep my account' }));
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeInTheDocument();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('only offers deletion to customers', () => {
    renderAs({ role: 'staff' });
    expect(screen.queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument();
  });
});
