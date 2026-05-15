import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const hookMocks = vi.hoisted(() => ({
  useK6Scenarios: vi.fn(),
  useK6Status: vi.fn(),
  useMode: vi.fn(),
}));

vi.mock('../../../src/api/hooks', () => hookMocks);
vi.mock('../../../src/api/k6', () => ({
  k6Api: { run: vi.fn(), stop: vi.fn() },
}));

import LoadTester from '../../../src/pages/LoadTester';

const allScenarios = [
  { name: 'hot_event', modes: ['tx'] },
  { name: 'hot_event_sharded', modes: ['tx'] },
  { name: 'non_transactional', modes: ['nontx'] },
];

function renderLoadTester() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LoadTester />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  hookMocks.useK6Scenarios.mockReset().mockReturnValue({ data: allScenarios });
  hookMocks.useK6Status.mockReset().mockReturnValue({ data: { status: 'idle', logTail: [] } });
  hookMocks.useMode.mockReset();
});

describe('<LoadTester /> scenario filtering', () => {
  it('shows only TX-compatible scenarios when mode is tx', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' } });
    renderLoadTester();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('hot_event');
    expect(values).toContain('hot_event_sharded');
    expect(values).not.toContain('non_transactional');
  });

  it('shows only Non-TX scenario when mode is nontx', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'nontx' } });
    renderLoadTester();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['non_transactional']);
  });

  it('disables Run button while a scenario is running', () => {
    hookMocks.useMode.mockReturnValue({ data: { mode: 'tx' } });
    hookMocks.useK6Status.mockReturnValue({
      data: { status: 'running', logTail: [], scenario: 'hot_event' },
    });
    renderLoadTester();
    expect(screen.getByRole('button', { name: /^run$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /stop/i })).not.toBeDisabled();
  });
});
