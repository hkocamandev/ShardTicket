import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, index: true },
  tenantId: { type: String, required: true, index: true },
  title: String,
  date: Date,
  totalTickets: Number,
  remainingTickets: Number,
  price: Number
}, { timestamps: true });

// ⚠️ EN KRİTİK SATIR
const Event = mongoose.model('Event', EventSchema);

export default Event;
