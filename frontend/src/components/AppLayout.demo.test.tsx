import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '../api/types.ts';
import { AppLayout } from './AppLayout.tsx';

const auth = vi.hoisted(() => ({ user: null as User | null }));

vi.mock('../auth/useAuth.ts', () => ({
  useAuth: () => ({ user: auth.user, logout: vi.fn() }),
}));

const BANNER = 'You’re exploring a demo. Data resets regularly.';

function renderAs(email: string) {
  auth.user = { id: 'u1', email, full_name: 'Some One', role: 'staff' };
  return render(
    <MemoryRouter initialEntries={['/services']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="services" element={<p>content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout demo banner', () => {
  it('shows on a shared demo account', () => {
    renderAs('staff@barbershop.example');
    expect(screen.getByText(BANNER)).toBeInTheDocument();
  });

  it('stays hidden for everyone else', () => {
    renderAs('someone@example.com');
    expect(screen.queryByText(BANNER)).not.toBeInTheDocument();
  });

  it('links the avatar to the account page', () => {
    renderAs('someone@example.com');
    expect(screen.getByRole('link', { name: 'Account: Some One' })).toHaveAttribute(
      'href',
      '/account',
    );
  });
});
