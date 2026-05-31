import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

// /admin/flags hits the file system to persist the env. Use a tmp env path
// (BACKEND_ENV_PATH) so tests don't touch the developer's real backend/.env.
//
// /admin/redis/health calls into the redisClient module — we mock it to
// avoid opening a TCP socket.
vi.mock('../../src/services/redisClient.js', () => ({
  getClient: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
  ping: vi.fn().mockResolvedValue(true),
  closeClient: vi.fn(),
  __setClientForTests: vi.fn(),
}));

let app;
let tmpDir;
let envPath;

beforeAll(async () => {
  const { buildTestApp } = await import('../helpers/buildApp.js');
  app = buildTestApp();
});

afterAll(() => {
  /* nothing to clean — no mongo in this suite */
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flags-routes-'));
  envPath = path.join(tmpDir, '.env');
  fs.writeFileSync(envPath, 'USE_REDIS_CACHE=false\nUSE_REDIS_LOCK=false\n');
  process.env.BACKEND_ENV_PATH = envPath;
  process.env.USE_REDIS_CACHE = 'false';
  process.env.USE_REDIS_LOCK = 'false';
  process.env.BACKEND_RESTART_TRIGGER = envPath; // avoid touching real src/app.js
});

describe('admin /flags', () => {
  it('GET /admin/flags returns the current flag values', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    process.env.USE_REDIS_LOCK = 'false';
    const res = await request(app).get('/admin/flags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      USE_REDIS_CACHE: true,
      USE_REDIS_LOCK: false,
    });
  });

  it('POST /admin/flags writes the value to the env file and reflects in-process', async () => {
    const res = await request(app)
      .post('/admin/flags')
      .send({ flag: 'USE_REDIS_CACHE', value: true });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      flag: 'USE_REDIS_CACHE',
      value: true,
      envPath,
      restartingInMs: 500,
    });
    expect(fs.readFileSync(envPath, 'utf8')).toMatch(/USE_REDIS_CACHE=true/);
    expect(process.env.USE_REDIS_CACHE).toBe('true');
  });

  it('POST /admin/flags rejects unknown flag name (zod) with 400', async () => {
    const res = await request(app)
      .post('/admin/flags')
      .send({ flag: 'NOT_A_FLAG', value: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST /admin/flags rejects non-boolean value (zod) with 400', async () => {
    const res = await request(app)
      .post('/admin/flags')
      .send({ flag: 'USE_REDIS_CACHE', value: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });
});

describe('admin /redis/health', () => {
  it('returns ready + pong when redis is healthy (mocked)', async () => {
    const res = await request(app).get('/admin/redis/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ready: true, pong: true });
  });
});
