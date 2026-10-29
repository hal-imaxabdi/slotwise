import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSlots, listAdminServices, listBusinessHours, listMyAppointments, listServices, logout, me } from './api/endpoints.ts';
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

  it('shows the booking page for a signed-in user', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    vi.mocked(getSlots).mockResolvedValue({
      service_id: 's1',
      date: '2026-10-27',
      timezone: 'Asia/Jakarta',
      duration_minutes: 30,
      slots: [],
    });
    renderApp('/services/s1/book');
    expect(await screen.findByRole('heading', { name: 'Book Classic Haircut' })).toBeInTheDocument();
    expect(await screen.findByText('No times are available on this date.')).toBeInTheDocument();
  });

  it('shows the appointments page for a signed-in user', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    vi.mocked(listMyAppointments).mockResolvedValue([]);
    renderApp('/appointments');
    expect(
      await screen.findByRole('heading', { name: 'My appointments', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('You have no appointments yet.')).toBeInTheDocument();
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

describe('App admin routing', () => {
  it('shows the admin page to an admin at /admin', async () => {
    vi.mocked(me).mockResolvedValue({ ...AUTH, user: { ...AUTH.user, role: 'admin' } });
    vi.mocked(listAdminServices).mockResolvedValue([]);
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Admin', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('No services match this filter.')).toBeInTheDocument();
  });

  it('keeps a customer off /admin', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Admin', level: 1 })).not.toBeInTheDocument();
    expect(listAdminServices).not.toHaveBeenCalled();
  });
});

describe('App business-hours routing', () => {
  it('shows the business hours page to an admin', async () => {
    vi.mocked(me).mockResolvedValue({ ...AUTH, user: { ...AUTH.user, role: 'admin' } });
    vi.mocked(listBusinessHours).mockResolvedValue([]);
    renderApp('/admin/business-hours');
    expect(
      await screen.findByRole('heading', { name: 'Business hours', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Weekly hours' })).toBeInTheDocument();
  });

  it('keeps a customer off business hours', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    renderApp('/admin/business-hours');
    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
    expect(listBusinessHours).not.toHaveBeenCalled();
  });
});
