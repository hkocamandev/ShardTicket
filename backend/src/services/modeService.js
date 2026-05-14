import fs from 'fs';
import path from 'path';

const ENV_PATH = process.env.BACKEND_ENV_PATH || path.resolve(process.cwd(), '.env');

export function readMode() {
  return process.env.USE_TRANSACTIONS === 'true' ? 'tx' : 'nontx';
}

export function writeMode(mode) {
  if (mode !== 'tx' && mode !== 'nontx') {
    const err = new Error('INVALID_MODE');
    err.code = 'INVALID_MODE';
    throw err;
  }
  const value = mode === 'tx' ? 'true' : 'false';
  let content = '';
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  }

  if (/^USE_TRANSACTIONS=.*$/m.test(content)) {
    content = content.replace(/^USE_TRANSACTIONS=.*$/m, `USE_TRANSACTIONS=${value}`);
  } else {
    content = content.replace(/\s*$/, '') + `\nUSE_TRANSACTIONS=${value}\n`;
  }

  fs.writeFileSync(ENV_PATH, content);
  return { mode, envPath: ENV_PATH };
}
