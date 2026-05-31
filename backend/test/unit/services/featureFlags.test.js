import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tmpDir;
let envPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flags-svc-'));
  envPath = path.join(tmpDir, '.env');
  process.env.BACKEND_ENV_PATH = envPath;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.BACKEND_ENV_PATH;
  delete process.env.USE_REDIS_CACHE;
  delete process.env.USE_REDIS_LOCK;
});

async function loadFresh() {
  return import('../../../src/services/featureFlags.js');
}

describe('featureFlags', () => {
  it('readFlag returns true when env var is "true"', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    const { readFlag, FLAGS } = await loadFresh();
    expect(readFlag(FLAGS.USE_REDIS_CACHE)).toBe(true);
  });

  it('readFlag returns false when env var is "false" or unset', async () => {
    process.env.USE_REDIS_CACHE = 'false';
    const { readFlag, FLAGS } = await loadFresh();
    expect(readFlag(FLAGS.USE_REDIS_CACHE)).toBe(false);
    delete process.env.USE_REDIS_CACHE;
    expect(readFlag(FLAGS.USE_REDIS_CACHE)).toBe(false);
  });

  it('readFlag throws INVALID_FLAG for unknown name', async () => {
    const { readFlag } = await loadFresh();
    expect(() => readFlag('NOT_A_FLAG')).toThrowError(
      expect.objectContaining({ code: 'INVALID_FLAG' })
    );
  });

  it('readAllFlags returns all known flags as booleans', async () => {
    process.env.USE_REDIS_CACHE = 'true';
    process.env.USE_REDIS_LOCK = 'false';
    const { readAllFlags } = await loadFresh();
    expect(readAllFlags()).toEqual({
      USE_REDIS_CACHE: true,
      USE_REDIS_LOCK: false,
    });
  });

  it('writeFlag creates the env file with the value', async () => {
    const { writeFlag, FLAGS } = await loadFresh();
    const r = writeFlag(FLAGS.USE_REDIS_CACHE, true);
    expect(r).toEqual({
      flag: 'USE_REDIS_CACHE',
      value: true,
      envPath,
    });
    expect(fs.readFileSync(envPath, 'utf8')).toMatch(/USE_REDIS_CACHE=true/);
    expect(process.env.USE_REDIS_CACHE).toBe('true');
  });

  it('writeFlag replaces an existing line and preserves the rest', async () => {
    fs.writeFileSync(
      envPath,
      'FOO=bar\nUSE_REDIS_CACHE=false\nBAZ=qux\nUSE_REDIS_LOCK=false\n'
    );
    const { writeFlag, FLAGS } = await loadFresh();
    writeFlag(FLAGS.USE_REDIS_CACHE, true);
    const content = fs.readFileSync(envPath, 'utf8');
    expect(content).toMatch(/FOO=bar/);
    expect(content).toMatch(/BAZ=qux/);
    expect(content).toMatch(/USE_REDIS_CACHE=true/);
    expect(content).toMatch(/USE_REDIS_LOCK=false/);
    expect(content.match(/USE_REDIS_CACHE=/g)?.length).toBe(1);
  });

  it('writeFlag throws INVALID_FLAG for unknown name', async () => {
    const { writeFlag } = await loadFresh();
    expect(() => writeFlag('NOT_A_FLAG', true)).toThrowError(
      expect.objectContaining({ code: 'INVALID_FLAG' })
    );
  });

  it('writeFlag throws INVALID_VALUE when value is not boolean', async () => {
    const { writeFlag, FLAGS } = await loadFresh();
    expect(() => writeFlag(FLAGS.USE_REDIS_LOCK, 'true')).toThrowError(
      expect.objectContaining({ code: 'INVALID_VALUE' })
    );
    expect(() => writeFlag(FLAGS.USE_REDIS_LOCK, 1)).toThrowError(
      expect.objectContaining({ code: 'INVALID_VALUE' })
    );
  });

  it('isValidFlag returns true for known and false for unknown', async () => {
    const { isValidFlag, FLAGS } = await loadFresh();
    expect(isValidFlag(FLAGS.USE_REDIS_CACHE)).toBe(true);
    expect(isValidFlag('NOPE')).toBe(false);
  });
});
