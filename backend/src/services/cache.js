import { getClient, isReady } from './redisClient.js';
import { readFlag, FLAGS } from './featureFlags.js';
import {
  ticketCacheHitTotal,
  ticketCacheMissTotal,
  ticketCacheErrorTotal,
} from '../metrics/registry.js';

// Logical buckets used as the `key_group` Prometheus label so the Grafana
// panel can break hit/miss rate per endpoint family. Adding a new cached
// endpoint = add a constant here + use it in the wrap() call.
export const KEY_GROUPS = Object.freeze({
  ADMIN_EVENTS: 'admin_events',
  ADMIN_TICKETS_COUNT: 'admin_tickets_count',
  ADMIN_SHARD_DISTRIBUTION: 'admin_shard_distribution',
});

/**
 * Cache-aside helper.
 *   - Flag off  → loader() result is returned directly. No counter touched.
 *   - Flag on, Redis up:
 *       GET key. If hit → JSON.parse and return (++hit).
 *       Else loader(), SET with TTL, return (++miss).
 *   - Flag on, Redis down or GET/SET errors → loader() result returned
 *     (graceful degradation, ++error{op}).
 */
export async function wrap(keyGroup, key, ttlSec, loader) {
  if (!readFlag(FLAGS.USE_REDIS_CACHE)) {
    return loader();
  }
  if (!isReady()) {
    ticketCacheErrorTotal.inc({ key_group: keyGroup, op: 'unavailable' });
    return loader();
  }
  const client = getClient();
  let raw;
  try {
    raw = await client.get(key);
  } catch (err) {
    ticketCacheErrorTotal.inc({ key_group: keyGroup, op: 'get' });
    return loader();
  }
  if (raw !== null && raw !== undefined) {
    ticketCacheHitTotal.inc({ key_group: keyGroup });
    try {
      return JSON.parse(raw);
    } catch {
      // poisoned cache value → treat as miss, overwrite
      ticketCacheErrorTotal.inc({ key_group: keyGroup, op: 'parse' });
    }
  }
  ticketCacheMissTotal.inc({ key_group: keyGroup });
  const value = await loader();
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch (err) {
    ticketCacheErrorTotal.inc({ key_group: keyGroup, op: 'set' });
  }
  return value;
}

// Best-effort multi-key invalidation. Safe to call when flag is off or
// Redis is down — both paths return 0 silently. Stage 3 / future write
// paths can hook here without coupling to Redis status.
export async function invalidate(...keys) {
  if (!readFlag(FLAGS.USE_REDIS_CACHE)) return 0;
  if (!isReady()) return 0;
  if (keys.length === 0) return 0;
  try {
    return await getClient().del(...keys);
  } catch {
    return 0;
  }
}
