import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';
import {
  ticketBuyTotal,
  ticketBuyLatencyMs,
  ticketBuyRetriesTotal,
  mongoWriteConflictTotal,
  BUY_MODES,
  BUY_RESULTS,
} from '../metrics/registry.js';

const MODE = BUY_MODES.TX;

/**
 * session.withTransaction() internally retries the callback on
 * TransientTransactionError / UnknownTransactionCommitResult. To observe
 * those retries (and the underlying WriteConflicts), we count callback
 * invocations: every entry past the first is a retry triggered by the
 * driver because the previous attempt hit a transient mongo error.
 */
export async function buyTicket({ tenantId, eventId, userId, seat }) {
  const session = await mongoose.startSession();
  const startMs = Date.now();
  let attempts = 0;

  const record = (result) => {
    const elapsed = Date.now() - startMs;
    ticketBuyTotal.inc({ mode: MODE, result });
    ticketBuyLatencyMs.observe({ mode: MODE, result }, elapsed);
  };

  try {
    let createdTicket;

    try {
      await session.withTransaction(async () => {
        attempts++;
        if (attempts > 1) {
          // previous attempt was rolled back by the driver due to a
          // transient error; surface both retry + conflict metrics.
          ticketBuyRetriesTotal.inc({ mode: MODE });
          mongoWriteConflictTotal.inc({ mode: MODE });
        }

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

      record(BUY_RESULTS.SUCCESS);
      return { success: true, ticket: createdTicket };

    } catch (err) {
      if (err?.message === 'SOLD_OUT') {
        record(BUY_RESULTS.SOLD_OUT);
        throw err;
      }
      if (isTransientMongoError(err)) {
        // withTransaction propagated a transient error after exhausting
        // its internal retry budget (~120s default). Count it once more
        // as the final outcome.
        mongoWriteConflictTotal.inc({ mode: MODE });
        record(BUY_RESULTS.CONFLICT);
        throw err;
      }
      record(BUY_RESULTS.ERROR);
      throw err;
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

function generateTicketId() {
  return `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
