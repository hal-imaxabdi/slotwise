import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listServices } from '../api/endpoints.ts';
import type { Service } from '../api/types.ts';
import { ServicesPage } from './ServicesPage.tsx';

vi.mock('../api/endpoints.ts');

const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Classic Haircut',
    description: 'A classic cut.',
    duration_minutes: 30,
    price_idr: 75000,
  },
  {
    id: 's2',
    name: 'Hair Coloring',
    description: 'Full color.',
    duration_minutes: 120,
    price_idr: 350000,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ServicesPage', () => {
  it('shows a loading state, then the services with formatted price and duration', async () => {
    vi.mocked(listServices).mockResolvedValue(SERVICES);
    render(<ServicesPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading services');
    expect(await screen.findByRole('heading', { name: 'Classic Haircut' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hair Coloring' })).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('Rp 75.000')).toBeInTheDocument();
    expect(screen.getByText('2 h')).toBeInTheDocument();
    expect(screen.getByText('Rp 350.000')).toBeInTheDocument();
  });

  it('shows an empty state when there are no services', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    render(<ServicesPage />);
    expect(await screen.findByText('No services are available right now.')).toBeInTheDocument();
  });

  it('shows an error and recovers on retry', async () => {
    vi.mocked(listServices)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(SERVICES);
    const user = userEvent.setup();
    render(<ServicesPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Classic Haircut' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listServices).toHaveBeenCalledTimes(2);
  });

  it('aborts the request on unmount', () => {
    vi.mocked(listServices).mockReturnValue(new Promise<Service[]>(() => undefined));
    const { unmount } = render(<ServicesPage />);
    const signal = vi.mocked(listServices).mock.calls[0]?.[0];
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
