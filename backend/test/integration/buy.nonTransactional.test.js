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

describe('POST /demo/non-transactional/:t/:e/buy', () => {
  it('decrements event and creates ticket on happy path (serial call)', async () => {
    await Event.create({
      tenantId: 't1',
      eventId: 'e1',
      totalTickets: 3,
      remainingTickets: 3,
    });

    const res = await request(app)
      .post('/demo/non-transactional/t1/e1/buy')
      .send({ userId: 'u1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const after = await Event.findOne({ tenantId: 't1', eventId: 'e1' });
    expect(after.remainingTickets).toBe(2);

    const tickets = await Ticket.countDocuments();
    expect(tickets).toBe(1);
  });

  it('returns 409 sold_out when remainingTickets is 0', async () => {
    await Event.create({
      tenantId: 't1',
      eventId: 'e1',
      totalTickets: 1,
      remainingTickets: 0,
    });

    const res = await request(app)
      .post('/demo/non-transactional/t1/e1/buy')
      .send({ userId: 'u1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SOLD_OUT');
  });

  it('returns 400 on invalid path params', async () => {
    const res = await request(app)
      .post('/demo/non-transactional/t$/e1/buy')
      .send({ userId: 'u1' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
  });
});
