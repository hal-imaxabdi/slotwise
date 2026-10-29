import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { me } from '../api/endpoints.ts';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import { AUTH } from '../test/fixtures.ts';
import { AppLayout } from './AppLayout.tsx';

vi.mock('../api/endpoints.ts');

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/services']}>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="services" element={<p>Services content</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AppLayout brand and user chip', () => {
  it('links the brand to the services page', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    renderLayout();
    expect(await screen.findByRole('link', { name: 'Slotwise' })).toHaveAttribute(
      'href',
      '/services',
    );
  });

  it('shows initials in a decorative avatar next to the full name', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    renderLayout();
    expect(await screen.findByText('Demo Customer')).toBeInTheDocument();
    expect(screen.getByText('DC')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses a single initial for a one-word name', async () => {
    vi.mocked(me).mockResolvedValue({ ...AUTH, user: { ...AUTH.user, full_name: 'madonna' } });
    renderLayout();
    expect(await screen.findByText('madonna')).toBeInTheDocument();
    expect(screen.getByText('M')).toHaveAttribute('aria-hidden', 'true');
  });
});
