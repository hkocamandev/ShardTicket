import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100,
  iterations: 10000
};

export default function () {
  const res = http.post(
    'http://localhost:3000/demo/non-transactional/tenant_1/tenant_1_evt_1/buy',
    JSON.stringify({ userId: `user_${__ITER}` }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    '200 or 409': r => r.status === 200 || r.status === 409
  });
}
