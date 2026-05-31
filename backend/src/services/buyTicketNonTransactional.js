import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';
import {
  ticketBuyTotal,
  ticketBuyLatencyMs,
  BUY_MODES,
  BUY_RESULTS,
} from '../metrics/registry.js';
import { acquire, release } from './distributedLock.js';

const MODE = BUY_MODES.NONTX;

// Lock TTL is generous (2s) relative to the actual critical section
// (~10-30ms read + sleep + write). It exists to bound the deadlock window
// if the holder process dies mid-flow, not to gate normal latency.
const LOCK_TTL_MS = 2000;

export async function buyTicketNonTransactional(req, res) {
  const startMs = Date.now();
  const record = (result) => {
    const elapsed = Date.now() - startMs;
    ticketBuyTotal.inc({ mode: MODE, result });
    ticketBuyLatencyMs.observe({ mode: MODE, result }, elapsed);
  };

  const { tenantId, eventId } = req.params;
  const lockKey = `lock:buy:${tenantId}:${eventId}`;
  const token = await acquire(lockKey, LOCK_TTL_MS);

  // Flag OFF / Redis down → acquire returns NOOP_TOKEN, flow proceeds
  // identically to pre-Phase-4 behavior. Only null means "busy after retries".
  if (token === null) {
    record(BUY_RESULTS.CONFLICT);
    return res.status(503).json({ error: 'lock_busy' });
  }

  try {
    const { userId } = req.body;
    const event = await Event.findOne({ tenantId, eventId });

    if (!event || event.remainingTickets <= 0) {
      record(BUY_RESULTS.SOLD_OUT);
      return res.status(409).json({ error: 'SOLD_OUT' });
    }

    // Yapay gecikme → race condition garantili (flag OFF iken). Lock ON iken
    // bu pencerede başka VU kritik bölüme giremez.
    await new Promise((r) => setTimeout(r, 10));

    await Ticket.create({
      ticketId: `tkt_${Date.now()}_${Math.random()}`,
      tenantId,
      eventId,
      userId,
    });

    event.remainingTickets -= 1;
    await event.save();

    record(BUY_RESULTS.SUCCESS);
    res.json({ success: true });
  } catch (err) {
    record(BUY_RESULTS.ERROR);
    console.error('non-tx buy error', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    await release(lockKey, token);
  }
}
