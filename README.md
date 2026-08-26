# Rundown

A local, personal daily task tracker. It's a small Electron app — a light-mode
desktop window backed by a tiny local server that reads and writes a plain
JSON file on your own machine. No account, no external services required.

Features: multiple side-by-side lists, sortable by status/priority, a rich-text
details drawer (bold/italic/underline, bulleted/numbered lists, links that open
in your default browser), settings for reordering, hiding, or deleting lists,
and optional cloud sync (bring your own MongoDB) to carry your lists between
machines.

### Cloud sync (optional)

Rundown works fully offline by default — nothing leaves your machine unless
you turn this on. To sync lists between two computers (e.g. a Mac and a
Windows laptop):

1. Create a free MongoDB Atlas cluster ([mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas))
   and get its connection string (`mongodb+srv://user:pass@cluster.mongodb.net/rundown`
   — include a database name in the path, e.g. `rundown`).
2. Open Settings (gear icon) → Cloud sync → paste the connection string → Save.
3. Lists are **local-only by default** — turning on the connection string
   alone doesn't sync anything. In Settings, click the cloud icon next to
   each list you want synced. The first time you turn it on for a list,
   that list is created in MongoDB on the next save; until then, it has no
   entry there at all.
4. From then on, every local edit to a synced list pushes to MongoDB
   automatically in the background. Local-only lists never leave the
   machine.
5. On another machine (also configured with the same connection string),
   click the **Sync** button (circular-arrows icon) in the header to pull
   the latest synced lists down. Lists you've never seen before on that
   machine are added; lists that already exist there (matched by an
   internal id, not by name) are replaced with the cloud's version.
   Local-only lists on that machine are untouched.

There's no realtime sync — it's push-on-save (for synced lists only),
pull-on-click. Both directions merge by list, so pushing from a second
device won't erase lists synced from your first device, even before you've
pulled anything down. One limitation: deleting a synced list only deletes
it locally — it stays in the cloud (and reappears if you pull again), so
delete it on every synced device if you want it fully gone. The connection
string is stored unencrypted in a local config file next to your data,
never committed to source control.

**Storage capacity:** each synced list is stored as its own document in
MongoDB, so MongoDB's 16MB single-document limit applies per list, not to
everything combined. That means total storage scales toward the real free
tier cap (512MB on Atlas M0) as you sync more lists, rather than being
capped at 16MB no matter how much you have. For reference: a typical
lightweight item (short title, no notes) is well under a few hundred
bytes, so a single list can hold tens of thousands of items before
approaching its own 16MB ceiling — items with substantial rich-text notes
in the details drawer take up more room, so the practical number is lower
the more text-heavy your items are.

## Install (just want to use the app)

1. Grab the latest build from [Releases](../../releases) — download
   `Rundown-macOS-arm64.zip`.
2. Unzip it.
3. **First launch only:** this app isn't code-signed (that requires a paid
   Apple Developer account), so macOS will refuse to open it and claim it's
   "damaged" — it isn't; that's just Gatekeeper blocking unsigned apps
   downloaded from a browser, and this particular error doesn't offer a
   right-click-to-open workaround. Clear the download flag first:
   ```
   xattr -cr ~/Downloads/Rundown.app
   ```
   (adjust the path if you unzipped somewhere else). Then drag `Rundown.app`
   to your `Applications` folder and open it — from then on it opens normally
   with a plain double-click.

Your data lives at `~/Library/Application Support/Rundown/data.json` — a
plain JSON file you can open, edit, or back up directly. It's created
automatically on first launch and is untouched by future app updates.

Currently built for **Apple Silicon (M-series) Macs** only via the
Releases page, but it runs from source on Windows and Linux too (see below).

## Run from source (for development)

Requires [Node.js](https://nodejs.org).

```
git clone https://github.com/prasidmitra/rundown.git
cd rundown
npm install
npm start          # launches the app directly via Electron
```

This works the same way on macOS, Windows, and Linux — nothing in the app
is platform-specific.

To build your own standalone app, matching your current OS/arch
(`dist/Rundown-darwin-arm64/Rundown.app` on macOS, `dist/Rundown-win32-x64/Rundown.exe`
on Windows):

```
npm run package
```

On Windows, your data lives at `%APPDATA%\Rundown\data.json` (the Windows
equivalent of the macOS path above).

### Updating the installed app after a `git pull`

```
npm run release
```

This builds the app and installs the new build over the old one, quitting
the running app first if needed, then relaunches it. It's the one-command
workflow for "pull latest, get the latest app running" on any machine.
`scripts/release.js` picks the right workflow for the current OS:

- **macOS** (`scripts/release.sh`) — replaces `/Applications/Rundown.app`.
- **Windows** (`scripts/release-win.js`) — replaces
  `%LOCALAPPDATA%\Rundown\Rundown.exe`.

Your data isn't touched by this — it lives in the OS per-user app-data
folder (see above), separate from wherever the app binary is installed, so
reinstalling never loses your lists.

On macOS, it also works around a packaging quirk: `electron-packager`'s
zip-extraction step silently hangs (exits 0, produces nothing) on some
newer Node builds (seen on Node 26.7.0). `npm run release` tries other
`node` binaries it can find (e.g. `/usr/local/bin/node`,
`/opt/homebrew/bin/node`) until one actually produces the app, so it should
work regardless of which Node version is your machine's default. If you hit
this with plain `npm run package`, run it with a different `node` binary
directly, e.g.:
```
/usr/local/bin/node ./node_modules/.bin/electron-packager . Rundown --platform=darwin --arch=arm64 --out=dist --overwrite --icon=icon.icns
```

## How it works

- `server.js` — a dependency-free Node HTTP server that serves the UI and
  reads/writes the data file. No database; the whole app is small enough that
  a JSON file is simpler and easier to inspect/back up.
- `main.js` — the Electron entry point. Starts the server in-process, opens a
  window pointed at it, and routes any link clicks to your system browser.
- `index.html` / `app.js` / `styles.css` — the UI, plain JavaScript with no
  build step or framework.

## License

Personal project, no license specified — all rights reserved by the author.
