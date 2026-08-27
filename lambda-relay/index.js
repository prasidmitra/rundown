// HTTPS relay in front of MongoDB, for Rundown clients on networks that
// block MongoDB's native driver ports (e.g. corporate VPNs) but allow
// normal HTTPS. Mirrors sync.js's push/pull logic — each synced list is
// its own document (_id: list.id) in the rundown_lists collection.
const { MongoClient } = require('mongodb');

const COLLECTION_NAME = 'rundown_lists';

// Reused across warm Lambda invocations so we don't reconnect every call.
let cachedClientPromise = null;

function getCollection() {
  if (!cachedClientPromise) {
    const client = new MongoClient(process.env.MONGO_URI);
    cachedClientPromise = client.connect();
  }
  return cachedClientPromise.then(client => client.db().collection(COLLECTION_NAME));
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async event => {
  const headers = event.headers || {};
  const apiKey = headers['x-api-key'] || headers['X-Api-Key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return response(401, { error: 'Unauthorized' });
  }

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  try {
    const collection = await getCollection();

    if (payload.action === 'push') {
      const lists = payload.lists || [];
      if (lists.length > 0) {
        await collection.bulkWrite(lists.map(list => ({
          updateOne: {
            filter: { _id: list.id },
            update: { $set: { list, updatedAt: new Date() } },
            upsert: true
          }
        })));
      }
      return response(200, { ok: true });
    }

    if (payload.action === 'pull') {
      const docs = await collection.find({}).toArray();
      return response(200, { lists: docs.map(d => d.list) });
    }

    if (payload.action === 'delete') {
      if (!payload.listId) return response(400, { error: 'listId is required' });
      await collection.deleteOne({ _id: payload.listId });
      return response(200, { ok: true });
    }

    return response(400, { error: 'Unknown action: ' + payload.action });
  } catch (e) {
    console.error(e);
    return response(500, { error: e.message });
  }
};
