import express from 'express';
import Event from '../models/Event.js';

const router = express.Router();

// Create event
router.post('/', async (req, res) => {
  try {
    const ev = await Event.create(req.body);
    res.status(201).json(ev);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List events by tenant
router.get('/tenant/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  const list = await Event.find({ tenantId }).lean();
  res.json(list);
});

// Get event
router.get('/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const ev = await Event.findOne({ eventId }).lean();
  if (!ev) return res.status(404).json({ error: 'not found' });
  res.json(ev);
});

export default router;
