import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 100,
  iterations: 10000,
};

export default function () {
  const url = 'http://localhost:3000/tenants/tenant_1/events/tenant_1_evt_1/buy';
  const payload = JSON.stringify({ userId: `user_${__VU}_${__ITER}` });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(url, payload, params);

  check(res, {
    '200 or 409': (r) => r.status === 200 || r.status === 409,
  });
}
