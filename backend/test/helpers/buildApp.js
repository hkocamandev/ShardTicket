import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { register as metricsRegister } from '../../src/metrics/registry.js';
import tenantRoutes from '../../src/routes/tenantRoutes.js';
import eventRoutes from '../../src/routes/eventRoutes.js';
import ticketRoutes from '../../src/routes/ticketRoutes.js';
import adminRoutes from '../../src/routes/adminRoutes.js';
import demoRoutes from '../../src/routes/demo.routes.js';
import k6Routes from '../../src/routes/k6Routes.js';

export function buildTestApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.use('/tenants', tenantRoutes);
  app.use('/events', eventRoutes);
  app.use('/', ticketRoutes);
  app.use('/tenants/:tenantId/events/:eventId', ticketRoutes);
  app.use('/admin', adminRoutes);
  app.use('/k6', k6Routes);
  app.use('/', demoRoutes);

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metricsRegister.contentType);
    res.end(await metricsRegister.metrics());
  });

  return app;
}
