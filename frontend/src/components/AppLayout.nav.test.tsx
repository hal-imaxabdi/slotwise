import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../api/types.ts';
import { AuthContext } from '../auth/context.ts';
import { authValueFor } from '../test/fixtures.ts';
import { AppLayout } from './AppLayout.tsx';

function renderLayout(role: Role, path = '/services') {
  return render(
    <AuthContext.Provider value={authValueFor(role)}>
      <MemoryRouter initialEntries={[path]}>
        <AppLayout />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AppLayout navigation by role', () => {
  it('shows no staff or admin links to a customer', () => {
    renderLayout('customer');
    expect(screen.getByRole('link', { name: 'Services' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('shows the Staff link but not Admin to staff', () => {
    renderLayout('staff');
    expect(screen.getByRole('link', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('shows both links to an admin', () => {
    renderLayout('admin');
    expect(screen.getByRole('link', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('sets the document title for the staff area', () => {
    renderLayout('staff', '/staff');
    expect(document.title).toBe('Staff - Slotwise');
  });
});

describe('AppLayout closures link', () => {
  it('hides the Closures link from a customer', () => {
    renderLayout('customer');
    expect(screen.queryByRole('link', { name: 'Closures' })).not.toBeInTheDocument();
  });

  it('shows the Closures link to staff and to an admin', () => {
    renderLayout('staff');
    expect(screen.getByRole('link', { name: 'Closures' })).toBeInTheDocument();
    renderLayout('admin');
    expect(screen.getAllByRole('link', { name: 'Closures' })).toHaveLength(2);
  });

  it('highlights only Closures, not Staff, on the closures page', () => {
    renderLayout('staff', '/staff/unavailable-periods');
    expect(screen.getByRole('link', { name: 'Closures' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Staff' })).not.toHaveAttribute('aria-current');
  });

  it('sets the document title for the closures page', () => {
    renderLayout('staff', '/staff/unavailable-periods');
    expect(document.title).toBe('Closures - Slotwise');
  });
});
