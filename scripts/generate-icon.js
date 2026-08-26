// Regenerates icon.ico (Windows) from logo_icon_source.png.
// Run manually if the source logo changes: node scripts/generate-icon.js
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

const src = path.join(__dirname, '..', 'logo_icon_source.png');
const dest = path.join(__dirname, '..', 'icon.ico');

pngToIco(src)
  .then(buf => {
    fs.writeFileSync(dest, buf);
    console.log('Wrote', dest);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
