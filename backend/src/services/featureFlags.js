import fs from 'fs';
import path from 'path';

// Centralized boolean feature flags persisted in backend/.env. Same idea
// as modeService (USE_TRANSACTIONS) but generalized so cache + lock + any
// future flag share the read/write/touch-app.js dance.
//
// Allowed flag set is intentionally narrow — guards against arbitrary
// env writes from a misbehaving caller (validate.js enforces this at the
// HTTP boundary, but this is the source-of-truth gate).
export const FLAGS = Object.freeze({
  USE_REDIS_CACHE: 'USE_REDIS_CACHE',
  USE_REDIS_LOCK: 'USE_REDIS_LOCK',
});

function envPath() {
  return process.env.BACKEND_ENV_PATH || path.resolve(process.cwd(), '.env');
}

export function isValidFlag(name) {
  return Object.prototype.hasOwnProperty.call(FLAGS, name);
}

export function readFlag(name) {
  if (!isValidFlag(name)) {
    const err = new Error('INVALID_FLAG');
    err.code = 'INVALID_FLAG';
    throw err;
  }
  return process.env[name] === 'true';
}

export function readAllFlags() {
  const out = {};
  for (const name of Object.keys(FLAGS)) {
    out[name] = process.env[name] === 'true';
  }
  return out;
}

export function writeFlag(name, value) {
  if (!isValidFlag(name)) {
    const err = new Error('INVALID_FLAG');
    err.code = 'INVALID_FLAG';
    throw err;
  }
  if (typeof value !== 'boolean') {
    const err = new Error('INVALID_VALUE');
    err.code = 'INVALID_VALUE';
    throw err;
  }
  const target = envPath();
  const strValue = value ? 'true' : 'false';
  let content = '';
  if (fs.existsSync(target)) {
    content = fs.readFileSync(target, 'utf8');
  }
  const lineRegex = new RegExp(`^${name}=.*$`, 'm');
  if (lineRegex.test(content)) {
    content = content.replace(lineRegex, `${name}=${strValue}`);
  } else {
    content = content.replace(/\s*$/, '') + `\n${name}=${strValue}\n`;
  }
  fs.writeFileSync(target, content);
  // Reflect the new value in-process so unit tests and same-process readers
  // see the update without a full restart. The mode toggle uses a nodemon
  // touch trick for the actual server; the flag endpoint will too.
  process.env[name] = strValue;
  return { flag: name, value, envPath: target };
}
