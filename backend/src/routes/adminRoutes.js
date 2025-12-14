import express from 'express';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import Event from '../models/Event.js';

const router = express.Router();

router.get('/shard-distribution', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const adminDb = db.admin();

    const shards = await adminDb.command({ listShards: 1 });

    const counts = await Ticket.aggregate([
      { $group: { _id: "$tenantId", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      shards: shards.shards || [],
      ticketsByTenant: counts
    });

  } catch (err) {
    console.error('admin error', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/events', async (req, res) => {
  const events = await Event.find({}, {
    _id: 0,
    tenantId: 1,
    eventId: 1,
    remainingTickets: 1,
    totalTickets: 1
  });
console.log('Event model:', Event);

  res.json(events);
});

/**
 * Toplam satılan ticket sayısı
 */
router.get('/tickets/count', async (req, res) => {
  const count = await Ticket.countDocuments();
  res.json({ count });
});

export default router;
