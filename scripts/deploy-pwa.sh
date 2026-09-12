#!/usr/bin/env bash
# Deploy the Rundown PWA to GitHub Pages by pushing the static app shell to
# the gh-pages branch. Only the browser-relevant files are shipped (no
# Electron/server/lambda sources). Run `npm run generate-pwa-icons` first if
# the logo changed. Requires `gh`/`git` auth to the repo.
set -euo pipefail
cd "$(dirname "$0")/.."

# The complete PWA app shell. Everything else in the repo is desktop/server
# code that must not ship to the phone.
DIST=(
  index.html
  app.js
  styles.css
  logo.png
  manifest.json
  service-worker.js
)

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

for f in "${DIST[@]}"; do
  mkdir -p "$STAGING/$(dirname "$f")"
  cp "$f" "$STAGING/$f"
done
cp -r icons "$STAGING/icons"

git -C "$STAGING" init -q
git -C "$STAGING" add -A
git -C "$STAGING" \
  -c user.name="Rundown" \
  -c user.email="rundown@localhost" \
  commit -q -m "Deploy Rundown PWA $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git -C "$STAGING" branch -M gh-pages
git -C "$STAGING" push -f origin gh-pages

echo "Pushed gh-pages."
echo "If Pages isn't enabled yet, run once:"
echo "  gh api repos/{owner}/{repo}/pages -X POST -f build_type=legacy -f source[branch]=gh-pages -f source[path]=/"
