# ShardTicket — A Sharded Multi-Tenant Ticketing System (Node.js + MongoDB)

ShardTicket is a production-style educational project demonstrating how **database sharding** works using **Node.js**, **MongoDB**, and modern distributed system patterns.

The repository contains **two complete architectures**:

1. **Non-Sharded Architecture**
2. **Sharded Architecture** (Router + Config Server + Multiple Shards)

Both versions expose the **same API**, making it easy to compare behavior, performance, and scalability.

---

## 🎯 Purpose

This project helps developers understand:

- What sharding is and why it matters
- How to design effective shard keys
- How multi-tenant systems scale horizontally
- How mongos routes queries to correct shards
- How to avoid cross-shard inefficiencies
- How to monitor a distributed MongoDB cluster
- How high-cardinality data affects design
- How to test sharded vs non-sharded performance

---

## 🧩 Core Ticketing Features

- Create events (concerts, festivals, sports, theatre, conferences, etc.)
- Define ticket categories (VIP, Regular, Backstage, etc.)
- Seat-based or quota-based ticket generation
- Ticket reservation and purchase operations
- Multi-tenant data isolation
- Monitoring dashboards
- Synthetic data generation tools
- Load testing scripts

---

## 🧠 Why Ticketing? Why Sharding?

Ticketing systems are naturally suitable for sharding education because they involve:

- Massive write bursts (e.g., concert ticket drop)
- Hot partitions (everyone hitting the same event)
- High-cardinality seat/ticket structures
- Independent tenants (each organization with its own events)

These produce real-world sharding challenges and make the system ideal for learning.

---

## 🛠 Architecture

### 1️⃣ Non-Sharded Architecture

A single MongoDB instance storing:
users
tenants
events
tickets
orders


Used to measure baseline performance and compare with the sharded setup.

---

### 2️⃣ Sharded Architecture

```txt
                          +------------------+
                          |      mongos       |  → Node.js API
                          +------------------+
                                    |
                +-----------------------------------------+
                |                                         |
       +----------------+                      +----------------+
       |     Shard 1    |                      |     Shard 2    |
       +----------------+                      +----------------+
                |                                         |
                        +-----------------------+
                        |     Config Server     |
                        +-----------------------+
```
---

## 🔑 Shard Key Strategy

ShardTicket uses the key:
{ "tenantId": 1, "eventId": 1 }
Benefits:

- tenantId distributes organizations across shards

- eventId groups all tickets of an event together

- Avoids cross-shard writes

- Handles bursty, high-traffic events

- Enables linear horizontal scaling

---

## 📊 Monitoring & Observability
Metrics include:

- API response latency

- Request throughput

- Per-shard CPU, RAM, disk I/O

- MongoDB read/write durations

- Shard distribution analytics

- Balancer activity

- Redis cache hit/miss rates

- Database connection pool metrics

Tools:

- Prometheus

- Grafana

- Node.js metrics endpoint

- MongoDB internal metrics
  
---

## 📁 Folder Structure
```txt
ShardTicket/
 ├── backend/
 │    ├── src/
 │    │    ├── api/
 │    │    ├── sharding/
 │    │    ├── tenants/
 │    │    ├── events/
 │    │    ├── tickets/
 │    │    ├── orders/
 │    ├── scripts/
 │    ├── monitoring/
 │    ├── docker/
 ├── frontend/
 ├── README.md

```
---

##  ⚙️ Tech Stack

### Backend

Node.js (Express)

MongoDB (single instance + sharded cluster)

Redis

Docker & Docker Compose

Prometheus + Grafana

### Frontend

React (Vite)

TailwindCSS

Recharts

### Developer Tools

ESLint + Prettier

k6 for load testing

---

## 🧪 Load Testing

Load scenarios include:

High concurrency ticket purchases

Multi-tenant traffic simulation

Cross-shard vs in-shard read/write comparison

Shard balancing under stress
### Run example:

```txt 
k6 run load-tests/purchase_load_test.js
```
## 🤝 Contributing

Pull requests are welcome.
Feel free to improve routing, monitoring, caching, or add new ticketing features.
