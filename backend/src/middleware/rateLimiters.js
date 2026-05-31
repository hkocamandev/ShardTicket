import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// Configurable per-minute caps. Defaults match the Phase 3 baseline; the
// env-var overrides are intended for k6 benchmark runs (e.g. the non-tx
// lock demo) where the default 600/min would mask race conditions by
// throttling the test traffic.
const BUY_LIMIT = parseInt(process.env.BUY_RATE_LIMIT || '600', 10);
const ADMIN_LIMIT = parseInt(process.env.ADMIN_RATE_LIMIT || '30', 10);

const noop = (_req, _res, next) => next();

export const buyLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 60 * 1000,
      limit: BUY_LIMIT,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'rate_limited', scope: 'buy' },
    });

export const adminLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 60 * 1000,
      limit: ADMIN_LIMIT,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'rate_limited', scope: 'admin' },
    });
