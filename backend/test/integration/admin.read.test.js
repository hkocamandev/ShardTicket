import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/buildApp.js';
import { startMemoryMongo, stopMemoryMongo, resetCollections } from '../helpers/mongo.js';
import Event from '../../src/models/Event.js';
import Ticket from '../../src/models/Ticket.js';

let app;

beforeAll(async () => {
  await startMemoryMongo();
  app = buildTestApp();
}, 90_000);

afterAll(async () => {
  await stopMemoryMongo();
});

beforeEach(async () => {
  await resetCollections();
});

describe('admin read endpoints', () => {
  it('GET /admin/events returns shape with remaining and total tickets', async () => {
    await Event.create({ tenantId: 't1', eventId: 'e1', totalTickets: 5, remainingTickets: 3 });
    await Event.create({ tenantId: 't2', eventId: 'e9', totalTickets: 10, remainingTickets: 10 });

    const res = await request(app).get('/admin/events');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      tenantId: expect.any(String),
      eventId: expect.any(String),
      remainingTickets: expect.any(Number),
      totalTickets: expect.any(Number),
    });
  });

  it('GET /admin/tickets/count returns the total ticket count', async () => {
    await Ticket.create([
      { ticketId: 'tk1', tenantId: 't1', eventId: 'e1' },
      { ticketId: 'tk2', tenantId: 't1', eventId: 'e1' },
      { ticketId: 'tk3', tenantId: 't1', eventId: 'e1' },
    ]);

    const res = await request(app).get('/admin/tickets/count');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it('GET /admin/shard-distribution returns 500 against a non-sharded standalone (expected degraded mode)', async () => {
    const res = await request(app).get('/admin/shard-distribution');
    expect(res.status).toBe(500);
  });
});
