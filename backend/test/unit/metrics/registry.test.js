import { describe, it, expect } from 'vitest';
import {
  register,
  ticketBuyTotal,
  ticketBuyRetriesTotal,
  mongoWriteConflictTotal,
  BUY_MODES,
  BUY_RESULTS,
} from '../../../src/metrics/registry.js';

describe('metrics registry', () => {
  it('exposes the expected buy mode and result constants', () => {
    expect(BUY_MODES).toMatchObject({ TX: 'tx', NONTX: 'nontx' });
    expect(BUY_RESULTS).toMatchObject({
      SUCCESS: 'success',
      SOLD_OUT: 'sold_out',
      CONFLICT: 'conflict',
      ERROR: 'error',
    });
  });

  it('renders prometheus exposition that includes ticket_buy_total and label combos', async () => {
    ticketBuyTotal.inc({ mode: BUY_MODES.TX, result: BUY_RESULTS.SUCCESS });
    ticketBuyTotal.inc({ mode: BUY_MODES.NONTX, result: BUY_RESULTS.SOLD_OUT });
    ticketBuyRetriesTotal.inc({ mode: BUY_MODES.TX });
    mongoWriteConflictTotal.inc({ mode: BUY_MODES.TX });

    const text = await register.metrics();

    expect(text).toContain('ticket_buy_total{');
    expect(text).toMatch(/ticket_buy_total\{[^}]*mode="tx"[^}]*result="success"[^}]*\}/);
    expect(text).toMatch(/ticket_buy_total\{[^}]*mode="nontx"[^}]*result="sold_out"[^}]*\}/);
    expect(text).toMatch(/ticket_buy_retries_total\{mode="tx"\}/);
    expect(text).toMatch(/mongo_writeconflict_total\{mode="tx"\}/);
  });
});
