import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

const spawned = [];

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    spawned.push(proc);
    return proc;
  }),
}));

vi.mock('../../../src/models/Ticket.js', () => ({ default: { deleteMany: vi.fn() } }));
vi.mock('../../../src/models/Event.js', () => ({ default: { deleteMany: vi.fn() } }));

let seedRunner;
beforeEach(async () => {
  spawned.length = 0;
  vi.resetModules();
  seedRunner = await import('../../../src/services/seedRunner.js');
});

describe('seedRunner', () => {
  it('rejects unknown seed mode synchronously with INVALID_SEED_MODE', () => {
    expect(() => seedRunner.runSeed({ mode: 'totally_invalid' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_SEED_MODE' })
    );
  });

  it('resolves when the child process exits with code 0', async () => {
    const promise = seedRunner.runSeed({ mode: 'hot' });
    const proc = spawned.at(-1);
    proc.stdout.emit('data', Buffer.from('seeded 10000 tickets\n'));
    proc.emit('exit', 0);
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('seeded 10000 tickets');
  });

  it('rejects with SCRIPT_FAILED when child process exits non-zero', async () => {
    const promise = seedRunner.runSeed({ mode: 'multi' });
    const proc = spawned.at(-1);
    proc.stderr.emit('data', Buffer.from('boom\n'));
    proc.emit('exit', 1);
    await expect(promise).rejects.toMatchObject({
      code: 'SCRIPT_FAILED',
      exitCode: 1,
    });
  });
});
