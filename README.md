# Rundown

A local, personal daily task tracker. It's a small Electron app — a light-mode
desktop window backed by a tiny local server that reads and writes a plain
JSON file on your own machine. No account, no cloud, no external services.

Features: multiple side-by-side lists, sortable by status/priority, a rich-text
details drawer (bold/italic/underline, bulleted/numbered lists, links that open
in your default browser), and settings for reordering, hiding, or deleting lists.

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

Your data lives at `~/Library/Application Support/tracker/data.json` — a
plain JSON file you can open, edit, or back up directly. It's created
automatically on first launch and is untouched by future app updates.

Currently built for **Apple Silicon (M-series) Macs** only.

## Run from source (for development)

Requires [Node.js](https://nodejs.org).

```
git clone https://github.com/prasidmitra/rundown.git
cd rundown
npm install
npm start          # launches the app directly via Electron
```

To build your own standalone `.app` (matches what's in Releases):

```
npm run package     # outputs dist/Rundown-darwin-arm64/Rundown.app
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
