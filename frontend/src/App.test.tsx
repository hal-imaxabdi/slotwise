import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listServices, logout, me } from './api/endpoints.ts';
import { UnauthorizedError } from './api/errors.ts';
import type { Service } from './api/types.ts';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { AUTH } from './test/fixtures.ts';

vi.mock('./api/endpoints.ts');

const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Classic Haircut',
    description: 'A classic cut.',
    duration_minutes: 30,
    price_idr: 75000,
  },
];

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

  it('sends an anonymous visitor on a deep link to the sign-in page', async () => {
    vi.mocked(me).mockRejectedValue(new UnauthorizedError('Not authenticated'));
    renderApp('/services');
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Slotwise' }),
    ).toBeInTheDocument();
  });

  it('shows the services page to a signed-in user at /', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Services', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Classic Haircut' })).toBeInTheDocument();
    expect(screen.getByText('Demo Customer')).toBeInTheDocument();
  });

  it('redirects unknown paths to the services page', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Services', level: 1 })).toBeInTheDocument();
  });

  it('signing out returns to the sign-in page', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    vi.mocked(logout).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Slotwise' }),
    ).toBeInTheDocument();
  });
});
