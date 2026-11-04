import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, me } from '../api/endpoints.ts';
import { UnauthorizedError } from '../api/errors.ts';
import { pingHealth, waitForServer } from '../api/health.ts';
import type { AuthOut } from '../api/types.ts';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import { WAKING_MESSAGE } from '../components/LoadingScreen.tsx';
import { AUTH } from '../test/fixtures.ts';
import { LANDING_TITLE, LandingPage } from './LandingPage.tsx';

vi.mock('../api/endpoints.ts');
vi.mock('../api/health.ts');

const STAFF_AUTH: AuthOut = {
  ...AUTH,
  user: { ...AUTH.user, email: 'staff@barbershop.example', role: 'staff' },
};

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/services" element={<p>services page</p>} />
          <Route path="/staff" element={<p>staff page</p>} />
          <Route path="/admin" element={<p>admin page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(me).mockRejectedValue(new UnauthorizedError('Not authenticated'));
  vi.mocked(waitForServer).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LandingPage', () => {
  it('shows the pitch without signing in, and sets the title', async () => {
    renderLanding();
    expect(
      await screen.findByRole('heading', { level: 1, name: /Never double.booked/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try the live demo' }).length).toBeGreaterThan(0);
    expect(document.title).toBe(LANDING_TITLE);
  });

  it('“Try the live demo” signs straight in as the demo client', async () => {
    vi.mocked(login).mockResolvedValueOnce(AUTH);
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getAllByRole('button', { name: 'Try the live demo' })[0]);
    expect(await screen.findByText('services page')).toBeInTheDocument();
    expect(waitForServer).toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith('demo.customer@example.com', 'demo-customer-2026');
  });

  it('wakes the API as soon as it loads', () => {
    renderLanding();
    expect(pingHealth).toHaveBeenCalledTimes(1);
  });

  it('gives every image a text alternative', () => {
    renderLanding();
    for (const img of screen.getAllByRole('img')) {
      expect(img).toHaveAccessibleName();
    }
  });

  it('offers one demo button per role', () => {
    renderLanding();
    for (const label of ['Explore as a client', 'Explore as staff', 'Explore as the owner']) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled();
    }
  });

  it('signs in through the normal login and opens that role’s start page', async () => {
    vi.mocked(login).mockResolvedValueOnce(STAFF_AUTH);
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole('button', { name: 'Explore as staff' }));
    expect(await screen.findByText('staff page')).toBeInTheDocument();
    expect(waitForServer).toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith('staff@barbershop.example', 'demo-staff-2026');
  });

  it('shows the error on the card and lets the visitor try again', async () => {
    vi.mocked(login).mockRejectedValueOnce(new UnauthorizedError('Invalid email or password'));
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole('button', { name: 'Explore as the owner' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: 'Explore as the owner' })).toBeEnabled();
  });

  it('explains the wait when the server is waking up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(waitForServer).mockReturnValueOnce(new Promise<void>(() => undefined));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderLanding();
    await user.click(screen.getByRole('button', { name: 'Explore as a client' }));
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    expect(screen.queryByText(WAKING_MESSAGE)).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByRole('status')).toHaveTextContent(WAKING_MESSAGE);
  });

  it('lets a visitor pick a time and open it in the client demo', async () => {
    vi.mocked(login).mockResolvedValueOnce(AUTH);
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole('button', { name: '11:00' }));
    expect(screen.getByRole('button', { name: '11:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '09:00, taken' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Book 11:00 in the demo' }));
    expect(await screen.findByText('services page')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('demo.customer@example.com', 'demo-customer-2026');
  });

  it('describes the appointment-book animation for screen readers', () => {
    renderLanding();
    expect(
      screen.getByRole('img', { name: /A second booking for 10:00 is refused/ }),
    ).toBeInTheDocument();
  });

  it('sends a signed-in visitor straight to the app', async () => {
    vi.mocked(me).mockResolvedValue(AUTH);
    renderLanding();
    expect(await screen.findByText('services page')).toBeInTheDocument();
  });
});
