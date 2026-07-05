/* gen-icons.js — rasterize icons/icon.svg into the PNG sizes the PWA
   manifest needs, using the bundled Chromium. */
import { launch } from './browser.js';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = await readFile(root + 'icons/icon.svg', 'utf8');

const browser = await launch();
const jobs = [
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 64 }, // safe-zone padding
];

for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size } });
  const inner = job.pad
    ? svg.replace('<svg xmlns', `<svg style="position:absolute;left:${job.pad}px;top:${job.pad}px;width:${job.size - job.pad * 2}px;height:${job.size - job.pad * 2}px" xmlns`)
    : svg.replace('<svg xmlns', `<svg style="position:absolute;inset:0;width:${job.size}px;height:${job.size}px" xmlns`);
  await page.setContent(`<body style="margin:0;background:#f5efdd;width:${job.size}px;height:${job.size}px;position:relative">${inner}</body>`);
  await page.waitForTimeout(250);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: job.size, height: job.size } });
  await writeFile(root + 'icons/' + job.file, buf);
  console.log('wrote icons/' + job.file);
  await page.close();
}
await browser.close();
