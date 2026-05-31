import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const hookMocks = vi.hoisted(() => ({
  useEvents: vi.fn(),
  useTicketsCount: vi.fn(),
  useMode: vi.fn(),
  useFlags: vi.fn(),
  useRedisHealth: vi.fn(),
}));

const adminMocks = vi.hoisted(() => ({
  setMode: vi.fn(),
  setFlag: vi.fn().mockResolvedValue({
    flag: 'USE_REDIS_CACHE',
    value: true,
    restartingInMs: 500,
  }),
  seed: vi.fn(),
  postSeedSharding: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('../../../src/api/hooks', () => hookMocks);
vi.mock('../../../src/api/admin', () => ({
  adminApi: adminMocks,
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
  hookMocks.useTicketsCount
    .mockReset()
    .mockReturnValue({ data: { count: 0 }, isLoading: false, error: null });
  hookMocks.useMode.mockReset();
  hookMocks.useFlags.mockReset().mockReturnValue({
    data: { USE_REDIS_CACHE: false, USE_REDIS_LOCK: false },
    isLoading: false,
  });
  hookMocks.useRedisHealth.mockReset().mockReturnValue({
    data: { ready: true, pong: true },
    isLoading: false,
  });
  adminMocks.setFlag.mockClear();
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

describe('<Dashboard /> redis toggles', () => {
  it('renders both Cache and Lock buttons as OFF when flags are false', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    renderDashboard();
    expect(screen.getByRole('button', { name: /cache: off/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lock: off/i })).toBeInTheDocument();
  });

  it('renders Cache button as ON when USE_REDIS_CACHE is true', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    hookMocks.useFlags.mockReturnValue({
      data: { USE_REDIS_CACHE: true, USE_REDIS_LOCK: false },
      isLoading: false,
    });
    renderDashboard();
    expect(screen.getByRole('button', { name: /cache: on/i })).toBeInTheDocument();
  });

  it('disables Cache and Lock buttons when Redis is unreachable', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    hookMocks.useRedisHealth.mockReturnValue({
      data: { ready: false, pong: false },
      isLoading: false,
    });
    renderDashboard();
    expect(screen.getByRole('button', { name: /cache: off/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /lock: off/i })).toBeDisabled();
  });

  it('calls setFlag with USE_REDIS_CACHE=true when the Cache OFF button is clicked', async () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /cache: off/i }));
    await waitFor(() => {
      expect(adminMocks.setFlag).toHaveBeenCalledWith('USE_REDIS_CACHE', true);
    });
  });

  it('calls setFlag with USE_REDIS_LOCK=true when the Lock OFF button is clicked', async () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /lock: off/i }));
    await waitFor(() => {
      expect(adminMocks.setFlag).toHaveBeenCalledWith('USE_REDIS_LOCK', true);
    });
  });

  it('calls setFlag with USE_REDIS_CACHE=false when an already-ON Cache button is clicked', async () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    hookMocks.useFlags.mockReturnValue({
      data: { USE_REDIS_CACHE: true, USE_REDIS_LOCK: false },
      isLoading: false,
    });
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /cache: on/i }));
    await waitFor(() => {
      expect(adminMocks.setFlag).toHaveBeenCalledWith('USE_REDIS_CACHE', false);
    });
  });
});
