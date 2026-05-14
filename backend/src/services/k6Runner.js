import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCENARIO_DIR = process.env.K6_SCENARIO_DIR || '/k6/scenarios';
const RESULTS_DIR = process.env.K6_RESULTS_DIR || '/k6/results';
const LOG_BUFFER_LINES = 200;

const ALLOWED_SCENARIOS = {
  hot_event:         { file: 'hot_event_test.js',         modes: ['tx'] },
  hot_event_sharded: { file: 'hot_event_sharded_test.js', modes: ['tx'] },
  non_transactional: { file: 'non_transactional_test.js', modes: ['nontx'] },
};

const state = {
  status: 'idle',
  scenario: null,
  params: null,
  pid: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  logTail: [],
  summaryPath: null,
  lastResult: null,
};

let currentProcess = null;

function pushLog(line) {
  state.logTail.push(line);
  if (state.logTail.length > LOG_BUFFER_LINES) {
    state.logTail.shift();
  }
}

export function getStatus() {
  return { ...state, logTail: [...state.logTail] };
}

export function listScenarios() {
  return Object.entries(ALLOWED_SCENARIOS).map(([name, meta]) => ({
    name,
    modes: meta.modes,
  }));
}

export function getLastResult() {
  if (!state.lastResult) return null;
  return { summaryPath: state.summaryPath, summary: state.lastResult };
}

export function startRun({ scenario, vus, iterations, duration }) {
  if (state.status === 'running') {
    const err = new Error('ALREADY_RUNNING');
    err.code = 'ALREADY_RUNNING';
    throw err;
  }
  const scenarioMeta = ALLOWED_SCENARIOS[scenario];
  if (!scenarioMeta) {
    const err = new Error('INVALID_SCENARIO');
    err.code = 'INVALID_SCENARIO';
    throw err;
  }
  const scenarioFile = scenarioMeta.file;

  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryPath = path.join(RESULTS_DIR, `${scenario}_${ts}.json`);

  const args = [
    'run',
    path.join(SCENARIO_DIR, scenarioFile),
    '--summary-export', summaryPath,
  ];
  if (vus) args.push('--vus', String(vus));
  if (iterations) args.push('--iterations', String(iterations));
  if (duration) args.push('--duration', String(duration));

  state.status = 'running';
  state.scenario = scenario;
  state.params = { vus: vus ?? null, iterations: iterations ?? null, duration: duration ?? null };
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.exitCode = null;
  state.logTail = [];
  state.summaryPath = summaryPath;
  state.lastResult = null;

  let proc;
  try {
    proc = spawn('k6', args, { env: process.env });
  } catch (err) {
    state.status = 'idle';
    const e = new Error('K6_SPAWN_FAILED');
    e.code = 'K6_SPAWN_FAILED';
    e.detail = err.message;
    throw e;
  }

  currentProcess = proc;
  state.pid = proc.pid;
  pushLog(`> k6 ${args.join(' ')}`);

  proc.stdout.on('data', chunk =>
    chunk.toString().split('\n').filter(Boolean).forEach(pushLog)
  );
  proc.stderr.on('data', chunk =>
    chunk.toString().split('\n').filter(Boolean).forEach(pushLog)
  );

  proc.on('error', err => {
    pushLog(`process error: ${err.message}`);
  });

  proc.on('exit', code => {
    state.status = 'idle';
    state.exitCode = code;
    state.finishedAt = new Date().toISOString();
    currentProcess = null;
    try {
      if (fs.existsSync(summaryPath)) {
        state.lastResult = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      }
    } catch (err) {
      pushLog(`summary parse error: ${err.message}`);
    }
  });

  return {
    pid: proc.pid,
    scenario,
    params: state.params,
    summaryPath,
    startedAt: state.startedAt,
  };
}

export function stopRun() {
  if (state.status !== 'running' || !currentProcess) {
    const err = new Error('NOT_RUNNING');
    err.code = 'NOT_RUNNING';
    throw err;
  }
  currentProcess.kill('SIGTERM');
  return { ok: true };
}
