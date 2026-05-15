import fs from 'fs';
import path from 'path';

function envPath() {
  return process.env.BACKEND_ENV_PATH || path.resolve(process.cwd(), '.env');
}

export function readMode() {
  return process.env.USE_TRANSACTIONS === 'true' ? 'tx' : 'nontx';
}

export function writeMode(mode) {
  if (mode !== 'tx' && mode !== 'nontx') {
    const err = new Error('INVALID_MODE');
    err.code = 'INVALID_MODE';
    throw err;
  }
  const target = envPath();
  const value = mode === 'tx' ? 'true' : 'false';
  let content = '';
  if (fs.existsSync(target)) {
    content = fs.readFileSync(target, 'utf8');
  }

  if (/^USE_TRANSACTIONS=.*$/m.test(content)) {
    content = content.replace(/^USE_TRANSACTIONS=.*$/m, `USE_TRANSACTIONS=${value}`);
  } else {
    content = content.replace(/\s*$/, '') + `\nUSE_TRANSACTIONS=${value}\n`;
  }

  fs.writeFileSync(target, content);
  return { mode, envPath: target };
}
