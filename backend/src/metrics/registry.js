import promClient from 'prom-client';

export const register = promClient.register;

promClient.collectDefaultMetrics({ register });

export const ticketBuyTotal = new promClient.Counter({
  name: 'ticket_buy_total',
  help: 'Ticket buy attempts grouped by mode and final result',
  labelNames: ['mode', 'result'],
});

export const ticketBuyLatencyMs = new promClient.Histogram({
  name: 'ticket_buy_latency_ms',
  help: 'End-to-end latency of a ticket buy attempt in milliseconds',
  labelNames: ['mode', 'result'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

export const ticketBuyRetriesTotal = new promClient.Counter({
  name: 'ticket_buy_retries_total',
  help: 'Total transaction retry attempts performed across all buy operations',
  labelNames: ['mode'],
});

export const mongoWriteConflictTotal = new promClient.Counter({
  name: 'mongo_writeconflict_total',
  help: 'MongoDB WriteConflict / TransientTransactionError occurrences',
  labelNames: ['mode'],
});

export const ticketCacheHitTotal = new promClient.Counter({
  name: 'ticket_cache_hit_total',
  help: 'Redis cache hits grouped by logical key group',
  labelNames: ['key_group'],
});

export const ticketCacheMissTotal = new promClient.Counter({
  name: 'ticket_cache_miss_total',
  help: 'Redis cache misses grouped by logical key group',
  labelNames: ['key_group'],
});

export const ticketCacheErrorTotal = new promClient.Counter({
  name: 'ticket_cache_error_total',
  help: 'Redis cache operation failures (unavailable, get, set, parse)',
  labelNames: ['key_group', 'op'],
});

export const lockAcquireTotal = new promClient.Counter({
  name: 'lock_acquire_total',
  help: 'Distributed lock acquire attempts grouped by final result',
  labelNames: ['result'],
});

export const lockReleaseTotal = new promClient.Counter({
  name: 'lock_release_total',
  help: 'Distributed lock release attempts grouped by final result',
  labelNames: ['result'],
});

export const lockWaitMs = new promClient.Histogram({
  name: 'lock_wait_ms',
  help: 'Milliseconds spent in acquire() until success or final busy',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
});

export const LOCK_RESULTS = Object.freeze({
  SUCCESS: 'success',
  BUSY: 'busy',
  EXPIRED: 'expired',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
});

export const BUY_RESULTS = Object.freeze({
  SUCCESS: 'success',
  SOLD_OUT: 'sold_out',
  CONFLICT: 'conflict',
  ERROR: 'error',
});

export const BUY_MODES = Object.freeze({
  TX: 'tx',
  NONTX: 'nontx',
});
