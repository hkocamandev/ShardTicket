SCRIPTS DIRECTORY — REFERENCE
==============================

All sh files must be run from the project root directory:
  bash scripts/<filename>.sh


----------------------------------------------------------------------
SEED SCRIPTS — Wipes the database and repopulates it
----------------------------------------------------------------------

seed_hot.sh
  Creates a single tenant (tenant_1) and a single event (tenant_1_evt_1)
  with a capacity of 10,000 tickets.
  Purpose: Simulates a "hot partition" scenario where all traffic
  hammers a single event.
  SEED_MODE=hot

seed_multi.sh
  Creates 3 tenants (tenant_1, tenant_2, tenant_3) with 10 events each.
  Total: 30 events, each with 5,000 ticket capacity.
  Purpose: Simulates a normal usage pattern where load is spread
  across multiple tenants and events.
  SEED_MODE=multi

shard_post_seed.sh
  Applies the sharding configuration via mongos after seeding.
  What it does:
    - Enables sharding on the ticketing database
    - Shards the tickets and events collections on { tenantId, eventId }
    - Splits a chunk at tenant_2 and moves it to shard2
  When to run: Once after the first seed in sharded mode.
  Does not need to be re-run unless the Docker stack is fully rebuilt.


----------------------------------------------------------------------
TEST SCRIPTS — Runs only the k6 test (no seeding)
----------------------------------------------------------------------

test_hot.sh
  Runs the hot_event_test.js scenario.
  100 virtual users (VUs), 10,000 requests, all targeting tenant_1/evt_1.
  Database must be seeded with seed_hot.sh beforehand.

test_multi.sh
  Runs the hot_event_sharded_test.js scenario.
  100 VUs, 10,000 requests, cycling across 3 tenants x 10 events.
  Database must be seeded with seed_multi.sh beforehand.

test_non_transactional.sh
  Runs the non_transactional_test.js scenario.
  200 requests/second for 30 seconds, all hitting the same endpoint.
  Backend must be running with USE_TRANSACTIONS=false.


----------------------------------------------------------------------
END-TO-END SCRIPTS — Seed + Test combined
----------------------------------------------------------------------

run_hot.sh
  Seeds with SEED_MODE=hot + USE_TRANSACTIONS=true,
  then runs hot_event_test.js.
  Shows: How a hot partition behaves under sharded mode —
  all load concentrates on one shard.

run_multi.sh
  Seeds with SEED_MODE=multi + USE_TRANSACTIONS=true,
  then runs hot_event_sharded_test.js.
  Shows: How sharding distributes load evenly across tenants and shards.

run_non_transactional.sh
  Seeds with SEED_MODE=hot + USE_TRANSACTIONS=false,
  then runs non_transactional_test.js.
  Shows: Without transactions, concurrent requests cause overselling —
  ticket count exceeds event capacity (race condition).

run_all.sh
  Resets the Docker stack and runs all three scenarios in sequence:
    1. Sharded hot event test
    2. Sharded multi event test
    3. Non-transactional test
  Results are saved as JSON files under k6/results/.
  Warning: The Docker stack is restarted between each scenario,
  so this takes a long time to complete.


----------------------------------------------------------------------
SCENARIO — SCRIPT MAPPING SUMMARY
----------------------------------------------------------------------

  What do you want to see?            Run
  ----------------------------------  --------------------------------
  Load distribution (sharding works)  bash scripts/run_multi.sh
  Hot partition problem               bash scripts/run_hot.sh
  Race condition / overselling        bash scripts/run_non_transactional.sh
  All scenarios in sequence           bash scripts/run_all.sh
