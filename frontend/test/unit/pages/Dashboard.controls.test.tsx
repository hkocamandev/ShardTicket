import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const hookMocks = vi.hoisted(() => ({
  useEvents: vi.fn(),
  useTicketsCount: vi.fn(),
  useMode: vi.fn(),
}));

vi.mock('../../../src/api/hooks', () => hookMocks);
vi.mock('../../../src/api/admin', () => ({
  adminApi: {
    setMode: vi.fn(),
    seed: vi.fn(),
    postSeedSharding: vi.fn(),
    reset: vi.fn(),
  },
}));

import Dashboard from '../../../src/pages/Dashboard';

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  hookMocks.useEvents.mockReset().mockReturnValue({ data: [], isLoading: false, error: null });
  hookMocks.useTicketsCount.mockReset().mockReturnValue({ data: { count: 0 }, isLoading: false, error: null });
  hookMocks.useMode.mockReset();
});

describe('<Dashboard /> control panel mode-aware buttons', () => {
  it('disables "Seed multi" when current mode is nontx', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'nontx' }, isLoading: false });
    renderDashboard();
    const seedMulti = screen.getByRole('button', { name: /seed multi/i });
    expect(seedMulti).toBeDisabled();
  });

  it('enables "Seed multi" when current mode is tx', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    renderDashboard();
    const seedMulti = screen.getByRole('button', { name: /seed multi/i });
    expect(seedMulti).not.toBeDisabled();
  });

  it('disables "Run post-seed sharding" when mode is nontx', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'nontx' }, isLoading: false });
    renderDashboard();
    const sharding = screen.getByRole('button', { name: /run post-seed sharding/i });
    expect(sharding).toBeDisabled();
    expect(sharding.getAttribute('title')).toMatch(/requires TX mode/i);
  });

  it('enables "Run post-seed sharding" when mode is tx', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    renderDashboard();
    const sharding = screen.getByRole('button', { name: /run post-seed sharding/i });
    expect(sharding).not.toBeDisabled();
  });

  it('always enables Seed hot regardless of mode', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'nontx' }, isLoading: false });
    renderDashboard();
    const seedHot = screen.getByRole('button', { name: /seed hot/i });
    expect(seedHot).not.toBeDisabled();
  });
});
