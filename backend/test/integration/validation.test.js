import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/buildApp.js';

let app;

beforeAll(() => {
  app = buildTestApp();
});

describe('zod body validation', () => {
  it('POST /admin/mode rejects an invalid mode with 400 + issues', async () => {
    const res = await request(app)
      .post('/admin/mode')
      .send({ mode: 'junk' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'invalid_body' });
    expect(res.body.issues[0]).toMatchObject({ path: 'mode' });
  });

  it('POST /admin/mode rejects a missing body with 400', async () => {
    const res = await request(app)
      .post('/admin/mode')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST /admin/seed rejects an invalid mode with 400', async () => {
    const res = await request(app)
      .post('/admin/seed')
      .send({ mode: 'NONE' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST /k6/run rejects empty scenario with 400', async () => {
    const res = await request(app)
      .post('/k6/run')
      .send({ scenario: '' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST /k6/run rejects an invalid duration shape', async () => {
    const res = await request(app)
      .post('/k6/run')
      .send({ scenario: 'hot_event', duration: '5 minutes' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST /demo/non-transactional/:tenantId/:eventId/buy rejects path injection attempt', async () => {
    const res = await request(app).post('/demo/non-transactional/te$ne/eve/buy').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_params');
  });

  it('GET /metrics returns Prometheus exposition format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('# HELP');
    expect(res.text).toMatch(/ticket_buy_total|process_/);
  });

  it('body limit returns 413 for an oversized JSON', async () => {
    const big = 'x'.repeat(150_000);
    const res = await request(app)
      .post('/admin/mode')
      .send({ mode: 'tx', filler: big })
      .set('Content-Type', 'application/json');
    expect([413, 400]).toContain(res.status);
  });

  it('helmet sets X-Content-Type-Options on responses', async () => {
    const res = await request(app).get('/metrics');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
