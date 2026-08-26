// Builds Rundown.exe and installs it to %LOCALAPPDATA%\Rundown, replacing
// any running instance. Run via `npm run release` (dispatched from
// scripts/release.js when process.platform is win32).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_NAME = 'Rundown';
const DIST_DIR = path.join(ROOT, 'dist', `${APP_NAME}-win32-x64`);
const INSTALL_ROOT = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const INSTALL_DIR = path.join(INSTALL_ROOT, APP_NAME);
const EXE = path.join(INSTALL_DIR, `${APP_NAME}.exe`);

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true, ...opts });
  if (result.status !== 0 && !opts.allowFailure) {
    console.error(`ERROR: "${cmd} ${args.join(' ')}" failed.`);
    process.exit(result.status || 1);
  }
  return result;
}

console.log('==> Installing dependencies');
run('npm', ['install']);

console.log('==> Building');
fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
run('node', ['scripts/package.js']);

if (!fs.existsSync(DIST_DIR)) {
  console.error(`ERROR: expected build output at ${DIST_DIR}, but it doesn't exist.`);
  process.exit(1);
}

console.log(`==> Stopping any running ${APP_NAME}`);
run('taskkill', ['/IM', `${APP_NAME}.exe`, '/F'], { allowFailure: true });
// Give Windows a moment to release the file lock on the old .exe before we overwrite it.
run('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 1000'], { allowFailure: true });

console.log(`==> Installing to ${INSTALL_DIR}`);
fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
fs.cpSync(DIST_DIR, INSTALL_DIR, { recursive: true });

console.log(`==> Launching ${APP_NAME}`);
spawnSync('cmd', ['/c', 'start', '""', EXE], { cwd: ROOT, stdio: 'ignore', shell: true, detached: true });

console.log('==> Done.');
