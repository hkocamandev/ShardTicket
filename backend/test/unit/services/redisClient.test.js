import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// vi.mock at top-level — vitest hoists; the factory must not reference outer
// variables. We replay the same minimal shape ioredis-mock would provide.
vi.mock('ioredis', () => {
  class MockRedis {
    constructor(opts) {
      this.opts = opts;
      this.status = 'connecting';
      this._handlers = {};
      // Simulate async connect → ready transition.
      queueMicrotask(() => {
        this.status = 'ready';
        (this._handlers.connect || []).forEach((fn) => fn());
      });
    }
    on(evt, fn) {
      (this._handlers[evt] ||= []).push(fn);
      return this;
    }
    async ping() {
      return 'PONG';
    }
    async quit() {
      this.status = 'end';
      return 'OK';
    }
  }
  return { default: MockRedis };
});

let mod;

beforeEach(async () => {
  vi.resetModules();
  mod = await import('../../../src/services/redisClient.js');
});

afterEach(async () => {
  await mod.closeClient();
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_PORT;
});

describe('redisClient', () => {
  it('getClient returns the same singleton instance', () => {
    const a = mod.getClient();
    const b = mod.getClient();
    expect(a).toBe(b);
  });

  it('getClient reads REDIS_HOST and REDIS_PORT from env', () => {
    process.env.REDIS_HOST = 'cache.local';
    process.env.REDIS_PORT = '6380';
    const c = mod.getClient();
    expect(c.opts.host).toBe('cache.local');
    expect(c.opts.port).toBe(6380);
  });

  it('isReady reflects underlying client status', async () => {
    expect(mod.isReady()).toBe(false); // no client yet
    mod.getClient();
    // wait one microtask for the mock to transition to ready
    await Promise.resolve();
    expect(mod.isReady()).toBe(true);
  });

  it('ping returns true when connected, false when no client', async () => {
    expect(await mod.ping()).toBe(false); // no client created
    mod.getClient();
    await Promise.resolve();
    expect(await mod.ping()).toBe(true);
  });

  it('closeClient resets the singleton so getClient creates a fresh one', async () => {
    const first = mod.getClient();
    await mod.closeClient();
    const second = mod.getClient();
    expect(second).not.toBe(first);
  });
});
