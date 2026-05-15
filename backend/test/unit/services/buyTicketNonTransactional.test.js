import { describe, it, expect, beforeEach, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockEvent: { findOne: vi.fn() },
  mockTicket: { create: vi.fn() },
  metricMocks: {
    ticketBuyTotal: { inc: vi.fn() },
    ticketBuyLatencyMs: { observe: vi.fn() },
  },
}));

const { mockEvent, mockTicket, metricMocks } = hoisted;

vi.mock('../../../src/models/Event.js', () => ({ default: hoisted.mockEvent }));
vi.mock('../../../src/models/Ticket.js', () => ({ default: hoisted.mockTicket }));
vi.mock('../../../src/metrics/registry.js', () => ({
  ...hoisted.metricMocks,
  BUY_MODES: { TX: 'tx', NONTX: 'nontx' },
  BUY_RESULTS: { SUCCESS: 'success', SOLD_OUT: 'sold_out', CONFLICT: 'conflict', ERROR: 'error' },
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
});

describe('buyTicketNonTransactional', () => {
  it('returns 409 SOLD_OUT when event has no remaining tickets', async () => {
    mockEvent.findOne.mockResolvedValue({ remainingTickets: 0, save: vi.fn() });
    const req = { params: { tenantId: 't1', eventId: 'e1' }, body: { userId: 'u1' } };
    const res = fakeRes();

    await buyTicketNonTransactional(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(metricMocks.ticketBuyTotal.inc).toHaveBeenCalledWith({ mode: 'nontx', result: 'sold_out' });
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
  });
});
