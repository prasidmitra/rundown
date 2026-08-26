// Optional cloud sync via MongoDB. The local JSON file is always the
// source of truth for what's on screen; this module only pushes local
// writes up (best-effort, on every save) and pulls remote state down (on
// demand, via the Sync button) — there's no realtime subscription and no
// per-field conflict resolution, just id-based merging on both sides.
//
// Each synced list is stored as its own document (_id: list.id) rather
// than the whole app state as one blob. That keeps MongoDB's 16MB
// single-document limit scoped to a single list instead of your entire
// account, so total storage can grow toward the real free-tier cap
// (512MB on Atlas M0) instead of being bottlenecked at 16MB no matter how
// much you have.
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const COLLECTION_NAME = 'rundown_lists';

// Cache the connected client across requests so we don't reconnect on
// every autosave. Keyed by URI so changing the configured URI reconnects.
let cachedClient = null; // { uri, clientPromise }

function configFile(dataDir) {
  return path.join(dataDir, 'sync-config.json');
}

function getConfig(dataDir) {
  const file = configFile(dataDir);
  if (!fs.existsSync(file)) return { mongoUri: null };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { mongoUri: null };
  }
}

function setConfig(dataDir, config) {
  fs.writeFileSync(configFile(dataDir), JSON.stringify(config, null, 2));
}

async function getCollection(uri) {
  if (!cachedClient || cachedClient.uri !== uri) {
    if (cachedClient) {
      cachedClient.clientPromise.then(c => c.close()).catch(() => {});
    }
    const client = new MongoClient(uri);
    cachedClient = { uri, clientPromise: client.connect() };
  }
  const client = await cachedClient.clientPromise;
  // Uses the database named in the URI path (e.g. .../rundown?...);
  // falls back to Mongo's default "test" db if the URI has none.
  return client.db().collection(COLLECTION_NAME);
}

// Best-effort: errors are the caller's problem to log, never block a local
// save on cloud availability.
//
// Upserts each synced list into its own document, keyed by list id. This
// is a per-list merge by construction — a device only ever touches the
// documents for lists it knows about, so pushing from one device can never
// clobber lists synced from another device it hasn't pulled yet. Deleting
// a synced list locally does not delete its document in the cloud (or
// remove it from other devices on their next pull) — there's no delete
// propagation, only add/update.
async function push(dataDir, dataObj) {
  const { mongoUri } = getConfig(dataDir);
  if (!mongoUri) return;
  const lists = dataObj.lists || [];
  if (lists.length === 0) return;
  const collection = await getCollection(mongoUri);
  await collection.bulkWrite(lists.map(list => ({
    updateOne: {
      filter: { _id: list.id },
      update: { $set: { list, updatedAt: new Date() } },
      upsert: true
    }
  })));
}

async function pull(dataDir) {
  const { mongoUri } = getConfig(dataDir);
  if (!mongoUri) throw new Error('Cloud sync is not configured yet.');
  const collection = await getCollection(mongoUri);
  const docs = await collection.find({}).toArray();
  if (docs.length === 0) throw new Error('No data found in the cloud yet — edit a list locally first so it pushes something up.');
  return { lists: docs.map(d => d.list) };
}

module.exports = { getConfig, setConfig, push, pull };
