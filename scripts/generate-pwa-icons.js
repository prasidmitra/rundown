// Generates the PWA icon set from logo_icon_source.png into icons/.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = path.join(__dirname, '..', 'logo_icon_source.png');
const outDir = path.join(__dirname, '..', 'icons');
const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-180.png', size: 180 } // apple-touch-icon
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const { name, size } of targets) {
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outDir, name));
    console.log(`wrote icons/${name}`);
  }
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
