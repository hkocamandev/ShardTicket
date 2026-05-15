import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const useModeMock = vi.fn();
vi.mock('../../../src/api/hooks', () => ({
  useMode: () => useModeMock(),
}));

import Sidebar from '../../../src/layout/Sidebar';

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('<Sidebar /> mode badge', () => {
  beforeEach(() => {
    useModeMock.mockReset();
  });

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
