import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout.tsx';

vi.mock('../auth/useAuth.ts', () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="services" element={<p>Services page</p>} />
          <Route path="services/:serviceId/book" element={<p>Booking page</p>} />
          <Route path="appointments" element={<p>Appointments page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout accessibility', () => {
  it('skip link moves focus to the main landmark', async () => {
    const user = userEvent.setup();
    renderAt('/services');
    await user.click(screen.getByRole('link', { name: 'Skip to main content' }));
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it.each([
    ['/services', 'Services - Slotwise'],
    ['/services/abc/book', 'Book a service - Slotwise'],
    ['/appointments', 'My appointments - Slotwise'],
  ])('sets the document title for %s', (path, title) => {
    renderAt(path);
    expect(document.title).toBe(title);
  });
});
