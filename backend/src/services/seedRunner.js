import { spawn } from 'child_process';
import path from 'path';
import Ticket from '../models/Ticket.js';
import Event from '../models/Event.js';

const SCRIPTS_DIR = process.env.BACKEND_SCRIPTS_DIR || path.resolve(process.cwd(), 'scripts');
const RUN_TIMEOUT_MS = 120_000;

function runNodeScript(scriptName, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    const env = { ...process.env, ...extraEnv };
    let proc;
    try {
      proc = spawn('node', [scriptPath], { env });
    } catch (err) {
      const e = new Error('SPAWN_FAILED');
      e.code = 'SPAWN_FAILED';
      e.detail = err.message;
      return reject(e);
    }

    const chunks = [];
    proc.stdout.on('data', d => chunks.push(d.toString()));
    proc.stderr.on('data', d => chunks.push(d.toString()));

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      const e = new Error('TIMEOUT');
      e.code = 'TIMEOUT';
      e.output = chunks.join('');
      reject(e);
    }, RUN_TIMEOUT_MS);

    proc.on('exit', code => {
      clearTimeout(timeout);
      const output = chunks.join('');
      if (code === 0) {
        resolve({ ok: true, output, exitCode: 0 });
      } else {
        const e = new Error(`SCRIPT_FAILED`);
        e.code = 'SCRIPT_FAILED';
        e.output = output;
        e.exitCode = code;
        reject(e);
      }
    });
  });
}

export function runSeed({ mode }) {
  if (mode !== 'hot' && mode !== 'multi') {
    const err = new Error('INVALID_SEED_MODE');
    err.code = 'INVALID_SEED_MODE';
    throw err;
  }
  return runNodeScript('seed.js', { SEED_MODE: mode });
}

export function runPostSeedSharding() {
  return runNodeScript('post_seed_sharding.js');
}

export async function resetData() {
  const [t, e] = await Promise.all([
    Ticket.deleteMany({}),
    Event.deleteMany({}),
  ]);
  return {
    ticketsDeleted: t.deletedCount,
    eventsDeleted: e.deletedCount,
  };
}
