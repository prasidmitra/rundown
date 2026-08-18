// Tiny local server for the tracker app.
// No dependencies - only Node core modules. Binds to localhost only.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8787;
const ROOT = __dirname;
// When run inside the packaged Electron app, main.js points this at a
// writable per-user data directory outside the (possibly read-only) app
// bundle. Falls back to this folder for plain `node server.js` use.
const DATA_DIR = process.env.TRACKER_DATA_DIR || ROOT;
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
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        writeData(body);
        res.writeHead(200, { 'Content-Type': MIME['.json'] });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request: ' + e.message);
      }
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
  console.log(`Tracker running at http://127.0.0.1:${PORT}`);
});

module.exports = server;
