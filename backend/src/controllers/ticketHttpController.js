import { buyTicket } from '../services/buyTicket.js';

export async function buyTicketHandler(req, res) {
  try {
    const { tenantId, eventId } = req.params;
    const { userId, seat } = req.body;

    const result = await buyTicket({
      tenantId,
      eventId,
      userId,
      seat
    });

    return res.status(201).json(result);

  } catch (err) {
    if (err.message === 'SOLD_OUT') {
      return res.status(409).json({ error: 'sold_out' });
    }

    console.error('buy handler error', err);
    res.status(500).json({ error: 'internal_error' });
  }
}
