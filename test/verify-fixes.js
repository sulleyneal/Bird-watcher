/* verify-fixes.js — targeted screenshots of the states the design checker
   flagged, to confirm the fixes on real pixels. */
import { launch, PHONE, TABLET } from './browser.js';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(outDir, { recursive: true });
const browser = await launch();

async function run(ctxOpts, label) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

  await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 1. spot screen with live (fake) camera — clipping + tablet layout
  await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}fix-${label}-spot.png` });

  // 2. manual naming with typed text — native search X must be gone
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // open an entry, use "not this one" path is long; use spot manual via queued entry instead:
  // simpler: type into the almanac? Manual field only exists in spot flow. Emulate via entry of a queued state:
  // Use seed=states for a needs_confirm entry
  await page.goto(`${BASE}/?seed=states#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const pending = page.locator('.entry-card:has-text("Who was this?")').first();
  if (await pending.count()) {
    await pending.click();
    await page.waitForTimeout(800);
    await page.click('#manual');
    await page.waitForTimeout(400);
    await page.fill('#f-species', 'Card');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}fix-${label}-manual.png` });
  }

  // 3. scrolled journal under nav — no bleed-through
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}fix-${label}-scrolled.png` });

  // 4. focus ring on a card (keyboard)
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}fix-${label}-focus.png` });

  // 5. delete dialog then navigate away — overlay must not survive
  const card = page.locator('.entry-card:not(:has-text("Who was this?")):not(:has-text("Awaiting"))').first();
  await card.click();
  await page.waitForTimeout(800);
  await page.locator('#delete').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = '#/life'; });
  await page.waitForTimeout(800);
  const orphan = await page.locator('.celebrate-overlay').count();
  console.log(`${label}: orphaned overlay after nav = ${orphan} (want 0)`);
  await page.screenshot({ path: `${outDir}fix-${label}-afternav.png` });

  await ctx.close();
}

await run(PHONE, 'phone');
await run(TABLET, 'tablet');
await browser.close();
console.log('done');
