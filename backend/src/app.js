// backend/src/app.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { register as metricsRegister } from './metrics/registry.js';
import tenantRoutes from './routes/tenantRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import demoRoutes from './routes/demo.routes.js';
import k6Routes from './routes/k6Routes.js';

// override: backend writes USE_TRANSACTIONS to .env at runtime;
// the file is the source of truth, env_file (if any) only seeds defaults.
dotenv.config({ override: true });

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN || 'http://localhost:5173';

const app = express();
// CSP off: backend serves JSON only — UI is a separate origin (Vite dev / Grafana iframe).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ADMIN_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

app.use('/tenants', tenantRoutes);
app.use('/events', eventRoutes);
app.use('/', ticketRoutes);
app.use(
  '/tenants/:tenantId/events/:eventId',
  ticketRoutes
);

app.use('/admin', adminRoutes);
app.use('/k6', k6Routes);
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

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on ${PORT}`);
});
