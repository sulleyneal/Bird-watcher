/* checker-c.js — edge-case attacks: double clicks, mid-identify navigation,
   seeded journal invariants, discard-from-clean, bad entry URL. */
import { launch, PHONE } from './browser.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(outDir, { recursive: true });
const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + String(extra).replace(/\s+/g, ' ').slice(0, 140) : ''}`);
}
const pageErrors = [];
async function setMock(s) {
  await fetch(`${BASE}/api/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: s }) });
}
async function dbState(p) {
  return p.evaluate(() => new Promise(res => {
    const rq = indexedDB.open('field-journal');
    rq.onsuccess = () => {
      const db = rq.result;
      const tx = db.transaction(['sightings', 'species']);
      const out = {};
      tx.objectStore('sightings').getAll().onsuccess = e => { out.sightings = e.target.result.map(s => ({ id: s.id, idStatus: s.idStatus, commonName: s.commonName || null })); };
      tx.objectStore('species').getAll().onsuccess = e => { out.species = e.target.result.map(s => ({ key: s.key, name: s.commonName, count: s.count })); };
      tx.oncomplete = () => { db.close(); res(out); };
    };
  }));
}
const shot = (p, n) => p.screenshot({ path: outDir + 'checker2-' + n + '.png', fullPage: true }).catch(() => {});

const browser = await launch();
const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGEERROR:', e.message); });

await page.goto('about:blank');
const dataURL = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d'); x.fillStyle = '#cddbe4'; x.fillRect(0, 0, 640, 480);
  x.fillStyle = '#7a4a2a'; x.beginPath(); x.ellipse(320, 280, 66, 44, 0, 0, 7); x.fill();
  return c.toDataURL('image/jpeg', 0.9);
});
const tmpDir = fileURLToPath(new URL('./tmp/', import.meta.url));
await mkdir(tmpDir, { recursive: true });
const jpgPath = tmpDir + 'checker-edge.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));

async function upload() {
  await page.evaluate(() => { location.hash = '#/spot'; });
  await page.waitForSelector('#file-input', { timeout: 5000 });
  await page.setInputFiles('#file-input', jpgPath);
  await page.waitForSelector('.photo-frame img', { timeout: 5000 });
}

/* ---- E0: discard-from-clean (isolating checker-b finding) ---- */
await setMock('not_bird');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await upload();
await page.click('#go-id');
await page.waitForSelector('#nb-discard', { timeout: 15000 });
await page.click('#nb-discard');
await page.waitForTimeout(600);
let db = await dbState(page);
check('E0 discard from clean state fully removes the not-bird record', db.sightings.length === 0, JSON.stringify(db.sightings));

/* ---- E1: double-click "Identify this bird" ---- */
await setMock('high');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await upload();
await page.locator('#go-id').dblclick();
await page.waitForSelector('#confirm-top', { timeout: 15000 });
await page.waitForTimeout(1200);
db = await dbState(page);
check('E1 double-click Identify creates exactly ONE sighting', db.sightings.length === 1, JSON.stringify(db.sightings));
await shot(page, 'c01-dblclick-identify');
/* confirm whatever is on screen to continue */
if (await page.locator('#confirm-top').count()) {
  /* ---- E2: double-click the confirm button — count must not inflate ---- */
  await page.locator('#confirm-top').dblclick().catch(() => {});
  await page.waitForTimeout(1200);
  if (await page.locator('#cel-ok').count()) await page.click('#cel-ok');
  await page.waitForTimeout(800);
  db = await dbState(page);
  const confirmed = db.sightings.filter(s => s.idStatus === 'confirmed');
  const counts = db.species.map(s => `${s.name}:${s.count}`).join(',');
  check('E2 double-click confirm does not inflate species count',
    db.species.length >= 1 && db.species.every(sp => sp.count === confirmed.filter(s => s.commonName === sp.name).length),
    `species=${counts}; confirmedSightings=${confirmed.length}`);
  await shot(page, 'c02-dblclick-confirm');
}

/* ---- E3: navigate away mid-identify (slow network) ---- */
await setMock('high');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.route('**/api/identify', async r => { await new Promise(res => setTimeout(res, 2500)); r.continue(); });
await upload();
await page.fill('#f-notes', 'walked away mid-identify');
await page.click('#go-id');
await page.waitForTimeout(400); // request in flight
await page.evaluate(() => { location.hash = '#/almanac'; });
await page.waitForTimeout(3500); // let the response land on the detached stage
check('E3 no crash after navigating away mid-identify', pageErrors.length === 0, pageErrors.join('|'));
db = await dbState(page);
const wander = db.sightings.find(s => true);
check('E3 sighting survives with a resolvable status', !!wander && ['queued', 'needs_confirm'].includes(wander.idStatus), wander && wander.idStatus);
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForTimeout(700);
const jTxt = await page.locator('main.screen').textContent();
check('E3 journal shows it as pending/confirmable, not lost or blank', /tap to confirm|Awaiting identification|Who was this/i.test(jTxt), jTxt.slice(0, 120));
await shot(page, 'c03-midnav');
/* can the user still resolve it? */
await page.locator('.entry-card').first().click();
await page.waitForTimeout(800);
const canResolve = await page.locator('#confirm-top, #name-now').count();
check('E3 abandoned identify is resolvable from its entry page', canResolve > 0);
await page.unroute('**/api/identify');

/* ---- E4: seeded journal — celebration invariant ---- */
await setMock('high');
await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const seededCards = await page.locator('.entry-card').count();
check('E4 demo seed renders a populated journal', seededCards > 3, `${seededCards} cards`);
await shot(page, 'c04-seeded');
await upload();
await page.click('#go-id');
await page.waitForSelector('#confirm-top', { timeout: 15000 });
const seededResult = await page.locator('#spot-stage').textContent();
const saysNew = /new species for you/i.test(seededResult);
const saysAlready = /already on your life list/i.test(seededResult);
check('E4 result page states new-vs-known status', saysNew || saysAlready, saysNew ? 'says NEW' : 'says ALREADY SEEN');
await page.click('#confirm-top');
let overlay = await page.waitForSelector('.celebrate-overlay', { timeout: 2500 }).catch(() => null);
check('E4 celebration iff actually new (invariant holds)', !!overlay === saysNew, `saysNew=${saysNew} celebrated=${!!overlay}`);
await shot(page, 'c05-seeded-confirm');
if (overlay) await page.click('#cel-ok');
await page.waitForTimeout(600);

/* ---- E5: all five tabs render on seeded data, online ---- */
for (const [name, hash] of [['journal', '#/'], ['life', '#/life'], ['map', '#/map'], ['almanac', '#/almanac'], ['spot', '#/spot']]) {
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForTimeout(600);
  const txt = (await page.locator('main.screen').textContent().catch(() => '')).trim();
  check(`E5 tab "${name}" renders with seeded data`, txt.length > 10);
}
await shot(page, 'c06-seeded-life');

/* ---- E6: garbage entry URL ---- */
await page.evaluate(() => { location.hash = '#/entry/does-not-exist'; });
await page.waitForTimeout(600);
const lostTxt = await page.locator('main.screen').textContent();
check('E6 unknown entry id shows friendly page, not blank/crash', /fluttered away|doesn.t exist/i.test(lostTxt), lostTxt.slice(0, 80));
await shot(page, 'c07-bad-entry');

/* ---- E7: rapid tab mashing ---- */
for (let i = 0; i < 12; i++) {
  await page.evaluate(h => { location.hash = h; }, ['#/', '#/life', '#/spot', '#/map', '#/almanac'][i % 5]);
  await page.waitForTimeout(80);
}
await page.waitForTimeout(800);
check('E7 rapid tab mashing causes no uncaught errors', pageErrors.length === 0, pageErrors.join('|'));
const finalTxt = (await page.locator('main.screen').textContent()).trim();
check('E7 app still renders after mashing', finalTxt.length > 10);

await setMock('auto');
check('NO uncaught page errors in edge run', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close();
const fails = results.filter(r => !r.ok).length;
console.log(`\n${fails ? fails + ' FAILURE(S)' : 'ALL PASS'} (${results.length} checks)`);
