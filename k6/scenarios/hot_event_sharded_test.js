import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

export const latency = new Trend('latency');
export const success = new Counter('success');
export const conflict = new Counter('conflict');
export const error = new Counter('error');

export let options = {
  vus: 100,
  iterations: 10000,
};

export default function () {
  const tenantIndex = (__ITER % 3) + 1;
  const eventIndex = (__ITER % 10) + 1;

  const tenant = `tenant_${tenantIndex}`;
  const event = `${tenant}_evt_${eventIndex}`;
  const url = `http://localhost:3000/tenants/${tenant}/events/${event}/buy`;

  const payload = JSON.stringify({ userId: `user_${__VU}_${__ITER}` });

  const res = http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  latency.add(res.timings.duration);

  if (res.status === 200 || res.status === 201) success.add(1);
  else if (res.status === 409) conflict.add(1);
  else error.add(1);

  check(res, {
    'valid response': r => [200, 201, 409].includes(r.status),
  });
}
