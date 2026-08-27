// Optional cloud sync via an HTTPS relay (see lambda-relay/) in front of
// MongoDB. Going through a relay rather than connecting to MongoDB
// directly means clients only ever need plain HTTPS on port 443 —
// MongoDB's native driver needs its own non-standard ports, which
// corporate/VPN networks commonly block even when browsing works fine.
//
// The local JSON file is always the source of truth for what's on
// screen; this module only pushes local writes up (best-effort, on every
// save) and pulls remote state down (on demand, via the Sync button) —
// there's no realtime subscription and no per-field conflict resolution,
// just id-based merging on both sides.
//
// Each synced list is stored as its own document in the relay's database
// rather than the whole app state as one blob, so MongoDB's 16MB
// single-document limit is scoped to a single list instead of your
// entire account — see lambda-relay/index.js.
const fs = require('fs');
const path = require('path');

function configFile(dataDir) {
  return path.join(dataDir, 'sync-config.json');
}

function getConfig(dataDir) {
  const file = configFile(dataDir);
  if (!fs.existsSync(file)) return { relayUrl: null, apiKey: null };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { relayUrl: null, apiKey: null };
  }
}

function setConfig(dataDir, config) {
  fs.writeFileSync(configFile(dataDir), JSON.stringify(config, null, 2));
}

async function callRelay(dataDir, action, extra) {
  const { relayUrl, apiKey } = getConfig(dataDir);
  if (!relayUrl || !apiKey) return null;
  const res = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ action, ...extra })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Relay returned ${res.status}`);
  return body;
}

// Best-effort: errors are the caller's problem to log, never block a local
// save on relay/cloud availability.
//
// The relay upserts each synced list into its own document, keyed by list
// id — a per-list merge by construction, so pushing from one device can
// never clobber lists synced from another device it hasn't pulled yet.
// Deleting a synced list locally does not delete it remotely by itself —
// that only happens if the caller explicitly calls remove() too (see
// server.js's /api/sync/delete, prompted by the UI when deleting a synced
// list).
async function push(dataDir, dataObj) {
  const { relayUrl } = getConfig(dataDir);
  if (!relayUrl) return;
  const lists = dataObj.lists || [];
  if (lists.length === 0) return;
  await callRelay(dataDir, 'push', { lists });
}

async function pull(dataDir) {
  const { relayUrl } = getConfig(dataDir);
  if (!relayUrl) throw new Error('Cloud sync is not configured yet.');
  const result = await callRelay(dataDir, 'pull');
  return { lists: (result && result.lists) || [] };
}

async function remove(dataDir, listId) {
  const { relayUrl } = getConfig(dataDir);
  if (!relayUrl) throw new Error('Cloud sync is not configured yet.');
  await callRelay(dataDir, 'delete', { listId });
}

module.exports = { getConfig, setConfig, push, pull, remove };
