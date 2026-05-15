import express from 'express';
import { buyTicketHandler } from '../controllers/ticketHttpController.js';
import { buyLimiter } from '../middleware/rateLimiters.js';
import { validateParams } from '../validation/validate.js';
import { tenantEventParamsSchema } from '../validation/commonSchemas.js';

const router = express.Router({ mergeParams: true });

router.post('/buy', buyLimiter, validateParams(tenantEventParamsSchema), buyTicketHandler);

export default router;
