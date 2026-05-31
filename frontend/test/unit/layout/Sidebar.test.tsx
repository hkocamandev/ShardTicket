import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const useModeMock = vi.fn();
const useFlagsMock = vi.fn();
const useRedisHealthMock = vi.fn();
vi.mock('../../../src/api/hooks', () => ({
  useMode: () => useModeMock(),
  useFlags: () => useFlagsMock(),
  useRedisHealth: () => useRedisHealthMock(),
}));

import Sidebar from '../../../src/layout/Sidebar';

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useModeMock.mockReset();
  useFlagsMock.mockReset().mockReturnValue({
    data: { USE_REDIS_CACHE: false, USE_REDIS_LOCK: false },
    isLoading: false,
  });
  useRedisHealthMock.mockReset().mockReturnValue({
    data: { ready: true, pong: true },
    isLoading: false,
  });
});

describe('<Sidebar /> mode badge', () => {
  it('renders the TX badge when mode is tx', () => {
    useModeMock.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    renderSidebar();
    expect(screen.getByText(/TX · sharded/i)).toBeInTheDocument();
  });

  it('renders the Non-TX badge when mode is nontx', () => {
    useModeMock.mockReturnValue({ data: { mode: 'nontx' }, isLoading: false });
    renderSidebar();
    expect(screen.getByText(/Non-TX · replica set/i)).toBeInTheDocument();
  });

  it('renders the loading placeholder while the mode query is in flight', () => {
    useModeMock.mockReturnValue({ data: undefined, isLoading: true });
    renderSidebar();
    expect(screen.getByText(/loading mode/i)).toBeInTheDocument();
  });

  it('renders backend-down badge when mode is undefined and not loading', () => {
    useModeMock.mockReturnValue({ data: undefined, isLoading: false });
    renderSidebar();
    expect(screen.getByText(/backend down/i)).toBeInTheDocument();
  });

  it('renders all four nav links', () => {
    useModeMock.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    renderSidebar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /load tester/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /shards/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /metrics/i })).toBeInTheDocument();
  });
});

describe('<Sidebar /> redis flag badges', () => {
  it('renders Cache · OFF when USE_REDIS_CACHE is false', () => {
    useModeMock.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    renderSidebar();
    expect(screen.getByText(/Cache · off/i)).toBeInTheDocument();
  });

  it('renders Cache · ON when USE_REDIS_CACHE is true', () => {
    useModeMock.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    useFlagsMock.mockReturnValue({
      data: { USE_REDIS_CACHE: true, USE_REDIS_LOCK: false },
      isLoading: false,
    });
    renderSidebar();
    expect(screen.getByText(/Cache · on/i)).toBeInTheDocument();
  });

  it('renders Lock · ON when USE_REDIS_LOCK is true', () => {
    useModeMock.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    useFlagsMock.mockReturnValue({
      data: { USE_REDIS_CACHE: false, USE_REDIS_LOCK: true },
      isLoading: false,
    });
    renderSidebar();
    expect(screen.getByText(/Lock · on/i)).toBeInTheDocument();
  });

  it('renders "Cache · redis down" + "Lock · redis down" when health.ready is false', () => {
    useModeMock.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    useRedisHealthMock.mockReturnValue({
      data: { ready: false, pong: false },
      isLoading: false,
    });
    renderSidebar();
    expect(screen.getByText(/Cache · redis down/i)).toBeInTheDocument();
    expect(screen.getByText(/Lock · redis down/i)).toBeInTheDocument();
  });

  it('renders loading placeholder for flags when isLoading is true', () => {
    useModeMock.mockReturnValue({ data: { mode: 'tx' }, isLoading: false });
    useFlagsMock.mockReturnValue({ data: undefined, isLoading: true });
    renderSidebar();
    expect(screen.getByText(/loading cache/i)).toBeInTheDocument();
    expect(screen.getByText(/loading lock/i)).toBeInTheDocument();
  });
});
