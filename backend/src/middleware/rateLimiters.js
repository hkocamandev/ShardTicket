import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

const noop = (_req, _res, next) => next();

export const buyLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'rate_limited', scope: 'buy' },
    });

export const adminLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'rate_limited', scope: 'admin' },
    });
