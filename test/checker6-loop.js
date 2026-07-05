/* checker6-loop.js — bar test B: full loop at phone viewport with offline reopen. */
import { launch, PHONE } from './browser.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(outDir, { recursive: true });
let failures = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`); if (!ok) failures++; };
const scenario = s => fetch(`${BASE}/api/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: s }) });

const browser = await launch();
const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push('p1: ' + e.message); console.log('PAGE ERROR:', e.message); });

await scenario('high');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200); // let SW install
const empty = await page.locator('.empty-state').count();
check('B1 cold journal shows empty state', empty > 0);

// fixture photo
const tmpDir = fileURLToPath(new URL('./tmp/', import.meta.url));
const dataURL = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d');
  x.fillStyle = '#cfd8b0'; x.fillRect(0, 0, 640, 480);
  x.fillStyle = '#31435a';
  x.beginPath(); x.ellipse(300, 290, 60, 42, -0.15, 0, 7); x.fill();
  x.beginPath(); x.ellipse(352, 246, 26, 24, 0, 0, 7); x.fill();
  return c.toDataURL('image/jpeg', 0.92);
});
const jpgPath = tmpDir + 'bird6b.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));

await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
await page.setInputFiles('#file-input', jpgPath);
await page.waitForSelector('#go-id', { timeout: 5000 });
await page.fill('#f-place', 'Old orchard gate');
await page.fill('#f-notes', 'Perched low, tail flicking, then gone into the brambles.');
await page.screenshot({ path: outDir + 'checker6-b-review.png' });
await page.click('#go-id');
await page.waitForSelector('#confirm-top', { timeout: 9000 });
const species = await page.locator('.cel-species').first().textContent();
check('B2 identification proposes a species', !!species, species.trim());
await page.screenshot({ path: outDir + 'checker6-b-result.png' });
await page.click('#confirm-top');
await page.waitForSelector('.celebrate-overlay', { timeout: 6000 });
check('B3 celebration for new species', true);
await page.screenshot({ path: outDir + 'checker6-b-celebration.png' });
await page.click('#cel-ok');
await page.waitForTimeout(1000);
check('B4 landed on journal', (await page.evaluate(() => location.hash)) === '#/' || (await page.evaluate(() => location.hash)) === '');
const card = await page.locator('.entry-card').count();
const cardText = await page.locator('.entry-card').first().textContent();
check('B5 journal shows the confirmed entry', card === 1 && cardText.includes(species.trim()), cardText.replace(/\s+/g, ' ').slice(0, 120));
await page.screenshot({ path: outDir + 'checker6-b-journal.png' });
await page.waitForTimeout(800); // let SW finish caching

/* -------- offline reopen on a brand-new page -------- */
await ctx.setOffline(true);
const page2 = await ctx.newPage();
page2.on('pageerror', e => { pageErrors.push('p2: ' + e.message); console.log('PAGE2 ERROR:', e.message); });
let offlineLoaded = true;
try {
  await page2.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
} catch (e) { offlineLoaded = false; }
await page2.waitForTimeout(1200);
check('B6 offline reopen loads the app shell', offlineLoaded);
const offCards = await page2.locator('.entry-card').count();
check('B7 offline journal shows the entry', offCards === 1, `${offCards} cards`);
await page2.screenshot({ path: outDir + 'checker6-b-offline-journal.png' });
if (offCards) {
  await page2.locator('.entry-card').first().click();
  await page2.waitForTimeout(900);
  const photoOk = await page2.evaluate(() => {
    const img = document.querySelector('.photo-frame img');
    return img ? { src: img.src.slice(0, 20), loaded: img.naturalWidth > 0 } : null;
  });
  check('B8 offline entry photo intact', photoOk && photoOk.loaded, JSON.stringify(photoOk));
  const notes = await page2.evaluate(() => (document.querySelector('#edit-notes') || {}).value || '');
  check('B9 offline entry notes intact', notes.includes('tail flicking'), notes.slice(0, 80));
  const placeShown = await page2.locator('main, body').first().textContent();
  check('B10 offline entry shows place', placeShown.includes('Old orchard gate'));
  await page2.screenshot({ path: outDir + 'checker6-b-offline-entry.png', fullPage: true });
}
check('B11 no uncaught page errors in full loop', pageErrors.length === 0, pageErrors.join(' | '));

await ctx.setOffline(false);
await scenario('auto');
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
