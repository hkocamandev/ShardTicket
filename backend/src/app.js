// backend/src/app.js
import express from 'express';
import mongoose from 'mongoose';
import promClient from 'prom-client'
import dotenv from 'dotenv';
import tenantRoutes from './routes/tenantRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import demoRoutes from './routes/demo.routes.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/tenants', tenantRoutes);
app.use('/events', eventRoutes);
app.use('/', ticketRoutes);
app.use(
  '/tenants/:tenantId/events/:eventId',
  ticketRoutes
);

app.use('/admin', adminRoutes);
app.use('/', demoRoutes);



const USE_TRANSACTIONS = process.env.USE_TRANSACTIONS === 'true';

const MONGO_URI = USE_TRANSACTIONS
  ? process.env.MONGO_URI_SHARDED
  : process.env.MONGO_URI_NONSHARDED;

if (!MONGO_URI) {
  throw new Error('Mongo URI not defined for current mode');
}

console.log(`Mongo mode: ${USE_TRANSACTIONS ? 'SHARDED+TX' : 'NONSHARDED+NO-TX'}`);
console.log(`Connecting to ${MONGO_URI}`);

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/', (req, res) => {
  res.send('ShardTicket backend is running!');
});

// Prometheus metrics endpoint
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on ${PORT}`);
});
