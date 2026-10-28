import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logout, me } from '../api/endpoints.ts';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import { AUTH } from '../test/fixtures.ts';
import { AppLayout } from './AppLayout.tsx';

vi.mock('../api/endpoints.ts');

function renderLayout(path = '/services') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="services" element={<p>Services content</p>} />
            <Route path="appointments" element={<p>Appointments content</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(me).mockResolvedValue(AUTH);
});

describe('AppLayout', () => {
  it('shows the nav, the user name and the page content', async () => {
    renderLayout();
    expect(await screen.findByText('Demo Customer')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('main')).toHaveTextContent('Services content');
  });

  it('links to My appointments', async () => {
    renderLayout();
    expect(await screen.findByRole('link', { name: 'My appointments' })).toHaveAttribute(
      'href',
      '/appointments',
    );
  });

  it('marks My appointments as current on /appointments', async () => {
    renderLayout('/appointments');
    expect(await screen.findByRole('link', { name: 'My appointments' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Services' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('main')).toHaveTextContent('Appointments content');
  });

  it('calls logout when Sign out is clicked', async () => {
    vi.mocked(logout).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLayout();
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shows an alert when logout fails', async () => {
    vi.mocked(logout).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderLayout();
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
