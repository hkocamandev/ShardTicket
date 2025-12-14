// backend/scripts/load_buyers.js
const axios = require('axios');
const { default: PQueue } = require('p-queue');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const TENANT = process.env.TENANT || 'tenant_1';
const EVENT = process.env.EVENT || `${TENANT}_evt_1`;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '100', 10);
const TOTAL = parseInt(process.env.TOTAL || '1000', 10);

const queue = new PQueue({ concurrency: CONCURRENCY });

async function buyOne(i) {
  try {
    const res = await axios.post(`${BASE}/tenants/${TENANT}/events/${EVENT}/buy`, {
      userId: `user_${i}`
    }, { timeout: 10000 });
    return res.data;
  } catch (err) {
    return { error: err.message, code: err.response && err.response.status };
  }
}

async function run() {
  console.log(`Starting ${TOTAL} buys at concurrency ${CONCURRENCY}`);
  const results = [];
  for (let i = 0; i < TOTAL; i++) {
    queue.add(async () => {
      const r = await buyOne(i);
      results.push(r);
    });
  }
  await queue.onIdle();
  const success = results.filter(r => r && r.success).length;
  console.log('Done. Success:', success, '/', TOTAL);
  process.exit(0);
}

run();
