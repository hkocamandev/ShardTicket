import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';

const MAX_RETRIES = 5;

export async function buyTicket({ tenantId, eventId, userId, seat }) {
  const session = await mongoose.startSession();
  let attempts = 0;

  try {
    while (attempts < MAX_RETRIES) {
      attempts++;

      try {
        let createdTicket;

        await session.withTransaction(async () => {
          /**
           * 🔑 CRITICAL:
           * Full shard key (tenantId + eventId)
           * → mongos targets SINGLE shard
           */
          const event = await Event.findOneAndUpdate(
            {
              tenantId,
              eventId,
              remainingTickets: { $gt: 0 }
            },
            { $inc: { remainingTickets: -1 } },
            { new: true, session }
          );

          if (!event) {
            throw new Error('SOLD_OUT');
          }

          const [ticket] = await Ticket.create(
            [{
              ticketId: generateTicketId(),
              tenantId,
              eventId,
              userId,
              seat,
              purchasedAt: new Date()
            }],
            { session }
          );

          createdTicket = ticket;
        });

        return { success: true, ticket: createdTicket };

      } catch (err) {
        if (isTransientMongoError(err) && attempts < MAX_RETRIES) {
          await sleep(50 * attempts);
          continue;
        }
        throw err;
      }
    }
  } finally {
    session.endSession();
  }
}

/* ---------------- helpers ---------------- */

function isTransientMongoError(err) {
  return (
    err?.errorLabels?.includes('TransientTransactionError') ||
    err?.code === 112 || // WriteConflict
    err?.message?.includes('WriteConflict')
  );
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function generateTicketId() {
  return `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

