import express from 'express';
import { buyTicketNonTransactional } from '../services/buyTicketNonTransactional.js';
import { buyLimiter } from '../middleware/rateLimiters.js';
import { validateParams } from '../validation/validate.js';
import { tenantEventParamsSchema } from '../validation/commonSchemas.js';

const router = express.Router();

router.post(
  '/demo/non-transactional/:tenantId/:eventId/buy',
  buyLimiter,
  validateParams(tenantEventParamsSchema),
  buyTicketNonTransactional
);

export default router;
