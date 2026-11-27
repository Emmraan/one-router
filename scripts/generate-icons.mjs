import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const source = await readFile('packages/ui/assets/brand/mark.svg');
const output = 'packages/ui/assets/brand/generated';
await mkdir(output, { recursive: true });
const files = new Map();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const mark = await sharp(source).resize(Math.round(size * 0.76)).png().toBuffer();
  const image = await sharp({ create: { width: size, height: size, channels: 4, background: '#fafafa' } }).composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
  files.set(name, image);
}
const png = await sharp(source).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 32; header[7] = 32;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
files.set('favicon.ico', Buffer.concat([header, png]));
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#1f1f1f"/><g transform="translate(70 65) scale(1.4)">${source.toString().replace(/<svg[^>]*>|<\/svg>/g, '').replaceAll('#075caa', '#8fc8ff')}</g><g font-family="Segoe UI, sans-serif" fill="#f2f2f2"><text x="190" y="126" font-size="28" font-weight="600" letter-spacing="3">ONE ROUTER</text><text x="80" y="330" font-size="76" font-weight="600">Your models.</text><text x="80" y="425" font-size="76" font-weight="600">One workspace.</text><text x="84" y="535" font-size="24" fill="#adadad">Self-hosted. Single owner.</text></g></svg>`;
files.set('og.png', await sharp(Buffer.from(og)).png().toBuffer());
for (const directory of [output, 'apps/web/public', 'apps/site/public']) {
  await mkdir(directory, { recursive: true });
  for (const [name, content] of files) await writeFile(`${directory}/${name}`, content);
  await writeFile(`${directory}/icon.svg`, source);
}
console.log(`Generated ${files.size + 1} brand assets in the shared package and both apps.`);
