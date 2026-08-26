# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Rundown: a local, personal daily task tracker. It's an Electron app — a
light-mode desktop window backed by a tiny dependency-free Node HTTP server
that reads/writes a plain JSON file on disk. No account, no cloud, no
external services, no build step, no framework.

## Commands

```
npm install
npm start            # launch the app via Electron (main.js -> server.js -> window)
npm run package       # build dist/Rundown-darwin-arm64/Rundown.app (darwin/arm64 only)
npm run release        # build + install the app into /Applications, replacing any running instance (see below)
```

There is no test suite, linter, or build step in this repo.

You can also run the server standalone (no Electron window) with
`node server.js`, which serves the UI at `http://127.0.0.1:8787` and stores
data in this directory (`./data.json`) instead of the per-user app-data
folder Electron uses.

### `npm run release` and the Node-version packaging bug

`electron-packager`'s zip-extraction step silently hangs and exits 0 with no
output/error on some newer Node builds (confirmed on Node 26.7.0 via
Homebrew) — it just produces no `dist/` output as if nothing ran. This
doesn't reproduce on Node 20.12.2. `scripts/release.sh` (run via
`npm run release`) works around this by trying multiple `node` binaries it
can find on the machine (`/usr/local/bin/node`, `/opt/homebrew/bin/node`,
whatever's on `PATH`) until one actually produces the `.app`, then installs
the result to `/Applications/Rundown.app` and relaunches it. If
`npm run package` appears to silently do nothing, this is almost certainly
why — try invoking `electron-packager` with a different `node` binary
directly instead of debugging the packager itself.

## Architecture

Three plain-JS layers, no build tooling:

- **`server.js`** — dependency-free Node `http` server. Binds to
  `127.0.0.1:8787` only. Serves the static UI files and exposes
  `GET /api/data` / `POST /api/data`, which read/write a single JSON file
  representing the whole app state (`{ lists: [...] }`). Writes go through a
  temp-file-then-rename for atomicity, and are JSON-validated before
  touching disk. There is no database — the JSON file *is* the database.
- **`main.js`** — Electron entry point. Sets `userData` explicitly to
  `~/Library/Application Support/tracker` (pinned independently of
  `app.setName('Rundown')`, since renaming the app would otherwise silently
  redirect Electron's default userData path and orphan existing data). Seeds
  `TRACKER_DATA_DIR` from a `data.json` next to the app bundle on first run
  if no user data file exists yet, then starts `server.js` in-process and
  opens a `BrowserWindow` pointed at `http://127.0.0.1:8787`. All link
  clicks are routed to the system browser via `setWindowOpenHandler`, never
  opened in-app.
- **`index.html` / `app.js` / `styles.css`** — the whole frontend, plain
  JavaScript with no framework or module bundler. `app.js` fetches
  `/api/data` on load, holds the full state in memory, mutates it in
  response to UI events, and calls `saveNow()`/`scheduleSave()` to
  `POST /api/data` back to the server (debounced for text edits, immediate
  for structural changes like add/delete/reorder). Rendering is a manual
  `render()` pass over the in-memory state — there's no virtual DOM or
  reactive framework, so UI updates are driven by re-rendering after each
  mutation.

Data model: a list of `lists`, each with its own `sort` (by
status/priority), and `items`. The rich-text details drawer content is
stored inline per item.

Packaged builds keep user data outside the (possibly read-only, asar-packed)
app bundle, in the OS per-user app-data directory — this is why `main.js`
sets `TRACKER_DATA_DIR` rather than letting `server.js` default to
`__dirname`. Don't assume `data.json` lives next to the source when running
from a packaged `.app`.

## Distribution

Currently built for Apple Silicon (`darwin/arm64`) only. Release builds are
unsigned (no paid Apple Developer account), so a zip downloaded from
GitHub Releases needs `xattr -cr` to clear the Gatekeeper quarantine flag on
first launch — see README.md for the exact steps. This quirk doesn't apply
to locally-built apps (via `npm run package` / `npm run release`), only to
ones downloaded through a browser.
