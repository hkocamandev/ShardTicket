import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the redis client surface so cache.js can be exercised without
// touching the network. We control isReady() and getClient() per test.
vi.mock('../../../src/services/redisClient.js', () => ({
  getClient: vi.fn(),
  isReady: vi.fn(),
  ping: vi.fn(),
  closeClient: vi.fn(),
  __setClientForTests: vi.fn(),
}));

import { wrap, invalidate, KEY_GROUPS } from '../../../src/services/cache.js';
import * as redisClient from '../../../src/services/redisClient.js';

function makeFakeClient() {
  const store = new Map();
  return {
    _store: store,
    get: vi.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    set: vi.fn(async (k, v) => {
      store.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (...keys) => {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n++;
      return n;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.USE_REDIS_CACHE;
});

afterEach(() => {
  delete process.env.USE_REDIS_CACHE;
});

describe('cache.wrap', () => {
  it('returns loader value directly when USE_REDIS_CACHE=false', async () => {
    process.env.USE_REDIS_CACHE = 'false';
    const loader = vi.fn(async () => ({ x: 1 }));
    const result = await wrap(KEY_GROUPS.ADMIN_EVENTS, 'k', 5, loader);
    expect(result).toEqual({ x: 1 });
    expect(loader).toHaveBeenCalledOnce();
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });

  it('returns loader value when flag is on but Redis is not ready', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(false);
    const loader = vi.fn(async () => 'value');
    const result = await wrap(KEY_GROUPS.ADMIN_EVENTS, 'k', 5, loader);
    expect(result).toBe('value');
    expect(loader).toHaveBeenCalledOnce();
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });

  it('caches the loader result and serves from cache on the second call', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(true);
    const client = makeFakeClient();
    redisClient.getClient.mockReturnValue(client);

    const loader = vi.fn(async () => ({ data: [1, 2, 3] }));

    const r1 = await wrap(KEY_GROUPS.ADMIN_EVENTS, 'k1', 5, loader);
    const r2 = await wrap(KEY_GROUPS.ADMIN_EVENTS, 'k1', 5, loader);

    expect(r1).toEqual({ data: [1, 2, 3] });
    expect(r2).toEqual({ data: [1, 2, 3] });
    expect(loader).toHaveBeenCalledOnce(); // 2nd call served from cache
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.set).toHaveBeenCalledOnce();
    // SET was called with EX TTL
    expect(client.set).toHaveBeenCalledWith('k1', JSON.stringify({ data: [1, 2, 3] }), 'EX', 5);
  });

  it('falls back to loader when GET throws (graceful degradation)', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(true);
    const client = {
      get: vi.fn(async () => { throw new Error('redis-down'); }),
      set: vi.fn(),
      del: vi.fn(),
    };
    redisClient.getClient.mockReturnValue(client);

    const loader = vi.fn(async () => 'fallback');
    const result = await wrap(KEY_GROUPS.ADMIN_EVENTS, 'k', 5, loader);
    expect(result).toBe('fallback');
    expect(loader).toHaveBeenCalledOnce();
    expect(client.set).not.toHaveBeenCalled();
  });

  it('still returns loader value when SET throws after a miss', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(true);
    const client = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => { throw new Error('set-fail'); }),
      del: vi.fn(),
    };
    redisClient.getClient.mockReturnValue(client);

    const loader = vi.fn(async () => 'v');
    const result = await wrap(KEY_GROUPS.ADMIN_EVENTS, 'k', 5, loader);
    expect(result).toBe('v');
  });

  it('treats poisoned JSON as a miss and re-loads', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(true);
    const client = {
      get: vi.fn(async () => '<<<not-json>>>'),
      set: vi.fn(async () => 'OK'),
      del: vi.fn(),
    };
    redisClient.getClient.mockReturnValue(client);

    const loader = vi.fn(async () => ({ y: 2 }));
    const result = await wrap(KEY_GROUPS.ADMIN_EVENTS, 'k', 5, loader);
    expect(result).toEqual({ y: 2 });
    expect(loader).toHaveBeenCalledOnce();
    expect(client.set).toHaveBeenCalledOnce();
  });
});

describe('cache.invalidate', () => {
  it('returns 0 when flag is off', async () => {
    process.env.USE_REDIS_CACHE = 'false';
    const n = await invalidate('a', 'b');
    expect(n).toBe(0);
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });

  it('returns 0 when redis is not ready', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(false);
    const n = await invalidate('a');
    expect(n).toBe(0);
  });

  it('returns 0 for empty key list', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(true);
    redisClient.getClient.mockReturnValue(makeFakeClient());
    const n = await invalidate();
    expect(n).toBe(0);
  });

  it('deletes existing keys and returns count', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(true);
    const client = makeFakeClient();
    client._store.set('a', '1');
    client._store.set('b', '2');
    redisClient.getClient.mockReturnValue(client);

    const n = await invalidate('a', 'b', 'missing');
    expect(n).toBe(2);
    expect(client.del).toHaveBeenCalledWith('a', 'b', 'missing');
  });

  it('returns 0 when DEL throws', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    redisClient.isReady.mockReturnValue(true);
    redisClient.getClient.mockReturnValue({
      del: vi.fn(async () => { throw new Error('boom'); }),
    });
    expect(await invalidate('a')).toBe(0);
  });
});
