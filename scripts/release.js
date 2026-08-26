// Dispatches `npm run release` to the right platform-specific workflow:
// build the app, install it, and relaunch it with the latest code.
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

if (process.platform === 'darwin') {
  const result = spawnSync('bash', [path.join(__dirname, 'release.sh')], { cwd: ROOT, stdio: 'inherit' });
  process.exit(result.status ?? 1);
} else if (process.platform === 'win32') {
  require('./release-win.js');
} else {
  console.error(`No release workflow for platform "${process.platform}".`);
  console.error('Run the app from source instead: npm start');
  process.exit(1);
}
