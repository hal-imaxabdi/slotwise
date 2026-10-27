import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logout, me } from './api/endpoints.ts';
import { UnauthorizedError } from './api/errors.ts';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { AUTH } from './test/fixtures.ts';

vi.mock('./api/endpoints.ts');

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('App routing', () => {
  it('sends an anonymous visitor to the sign-in page', async () => {
    vi.mocked(me).mockRejectedValue(new UnauthorizedError('Not authenticated'));
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Slotwise' }),
    ).toBeInTheDocument();
  });

  it('shows the home page to a signed-in user', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    renderApp('/');
    expect(await screen.findByText('Signed in as Demo Customer')).toBeInTheDocument();
  });

  it('redirects unknown paths to the home page', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    renderApp('/nope');
    expect(await screen.findByText('Signed in as Demo Customer')).toBeInTheDocument();
  });

  it('signing out returns to the sign-in page', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    vi.mocked(logout).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Slotwise' }),
    ).toBeInTheDocument();
  });
});
