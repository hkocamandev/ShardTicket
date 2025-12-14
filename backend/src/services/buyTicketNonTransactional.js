import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';

export async function buyTicketNonTransactional(req, res) {
  const { tenantId, eventId } = req.params;
  const { userId } = req.body;

  // 1️⃣ Event’i oku
  const event = await Event.findOne({ tenantId, eventId });

  if (!event || event.remainingTickets <= 0) {
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

  res.json({ success: true });
}
