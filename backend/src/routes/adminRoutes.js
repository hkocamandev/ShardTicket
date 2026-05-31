import express from 'express';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import Event from '../models/Event.js';
import { readMode, writeMode } from '../services/modeService.js';
import { runSeed, runPostSeedSharding, resetData } from '../services/seedRunner.js';
import { adminLimiter } from '../middleware/rateLimiters.js';
import { validateBody } from '../validation/validate.js';
import { modeBodySchema, seedBodySchema, flagBodySchema } from '../validation/adminSchemas.js';
import { wrap, KEY_GROUPS } from '../services/cache.js';
import { readAllFlags, writeFlag, FLAGS } from '../services/featureFlags.js';
import { isReady as redisReady, ping as redisPing } from '../services/redisClient.js';

const ADMIN_CACHE_TTL = 5;

const RESTART_TRIGGER_PATH =
  process.env.BACKEND_RESTART_TRIGGER ||
  path.resolve(process.cwd(), 'src', 'app.js');

const router = express.Router();

router.get('/shard-distribution', async (req, res) => {
  try {
    const result = await wrap(
      KEY_GROUPS.ADMIN_SHARD_DISTRIBUTION,
      'cache:admin:shard-distribution',
      ADMIN_CACHE_TTL,
      async () => {
        const db = mongoose.connection.db;
        const adminDb = db.admin();
        const shards = await adminDb.command({ listShards: 1 });
        const counts = await Ticket.aggregate([
          { $group: { _id: '$tenantId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]);
        return { shards: shards.shards || [], ticketsByTenant: counts };
      }
    );
    res.json(result);
  } catch (err) {
    console.error('admin error', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/events', async (req, res) => {
  const events = await wrap(
    KEY_GROUPS.ADMIN_EVENTS,
    'cache:admin:events',
    ADMIN_CACHE_TTL,
    () =>
      Event.find(
        {},
        { _id: 0, tenantId: 1, eventId: 1, remainingTickets: 1, totalTickets: 1 }
      )
  );
  res.json(events);
});

router.get('/tickets/count', async (req, res) => {
  const result = await wrap(
    KEY_GROUPS.ADMIN_TICKETS_COUNT,
    'cache:admin:tickets:count',
    ADMIN_CACHE_TTL,
    async () => ({ count: await Ticket.countDocuments() })
  );
  res.json(result);
});

router.get('/mode', (req, res) => {
  res.json({ mode: readMode() });
});

router.post('/mode', adminLimiter, validateBody(modeBodySchema), (req, res) => {
  try {
    const { mode } = req.body;
    const { mode: newMode, envPath } = writeMode(mode);
    res.status(202).json({
      mode: newMode,
      envPath,
      restartingInMs: 500,
      message: 'Backend nodemon will reload to apply mode',
    });
    // Trigger nodemon by touching a watched file. After the response flushes,
    // touch app.js mtime → nodemon respawns the node process which re-reads
    // .env via dotenv.config({ override: true }).
    setTimeout(() => {
      try {
        const now = new Date();
        fs.utimesSync(RESTART_TRIGGER_PATH, now, now);
        console.log(`Mode switched to ${newMode}, touched ${RESTART_TRIGGER_PATH}`);
      } catch (err) {
        console.error('failed to touch restart trigger', err);
      }
    }, 500);
  } catch (err) {
    if (err.code === 'INVALID_MODE') {
      return res.status(400).json({ error: 'invalid_mode', allowed: ['tx', 'nontx'] });
    }
    console.error('mode write error', err);
    res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

router.post('/seed', adminLimiter, validateBody(seedBodySchema), async (req, res) => {
  try {
    const { mode } = req.body;
    const result = await runSeed({ mode });
    res.json(result);
  } catch (err) {
    if (err.code === 'INVALID_SEED_MODE') {
      return res.status(400).json({ error: 'invalid_seed_mode', allowed: ['hot', 'multi'] });
    }
    if (err.code === 'SCRIPT_FAILED' || err.code === 'TIMEOUT') {
      return res.status(500).json({
        error: err.code.toLowerCase(),
        exitCode: err.exitCode,
        output: err.output,
      });
    }
    res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

router.post('/sharding/post-seed', adminLimiter, async (req, res) => {
  if (readMode() !== 'tx') {
    return res.status(409).json({
      error: 'mode_mismatch',
      detail: 'Sharding setup requires TX mode (mongos connection)',
    });
  }
  try {
    const result = await runPostSeedSharding();
    res.json(result);
  } catch (err) {
    if (err.code === 'SCRIPT_FAILED' || err.code === 'TIMEOUT') {
      return res.status(500).json({
        error: err.code.toLowerCase(),
        exitCode: err.exitCode,
        output: err.output,
      });
    }
    res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

router.post('/reset', adminLimiter, async (req, res) => {
  try {
    const result = await resetData();
    res.json(result);
  } catch (err) {
    console.error('reset error', err);
    res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

router.get('/flags', (req, res) => {
  res.json(readAllFlags());
});

router.post('/flags', adminLimiter, validateBody(flagBodySchema), (req, res) => {
  try {
    const { flag, value } = req.body;
    const result = writeFlag(flag, value);
    res.status(202).json({
      ...result,
      restartingInMs: 500,
      message: 'Backend nodemon will reload to apply flag',
    });
    // Same nodemon-touch trick as POST /admin/mode so the new env value is
    // re-read by dotenv on respawn.
    setTimeout(() => {
      try {
        const now = new Date();
        fs.utimesSync(RESTART_TRIGGER_PATH, now, now);
      } catch (err) {
        console.error('failed to touch restart trigger', err);
      }
    }, 500);
  } catch (err) {
    if (err.code === 'INVALID_FLAG' || err.code === 'INVALID_VALUE') {
      return res.status(400).json({
        error: err.code.toLowerCase(),
        allowed: Object.keys(FLAGS),
      });
    }
    console.error('flag write error', err);
    res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

router.get('/redis/health', async (req, res) => {
  const ready = redisReady();
  const pong = ready ? await redisPing() : false;
  res.json({ ready, pong });
});

export default router;
