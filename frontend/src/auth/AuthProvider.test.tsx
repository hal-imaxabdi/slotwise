import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout, me } from '../api/endpoints.ts';
import { NetworkError, UnauthorizedError } from '../api/errors.ts';
import type { AuthOut } from '../api/types.ts';
import { AUTH } from '../test/fixtures.ts';
import { AuthProvider } from './AuthProvider.tsx';
import { useAuth } from './useAuth.ts';

vi.mock('../api/endpoints.ts');

function Probe() {
  const auth = useAuth();
  const [actionError, setActionError] = useState('none');

  function capture(promise: Promise<void>) {
    promise.catch((error: unknown) => {
      setActionError(error instanceof Error ? error.message : 'unknown');
    });
  }

  return (
    <div>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="user">{auth.user?.email ?? 'none'}</p>
      <p data-testid="error">{auth.error ?? 'none'}</p>
      <p data-testid="action-error">{actionError}</p>
      <button
        type="button"
        onClick={() => {
          capture(auth.login('demo.customer@example.com', 'pw-123456789'));
        }}
      >
        do login
      </button>
      <button
        type="button"
        onClick={() => {
          capture(auth.logout());
        }}
      >
        do logout
      </button>
      <button type="button" onClick={auth.retry}>
        do retry
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

async function expectStatus(status: string) {
  await waitFor(() => {
    expect(screen.getByTestId('status')).toHaveTextContent(status);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AuthProvider', () => {
  it('is loading until /auth/me answers, then authenticated', async () => {
    let resolve!: (value: AuthOut) => void;
    vi.mocked(me).mockReturnValueOnce(
      new Promise<AuthOut>((r) => {
        resolve = r;
      }),
    );
    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    resolve(AUTH);
    await expectStatus('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('demo.customer@example.com');
  });

  it('becomes anonymous when /auth/me returns 401', async () => {
    vi.mocked(me).mockRejectedValueOnce(new UnauthorizedError('Not authenticated'));
    renderProvider();
    await expectStatus('anonymous');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('shows an error state on a network failure and recovers on retry', async () => {
    vi.mocked(me).mockRejectedValueOnce(new NetworkError());
    vi.mocked(me).mockResolvedValueOnce(AUTH);
    const user = userEvent.setup();
    renderProvider();
    await expectStatus('error');
    expect(screen.getByTestId('error')).toHaveTextContent('Could not reach the server');
    await user.click(screen.getByRole('button', { name: 'do retry' }));
    await expectStatus('authenticated');
  });

  it('login stores the user', async () => {
    vi.mocked(me).mockRejectedValueOnce(new UnauthorizedError('Not authenticated'));
    vi.mocked(login).mockResolvedValueOnce(AUTH);
    const user = userEvent.setup();
    renderProvider();
    await expectStatus('anonymous');
    await user.click(screen.getByRole('button', { name: 'do login' }));
    await expectStatus('authenticated');
    expect(login).toHaveBeenCalledWith('demo.customer@example.com', 'pw-123456789');
    expect(screen.getByTestId('user')).toHaveTextContent('demo.customer@example.com');
  });

  it('a failed login rethrows and stays anonymous', async () => {
    vi.mocked(me).mockRejectedValueOnce(new UnauthorizedError('Not authenticated'));
    vi.mocked(login).mockRejectedValueOnce(new UnauthorizedError('Invalid email or password'));
    const user = userEvent.setup();
    renderProvider();
    await expectStatus('anonymous');
    await user.click(screen.getByRole('button', { name: 'do login' }));
    await waitFor(() => {
      expect(screen.getByTestId('action-error')).toHaveTextContent('Invalid email or password');
    });
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
  });

  it('logout clears the user', async () => {
    vi.mocked(me).mockResolvedValueOnce(AUTH);
    vi.mocked(logout).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderProvider();
    await expectStatus('authenticated');
    await user.click(screen.getByRole('button', { name: 'do logout' }));
    await expectStatus('anonymous');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('a failed logout keeps the user signed in and rethrows', async () => {
    vi.mocked(me).mockResolvedValueOnce(AUTH);
    vi.mocked(logout).mockRejectedValueOnce(new NetworkError());
    const user = userEvent.setup();
    renderProvider();
    await expectStatus('authenticated');
    await user.click(screen.getByRole('button', { name: 'do logout' }));
    await waitFor(() => {
      expect(screen.getByTestId('action-error')).toHaveTextContent('Could not reach the server');
    });
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
  });
});
