import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '../public');

const svg = readFileSync(join(publicDir, 'favicon.svg'));

async function generateIcons() {
  // Generate 192x192
  await sharp(svg, { density: 300 })
    .resize(192, 192)
    .png()
    .toFile(join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // Generate 512x512
  await sharp(svg, { density: 600 })
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // Generate maskable icon with padding (for safe zone)
  await sharp(svg, { density: 600 })
    .resize(420, 420)
    .extend({
      top: 46,
      bottom: 46,
      left: 46,
      right: 46,
      background: '#1A368B'
    })
    .png()
    .toFile(join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');
}

generateIcons().catch(console.error);
