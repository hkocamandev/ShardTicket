import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

const hoisted = vi.hoisted(() => ({
  startRun: vi.fn(),
  stopRun: vi.fn(),
  getStatus: vi.fn(() => ({ status: 'idle', logTail: [] })),
  getLastResult: vi.fn(() => null),
  listScenarios: vi.fn(() => [
    { name: 'hot_event', modes: ['tx'] },
    { name: 'hot_event_sharded', modes: ['tx'] },
    { name: 'non_transactional', modes: ['nontx'] },
  ]),
}));

vi.mock('../../src/services/k6Runner.js', () => hoisted);

let app;

beforeAll(async () => {
  const { buildTestApp } = await import('../helpers/buildApp.js');
  app = buildTestApp();
});

beforeEach(() => {
  hoisted.startRun.mockReset();
  hoisted.stopRun.mockReset();
  hoisted.getStatus.mockReset().mockImplementation(() => ({ status: 'idle', logTail: [] }));
  hoisted.getLastResult.mockReset().mockReturnValue(null);
  hoisted.listScenarios.mockReset().mockReturnValue([
    { name: 'hot_event', modes: ['tx'] },
    { name: 'hot_event_sharded', modes: ['tx'] },
    { name: 'non_transactional', modes: ['nontx'] },
  ]);
});

describe('k6 endpoints', () => {
  it('GET /k6/scenarios returns the whitelist', async () => {
    const res = await request(app).get('/k6/scenarios');
    expect(res.status).toBe(200);
    expect(res.body.scenarios).toHaveLength(3);
  });

  it('POST /k6/run with valid body delegates to startRun and returns 202', async () => {
    hoisted.startRun.mockReturnValue({ pid: 42, scenario: 'hot_event' });

    const res = await request(app)
      .post('/k6/run')
      .send({ scenario: 'hot_event', duration: '5s' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(202);
    expect(hoisted.startRun).toHaveBeenCalledWith({
      scenario: 'hot_event',
      vus: undefined,
      iterations: undefined,
      duration: '5s',
    });
  });

  it('POST /k6/run with invalid scenario body fails zod (400)', async () => {
    const res = await request(app)
      .post('/k6/run')
      .send({ scenario: '' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST /k6/run forwards INVALID_SCENARIO from runner as 400', async () => {
    const err = new Error('INVALID_SCENARIO');
    err.code = 'INVALID_SCENARIO';
    hoisted.startRun.mockImplementation(() => { throw err; });

    const res = await request(app)
      .post('/k6/run')
      .send({ scenario: 'shadow_scenario' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_scenario');
  });
});
