import express from 'express';
import { buyTicketHandler } from '../controllers/ticketHttpController.js';

const router = express.Router({ mergeParams: true });

router.post('/buy', buyTicketHandler);

export default router;
