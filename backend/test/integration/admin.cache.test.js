import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// End-to-end cache wrap proof: drive /admin/events through the actual
// Express + Mongoose stack, but mock the redis client surface so we can
// assert that the second polling call NEVER hits Mongo when the flag is on.
vi.mock('../../src/services/redisClient.js', () => {
  const store = new Map();
  const client = {
    get: vi.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    set: vi.fn(async (k, v) => { store.set(k, v); return 'OK'; }),
    del: vi.fn(async (...keys) => {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n++;
      return n;
    }),
    _store: store,
  };
  return {
    getClient: vi.fn(() => client),
    isReady: vi.fn(() => true),
    ping: vi.fn(async () => true),
    closeClient: vi.fn(),
    __setClientForTests: vi.fn(),
    __mockClient: client,
    __resetStore: () => store.clear(),
  };
});

let app;
let Event;
let Ticket;
let mockedRedis;

beforeAll(async () => {
  const { startMemoryMongo } = await import('../helpers/mongo.js');
  await startMemoryMongo();
  const { buildTestApp } = await import('../helpers/buildApp.js');
  app = buildTestApp();
  Event = (await import('../../src/models/Event.js')).default;
  Ticket = (await import('../../src/models/Ticket.js')).default;
  mockedRedis = await import('../../src/services/redisClient.js');
}, 90_000);

afterAll(async () => {
  const { stopMemoryMongo } = await import('../helpers/mongo.js');
  await stopMemoryMongo();
});

beforeEach(async () => {
  const { resetCollections } = await import('../helpers/mongo.js');
  await resetCollections();
  mockedRedis.__resetStore();
  vi.clearAllMocks();
  delete process.env.USE_REDIS_CACHE;
});

describe('admin endpoints cache wrap', () => {
  it('flag OFF: every request hits Mongo (loader called twice)', async () => {
    process.env.USE_REDIS_CACHE = 'false';
    await Event.create({ tenantId: 't1', eventId: 'e1', totalTickets: 5, remainingTickets: 5 });

    const r1 = await request(app).get('/admin/events');
    const r2 = await request(app).get('/admin/events');
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Redis was never called when flag is off
    expect(mockedRedis.__mockClient.get).not.toHaveBeenCalled();
    expect(mockedRedis.__mockClient.set).not.toHaveBeenCalled();
  });

  it('flag ON: first request fills cache, second hits cache and skips Mongo loader', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    await Event.create({ tenantId: 't1', eventId: 'e1', totalTickets: 5, remainingTickets: 5 });

    const r1 = await request(app).get('/admin/events');
    const r2 = await request(app).get('/admin/events');
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body).toEqual(r2.body);
    // first call: GET miss + SET
    // second call: GET hit, no SET
    expect(mockedRedis.__mockClient.get).toHaveBeenCalledTimes(2);
    expect(mockedRedis.__mockClient.set).toHaveBeenCalledTimes(1);
  });

  it('flag ON: /admin/tickets/count is cached after first call', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    await Ticket.create([
      { ticketId: 't1', tenantId: 'a', eventId: 'b' },
      { ticketId: 't2', tenantId: 'a', eventId: 'b' },
    ]);

    const r1 = await request(app).get('/admin/tickets/count');
    const r2 = await request(app).get('/admin/tickets/count');
    expect(r1.body).toEqual({ count: 2 });
    expect(r2.body).toEqual({ count: 2 });
    expect(mockedRedis.__mockClient.set).toHaveBeenCalledTimes(1);
    expect(mockedRedis.__mockClient.set.mock.calls[0][0]).toBe('cache:admin:tickets:count');
  });
});
