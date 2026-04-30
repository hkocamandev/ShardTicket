import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

export const latency = new Trend('latency');
export const success = new Counter('success');
export const conflict = new Counter('conflict');
export const error = new Counter('error');

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 100,
    },
  },
};

export default function () {
  const res = http.post(
    'http://localhost:3000/demo/non-transactional/tenant_1/tenant_1_evt_1/buy',
    JSON.stringify({ userId: `user_${__ITER}` }),
    { headers: { 'Content-Type': 'application/json' },
  timeout: '10s' }
  );

  latency.add(res.timings.duration);

  if (res.status === 200 || res.status === 201) success.add(1);
  else if (res.status === 409) conflict.add(1);
  else error.add(1);

  check(res, {
    'valid response': r => [200, 201, 409].includes(r.status),
  });
}
