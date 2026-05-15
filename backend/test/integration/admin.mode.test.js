import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildTestApp } from '../helpers/buildApp.js';

let tmpDir;
let envPath;
let app;

beforeAll(() => {
  app = buildTestApp();
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-int-'));
  envPath = path.join(tmpDir, '.env');
  process.env.BACKEND_ENV_PATH = envPath;
  process.env.BACKEND_RESTART_TRIGGER = path.join(tmpDir, 'trigger.touch');
  fs.writeFileSync(process.env.BACKEND_RESTART_TRIGGER, '');
  process.env.USE_TRANSACTIONS = 'true';
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.BACKEND_ENV_PATH;
  delete process.env.BACKEND_RESTART_TRIGGER;
  delete process.env.USE_TRANSACTIONS;
});

describe('admin mode endpoints', () => {
  it('GET /admin/mode reflects the current USE_TRANSACTIONS env var', async () => {
    const res = await request(app).get('/admin/mode');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('tx');
  });

  it('POST /admin/mode persists the new mode to the env file', async () => {
    const res = await request(app)
      .post('/admin/mode')
      .send({ mode: 'nontx' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(202);
    expect(res.body.mode).toBe('nontx');
    expect(fs.readFileSync(envPath, 'utf8')).toMatch(/USE_TRANSACTIONS=false/);
  });

  it('POST /admin/mode rejects an unknown mode at the zod layer', async () => {
    const res = await request(app)
      .post('/admin/mode')
      .send({ mode: 'invalid' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });
});
