import { describe, it, expect, beforeEach, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const sessionRef = { current: null };
  return {
    sessionRef,
    mockEvent: { findOneAndUpdate: vi.fn() },
    mockTicket: { create: vi.fn() },
    metricMocks: {
      ticketBuyTotal: { inc: vi.fn() },
      ticketBuyLatencyMs: { observe: vi.fn() },
      ticketBuyRetriesTotal: { inc: vi.fn() },
      mongoWriteConflictTotal: { inc: vi.fn() },
    },
  };
});

const { sessionRef, mockEvent, mockTicket, metricMocks } = hoisted;

vi.mock('../../../src/models/Event.js', () => ({ default: hoisted.mockEvent }));
vi.mock('../../../src/models/Ticket.js', () => ({ default: hoisted.mockTicket }));
vi.mock('../../../src/metrics/registry.js', () => ({
  ...hoisted.metricMocks,
  BUY_MODES: { TX: 'tx', NONTX: 'nontx' },
  BUY_RESULTS: { SUCCESS: 'success', SOLD_OUT: 'sold_out', CONFLICT: 'conflict', ERROR: 'error' },
}));

vi.mock('mongoose', () => ({
  default: {
    startSession: vi.fn(async () => hoisted.sessionRef.current),
  },
}));

import { buyTicket } from '../../../src/services/buyTicket.js';

beforeEach(() => {
  Object.values(metricMocks).forEach((m) => Object.values(m).forEach((fn) => fn.mockClear()));
  mockEvent.findOneAndUpdate.mockReset();
  mockTicket.create.mockReset();
  sessionRef.current = {
    withTransaction: async (cb) => cb(),
    endSession: vi.fn(),
  };
});

describe('buyTicket (transactional)', () => {
  it('returns success and records success metric on happy path', async () => {
    mockEvent.findOneAndUpdate.mockResolvedValue({ remainingTickets: 99 });
    mockTicket.create.mockResolvedValue([{ ticketId: 't1' }]);

    const res = await buyTicket({ tenantId: 't1', eventId: 'e1', userId: 'u1', seat: 'A1' });

    expect(res.success).toBe(true);
    expect(res.ticket.ticketId).toBe('t1');
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'tx', result: 'success' });
  });

  it('throws SOLD_OUT when findOneAndUpdate returns null', async () => {
    mockEvent.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      buyTicket({ tenantId: 't1', eventId: 'e1', userId: 'u1', seat: 'A1' })
    ).rejects.toThrow('SOLD_OUT');
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'tx', result: 'sold_out' });
  });

  it('increments retry counter when withTransaction invokes the callback twice', async () => {
    mockEvent.findOneAndUpdate.mockResolvedValue({ remainingTickets: 50 });
    mockTicket.create.mockResolvedValue([{ ticketId: 't2' }]);

    sessionRef.current.withTransaction = async (cb) => {
      // simulate driver-internal retry: invoke twice
      try {
        await cb();
      } catch (_) { /* swallow first attempt's pretend failure */ }
      await cb();
    };

    await buyTicket({ tenantId: 't1', eventId: 'e1', userId: 'u1', seat: 'A1' });

    expect(metricMocks.ticketBuyRetriesTotal.inc).toHaveBeenCalledWith({ mode: 'tx' });
    expect(metricMocks.mongoWriteConflictTotal.inc).toHaveBeenCalledWith({ mode: 'tx' });
  });

  it('records conflict metric when withTransaction surfaces a WriteConflict', async () => {
    sessionRef.current.withTransaction = async () => {
      const err = new Error('WriteConflict');
      err.code = 112;
      throw err;
    };
    await expect(
      buyTicket({ tenantId: 't1', eventId: 'e1', userId: 'u1', seat: 'A1' })
    ).rejects.toThrow(/WriteConflict/);
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'tx', result: 'conflict' });
  });
});
