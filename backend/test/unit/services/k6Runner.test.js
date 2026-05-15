import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.pid = 4242;
    proc.kill = vi.fn();
    return proc;
  }),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    default: { ...actual.default, mkdirSync: vi.fn() },
    mkdirSync: vi.fn(),
  };
});

let k6Runner;

beforeEach(async () => {
  vi.resetModules();
  k6Runner = await import('../../../src/services/k6Runner.js');
});

describe('k6Runner', () => {
  it('listScenarios returns the whitelist with mode metadata', () => {
    const list = k6Runner.listScenarios();
    expect(list).toEqual(
      expect.arrayContaining([
        { name: 'hot_event', modes: ['tx'] },
        { name: 'hot_event_sharded', modes: ['tx'] },
        { name: 'non_transactional', modes: ['nontx'] },
      ])
    );
  });

  it('startRun rejects scenario not in the whitelist', () => {
    expect(() => k6Runner.startRun({ scenario: 'malicious_payload' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_SCENARIO' })
    );
  });

  it('startRun transitions state to running and back to idle on exit', async () => {
    const cp = await import('child_process');
    const result = k6Runner.startRun({ scenario: 'hot_event', duration: '5s' });
    expect(result.scenario).toBe('hot_event');
    expect(k6Runner.getStatus().status).toBe('running');

    const proc = cp.spawn.mock.results.at(-1).value;
    proc.emit('exit', 0);

    expect(k6Runner.getStatus().status).toBe('idle');
    expect(k6Runner.getStatus().exitCode).toBe(0);
  });

  it('startRun refuses a concurrent run', () => {
    k6Runner.startRun({ scenario: 'hot_event' });
    expect(() => k6Runner.startRun({ scenario: 'hot_event' })).toThrowError(
      expect.objectContaining({ code: 'ALREADY_RUNNING' })
    );
  });

  it('stopRun throws NOT_RUNNING when idle', () => {
    expect(() => k6Runner.stopRun()).toThrowError(
      expect.objectContaining({ code: 'NOT_RUNNING' })
    );
  });
});
