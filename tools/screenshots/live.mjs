// Captures docs/screenshots/live-buying.gif — the Dashboard while a load test
// is running: "Tickets sold" climbs, "Remaining inventory" drops, and all the
// event progress bars fill in real time. Run after capture.mjs (stack up, TX).
//
// Usage: node live.mjs   (from tools/screenshots/)

import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/screenshots');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:3000';
const log = (...a) => console.log('•', ...a);

function halve({ width, height, data }) {
  const w2 = width >> 1;
  const h2 = height >> 1;
  const out = new Uint8Array(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const sx = x * 2;
      const sy = y * 2;
      for (let c = 0; c < 4; c++) {
        const i00 = (sy * width + sx) * 4 + c;
        const i01 = (sy * width + sx + 1) * 4 + c;
        const i10 = ((sy + 1) * width + sx) * 4 + c;
        const i11 = ((sy + 1) * width + sx + 1) * 4 + c;
        out[(y * w2 + x) * 4 + c] = (data[i00] + data[i01] + data[i10] + data[i11]) >> 2;
      }
    }
  }
  return { width: w2, height: h2, data: out };
}

function encodeGif(frames, outPath, delayMs) {
  const gif = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.data, 256);
    const index = applyPalette(f.data, palette);
    gif.writeFrame(index, f.width, f.height, { palette, delay: delayMs });
  }
  gif.finish();
  fs.writeFileSync(outPath, Buffer.from(gif.bytes()));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
  log(`gif → ${path.basename(outPath)} (${frames.length} frames, ${kb} KB)`);
}

const post = (p, body) =>
  fetch(`${API}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.text());

async function main() {
  // Start from zero so the counters visibly climb.
  log('reset → seed multi → post-seed sharding …');
  await post('/admin/reset');
  await post('/admin/seed', { mode: 'multi' });
  await post('/admin/sharding/post-seed');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.getByText('Tickets sold').first().waitFor();
  await page.waitForTimeout(800);

  // Kick off the load test, then immediately start recording so we catch the climb.
  log('starting load test (hot_event_sharded, 20 VUs, 30s) …');
  await post('/k6/run', { scenario: 'hot_event_sharded', vus: 20, duration: '30s' });

  log('recording live-buying.gif …');
  const frames = [];
  const COUNT = 60;
  const INTERVAL = 350; // ~21s of dashboard, several 5s data refreshes
  for (let i = 0; i < COUNT; i++) {
    const buf = await page.screenshot();
    frames.push(halve(PNG.sync.read(buf)));
    if (i < COUNT - 1) await page.waitForTimeout(INTERVAL);
  }
  encodeGif(frames, path.join(OUT, 'live-buying.gif'), INTERVAL);

  // Stop the run so it doesn't linger.
  await post('/k6/stop').catch(() => {});
  await browser.close();

  // Drop the dead GIF.
  const dead = path.join(OUT, 'shard-distribution.gif');
  if (fs.existsSync(dead)) {
    fs.unlinkSync(dead);
    log('removed shard-distribution.gif');
  }
  log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
