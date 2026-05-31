import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

// Demonstrates the read-cache (USE_REDIS_CACHE) effect: 50 VUs hammer the
// two admin endpoints the frontend polls (events, tickets/count). With the
// flag OFF every request hits Mongo. With the flag ON the first request
// per 5s window hits Mongo; the rest serve from Redis.
//
// Compare two runs by flipping POST /admin/flags between them.

export const eventsLatency = new Trend('admin_events_latency_ms');
export const countLatency = new Trend('admin_count_latency_ms');

export let options = {
  vus: 50,
  duration: '30s',
};

export default function () {
  const base = 'http://localhost:3000/admin';

  const r1 = http.get(`${base}/events`);
  eventsLatency.add(r1.timings.duration);
  check(r1, { 'events 200': (r) => r.status === 200 });

  const r2 = http.get(`${base}/tickets/count`);
  countLatency.add(r2.timings.duration);
  check(r2, { 'count 200': (r) => r.status === 200 });
}
