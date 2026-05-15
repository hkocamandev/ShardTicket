import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const adminMocks = vi.hoisted(() => ({
  events: vi.fn(),
  ticketsCount: vi.fn(),
  getMode: vi.fn(),
  shardDistribution: vi.fn(),
}));

vi.mock('../../../src/api/admin', () => ({ adminApi: adminMocks }));
vi.mock('../../../src/api/k6', () => ({ k6Api: { scenarios: vi.fn(), status: vi.fn() } }));

import { useEvents, useMode, useTicketsCount } from '../../../src/api/hooks';

function wrapper(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  Object.values(adminMocks).forEach((fn) => fn.mockReset());
});

describe('react-query hooks', () => {
  it('useEvents resolves to the events payload on success', async () => {
    adminMocks.events.mockResolvedValue([{ tenantId: 't1', eventId: 'e1', totalTickets: 10, remainingTickets: 7 }]);
    const { result } = renderHook(() => useEvents(), { wrapper: ({ children }) => wrapper(children) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].tenantId).toBe('t1');
  });

  it('useTicketsCount surfaces the count value', async () => {
    adminMocks.ticketsCount.mockResolvedValue({ count: 42 });
    const { result } = renderHook(() => useTicketsCount(), { wrapper: ({ children }) => wrapper(children) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(42);
  });

  it('useMode resolves to the current mode on success', async () => {
    adminMocks.getMode.mockResolvedValue({ mode: 'tx' });
    const { result } = renderHook(() => useMode(), { wrapper: ({ children }) => wrapper(children) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.mode).toBe('tx');
  });
});
