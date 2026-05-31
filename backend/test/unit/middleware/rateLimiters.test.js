import { describe, it, expect, beforeEach, vi } from 'vitest';

// Capture the opts the limiter was constructed with so we can assert on
// `limit` without round-tripping through Express.
vi.mock('express-rate-limit', () => ({
  default: vi.fn((opts) => {
    const mw = (_req, _res, next) => next();
    mw._opts = opts;
    return mw;
  }),
}));

let prevNodeEnv;

beforeEach(() => {
  vi.resetModules();
  prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development'; // bypass the isTest noop path
  delete process.env.BUY_RATE_LIMIT;
  delete process.env.ADMIN_RATE_LIMIT;
});

afterEach(() => {
  process.env.NODE_ENV = prevNodeEnv;
  delete process.env.BUY_RATE_LIMIT;
  delete process.env.ADMIN_RATE_LIMIT;
});

import { afterEach } from 'vitest';

describe('rateLimiters config', () => {
  it('falls back to 600 / 30 when env vars are unset', async () => {
    const mod = await import('../../../src/middleware/rateLimiters.js');
    expect(mod.buyLimiter._opts.limit).toBe(600);
    expect(mod.adminLimiter._opts.limit).toBe(30);
  });

  it('reads BUY_RATE_LIMIT and ADMIN_RATE_LIMIT from env when set', async () => {
    process.env.BUY_RATE_LIMIT = '100000';
    process.env.ADMIN_RATE_LIMIT = '1000';
    const mod = await import('../../../src/middleware/rateLimiters.js');
    expect(mod.buyLimiter._opts.limit).toBe(100000);
    expect(mod.adminLimiter._opts.limit).toBe(1000);
  });

  it('returns noop middleware in test env regardless of env vars', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BUY_RATE_LIMIT = '50';
    const mod = await import('../../../src/middleware/rateLimiters.js');
    // noop has no _opts because the rateLimit factory was never invoked
    expect(mod.buyLimiter._opts).toBeUndefined();
    expect(mod.adminLimiter._opts).toBeUndefined();
  });
});
