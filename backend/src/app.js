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
app.use('/tenants/:tenantId/events/:eventId', ticketRoutes);
app.use('/admin', adminRoutes);
app.use('/', demoRoutes);



const PORT = process.env.PORT || 3000;
if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI is not defined');
}
const MONGO_URI = process.env.MONGO_URI;

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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
