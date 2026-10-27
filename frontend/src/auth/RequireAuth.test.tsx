import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { me } from '../api/endpoints.ts';
import { NetworkError, UnauthorizedError } from '../api/errors.ts';
import type { AuthOut } from '../api/types.ts';
import { AUTH } from '../test/fixtures.ts';
import { AuthProvider } from './AuthProvider.tsx';
import { RequireAuth } from './RequireAuth.tsx';

vi.mock('../api/endpoints.ts');

function LoginStub() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  return <p>{`login page, from=${state?.from ?? 'none'}`}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginStub />} />
          <Route element={<RequireAuth />}>
            <Route path="/private" element={<p>private content</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('RequireAuth', () => {
  it('shows a loading status while the session check is pending', () => {
    vi.mocked(me).mockReturnValueOnce(new Promise<AuthOut>(() => undefined));
    renderAt('/private');
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('renders the protected route when authenticated', async () => {
    vi.mocked(me).mockResolvedValueOnce(AUTH);
    renderAt('/private');
    expect(await screen.findByText('private content')).toBeInTheDocument();
  });

  it('redirects anonymous visitors to /login and remembers where they were going', async () => {
    vi.mocked(me).mockRejectedValueOnce(new UnauthorizedError('Not authenticated'));
    renderAt('/private?x=1');
    expect(await screen.findByText('login page, from=/private?x=1')).toBeInTheDocument();
  });

  it('shows an error with a retry button when the session check fails', async () => {
    vi.mocked(me).mockRejectedValueOnce(new NetworkError());
    renderAt('/private');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not reach the server');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
