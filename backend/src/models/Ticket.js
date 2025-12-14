import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true },
  tenantId: String,
  eventId: String,
  userId: String,
  seat: String,
  purchasedAt: Date
});

/**
 * 🔑 Same shard key
 * Keeps tickets colocated with event
 */
TicketSchema.index({ tenantId: 1, eventId: 1 });

export default mongoose.model('Ticket', TicketSchema);
