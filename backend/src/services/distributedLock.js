import { v4 as uuid } from 'uuid';
import { getClient, isReady } from './redisClient.js';
import { readFlag, FLAGS } from './featureFlags.js';
import {
  lockAcquireTotal,
  lockReleaseTotal,
  lockWaitMs,
  LOCK_RESULTS,
} from '../metrics/registry.js';

// Lua release script: token check + DEL must be atomic so we never delete a
// lock owned by someone else. This is the "fencing-lite" pattern from
// redis_info.txt section 17.
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

// Sentinel returned when the lock layer is disabled or degraded. Callers
// should treat any truthy value as "proceed"; only null means "back off".
export const NOOP_TOKEN = '__noop_lock__';

/**
 * Try to acquire a distributed lock.
 *
 *  Flag OFF             -> NOOP_TOKEN  (pass-through, caller proceeds).
 *  Redis not ready      -> NOOP_TOKEN  (graceful degradation; metric tagged).
 *  SET NX OK            -> uuid token  (caller MUST release with same token).
 *  Busy after retries   -> null        (caller should return 503).
 *  SET threw            -> NOOP_TOKEN  (do not block traffic on infra blip).
 */
export async function acquire(key, ttlMs, maxAttempts = 3, baseDelayMs = 50) {
  if (!readFlag(FLAGS.USE_REDIS_LOCK)) {
    return NOOP_TOKEN;
  }
  if (!isReady()) {
    lockAcquireTotal.inc({ result: LOCK_RESULTS.UNAVAILABLE });
    return NOOP_TOKEN;
  }
  const client = getClient();
  const token = uuid();
  const startMs = Date.now();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await client.set(key, token, 'PX', ttlMs, 'NX');
    } catch {
      lockAcquireTotal.inc({ result: LOCK_RESULTS.ERROR });
      return NOOP_TOKEN;
    }
    if (res === 'OK') {
      lockAcquireTotal.inc({ result: LOCK_RESULTS.SUCCESS });
      lockWaitMs.observe(Date.now() - startMs);
      return token;
    }
    if (attempt < maxAttempts) {
      const jitter = Math.floor(Math.random() * baseDelayMs);
      await sleep(baseDelayMs + jitter);
    }
  }
  lockAcquireTotal.inc({ result: LOCK_RESULTS.BUSY });
  lockWaitMs.observe(Date.now() - startMs);
  return null;
}

/**
 * Release a lock obtained from acquire(). Safe to call with any token state:
 *
 *  Flag OFF / NOOP_TOKEN / null token -> no-op (no Redis call).
 *  Token matches in Redis             -> DEL, counter 'success'.
 *  Token differs (we expired)         -> no DEL, counter 'expired'.
 *  EVAL threw                         -> swallowed, counter 'error'.
 */
export async function release(key, token) {
  if (!readFlag(FLAGS.USE_REDIS_LOCK)) return;
  if (!token || token === NOOP_TOKEN) return;
  if (!isReady()) {
    lockReleaseTotal.inc({ result: LOCK_RESULTS.UNAVAILABLE });
    return;
  }
  try {
    const res = await getClient().eval(RELEASE_SCRIPT, 1, key, token);
    if (res === 1) {
      lockReleaseTotal.inc({ result: LOCK_RESULTS.SUCCESS });
    } else {
      lockReleaseTotal.inc({ result: LOCK_RESULTS.EXPIRED });
    }
  } catch {
    lockReleaseTotal.inc({ result: LOCK_RESULTS.ERROR });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
