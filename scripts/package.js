#!/usr/bin/env node
// Packages the app for whichever OS/arch this script is run on, or for an
// explicit target via --platform=/--arch= (e.g. to cross-build a Windows
// .exe from WSL, where process.platform reports 'linux').
// Usage: npm run package [-- --platform=win32 --arch=x64]
const { spawnSync } = require('child_process');
const path = require('path');

const ICONS = {
  darwin: 'icon.icns',
  win32: 'icon.ico'
};

function argValue(flag) {
  const arg = process.argv.find(a => a.startsWith(`--${flag}=`));
  return arg ? arg.split('=')[1] : undefined;
}

const platform = argValue('platform') || process.platform;
const arch = argValue('arch') || process.arch;
const icon = ICONS[platform];

if (!icon) {
  console.error(`No packaging config for platform "${platform}". Supported: ${Object.keys(ICONS).join(', ')}.`);
  console.error('You can still run the app from source with `npm start`.');
  process.exit(1);
}

// The electron-packager CLI wrapper's extension depends on the *host* OS
// (whichever platform `npm install` ran on), not the packaging target —
// electron-packager can cross-build for other platforms without needing to
// run on them.
const electronPackagerBin = process.platform === 'win32' ? 'electron-packager.cmd' : 'electron-packager';
const electronPackager = path.join(__dirname, '..', 'node_modules', '.bin', electronPackagerBin);

const args = [
  '.', 'Rundown',
  `--platform=${platform}`,
  `--arch=${arch}`,
  '--out=dist',
  '--overwrite',
  `--icon=${icon}`
];

console.log(`==> Packaging for ${platform}/${arch}`);
const result = spawnSync(electronPackager, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
