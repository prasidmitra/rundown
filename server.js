// Tiny local server for Rundown.
// Core logic has no dependencies beyond Node itself; optional cloud sync
// (sync.js) is the one place that pulls in an npm package (mongodb).
// Binds to localhost only.
const http = require('http');
const fs = require('fs');
const path = require('path');
const sync = require('./sync.js');

const PORT = 8787;
const ROOT = __dirname;
// When run inside the packaged Electron app, main.js points this at a
// writable per-user data directory outside the (possibly read-only) app
// bundle. Falls back to this folder for plain `node server.js` use.
const DATA_DIR = process.env.RUNDOWN_DATA_DIR || ROOT;
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const DEFAULT_DATA = {
  lists: [
    { id: 'l1', name: 'Work', sort: { by: 'priority', dir: 'asc' }, items: [] }
  ]
};

const STATIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/styles.css': 'styles.css',
  '/app.js': 'app.js',
  '/logo.png': 'logo.png'
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
  return fs.readFileSync(DATA_FILE, 'utf8');
}

function writeData(jsonText) {
  // Validate before touching disk.
  JSON.parse(jsonText);
  const tmpFile = DATA_FILE + '.tmp';
  fs.writeFileSync(tmpFile, jsonText);
  fs.renameSync(tmpFile, DATA_FILE); // atomic on the same filesystem
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

function serveStatic(res, relPath) {
  const filePath = path.join(ROOT, relPath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/api/data' && req.method === 'GET') {
    const json = readData();
    res.writeHead(200, { 'Content-Type': MIME['.json'] });
    res.end(json);
    return;
  }

  if (url === '/api/data' && req.method === 'POST') {
    readBody(req).then(async body => {
      try {
        writeData(body);
        res.writeHead(200, { 'Content-Type': MIME['.json'] });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request: ' + e.message);
        return;
      }
      // Best-effort: cloud push failures shouldn't affect the local save,
      // which already succeeded by this point. Only lists with
      // syncEnabled explicitly turned on ever leave this machine — sync is
      // opt-in per list, off by default.
      try {
        const parsed = JSON.parse(body);
        const syncable = { ...parsed, lists: (parsed.lists || []).filter(l => l.syncEnabled) };
        await sync.push(DATA_DIR, syncable);
      } catch (e) {
        console.error('Cloud sync push failed:', e.message);
      }
    });
    return;
  }

  if (url === '/api/sync/status' && req.method === 'GET') {
    const { mongoUri } = sync.getConfig(DATA_DIR);
    res.writeHead(200, { 'Content-Type': MIME['.json'] });
    res.end(JSON.stringify({ configured: !!mongoUri }));
    return;
  }

  if (url === '/api/sync/config' && req.method === 'POST') {
    readBody(req).then(body => {
      try {
        const { mongoUri } = JSON.parse(body);
        if (!mongoUri || typeof mongoUri !== 'string') throw new Error('mongoUri is required');
        sync.setConfig(DATA_DIR, { mongoUri });
        res.writeHead(200, { 'Content-Type': MIME['.json'] });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request: ' + e.message);
      }
    });
    return;
  }

  if (url === '/api/sync/pull' && req.method === 'POST') {
    sync.pull(DATA_DIR).then(remote => {
      // Pulling replaces the synced lists wholesale with the cloud's
      // version, but local-only lists (syncEnabled false/unset) never went
      // to the cloud in the first place, so they're preserved as-is rather
      // than being wiped out.
      const local = JSON.parse(readData());
      const localOnlyLists = local.lists.filter(l => !l.syncEnabled);
      const merged = { ...local, ...remote, lists: [...localOnlyLists, ...(remote.lists || [])] };
      writeData(JSON.stringify(merged));
      res.writeHead(200, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify(merged));
    }).catch(e => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Sync failed: ' + e.message);
    });
    return;
  }

  if (STATIC_FILES[url]) {
    serveStatic(res, STATIC_FILES[url]);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Rundown server running at http://127.0.0.1:${PORT}`);
});

module.exports = server;
