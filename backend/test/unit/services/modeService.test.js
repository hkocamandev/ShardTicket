import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tmpDir;
let envPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-svc-'));
  envPath = path.join(tmpDir, '.env');
  process.env.BACKEND_ENV_PATH = envPath;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.BACKEND_ENV_PATH;
  delete process.env.USE_TRANSACTIONS;
});

async function loadFresh() {
  return import('../../../src/services/modeService.js');
}

describe('modeService', () => {
  it('readMode returns tx when USE_TRANSACTIONS=true', async () => {
    process.env.USE_TRANSACTIONS = 'true';
    const { readMode } = await loadFresh();
    expect(readMode()).toBe('tx');
  });

  it('readMode returns nontx when USE_TRANSACTIONS=false', async () => {
    process.env.USE_TRANSACTIONS = 'false';
    const { readMode } = await loadFresh();
    expect(readMode()).toBe('nontx');
  });

  it('writeMode creates the file with USE_TRANSACTIONS=true for tx', async () => {
    const { writeMode } = await loadFresh();
    const result = writeMode('tx');
    expect(result.mode).toBe('tx');
    expect(fs.readFileSync(envPath, 'utf8')).toMatch(/USE_TRANSACTIONS=true/);
  });

  it('writeMode replaces an existing USE_TRANSACTIONS line', async () => {
    fs.writeFileSync(envPath, 'FOO=bar\nUSE_TRANSACTIONS=true\nBAZ=qux\n');
    const { writeMode } = await loadFresh();
    writeMode('nontx');
    const content = fs.readFileSync(envPath, 'utf8');
    expect(content).toMatch(/USE_TRANSACTIONS=false/);
    expect(content).toMatch(/FOO=bar/);
    expect(content).toMatch(/BAZ=qux/);
    expect(content.match(/USE_TRANSACTIONS=/g)?.length).toBe(1);
  });

  it('writeMode throws INVALID_MODE for unknown input', async () => {
    const { writeMode } = await loadFresh();
    expect(() => writeMode('foo')).toThrowError(
      expect.objectContaining({ code: 'INVALID_MODE' })
    );
  });
});
