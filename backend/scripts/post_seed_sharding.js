import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGO_URI_SHARDED;

const ALREADY_DONE_PATTERNS = [
  /already/i,
  /boundary key/i,
  /not unique/i,
  /sharding already enabled/i,
];

async function safe(label, op) {
  try {
    await op();
    console.log(`  [OK]   ${label}`);
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    if (ALREADY_DONE_PATTERNS.some(re => re.test(msg))) {
      console.log(`  [skip] ${label} — already done`);
    } else {
      throw err;
    }
  }
}

async function run() {
  console.log("Connecting to mongos...");
  await mongoose.connect(uri);
  console.log("Connected.");

  const admin = mongoose.connection.db.admin();

  await safe("enableSharding ticketing", () =>
    admin.command({ enableSharding: "ticketing" })
  );

  await safe("shardCollection ticketing.tickets", () =>
    admin.command({
      shardCollection: "ticketing.tickets",
      key: { tenantId: 1, eventId: 1 }
    })
  );

  await safe("shardCollection ticketing.events", () =>
    admin.command({
      shardCollection: "ticketing.events",
      key: { tenantId: 1, eventId: 1 }
    })
  );

  await safe("split tickets at tenant_2/evt_1", () =>
    admin.command({
      split: "ticketing.tickets",
      middle: { tenantId: "tenant_2", eventId: "tenant_2_evt_1" }
    })
  );

  await safe("moveChunk tenant_2/evt_1 to shard2", () =>
    admin.command({
      moveChunk: "ticketing.tickets",
      find: { tenantId: "tenant_2", eventId: "tenant_2_evt_1" },
      to: "shard2"
    })
  );

  console.log("Done.");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
