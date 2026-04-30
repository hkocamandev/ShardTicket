import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGO_URI_SHARDED;

async function run() {
  console.log("Connecting to mongos...");
  await mongoose.connect(uri);
  console.log("Connected.");

  const admin = mongoose.connection.db.admin();

  console.log("Enabling sharding for ticketing...");
  await admin.command({ enableSharding: "ticketing" });

  console.log("Sharding tickets...");
  await admin.command({
    shardCollection: "ticketing.tickets",
    key: { tenantId: 1, eventId: 1 }
  });

  console.log("Sharding events...");
  await admin.command({
    shardCollection: "ticketing.events",
    key: { tenantId: 1, eventId: 1 }
  });

  console.log("Splitting chunks...");
  await admin.command({
    split: "ticketing.tickets",
    middle: { tenantId: "tenant_2", eventId: "tenant_2_evt_1" }
  });

  console.log("Moving chunk to shard2...");
  await admin.command({
    moveChunk: "ticketing.tickets",
    find: { tenantId: "tenant_2", eventId: "tenant_2_evt_1" },
    to: "shard2"
  });

  console.log("Done.");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
