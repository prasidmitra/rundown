// Optional cloud sync via MongoDB. The local JSON file is always the
// source of truth for what's on screen; this module only pushes local
// writes up (best-effort, on every save) and pulls remote state down (on
// demand, via the Sync button) — there's no realtime subscription and no
// per-field conflict resolution, just id-based list merging on both sides
// (see push() and server.js's pull handler).
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const COLLECTION_NAME = 'rundown_state';
const DOC_ID = 'singleton';

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
// Merges by list id into whatever's already in the cloud, rather than
// overwriting the whole document. A device only knows about its own
// locally-synced lists, so a wholesale overwrite would erase lists synced
// from *other* devices that this device has never pulled down — e.g.
// enabling sync on a fresh machine before ever pulling would otherwise
// wipe out every list synced from elsewhere. This does mean deleting a
// synced list locally doesn't remove it from the cloud (or other devices,
// on their next pull) — there's no delete propagation, only add/update.
async function push(dataDir, dataObj) {
  const { mongoUri } = getConfig(dataDir);
  if (!mongoUri) return;
  const collection = await getCollection(mongoUri);
  const existing = await collection.findOne({ _id: DOC_ID });
  const remoteLists = (existing && existing.data && existing.data.lists) || [];
  const localLists = dataObj.lists || [];
  const localIds = new Set(localLists.map(l => l.id));
  const mergedLists = [...remoteLists.filter(l => !localIds.has(l.id)), ...localLists];
  await collection.updateOne(
    { _id: DOC_ID },
    { $set: { data: { ...dataObj, lists: mergedLists }, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function pull(dataDir) {
  const { mongoUri } = getConfig(dataDir);
  if (!mongoUri) throw new Error('Cloud sync is not configured yet.');
  const collection = await getCollection(mongoUri);
  const doc = await collection.findOne({ _id: DOC_ID });
  if (!doc) throw new Error('No data found in the cloud yet — edit a list locally first so it pushes something up.');
  return doc.data;
}

module.exports = { getConfig, setConfig, push, pull };
