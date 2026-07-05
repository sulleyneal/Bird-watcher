/* shots.js — screenshot every screen at phone + tablet sizes.
   Usage: node test/shots.js [baseURL]   (default http://localhost:8787) */
import { launch, PHONE, TABLET } from './browser.js';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(outDir, { recursive: true });

const browser = await launch();

async function shoot(ctxOpts, label) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`[${label}] PAGE ERROR:`, e.message));
  page.on('console', m => { if (m.type() === 'error') console.log(`[${label}] console.error:`, m.text().slice(0, 300)); });

  // seed demo data first
  await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  const shots = [
    ['journal', '#/'],
    ['lifelist', '#/life'],
    ['map', '#/map'],
    ['almanac', '#/almanac'],
    ['spot', '#/spot'],
  ];
  for (const [name, hash] of shots) {
    await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}${label}-${name}.png`, fullPage: name !== 'spot' });
    console.log(`shot ${label}-${name}`);
  }

  // entry page: click first journal card
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const first = page.locator('.entry-card').first();
  if (await first.count()) {
    await first.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}${label}-entry.png`, fullPage: true });
    console.log(`shot ${label}-entry`);
  }
  await ctx.close();
}

await shoot(PHONE, 'phone');
await shoot(TABLET, 'tablet');
await browser.close();
console.log('done →', outDir);
