import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../src/services/redisClient.js', () => ({
  getClient: vi.fn(),
  isReady: vi.fn(),
  ping: vi.fn(),
  closeClient: vi.fn(),
  __setClientForTests: vi.fn(),
}));

import { acquire, release, NOOP_TOKEN } from '../../../src/services/distributedLock.js';
import * as redisClient from '../../../src/services/redisClient.js';

function fakeClient() {
  return {
    set: vi.fn(),
    eval: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.USE_REDIS_LOCK;
});

afterEach(() => {
  delete process.env.USE_REDIS_LOCK;
});

describe('distributedLock.acquire', () => {
  it('returns NOOP_TOKEN when USE_REDIS_LOCK=false', async () => {
    process.env.USE_REDIS_LOCK = 'false';
    const t = await acquire('k', 1000);
    expect(t).toBe(NOOP_TOKEN);
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });

  it('returns NOOP_TOKEN when flag is on but redis is not ready', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(false);
    const t = await acquire('k', 1000);
    expect(t).toBe(NOOP_TOKEN);
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });

  it('acquires lock on first try when SET NX returns OK', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(true);
    const c = fakeClient();
    c.set.mockResolvedValue('OK');
    redisClient.getClient.mockReturnValue(c);

    const t = await acquire('lock:k', 1234);
    expect(t).toBeTruthy();
    expect(t).not.toBe(NOOP_TOKEN);
    expect(c.set).toHaveBeenCalledOnce();
    // SET key value PX ttl NX
    expect(c.set).toHaveBeenCalledWith('lock:k', t, 'PX', 1234, 'NX');
  });

  it('returns null after exhausting retries when always busy', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(true);
    const c = fakeClient();
    c.set.mockResolvedValue(null); // ioredis returns null when NX rejected
    redisClient.getClient.mockReturnValue(c);

    const t = await acquire('k', 1000, 3, 1); // 1ms delay to keep test fast
    expect(t).toBeNull();
    expect(c.set).toHaveBeenCalledTimes(3);
  });

  it('succeeds on retry when lock frees up mid-flight', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(true);
    const c = fakeClient();
    c.set.mockResolvedValueOnce(null).mockResolvedValueOnce('OK');
    redisClient.getClient.mockReturnValue(c);

    const t = await acquire('k', 1000, 3, 1);
    expect(t).toBeTruthy();
    expect(t).not.toBe(NOOP_TOKEN);
    expect(c.set).toHaveBeenCalledTimes(2);
  });

  it('returns NOOP_TOKEN when SET throws (graceful degradation)', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(true);
    const c = fakeClient();
    c.set.mockRejectedValue(new Error('redis-blip'));
    redisClient.getClient.mockReturnValue(c);

    const t = await acquire('k', 1000, 3, 1);
    expect(t).toBe(NOOP_TOKEN);
  });
});

describe('distributedLock.release', () => {
  it('is a no-op when USE_REDIS_LOCK=false', async () => {
    process.env.USE_REDIS_LOCK = 'false';
    await release('k', 'some-token');
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });

  it('is a no-op when token is NOOP_TOKEN', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    await release('k', NOOP_TOKEN);
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });

  it('is a no-op when token is null/undefined', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    await release('k', null);
    await release('k', undefined);
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });

  it('calls EVAL with release script and token, on success returns silently', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(true);
    const c = fakeClient();
    c.eval.mockResolvedValue(1); // 1 = deleted
    redisClient.getClient.mockReturnValue(c);

    await release('lock:k', 'tkn-abc');
    expect(c.eval).toHaveBeenCalledOnce();
    const args = c.eval.mock.calls[0];
    expect(args[0]).toContain('redis.call("GET", KEYS[1])');
    expect(args[0]).toContain('redis.call("DEL", KEYS[1])');
    expect(args[1]).toBe(1);
    expect(args[2]).toBe('lock:k');
    expect(args[3]).toBe('tkn-abc');
  });

  it('handles EVAL returning 0 (token mismatch / expired) silently', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(true);
    const c = fakeClient();
    c.eval.mockResolvedValue(0);
    redisClient.getClient.mockReturnValue(c);
    await expect(release('k', 'tkn')).resolves.toBeUndefined();
  });

  it('swallows EVAL errors so callers never see a release exception', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(true);
    const c = fakeClient();
    c.eval.mockRejectedValue(new Error('script kill'));
    redisClient.getClient.mockReturnValue(c);
    await expect(release('k', 'tkn')).resolves.toBeUndefined();
  });

  it('returns silently when redis is not ready', async () => {
    process.env.USE_REDIS_LOCK = 'true';
    redisClient.isReady.mockReturnValue(false);
    await release('k', 'tkn');
    expect(redisClient.getClient).not.toHaveBeenCalled();
  });
});
