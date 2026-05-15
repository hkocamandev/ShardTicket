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

async function seedEvent({ remaining = 3, total = 3 } = {}) {
  await Event.create({
    tenantId: 't1',
    eventId: 'e1',
    title: 'Test',
    date: new Date(),
    totalTickets: total,
    remainingTickets: remaining,
    price: 100,
  });
}

describe('POST /tenants/:t/events/:e/buy (transactional)', () => {
  it('decrements remainingTickets and creates a ticket on success', async () => {
    await seedEvent({ remaining: 2, total: 2 });

    const res = await request(app)
      .post('/tenants/t1/events/e1/buy')
      .send({ userId: 'u1', seat: 'A1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const after = await Event.findOne({ tenantId: 't1', eventId: 'e1' });
    expect(after.remainingTickets).toBe(1);

    const ticketCount = await Ticket.countDocuments({ tenantId: 't1', eventId: 'e1' });
    expect(ticketCount).toBe(1);
  });

  it('returns 409 sold_out when remainingTickets reaches 0', async () => {
    await seedEvent({ remaining: 1, total: 1 });

    const ok = await request(app)
      .post('/tenants/t1/events/e1/buy')
      .send({ userId: 'u1', seat: 'A1' })
      .set('Content-Type', 'application/json');
    expect(ok.status).toBe(201);

    const soldOut = await request(app)
      .post('/tenants/t1/events/e1/buy')
      .send({ userId: 'u2', seat: 'A2' })
      .set('Content-Type', 'application/json');

    expect(soldOut.status).toBe(409);
    expect(soldOut.body.error).toBe('sold_out');
  });

  it('returns 400 on path param injection attempt', async () => {
    const res = await request(app)
      .post('/tenants/t$ne/events/e1/buy')
      .send({ userId: 'u1', seat: 'A1' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_params');
  });
});
