import express from 'express';
import Tenant from '../models/Tenant.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { tenantId, name, plan } = req.body;
    const t = await Tenant.create({ tenantId, name, plan });
    res.status(201).json(t);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const list = await Tenant.find().lean();
  res.json(list);
});

export default router;
