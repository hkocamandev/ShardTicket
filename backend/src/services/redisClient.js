import Redis from 'ioredis';

const HOST = () => process.env.REDIS_HOST || 'redis';
const PORT = () => parseInt(process.env.REDIS_PORT || '6379', 10);

let client = null;

// Singleton ioredis client. Connection is lazy: first getClient() call
// opens the TCP connection. retryStrategy keeps the app alive when Redis
// is temporarily down — features that depend on Redis (cache, lock) check
// status before issuing commands.
export function getClient() {
  if (client) return client;
  client = new Redis({
    host: HOST(),
    port: PORT(),
    lazyConnect: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 100, 2000),
  });
  client.on('error', (err) => {
    if (!client._loggedError || client._loggedError !== err.message) {
      client._loggedError = err.message;
      console.error('[redis] error:', err.message);
    }
  });
  client.on('connect', () => {
    client._loggedError = null;
    console.log('[redis] connected', `${HOST()}:${PORT()}`);
  });
  return client;
}

export function isReady() {
  return Boolean(client && client.status === 'ready');
}

export async function ping() {
  if (!client) return false;
  try {
    const reply = await client.ping();
    return reply === 'PONG';
  } catch {
    return false;
  }
}

export async function closeClient() {
  if (!client) return;
  try { await client.quit(); } catch { /* ignore */ }
  client = null;
}

// Test-only injection seam. The unit tests swap in an ioredis-mock so they
// never reach the network.
export function __setClientForTests(c) {
  client = c;
}
