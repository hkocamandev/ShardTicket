#!/bin/bash
export SEED_MODE=hot
export USE_TRANSACTIONS=false
node backend/scripts/seed.js
k6 run k6/scenarios/non_transactional_test.js
