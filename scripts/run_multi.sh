#!/bin/bash
export SEED_MODE=multi
export USE_TRANSACTIONS=true
node backend/scripts/seed.js
k6 run k6/scenarios/hot_event_sharded_test.js
