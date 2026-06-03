// Playwright capture harness for the ShardTicket admin panel.
//
// Produces the README assets in docs/screenshots/:
//   - 7 static PNG screenshots of the critical features
//   - 3 animated GIFs of the most striking interactions
//
// Prereqs: the full Docker stack is up (docker compose -f docker/docker-compose.yml up -d),
// the DB is seeded (multi), post-seed sharding has run, and at least one load test has
// populated ticket + metric data. See README "How the screenshots are made".
//
// Usage: npm run shots   (from tools/screenshots/)

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

fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log('•', ...a);

// ---------- GIF helpers ----------

// Average a 2x2 block down to one pixel — halves width/height, smooths and
// shrinks the GIF without a native dependency.
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

// Capture `count` frames `intervalMs` apart. `shrink` = how many 2x halvings
// to apply (1 keeps text readable for full-page demos; 2 for compact strips).
async function captureFrames(page, { count, intervalMs, clip, shrink = 1 }) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    const buf = await page.screenshot(clip ? { clip } : {});
    let img = PNG.sync.read(buf);
    for (let s = 0; s < shrink; s++) img = halve(img);
    frames.push(img);
    if (i < count - 1) await page.waitForTimeout(intervalMs);
  }
  return frames;
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  log(`png → ${name}`);
}

// ---------- main ----------

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();

  // Auto-accept the confirm() dialogs (mode switch / reset).
  page.on('dialog', (d) => d.accept());

  const goto = async (route) => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
  };

  // 1) Dashboard — workspace overview (control panel + stat cards + events table)
  await goto('/dashboard');
  await page.getByText('Tickets sold').first().waitFor();
  await page.waitForTimeout(1200); // let progress bars settle
  await shot(page, '01-dashboard.png');

  // 2) Control panel close-up — mode / redis flags / data controls
  const panel = page.locator('section.rounded.border').first();
  await panel.screenshot({ path: path.join(OUT, '02-controls.png') });
  log('png → 02-controls.png');

  // 3) Shards — cluster topology + tickets-per-tenant chart
  await goto('/shards');
  await page.getByText('Tickets per tenant').first().waitFor();
  await page.waitForTimeout(2200); // let the bar chart finish its entrance animation
  await shot(page, '03-shards.png');

  // GIF A: shard distribution bar chart entrance animation
  log('recording shard-distribution.gif …');
  await page.reload({ waitUntil: 'networkidle' });
  // Wait until the bars exist (recharts mounts them at the start of the animation).
  await page.locator('.recharts-bar-rectangle').first().waitFor({ timeout: 10000 });
  const chartBox = await page.locator('.h-80').first().boundingBox();
  const shardFrames = await captureFrames(page, {
    count: 22,
    intervalMs: 110,
    shrink: 1,
    clip: chartBox
      ? { x: Math.floor(chartBox.x), y: Math.floor(chartBox.y), width: Math.floor(chartBox.width), height: Math.floor(chartBox.height) }
      : undefined,
  });
  encodeGif(shardFrames, path.join(OUT, 'shard-distribution.gif'), 110);

  // 4) Metrics — embedded Grafana dashboard
  await goto('/metrics');
  await page.waitForTimeout(6000); // give the Grafana iframe time to render panels
  await shot(page, '04-metrics.png');

  // 5) Load Tester — idle config + last result + log
  await goto('/load-tester');
  await page.getByRole('button', { name: 'Run' }).waitFor();
  await page.waitForTimeout(800);
  await shot(page, '05-load-tester.png');

  // GIF B: live load test — click Run, capture streaming log + running pulse + results
  log('recording load-test.gif …');
  await page.getByRole('button', { name: 'Run' }).click();
  await page.waitForTimeout(1500); // let it transition to running
  const loadFrames = await captureFrames(page, { count: 40, intervalMs: 280, shrink: 1 });
  encodeGif(loadFrames, path.join(OUT, 'load-test.gif'), 280);
  // Stop the run we started so it doesn't linger.
  try {
    await page.getByRole('button', { name: 'Stop' }).click({ timeout: 3000 });
  } catch {
    /* may have already finished */
  }
  await page.waitForTimeout(2500);
  await shot(page, '06-load-tester-result.png');

  // 6) Non-TX mode + mode-toggle GIF (do this LAST — it flips backend mode)
  await goto('/dashboard');
  log('recording mode-toggle.gif …');
  // Start recording, then click Non-TX (dialog auto-accepted) and watch the
  // restart overlay + sidebar badge flip from "TX · sharded" to "Non-TX".
  const toggleStart = (async () => {
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Non-TX (replica set)' }).click();
  })();
  const modeFrames = await captureFrames(page, { count: 55, intervalMs: 240, shrink: 1 });
  await toggleStart;
  encodeGif(modeFrames, path.join(OUT, 'mode-toggle.gif'), 240);

  // Wait for non-tx to fully settle, capture the non-tx dashboard state.
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Tickets sold').first().waitFor();
  await page.waitForTimeout(1500);
  await shot(page, '07-nontx-mode.png');

  await browser.close();

  // Restore TX mode so the stack is left in its default state.
  log('restoring TX mode …');
  await fetch(`${API}/admin/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'tx' }),
  }).catch(() => {});

  log('done. assets in docs/screenshots/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
