/* checker-b.js — independent adversarial check of Claim B:
   not-a-bird handling, low-confidence flow, candidate override, manual naming. */
import { launch, PHONE } from './browser.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(outDir, { recursive: true });

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + String(extra).replace(/\s+/g, ' ').slice(0, 130) : ''}`);
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
  const x = c.getContext('2d'); x.fillStyle = '#8899aa'; x.fillRect(0, 0, 640, 480);
  x.fillStyle = '#556'; x.fillRect(280, 100, 60, 300); // a fence post, definitely not a bird
  return c.toDataURL('image/jpeg', 0.85);
});
const tmpDir = fileURLToPath(new URL('./tmp/', import.meta.url));
await mkdir(tmpDir, { recursive: true });
const jpgPath = tmpDir + 'checker-notbird.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));

async function uploadAndIdentify() {
  await page.evaluate(() => { location.hash = '#/spot'; });
  await page.waitForSelector('#file-input', { timeout: 5000 });
  await page.setInputFiles('#file-input', jpgPath);
  await page.waitForSelector('.photo-frame img', { timeout: 5000 });
  await page.click('#go-id');
}

/* ---- B1: not a bird ---- */
await setMock('not_bird');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await uploadAndIdentify();
await page.waitForSelector('#nb-discard', { timeout: 15000 });
const nbTxt = await page.locator('#spot-stage').textContent();
check('B1 friendly non-bird message shown', /no bird/i.test(nbTxt) && /fence post|squinted|doesn.t seem/i.test(nbTxt), nbTxt.slice(0, 140));
check('B1 recovery options offered (retry + discard)', await page.locator('#nb-retry').count() > 0 && await page.locator('#nb-discard').count() > 0);
await shot(page, 'b01-notbird');
let db = await dbState(page);
check('B1 no bogus species filed', db.species.length === 0, JSON.stringify(db.species));
check('B1 record held as not_bird, not confirmed', db.sightings.every(s => s.idStatus !== 'confirmed'));
/* journal must not show it even before discard */
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForTimeout(600);
check('B1 non-bird never appears in journal list', await page.locator('.entry-card').count() === 0 && await page.locator('.empty-state').count() > 0);
await shot(page, 'b02-notbird-journal');
/* orphan check: navigating away without discarding leaves a hidden record? */
db = await dbState(page);
check('B1 (edge) navigating away does not leave hidden orphan record', db.sightings.length === 0, `sightings in DB: ${JSON.stringify(db.sightings)}`);

/* clean up: use the discard button properly this time */
await setMock('not_bird');
await uploadAndIdentify();
await page.waitForSelector('#nb-discard', { timeout: 15000 });
await page.click('#nb-discard');
await page.waitForTimeout(600);
db = await dbState(page);
check('B1 discard removes the record', db.sightings.filter(s => s.idStatus === 'not_bird').length === 0, JSON.stringify(db.sightings));

/* ---- B2: blurry / unclear -> low-confidence candidates, never silent ---- */
await setMock('unclear');
await uploadAndIdentify();
await page.waitForSelector('#confirm-top', { timeout: 15000 });
const ucTxt = await page.locator('#spot-stage').textContent();
check('B2 low confidence framed as "best guess — your call"', /best guess — your call/i.test(ucTxt), ucTxt.slice(0, 80));
const topName = (await page.locator('.cel-species').first().textContent()).trim();
const altNames = await page.locator('.cand .entry-name').allTextContents();
check('B2 alternative candidates offered', altNames.length >= 1, `top=${topName}; alts=${altNames.join(', ')}`);
check('B2 manual + discard escape hatches present', await page.locator('#manual').count() > 0 && await page.locator('#discard').count() > 0);
await shot(page, 'b03-unclear');
db = await dbState(page);
check('B2 NOTHING auto-filed while awaiting user call', db.species.length === 0 && db.sightings.every(s => s.idStatus !== 'confirmed'), JSON.stringify({ sp: db.species, st: db.sightings.map(s => s.idStatus) }));

/* ---- B3: override to a DIFFERENT candidate; THAT species must be filed ---- */
const overrideName = altNames[0].trim();
await page.locator('.cand', { hasText: overrideName }).first().click();
await page.waitForTimeout(900);
if (await page.locator('#cel-ok').count()) { await shot(page, 'b04-override-celebration'); await page.click('#cel-ok'); }
await page.waitForTimeout(700);
db = await dbState(page);
check('B3 override filed the CHOSEN species, not the top guess',
  db.species.length === 1 && db.species[0].name === overrideName && db.species.every(s => s.name !== topName),
  JSON.stringify(db.species));
const overrideId = db.sightings.find(s => s.idStatus === 'confirmed')?.id;
await page.evaluate(id => { location.hash = '#/entry/' + id; }, overrideId);
await page.waitForSelector('.detail-title', { timeout: 5000 });
const title = (await page.locator('.detail-title').textContent()).trim();
check('B3 entry page shows the overridden species', title === overrideName, title);
await shot(page, 'b05-override-entry');

/* ---- B4: manual naming when the guide is unsure (custom, off-guide name) ---- */
await setMock('unclear');
await uploadAndIdentify();
await page.waitForSelector('#manual', { timeout: 15000 });
await page.click('#manual');
await page.waitForSelector('#f-species');
await page.fill('#f-species', 'Speckled Checker-Wren');
await page.waitForTimeout(300);
const custom = page.locator('#suggestions .cand[data-custom]');
check('B4 custom "use my name" option offered', await custom.count() > 0);
await shot(page, 'b06-manual');
await custom.click();
await page.waitForTimeout(900);
if (await page.locator('#cel-ok').count()) await page.click('#cel-ok');
await page.waitForTimeout(700);
db = await dbState(page);
check('B4 manually named bird filed under my name', db.species.some(s => s.name === 'Speckled Checker-Wren'), JSON.stringify(db.species));
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForTimeout(600);
check('B4 manual bird visible in journal', (await page.locator('main.screen').textContent()).includes('Speckled Checker-Wren'));
await shot(page, 'b07-manual-journal');

/* ---- B5: "low" scenario (0.55 confidence) must also NOT read as certain ---- */
await setMock('low');
await uploadAndIdentify();
await page.waitForSelector('#confirm-top', { timeout: 15000 });
const lowTxt = await page.locator('#spot-stage').textContent();
check('B5 mid-low confidence also framed as best guess, alternatives listed', /best guess — your call/i.test(lowTxt) && await page.locator('.cand').count() >= 1);
db = await dbState(page);
check('B5 not auto-filed either', db.sightings.filter(s => s.idStatus === 'confirmed').length === 2);
await shot(page, 'b08-low');
/* discard it to leave clean state */
await page.click('#discard');
await page.waitForTimeout(500);

await setMock('auto');
check('NO uncaught page errors in B run', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close();
const fails = results.filter(r => !r.ok).length;
console.log(`\n${fails ? fails + ' FAILURE(S)' : 'ALL PASS'} (${results.length} checks)`);
