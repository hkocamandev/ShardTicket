#!/usr/bin/env bash
set -e

K6_BIN=$(which k6)

reset_stack() {
  docker compose -f ../docker/docker-compose.yml down -v
  docker compose -f ../docker/docker-compose.yml up -d

  echo "⏳ Waiting for backend HTTP..."
  until curl -s http://localhost:3000/ >/dev/null; do sleep 1; done

  echo "⏳ Waiting for Mongo primary..."
  until docker exec mongos mongosh --quiet --eval 'db.hello().isWritablePrimary' | grep true >/dev/null; do
    sleep 1
  done

  echo "⏳ Waiting for sharding..."
  until docker exec mongos mongosh --quiet --eval 'db.getSiblingDB("config").shards.countDocuments()' | grep -v '^0$' >/dev/null; do
    sleep 1
  done

  echo "✅ Stack ready"
}



set_mode() {
  local mode=$1

  if [ "$mode" = "tx" ]; then
    sed -i '' 's/USE_TRANSACTIONS=.*/USE_TRANSACTIONS=true/' ../backend/.env
  else
    sed -i '' 's/USE_TRANSACTIONS=.*/USE_TRANSACTIONS=false/' ../backend/.env
  fi

  docker compose -f ../docker/docker-compose.yml up -d backend
  docker compose -f ../docker/docker-compose.yml restart backend

  echo "⏳ Waiting for backend to restart..."
  sleep 10
}



run_case() {
  local seed_mode=$1
  local scenario=$2
  local output=$3

 docker exec \
  -e SEED_MODE=$seed_mode \
  -e USE_TRANSACTIONS=$(grep USE_TRANSACTIONS ../backend/.env | cut -d= -f2) \
  shard_backend node scripts/seed.js

  echo "⏳ Letting DB stabilize..."
  sleep 5

  k6 run ../k6/scenarios/$scenario --summary-export ../k6/results/$output
}


reset_stack
set_mode tx
run_case hot hot_event_test.js sharded_hot.json

reset_stack
set_mode tx
run_case multi hot_event_sharded_test.js sharded_multi.json

reset_stack
set_mode no_tx
run_case hot non_transactional_test.js non_tx.json

echo "🎉 All tests done successfully."
