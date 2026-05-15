import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

const hoisted = vi.hoisted(() => ({
  runSeed: vi.fn(),
  runPostSeedSharding: vi.fn(),
  resetData: vi.fn(),
}));

vi.mock('../../src/services/seedRunner.js', () => hoisted);

let app;

beforeAll(async () => {
  const { buildTestApp } = await import('../helpers/buildApp.js');
  app = buildTestApp();
});

beforeEach(() => {
  hoisted.runSeed.mockReset();
  hoisted.runPostSeedSharding.mockReset();
  hoisted.resetData.mockReset();
});

describe('admin seed endpoints', () => {
  it('POST /admin/seed { mode: hot } delegates to seedRunner and returns its result', async () => {
    hoisted.runSeed.mockResolvedValue({ ok: true, exitCode: 0, output: 'seeded' });

    const res = await request(app)
      .post('/admin/seed')
      .send({ mode: 'hot' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, exitCode: 0 });
    expect(hoisted.runSeed).toHaveBeenCalledWith({ mode: 'hot' });
  });

  it('POST /admin/seed { mode: multi } passes through to seedRunner', async () => {
    hoisted.runSeed.mockResolvedValue({ ok: true, exitCode: 0, output: '' });
    const res = await request(app)
      .post('/admin/seed')
      .send({ mode: 'multi' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(hoisted.runSeed).toHaveBeenCalledWith({ mode: 'multi' });
  });

  it('POST /admin/seed returns 500 when seedRunner rejects with SCRIPT_FAILED', async () => {
    const err = new Error('SCRIPT_FAILED');
    err.code = 'SCRIPT_FAILED';
    err.exitCode = 1;
    err.output = 'oops';
    hoisted.runSeed.mockRejectedValue(err);

    const res = await request(app)
      .post('/admin/seed')
      .send({ mode: 'hot' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('script_failed');
  });
});
