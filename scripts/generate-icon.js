// Regenerates icon.ico (Windows) from logo_icon_source.png.
// Run manually if the source logo changes: node scripts/generate-icon.js
//
// Bakes in the full set of sizes Windows actually requests for taskbar/
// shell icons across its common display-scaling factors (100%-250%+) —
// SM_CXSMICON scales with system DPI, and if the exact requested size
// isn't present in the .ico, Windows picks the nearest one and scales it
// itself, which looks shrunken/blurry next to icons that do ship the
// right size. png-to-ico with just one source image only bakes in a
// handful of default sizes (16/32/48/256), which isn't enough coverage.
//
// logo_icon_source.png has ~7% transparent margin baked in on every side
// (measured: visible content is 879x879 within the 1024x1024 canvas) -
// intentional for macOS's dock, which expects that kind of inset. Windows
// taskbar icons (WhatsApp, Notepad, etc.) are typically near edge-to-edge,
// so the same art at the same pixel size reads as visibly smaller next to
// them. This only matters for the Windows .ico - trim() + resize here,
// rather than editing the master PNG, which is also used for the macOS
// dock icon and the in-app header logo where the built-in inset is fine.
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const CANVAS = 1024;
const PADDING_PCT = 0.02; // small breathing room so edges don't clip at small sizes

const src = path.join(__dirname, '..', 'logo_icon_source.png');
const dest = path.join(__dirname, '..', 'icon.ico');

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rundown-icon-'));
  try {
    const padding = Math.round(CANVAS * PADDING_PCT);
    const targetContentSize = CANVAS - padding * 2;

    const windowsSource = path.join(tmpDir, 'windows-source.png');
    await sharp(src)
      .trim()
      .resize(targetContentSize, targetContentSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(windowsSource);

    const files = await Promise.all(SIZES.map(async size => {
      const file = path.join(tmpDir, `${size}.png`);
      await sharp(windowsSource).resize(size, size).png().toFile(file);
      return file;
    }));
    const buf = await pngToIco(files);
    fs.writeFileSync(dest, buf);
    console.log('Wrote', dest, `(sizes: ${SIZES.join(', ')}, content fill: ${Math.round((1 - PADDING_PCT * 2) * 100)}%)`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
