#!/bin/bash

echo "🚀 Creating ShardTicket project skeleton..."



###############################################
# BACKEND STRUCTURE
###############################################
echo "📦 Creating backend structure..."

mkdir -p backend/src/{api,config,sharding,tenants,events,tickets,orders,utils,services,models,db}
mkdir -p backend/{docker,scripts,monitoring}
mkdir -p backend/tests

# Example backend files
cat <<EOF > backend/src/server.js
console.log("ShardTicket backend server placeholder");
EOF

cat <<EOF > backend/.env.example
MONGO_URI=
REDIS_HOST=localhost
PORT=3000
EOF

###############################################
# FRONTEND STRUCTURE
###############################################
echo "🎨 Creating frontend structure..."

mkdir -p frontend/src/{components,pages,utils,services}
mkdir -p frontend/public

cat <<EOF > frontend/README.md
# ShardTicket Frontend
This is the React frontend placeholder.
EOF

###############################################
# DOCKER STRUCTURE
###############################################
echo "🐳 Creating Docker & Mongo cluster folders..."

mkdir -p docker/{mongo-single,mongo-sharded,prometheus,grafana}

cat <<EOF > docker/docker-compose.yml
version: '3.8'
services:
  # Placeholder services — to be expanded later
  backend:
    image: node:18
    command: "echo backend placeholder"
  frontend:
    image: node:18
    command: "echo frontend placeholder"
EOF

###############################################
# MONGO CLUSTER FOLDERS (SHARDED + SINGLE)
###############################################
echo "🧩 Creating Mongo single + sharded cluster folders..."

mkdir -p docker/mongo-single/data

mkdir -p docker/mongo-sharded/{configsvr,shard1,shard2,router}
mkdir -p docker/mongo-sharded/configsvr/data
mkdir -p docker/mongo-sharded/shard1/data
mkdir -p docker/mongo-sharded/shard2/data
mkdir -p docker/mongo-sharded/router

###############################################
# SCRIPTS
###############################################
echo "📜 Creating scripts..."

mkdir -p scripts/

cat <<EOF > scripts/load_test_placeholder.js
// k6 load test placeholder
export default function () {
  console.log("Load test placeholder");
}
EOF

cat <<EOF > scripts/data_generator.js
console.log("Data generator placeholder");
EOF

###############################################
# MONITORING
###############################################
echo "📡 Creating monitoring folders..."

mkdir -p monitoring/{prometheus,grafana}

cat <<EOF > monitoring/prometheus/prometheus.yml
# Prometheus config placeholder
global:
  scrape_interval: 5s
scrape_configs: []
EOF

###############################################
# ROOT README
###############################################
echo "📝 Creating root README placeholder..."

cat <<EOF > README.md
# ShardTicket
Project initialized. Replace this README with your final version.
EOF

###############################################
# DONE
###############################################
echo "🎉 ShardTicket skeleton created successfully!"
