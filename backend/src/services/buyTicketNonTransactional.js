import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';
import {
  ticketBuyTotal,
  ticketBuyLatencyMs,
  BUY_MODES,
  BUY_RESULTS,
} from '../metrics/registry.js';

const MODE = BUY_MODES.NONTX;

export async function buyTicketNonTransactional(req, res) {
  const startMs = Date.now();
  const record = (result) => {
    const elapsed = Date.now() - startMs;
    ticketBuyTotal.inc({ mode: MODE, result });
    ticketBuyLatencyMs.observe({ mode: MODE, result }, elapsed);
  };

  try {
    const { tenantId, eventId } = req.params;
    const { userId } = req.body;

    // 1️⃣ Event’i oku
    const event = await Event.findOne({ tenantId, eventId });

    if (!event || event.remainingTickets <= 0) {
      record(BUY_RESULTS.SOLD_OUT);
      return res.status(409).json({ error: 'SOLD_OUT' });
    }

    // ⏱️ Yapay gecikme → race condition garanti
    await new Promise(r => setTimeout(r, 10));

    // 2️⃣ Ticket oluştur
    await Ticket.create({
      ticketId: `tkt_${Date.now()}_${Math.random()}`,
      tenantId,
      eventId,
      userId
    });

    // 3️⃣ Event’i güncelle (ayrı işlem ❌)
    event.remainingTickets -= 1;
    await event.save();

    record(BUY_RESULTS.SUCCESS);
    res.json({ success: true });
  } catch (err) {
    record(BUY_RESULTS.ERROR);
    console.error('non-tx buy error', err);
    res.status(500).json({ error: 'internal_error' });
  }
}
