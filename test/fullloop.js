/* fullloop.js — the "bar" test #2 and #4, scripted:
   cold load at phone size → upload a bird photo → identify → confirm →
   celebration → collection → full offline reopen with entry intact.
   Plus wrong-bird and blurry-photo handling via mock scenarios.
   Usage: node test/fullloop.js [baseURL]                     */

import { launch, PHONE } from './browser.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(outDir, { recursive: true });

let failures = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}

const browser = await launch();
const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
page.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });

// make a "bird photo" file to upload
const tmpDir = fileURLToPath(new URL('./tmp/', import.meta.url));
await mkdir(tmpDir, { recursive: true });
const dataURL = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, '#cfe0e8'); g.addColorStop(1, '#a8c3d1');
  x.fillStyle = g; x.fillRect(0, 0, 640, 480);
  x.strokeStyle = '#4a3a28'; x.lineWidth = 9; x.beginPath(); x.moveTo(0, 360); x.quadraticCurveTo(320, 320, 640, 350); x.stroke();
  x.fillStyle = '#b8402e';
  x.beginPath(); x.ellipse(320, 300, 52, 38, -0.1, 0, 7); x.fill();
  x.beginPath(); x.ellipse(365, 262, 24, 22, 0, 0, 7); x.fill();
  x.beginPath(); x.moveTo(268, 300); x.lineTo(210, 330); x.lineTo(222, 348); x.lineTo(276, 318); x.fill();
  return c.toDataURL('image/jpeg', 0.9);
});
const jpgPath = tmpDir + 'bird.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));

/* reset state + mock scenario */
await fetch(`${BASE}/api/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: 'high' }) });
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

/* ---- cold load: empty journal ---- */
check('cold load shows empty-state journal', await page.locator('.empty-state').count() > 0);

/* ---- capture via upload ---- */
await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
await page.setInputFiles('#file-input', jpgPath);
await page.waitForTimeout(700);
check('review step shows the photo', await page.locator('.photo-frame img').count() > 0);
await page.fill('#f-notes', 'Bright red, singing from the maple.');
await page.fill('#f-place', 'Test Meadow');
await page.click('#go-id');
await page.waitForTimeout(2500);

/* ---- result + confirm ---- */
check('identification result appears', await page.locator('#confirm-top').count() > 0);
const speciesName = (await page.locator('.cel-species').first().textContent() || '').trim();
check('a species is proposed', speciesName.length > 3, speciesName);
await page.screenshot({ path: outDir + 'loop-result.png' });
await page.click('#confirm-top');
await page.waitForTimeout(900);
check('celebration appears for new species', await page.locator('.celebrate-overlay').count() > 0);
await page.screenshot({ path: outDir + 'loop-celebration.png' });
await page.click('#cel-ok');
await page.waitForTimeout(900);

/* ---- lands in collection ---- */
await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
const cardText = await page.locator('.entry-card').first().textContent();
check('entry is in the journal', (cardText || '').includes(speciesName), speciesName);
check('entry keeps my notes', (cardText || '').includes('Bright red'));

/* ---- offline reopen ---- */
await page.waitForTimeout(1500); // let SW finish precaching
await ctx.setOffline(true);
const page2 = await ctx.newPage();
await page2.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page2.waitForTimeout(1200);
const offlineText = await page2.locator('.entry-card').first().textContent().catch(() => '');
check('offline reopen shows the journal', (offlineText || '').includes(speciesName));
const photoVisible = await page2.locator('.entry-card img.entry-photo').first().isVisible().catch(() => false);
check('offline entry still has its photo', photoVisible);
await page2.locator('.entry-card').first().click();
await page2.waitForTimeout(900);
check('offline entry page opens with notes', ((await page2.locator('#edit-notes').inputValue().catch(() => '')) || '').includes('Bright red'));
await page2.screenshot({ path: outDir + 'loop-offline-entry.png', fullPage: true });

/* ---- offline capture queues ---- */
await page2.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page2.waitForTimeout(700);
await page2.setInputFiles('#file-input', jpgPath);
await page2.waitForTimeout(700);
await page2.click('#go-id');
await page2.waitForTimeout(900);
await page2.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page2.waitForTimeout(700);
const queuedNote = await page2.locator('.pending-note').count();
check('offline capture is queued with a visible note', queuedNote > 0);
await page2.close();
await ctx.setOffline(false);

/* ---- wrong-bird test: not a bird ---- */
await fetch(`${BASE}/api/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: 'not_bird' }) });
await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
await page.setInputFiles('#file-input', jpgPath);
await page.waitForTimeout(700);
await page.click('#go-id');
await page.waitForTimeout(2200);
const nbText = await page.locator('#spot-stage').textContent();
check('non-bird photo handled gracefully', (nbText || '').includes('no bird'), (nbText || '').slice(0, 80).trim());
await page.screenshot({ path: outDir + 'loop-notbird.png' });
const before = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal'); rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').count();
    t.onsuccess = () => res(t.result);
  };
}));
await page.click('#nb-discard');
await page.waitForTimeout(800);

/* ---- wrong-bird test: blurry/unclear ---- */
await fetch(`${BASE}/api/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: 'unclear' }) });
await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
await page.setInputFiles('#file-input', jpgPath);
await page.waitForTimeout(700);
await page.click('#go-id');
await page.waitForTimeout(2200);
const ucText = await page.locator('#spot-stage').textContent();
check('blurry photo shows low-confidence choices, never a silent guess',
  /best guess|squint|Or was it/i.test(ucText || ''), (ucText || '').slice(0, 60).trim());
await page.screenshot({ path: outDir + 'loop-unclear.png' });

/* ---- low-confidence override ---- */
const altCount = await page.locator('.cand').count();
check('alternative candidates offered on low confidence', altCount > 0, `${altCount} alternatives`);
const manual = await page.locator('#manual').count();
check('manual override path exists', manual > 0);

await fetch(`${BASE}/api/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: 'auto' }) });
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
