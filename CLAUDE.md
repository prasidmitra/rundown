# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Rundown: a local, personal daily task tracker. It's an Electron app — a
light-mode desktop window backed by a tiny Node HTTP server that
reads/writes a plain JSON file on disk. No account, no build step, no
framework. Core functionality has no external services; cloud sync (see
below) is optional and off by default.

## Commands

```
npm install
npm start            # launch the app via Electron (main.js -> server.js -> window)
npm run package       # build a standalone app for the current OS/arch (scripts/package.js dispatches by process.platform)
npm run generate-icon  # regenerate icon.ico from logo_icon_source.png (only needed if the logo changes)
npm run release        # build + install + relaunch the app with the latest code, for the current OS (see below)
```

There is no test suite, linter, or build step in this repo.

You can also run the server standalone (no Electron window) with
`node server.js`, which serves the UI at `http://127.0.0.1:8787` and stores
data in this directory (`./data.json`) instead of the per-user app-data
folder Electron uses.

### `npm run release`

`scripts/release.js` is a thin dispatcher: it picks the release workflow
for `process.platform` and hands off to it.

- **macOS** → `scripts/release.sh` (bash). Builds, installs to
  `/Applications/Rundown.app`, quitting/relaunching as needed.
- **Windows** → `scripts/release-win.js` (Node). Builds, installs to
  `%LOCALAPPDATA%\Rundown\Rundown.exe` (`taskkill /IM Rundown.exe /F` first
  if it's running), then relaunches it.
- Any other platform → prints an error and exits; run from source instead
  (`npm start`).

Both workflows leave user data untouched — it lives in the OS app-data
directory (see `main.js` below), not next to the installed binary, so
reinstalling/updating never loses data.

#### macOS Node-version packaging bug

`electron-packager`'s zip-extraction step silently hangs and exits 0 with no
output/error on some newer Node builds (confirmed on Node 26.7.0 via
Homebrew) — it just produces no `dist/` output as if nothing ran. This
doesn't reproduce on Node 20.12.2. `scripts/release.sh` works around this by
trying multiple `node` binaries it can find on the machine
(`/usr/local/bin/node`, `/opt/homebrew/bin/node`, whatever's on `PATH`)
until one actually produces the `.app`. If `npm run package` appears to
silently do nothing on macOS, this is almost certainly why — try invoking
`electron-packager` with a different `node` binary directly instead of
debugging the packager itself. This workaround is macOS-only; it hasn't
been observed or reproduced on Windows.

## Architecture

Three plain-JS layers, no build tooling:

- **`server.js`** — Node `http` server, no dependencies beyond Node itself
  (cloud sync's `mongodb` dependency lives entirely in `sync.js`). Binds to
  `127.0.0.1:8787` only. Serves the static UI files and exposes
  `GET /api/data` / `POST /api/data`, which read/write a single JSON file
  representing the whole app state (`{ lists: [...] }`). Writes go through a
  temp-file-then-rename for atomicity, and are JSON-validated before
  touching disk. The local JSON file is always the source of truth for
  rendering — there is no database in the traditional sense, even with
  cloud sync enabled (see below).
- **`sync.js`** — optional cloud sync via MongoDB. `POST /api/data` calls
  `sync.push()` after every successful local write — best-effort, fire and
  forget; failures are logged server-side and never block the local save
  or surface an error to the user. `POST /api/sync/pull` (the header Sync
  button) is the only way remote data flows back down. There's no realtime
  subscription or per-field conflict resolution, but both directions merge
  by list `id` rather than overwriting wholesale (see below) — this matters
  because a device only ever knows about its own local lists, and a naive
  overwrite would erase lists synced from *other* devices it's never
  pulled. Deleting a synced list locally does **not** delete it from the
  cloud (or from other devices on their next pull) — merge-by-id only adds
  and updates by id, there's no delete propagation. The Mongo connection
  string is entered once via the settings modal (`POST /api/sync/config`)
  and stored unencrypted in `<data dir>/sync-config.json` (gitignored,
  per-user, outside the repo — never commit this file). A single document
  (`_id: "singleton"`) in the `rundown_state` collection holds the synced
  subset of state (`{ lists: [...] }`); the database name comes from the
  URI's path (e.g. `.../rundown?...`), falling back to Mongo's default
  `test` db if omitted from the URI.
  - **Per-list opt-in**: sync is off by default for every list. Each list
    may carry `syncEnabled: true` (toggled via the cloud icon in the
    settings list rows; new lists are created with `syncEnabled: false`
    explicitly). `server.js` filters the payload down to only
    `syncEnabled` lists before calling `sync.push()` — lists without it
    (the default) never reach Mongo, and a list gets its first Mongo entry
    only on the next save after you turn its toggle on. On pull,
    `server.js` doesn't let `sync.pull()`'s result overwrite local data
    wholesale — it merges: local lists that aren't `syncEnabled` are kept
    as-is, and the remote's list set entirely replaces the `syncEnabled`
    ones (added/updated/removed to match remote — pulled lists arrive with
    `syncEnabled: true` already set, since that's what was pushed). This is
    why the pull merge lives in `server.js` rather than `sync.js` — it needs
    the current local state to know which lists to preserve, whereas
    `sync.js` only knows about the cloud.
- **`main.js`** — Electron entry point. Sets `userData` explicitly to
  `<OS app-data dir>/Rundown` via `app.getPath('appData')` (pinned
  independently of `app.setName('Rundown')`, since renaming the app would
  otherwise silently redirect Electron's default userData path and orphan
  existing data). This resolves per-OS automatically — `~/Library/Application
  Support/Rundown` on macOS, `%APPDATA%\Rundown` on Windows,
  `~/.config/Rundown` on Linux. The folder used to be named `tracker` (the
  app's old internal name); on first run, if the new folder has no
  `data.json` yet, `main.js` migrates it from the old `tracker` folder if
  present, so the rename doesn't orphan existing users' data. Seeds
  `RUNDOWN_DATA_DIR` from a `data.json` next to the app bundle on first run
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
sets `RUNDOWN_DATA_DIR` rather than letting `server.js` default to
`__dirname`. Don't assume `data.json` lives next to the source when running
from a packaged `.app`.

## Distribution

GitHub Releases currently only publishes Apple Silicon (`darwin/arm64`)
builds. Release builds are unsigned (no paid Apple Developer account), so a
zip downloaded from GitHub Releases needs `xattr -cr` to clear the
Gatekeeper quarantine flag on first launch — see README.md for the exact
steps. This quirk doesn't apply to locally-built apps (via `npm run package`
/ `npm run release`), only to ones downloaded through a browser.

The app itself has no macOS-specific code — `npm start`, `npm run package`,
and `npm run release` all work on Windows too (see the `npm run release`
section above for how the platform-specific install/relaunch step works).
`scripts/package.js` picks the right `electron-packager` platform/arch/icon
based on `process.platform`/`process.arch` it's run on (darwin → `.icns`,
win32 → `.ico`), so the same `npm run package` command works correctly on
both without the caller needing to specify anything.
`icon.ico` is generated from `logo_icon_source.png` via `npm run generate-icon`
(uses the `png-to-ico` devDependency) — regenerate it only if the source
logo changes.
