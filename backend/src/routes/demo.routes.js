import express from 'express';
import { buyTicketNonTransactional } from '../services/buyTicketNonTransactional.js';

const router = express.Router();

router.post(
  '/demo/non-transactional/:tenantId/:eventId/buy',
  buyTicketNonTransactional
);

export default router;
