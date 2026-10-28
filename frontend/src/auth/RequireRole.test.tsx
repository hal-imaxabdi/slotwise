import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../api/types.ts';
import { authValueFor } from '../test/fixtures.ts';
import { AuthContext } from './context.ts';
import { RequireRole } from './RequireRole.tsx';

function renderGuarded(role: Role | null, allow: readonly Role[]) {
  return render(
    <AuthContext.Provider value={authValueFor(role)}>
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route element={<RequireRole allow={allow} />}>
            <Route path="secret" element={<p>Secret content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RequireRole', () => {
  it('renders the page for an allowed role', () => {
    renderGuarded('staff', ['staff', 'admin']);
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('shows a message instead of the page for a customer', () => {
    renderGuarded('customer', ['staff', 'admin']);
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
  });

  it('keeps admin-only pages away from staff', () => {
    renderGuarded('staff', ['admin']);
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
    expect(screen.getByText('You do not have access to this page.')).toBeInTheDocument();
  });

  it('denies when there is no user', () => {
    renderGuarded(null, ['staff', 'admin']);
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });
});
