#!/bin/bash
export SEED_MODE=hot
export USE_TRANSACTIONS=true
node backend/scripts/seed.js
k6 run k6/scenarios/hot_event_test.js
