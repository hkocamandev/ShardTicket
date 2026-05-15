import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let replset;

export async function startMemoryMongo() {
  if (replset) return mongoose.connection;
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = replset.getUri('ticketing');
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function stopMemoryMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replset) {
    await replset.stop();
    replset = undefined;
  }
}

export async function resetCollections() {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
