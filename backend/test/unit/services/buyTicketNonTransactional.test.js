import { describe, it, expect, beforeEach, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockEvent: { findOne: vi.fn() },
  mockTicket: { create: vi.fn() },
  metricMocks: {
    ticketBuyTotal: { inc: vi.fn() },
    ticketBuyLatencyMs: { observe: vi.fn() },
  },
  lockMocks: {
    acquire: vi.fn(),
    release: vi.fn(),
  },
}));

const { mockEvent, mockTicket, metricMocks, lockMocks } = hoisted;
const NOOP_TOKEN = '__noop_lock__';

vi.mock('../../../src/models/Event.js', () => ({ default: hoisted.mockEvent }));
vi.mock('../../../src/models/Ticket.js', () => ({ default: hoisted.mockTicket }));
vi.mock('../../../src/metrics/registry.js', () => ({
  ...hoisted.metricMocks,
  BUY_MODES: { TX: 'tx', NONTX: 'nontx' },
  BUY_RESULTS: { SUCCESS: 'success', SOLD_OUT: 'sold_out', CONFLICT: 'conflict', ERROR: 'error' },
}));
vi.mock('../../../src/services/distributedLock.js', () => ({
  acquire: hoisted.lockMocks.acquire,
  release: hoisted.lockMocks.release,
  NOOP_TOKEN: '__noop_lock__',
}));

import { buyTicketNonTransactional } from '../../../src/services/buyTicketNonTransactional.js';

function fakeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  Object.values(metricMocks).forEach((m) => Object.values(m).forEach((fn) => fn.mockClear()));
  mockEvent.findOne.mockReset();
  mockTicket.create.mockReset();
  // Default: lock layer is a pass-through. Individual tests can override.
  lockMocks.acquire.mockReset().mockResolvedValue(NOOP_TOKEN);
  lockMocks.release.mockReset().mockResolvedValue(undefined);
});

describe('buyTicketNonTransactional (pre-existing flow, lock off / noop)', () => {
  it('returns 409 SOLD_OUT when event has no remaining tickets', async () => {
    mockEvent.findOne.mockResolvedValue({ remainingTickets: 0, save: vi.fn() });
    const req = { params: { tenantId: 't1', eventId: 'e1' }, body: { userId: 'u1' } };
    const res = fakeRes();

    await buyTicketNonTransactional(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'nontx', result: 'sold_out' });
    // release was still called in finally with the noop token
    expect(lockMocks.release).toHaveBeenCalledWith('lock:buy:t1:e1', NOOP_TOKEN);
  });

  it('returns 409 SOLD_OUT when event not found', async () => {
    mockEvent.findOne.mockResolvedValue(null);
    const req = { params: { tenantId: 't1', eventId: 'e1' }, body: { userId: 'u1' } };
    const res = fakeRes();

    await buyTicketNonTransactional(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'nontx', result: 'sold_out' });
  });

  it('records success metric and writes both ticket and updated event on happy path', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const event = { remainingTickets: 5, save };
    mockEvent.findOne.mockResolvedValue(event);
    mockTicket.create.mockResolvedValue({ ticketId: 'tk1' });
    const req = { params: { tenantId: 't1', eventId: 'e1' }, body: { userId: 'u1' } };
    const res = fakeRes();

    await buyTicketNonTransactional(req, res);

    expect(mockTicket.create).toHaveBeenCalled();
    expect(event.remainingTickets).toBe(4);
    expect(save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'nontx', result: 'success' });
  });

  it('records error metric when ticket create throws', async () => {
    const save = vi.fn();
    mockEvent.findOne.mockResolvedValue({ remainingTickets: 5, save });
    mockTicket.create.mockRejectedValue(new Error('db down'));
    const req = { params: { tenantId: 't1', eventId: 'e1' }, body: { userId: 'u1' } };
    const res = fakeRes();

    await buyTicketNonTransactional(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'nontx', result: 'error' });
    // release still called even on error path
    expect(lockMocks.release).toHaveBeenCalled();
  });
});

describe('buyTicketNonTransactional (lock layer engaged)', () => {
  it('returns 503 lock_busy and counts CONFLICT when acquire returns null', async () => {
    lockMocks.acquire.mockResolvedValue(null); // busy after retries
    const req = { params: { tenantId: 't1', eventId: 'e1' }, body: { userId: 'u1' } };
    const res = fakeRes();

    await buyTicketNonTransactional(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'lock_busy' });
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'nontx', result: 'conflict' });
    // No Mongo work done when the lock was rejected
    expect(mockEvent.findOne).not.toHaveBeenCalled();
    expect(mockTicket.create).not.toHaveBeenCalled();
    // release MUST NOT be called for a null token (we never owned the lock)
    expect(lockMocks.release).not.toHaveBeenCalled();
  });

  it('proceeds normally when acquire returns a real token, and releases with it in finally', async () => {
    const realToken = 'tkn-abc';
    lockMocks.acquire.mockResolvedValue(realToken);
    const save = vi.fn().mockResolvedValue(undefined);
    mockEvent.findOne.mockResolvedValue({ remainingTickets: 3, save });
    mockTicket.create.mockResolvedValue({ ticketId: 'tk1' });
    const req = { params: { tenantId: 't1', eventId: 'e1' }, body: { userId: 'u1' } };
    const res = fakeRes();

    await buyTicketNonTransactional(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(lockMocks.acquire).toHaveBeenCalledWith('lock:buy:t1:e1', 2000);
    expect(lockMocks.release).toHaveBeenCalledWith('lock:buy:t1:e1', realToken);
  });
});
