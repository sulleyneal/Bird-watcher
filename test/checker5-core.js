/* checker5-core.js — cycle-2 adversarial re-check of fixes 1,2,3,8:
   double-tap confirm, double-tap identify, not_bird orphan purge,
   celebration Escape. Usage: node test/checker5-core.js */

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
const scenario = s => fetch(`${BASE}/api/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: s }) });

const browser = await launch();
const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGE ERROR:', e.message); });

// bird photo fixture
const tmpDir = fileURLToPath(new URL('./tmp/', import.meta.url));
await mkdir(tmpDir, { recursive: true });
const dataURL = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d');
  x.fillStyle = '#b9d0da'; x.fillRect(0, 0, 640, 480);
  x.fillStyle = '#a03b2c';
  x.beginPath(); x.ellipse(320, 300, 52, 38, -0.1, 0, 7); x.fill();
  x.beginPath(); x.ellipse(365, 262, 24, 22, 0, 0, 7); x.fill();
  return c.toDataURL('image/jpeg', 0.9);
});
const jpgPath = tmpDir + 'bird5.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));

const dbDump = () => page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const db = rq.result;
    const t = db.transaction(['sightings', 'species']);
    const a = t.objectStore('sightings').getAll();
    const b = t.objectStore('species').getAll();
    t.oncomplete = () => res({
      sightings: a.result.map(s => ({ id: s.id, idStatus: s.idStatus, speciesKey: s.speciesKey || null })),
      species: b.result.map(s => ({ key: s.key, count: s.count })),
    });
  };
}));

async function uploadAndIdentify(clicks = 1) {
  await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.setInputFiles('#file-input', jpgPath);
  await page.waitForSelector('#go-id', { timeout: 5000 });
  await page.waitForTimeout(200);
  if (clicks === 1) await page.click('#go-id');
  else await page.evaluate(n => {
    const b = document.querySelector('#go-id');
    for (let i = 0; i < n; i++) b.click();
  }, clicks);
}

/* =============== FIX 2: double-tap "Identify this bird" =============== */
await scenario('high');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await uploadAndIdentify(3); // triple synchronous click
await page.waitForSelector('#confirm-top', { timeout: 8000 }).catch(() => {});
let dump = await dbDump();
check('[fix2] triple-click go-id files exactly 1 sighting', dump.sightings.length === 1, JSON.stringify(dump.sightings));
await page.screenshot({ path: outDir + 'checker5-fix2-dblclick-goid.png' });

/* also: two real dispatched clicks in quick succession */
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.setInputFiles('#file-input', jpgPath);
await page.waitForSelector('#go-id');
await page.click('#go-id', { clickCount: 2, delay: 40 }).catch(() => {});
await page.waitForSelector('#confirm-top', { timeout: 8000 }).catch(() => {});
dump = await dbDump();
check('[fix2] real double-click go-id files exactly 1 sighting', dump.sightings.length === 1, JSON.stringify(dump.sightings));

/* =============== FIX 1: double-tap "Yes — that's the bird" =============== */
// continue from the result screen we're on now
const hasConfirm = await page.locator('#confirm-top').count();
check('[fix1] result card is showing', hasConfirm > 0);
await page.evaluate(() => {
  const b = document.querySelector('#confirm-top');
  b.click(); b.click(); b.click(); // 3 rapid taps before UI can update
});
await page.waitForTimeout(1200);
// celebration for new species should appear once
const overlays = await page.locator('.celebrate-overlay').count();
check('[fix1] exactly one celebration overlay after triple-tap', overlays === 1, `${overlays} overlays`);
await page.screenshot({ path: outDir + 'checker5-fix1-dbltap-confirm.png' });
if (overlays) { await page.click('#cel-ok'); await page.waitForTimeout(800); }
dump = await dbDump();
const confirmed = dump.sightings.filter(s => s.idStatus === 'confirmed');
check('[fix1] one confirmed sighting after triple-tap confirm', confirmed.length === 1, JSON.stringify(dump.sightings));
check('[fix1] species.count === 1 in IndexedDB', dump.species.length === 1 && dump.species[0].count === 1, JSON.stringify(dump.species));
// life list shows ×1
await page.goto(`${BASE}/#/life`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
const lifeText = await page.locator('main').textContent();
check('[fix1] life list shows ×1 (no ×2/×3)', /×\s*1\b/.test(lifeText || '') && !/×\s*[23]/.test(lifeText || ''), (lifeText || '').replace(/\s+/g, ' ').slice(0, 200));
await page.screenshot({ path: outDir + 'checker5-fix1-lifelist.png' });

/* fix1 variant: confirm-top + alternative candidate raced together */
await scenario('low');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await uploadAndIdentify(1);
await page.waitForSelector('#confirm-top', { timeout: 8000 });
const candCount = await page.locator('.cand').count();
if (candCount > 0) {
  await page.evaluate(() => {
    document.querySelector('#confirm-top').click();
    const c = document.querySelector('.cand'); if (c) c.click();
  });
  await page.waitForTimeout(1200);
  const ov2 = await page.locator('.celebrate-overlay').count();
  if (ov2) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
  dump = await dbDump();
  const conf2 = dump.sightings.filter(s => s.idStatus === 'confirmed');
  const totalCount = dump.species.reduce((a, s) => a + s.count, 0);
  check('[fix1] confirm-top + candidate race: 1 confirmed sighting, total species count 1',
    conf2.length === 1 && totalCount === 1 && dump.species.length === 1,
    JSON.stringify({ sightings: dump.sightings, species: dump.species }));
} else {
  check('[fix1] (variant) low scenario offered candidates', false, 'no .cand rows to race');
}

/* =============== FIX 3: not_bird orphan purged on reload =============== */
await scenario('not_bird');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await uploadAndIdentify(1);
await page.waitForSelector('#nb-retry', { timeout: 8000 });
await page.screenshot({ path: outDir + 'checker5-fix3-notbird.png' });
// navigate away WITHOUT choosing retry/discard
await page.evaluate(() => { location.hash = '#/life'; });
await page.waitForTimeout(600);
dump = await dbDump();
const orphansBefore = dump.sightings.filter(s => s.idStatus === 'not_bird').length;
console.log(`  (info) not_bird rows before reload: ${orphansBefore}`);
// journal must not show a ghost card before reload either
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForTimeout(600);
const ghostCards = await page.locator('.entry-card').count();
check('[fix3] no ghost entry-card in journal before reload', ghostCards === 0, `${ghostCards} cards`);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
dump = await dbDump();
const orphansAfter = dump.sightings.filter(s => s.idStatus === 'not_bird').length;
check('[fix3] not_bird orphan purged from IndexedDB after reload', orphansAfter === 0, JSON.stringify(dump.sightings));
check('[fix3] no sightings at all remain after orphan purge', dump.sightings.length === 0, JSON.stringify(dump.sightings));
await page.screenshot({ path: outDir + 'checker5-fix3-after-reload.png' });

/* =============== FIX 8: celebration Escape =============== */
await scenario('high');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await uploadAndIdentify(1);
await page.waitForSelector('#confirm-top', { timeout: 8000 });
await page.click('#confirm-top');
await page.waitForSelector('.celebrate-overlay', { timeout: 5000 });
check('[fix8] celebration appears for new species', true);
await page.screenshot({ path: outDir + 'checker5-fix8-celebration.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
const celAfterEsc = await page.locator('.celebrate-overlay').count();
check('[fix8] Escape dismisses celebration', celAfterEsc === 0, `${celAfterEsc} overlays remain`);
// flow must still complete: toast + navigation to journal + entry filed
const toastVisible = await page.locator('.toast, [class*="toast"]').count();
const hash = await page.evaluate(() => location.hash);
check('[fix8] flow completed after Escape (navigated to journal)', hash === '#/' || hash === '' || hash === '#', hash);
dump = await dbDump();
const conf8 = dump.sightings.filter(s => s.idStatus === 'confirmed');
check('[fix8] entry filed as confirmed after Escape', conf8.length === 1 && dump.species.length === 1 && dump.species[0].count === 1, JSON.stringify(dump));
console.log(`  (info) toast elements visible after Escape: ${toastVisible}`);
await page.waitForTimeout(400);
await page.screenshot({ path: outDir + 'checker5-fix8-after-escape.png' });
// no stuck state: journal renders, spot works again
await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const spotOk = await page.locator('#file-input').count();
check('[fix8] app not stuck — spot screen still functional', spotOk > 0);

check('no uncaught page errors during core attacks', pageErrors.length === 0, pageErrors.join(' | '));

await scenario('auto');
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
