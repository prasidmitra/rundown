# Rundown sync relay (AWS Lambda)

A tiny HTTPS relay in front of MongoDB, used by `sync.js` in the main app.
Exists because MongoDB's native driver needs non-standard TCP ports that
some corporate/VPN networks block, even though plain HTTPS (443) works
fine. This relay is the only thing that speaks MongoDB's native protocol;
Rundown clients only ever do plain `fetch()` HTTPS calls to it.

Mirrors the same storage model as the old direct-Mongo `sync.js`: each
synced list is its own document (`_id: list.id`) in the `rundown_lists`
collection, so MongoDB's 16MB single-document limit applies per list, not
to your whole account.

## Deployed resources

- Lambda function: `rundown-sync-relay` (region: `us-east-1`)
- Execution role: `rundown-sync-relay-role` (basic execution policy only —
  CloudWatch Logs, nothing else; it doesn't need any other AWS permissions
  since it only talks to MongoDB over the network)
- Function URL with `AuthType: NONE` — auth is handled in application code
  via the `x-api-key` header instead of AWS IAM, so plain `fetch()` calls
  work without request signing
- Environment variables (set directly on the function, not in this repo):
  `MONGO_URI` (the real MongoDB connection string) and `API_KEY` (a random
  shared secret; Rundown clients send it as `x-api-key` on every request)

## Redeploying after a code change

```
cd lambda-relay
npm install
python3 -c "
import zipfile, os
def add_dir(zf, path):
    for root, dirs, files in os.walk(path):
        for f in files:
            full = os.path.join(root, f)
            zf.write(full, os.path.relpath(full, '.'))
with zipfile.ZipFile('function.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.write('index.js', 'index.js')
    zf.write('package.json', 'package.json')
    add_dir(zf, 'node_modules')
"
aws lambda update-function-code \
  --function-name rundown-sync-relay \
  --zip-file fileb://function.zip
```

## Rotating the API key

```
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
aws lambda update-function-configuration \
  --function-name rundown-sync-relay \
  --environment "{\"Variables\":{\"MONGO_URI\":\"<existing mongo uri>\",\"API_KEY\":\"$NEW_KEY\"}}"
```

Then update the API key in Settings → Cloud sync on every device.

## API

`POST <function url>` with header `x-api-key: <key>` and JSON body:

- `{"action": "push", "lists": [...]}` — upserts each list by id
- `{"action": "pull"}` — returns `{"lists": [...]}`, all synced lists

Unauthenticated or malformed requests get `401`/`400`; the function itself
never proxies MongoDB errors verbatim to unauthenticated callers.
