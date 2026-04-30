# ShardTicket

A production-style educational project demonstrating how **database sharding** works using **Node.js**, **MongoDB**, and modern distributed system patterns.

The repository contains **two complete architectures** that expose the same API, making it easy to compare behavior, performance, and scalability:

1. **Non-Sharded Architecture** — single MongoDB replica set, no transactions
2. **Sharded Architecture** — Router + Config Server + Multiple Shards, full ACID transactions

---

## 🎯 Purpose

This project helps developers understand:

- What sharding is and why it matters
- How to design effective shard keys
- How multi-tenant systems scale horizontally
- How mongos routes queries to correct shards
- How to avoid cross-shard inefficiencies
- How high-cardinality data affects design
- How to test sharded vs non-sharded performance

---

## 🧠 Why Ticketing? Why Sharding?

Ticketing systems are naturally suitable for sharding education because they involve:

- **Massive write bursts** — concert ticket drops
- **Hot partitions** — everyone hitting the same event simultaneously
- **High-cardinality structures** — seat/ticket IDs, many tenants
- **Independent tenants** — each organization with its own events

These produce real-world sharding challenges that make the system ideal for learning.

---

## 🛠 Architecture

### Non-Sharded Architecture

A single MongoDB replica set storing all collections. Used to measure baseline performance and demonstrate race conditions without transactions.

### Sharded Architecture

```
                  ┌─────────────────┐
                  │     mongos      │  ← Node.js API connects here
                  └────────┬────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
   ┌──────┴──────┐                   ┌──────┴──────┐
   │   Shard 1   │                   │   Shard 2   │
   └─────────────┘                   └─────────────┘
          │                                 │
          └────────────────┬────────────────┘
                           │
                  ┌────────┴────────┐
                  │  Config Server  │
                  └─────────────────┘
```

---

## 🔑 Shard Key Strategy

Both `events` and `tickets` collections are sharded on:

```json
{ "tenantId": 1, "eventId": 1 }
```

**Benefits:**
- `tenantId` distributes organizations across shards
- `eventId` groups all tickets of an event together
- Avoids cross-shard transactions
- Handles bursty, high-traffic events
- Enables linear horizontal scaling

---

## 🧩 Core Features

- Multi-tenant event management
- Transactional ticket purchasing with WriteConflict retry logic
- Non-transactional purchasing flow (intentional race condition demo)
- Seed scripts for hot event and multi-tenant scenarios
- k6 load tests for all three scenarios
- Admin endpoints for shard distribution and ticket analytics
- Prometheus metrics endpoint

---

## ⚙️ Tech Stack

**Backend:** Node.js (Express), MongoDB 6, Mongoose, Prometheus client

**Infrastructure:** Docker Compose, mongos, replica sets

**Load Testing:** k6

**Monitoring:** Prometheus, Grafana (planned)

---

## 📁 Project Structure

```
ShardTicket/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/          # Tenant, Event, Ticket
│   │   ├── routes/
│   │   ├── services/        # buyTicket.js (TX), buyTicketNonTransactional.js
│   │   └── config/
│   └── scripts/             # seed.js, post_seed_sharding.js
├── docker/
│   ├── mongo-init/          # Replica set + shard initialization scripts
│   ├── docker-compose.yml              # Full sharded cluster
│   ├── docker-compose.sharded.yml
│   └── docker-compose.nonsharded.yml
├── k6/
│   └── scenarios/           # hot_event_test.js, hot_event_sharded_test.js, non_transactional_test.js
├── scripts/                 # Shell scripts for seed, test, and end-to-end runs
└── monitoring/
    └── prometheus/
```

---

## 🧪 Load Testing

Three scenarios are available:

| Scenario | Seed Mode | Test Script | What It Shows |
|---|---|---|---|
| Hot Event | `hot` | `hot_event_test.js` | Hot partition under transaction contention |
| Multi Event | `multi` | `hot_event_sharded_test.js` | Load distribution across shards |
| Non-Transactional | `hot` | `non_transactional_test.js` | Race condition / overselling |

Run all scenarios end-to-end:

```bash
bash scripts/run_all.sh
```

See `scripts/SCRIPTS_README.txt` for the full script reference.

---

## 🤝 Contributing

Pull requests are welcome. Feel free to improve routing, monitoring, caching, or add new ticketing features.
