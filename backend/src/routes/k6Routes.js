import express from 'express';
import {
  startRun,
  stopRun,
  getStatus,
  getLastResult,
  listScenarios,
} from '../services/k6Runner.js';

const router = express.Router();

router.get('/scenarios', (req, res) => {
  res.json({ scenarios: listScenarios() });
});

router.post('/run', (req, res) => {
  try {
    const { scenario, vus, iterations, duration } = req.body || {};
    const result = startRun({ scenario, vus, iterations, duration });
    res.status(202).json(result);
  } catch (err) {
    if (err.code === 'ALREADY_RUNNING') {
      return res.status(409).json({ error: 'already_running' });
    }
    if (err.code === 'INVALID_SCENARIO') {
      return res.status(400).json({ error: 'invalid_scenario', allowed: listScenarios() });
    }
    if (err.code === 'K6_SPAWN_FAILED') {
      return res.status(500).json({ error: 'k6_spawn_failed', detail: err.detail });
    }
    console.error('k6 run error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/stop', (req, res) => {
  try {
    res.json(stopRun());
  } catch (err) {
    if (err.code === 'NOT_RUNNING') {
      return res.status(409).json({ error: 'not_running' });
    }
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/status', (req, res) => {
  res.json(getStatus());
});

router.get('/results', (req, res) => {
  const r = getLastResult();
  if (!r) return res.status(404).json({ error: 'no_results' });
  res.json(r);
});

export default router;
