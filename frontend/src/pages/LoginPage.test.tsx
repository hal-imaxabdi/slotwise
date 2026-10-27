import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, me } from '../api/endpoints.ts';
import { RateLimitError, UnauthorizedError } from '../api/errors.ts';
import type { AuthOut } from '../api/types.ts';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import { AUTH } from '../test/fixtures.ts';
import { LoginPage } from './LoginPage.tsx';

vi.mock('../api/endpoints.ts');

function renderLogin(entry: string | { pathname: string; state: unknown } = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>home page</p>} />
          <Route path="/appointments" element={<p>appointments page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(user: UserEvent) {
  await user.type(await screen.findByLabelText('Email'), 'demo.customer@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret-pass-1');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(me).mockRejectedValue(new UnauthorizedError('Not authenticated'));
});

describe('LoginPage', () => {
  it('shows the form once the session check says anonymous', async () => {
    renderLogin();
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('logs in and goes to the page the user was heading to', async () => {
    vi.mocked(login).mockResolvedValueOnce(AUTH);
    const user = userEvent.setup();
    renderLogin({ pathname: '/login', state: { from: '/appointments' } });
    await fillAndSubmit(user);
    expect(await screen.findByText('appointments page')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('demo.customer@example.com', 'secret-pass-1');
  });

  it('goes to the home page when there is no "from"', async () => {
    vi.mocked(login).mockResolvedValueOnce(AUTH);
    const user = userEvent.setup();
    renderLogin();
    await fillAndSubmit(user);
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  it('ignores an unsafe "from" value', async () => {
    vi.mocked(login).mockResolvedValueOnce(AUTH);
    const user = userEvent.setup();
    renderLogin({ pathname: '/login', state: { from: '//evil.example' } });
    await fillAndSubmit(user);
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  it('shows the server message on a failed login and re-enables the button', async () => {
    vi.mocked(login).mockRejectedValueOnce(new UnauthorizedError('Invalid email or password'));
    const user = userEvent.setup();
    renderLogin();
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('tells the user how long to wait when throttled', async () => {
    vi.mocked(login).mockRejectedValueOnce(new RateLimitError('Too many failed login attempts.', 900));
    const user = userEvent.setup();
    renderLogin();
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('15 minutes');
  });

  it('redirects away when already signed in', async () => {
    vi.mocked(me).mockResolvedValueOnce(AUTH);
    renderLogin();
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  it('disables the button while the request is in flight', async () => {
    let resolve!: (value: AuthOut) => void;
    vi.mocked(login).mockReturnValueOnce(
      new Promise<AuthOut>((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();
    renderLogin();
    await fillAndSubmit(user);
    expect(await screen.findByRole('button', { name: 'Signing in...' })).toBeDisabled();
    resolve(AUTH);
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });
});
