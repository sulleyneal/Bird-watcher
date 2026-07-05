/* checker6-wrongbird.js — bar test D: not_bird and unclear scenarios, fresh eyes. */
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
page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGE ERROR:', e.message); });

const tmpDir = fileURLToPath(new URL('./tmp/', import.meta.url));
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
const dataURL = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d');
  x.fillStyle = '#888'; x.fillRect(0, 0, 640, 480);
  return c.toDataURL('image/jpeg', 0.9);
});
const jpgPath = tmpDir + 'grey6.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));

const dbDump = () => page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction(['sightings', 'species']);
    const a = t.objectStore('sightings').getAll();
    const b = t.objectStore('species').getAll();
    t.oncomplete = () => res({ sightings: a.result.map(s => ({ idStatus: s.idStatus, speciesKey: s.speciesKey || null })), species: b.result.length });
  };
}));

async function upload() {
  await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.setInputFiles('#file-input', jpgPath);
  await page.waitForSelector('#go-id', { timeout: 5000 });
  await page.click('#go-id');
}

/* ---------- not_bird ---------- */
await scenario('not_bird');
await upload();
await page.waitForSelector('#nb-retry', { timeout: 9000 });
const nbText = await page.locator('#spot-stage').textContent();
check('D1 not_bird: honest "no bird" message', /no bird/i.test(nbText), nbText.replace(/\s+/g, ' ').slice(0, 100));
check('D2 not_bird: no species proposed / no confirm button', (await page.locator('#confirm-top').count()) === 0);
await page.screenshot({ path: outDir + 'checker6-d-notbird.png' });
let dump = await dbDump();
check('D3 not_bird: nothing silently confirmed', dump.sightings.every(s => s.idStatus !== 'confirmed') && dump.species === 0, JSON.stringify(dump));
await page.click('#nb-discard');
await page.waitForTimeout(800);
dump = await dbDump();
check('D4 not_bird discard removes the record', dump.sightings.length === 0, JSON.stringify(dump));
await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
check('D5 journal stays clean after not_bird discard', (await page.locator('.entry-card').count()) === 0);

/* ---------- unclear ---------- */
await scenario('unclear');
await upload();
await page.waitForSelector('#uc-retry, #confirm-top, .cand', { timeout: 9000 });
await page.waitForTimeout(500);
const state = await page.evaluate(() => ({
  ucRetry: !!document.querySelector('#uc-retry'),
  ucKeep: !!document.querySelector('#uc-keep'),
  ucManual: !!document.querySelector('#uc-manual'),
  confirmTop: !!document.querySelector('#confirm-top'),
  cands: document.querySelectorAll('.cand').length,
  text: document.querySelector('#spot-stage').textContent.replace(/\s+/g, ' ').slice(0, 160),
}));
console.log('  unclear state:', JSON.stringify(state));
const surfaced = (state.confirmTop || state.cands > 0) || (state.ucRetry && state.ucManual);
check('D6 unclear: candidates or honest options surfaced (never silent)', surfaced, state.text);
const hedged = /best guess|your call|too quick|blurry|not sure|honest/i.test(state.text);
check('D7 unclear: hedged language, no confident claim', hedged, state.text);
await page.screenshot({ path: outDir + 'checker6-d-unclear.png', fullPage: true });
dump = await dbDump();
check('D8 unclear: nothing auto-confirmed in DB', dump.sightings.every(s => s.idStatus !== 'confirmed') && dump.species === 0, JSON.stringify(dump));

/* keep-it-unnamed path, then journal state */
if (state.ucKeep) {
  await page.click('#uc-keep');
  await page.waitForTimeout(800);
} else if (state.cands || state.confirmTop) {
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(800);
}
await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
const jText = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
const cardCount = await page.locator('.entry-card').count();
check('D9 unclear sighting parked honestly in journal (needs another look, not named)',
  cardCount === 1 && /who was this|too quick|another look/i.test(jText), jText.slice(0, 0) || `${cardCount} cards`);
await page.screenshot({ path: outDir + 'checker6-d-unclear-journal.png' });

/* manual naming from the unclear entry */
await page.locator('.entry-card').first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: outDir + 'checker6-d-unclear-entry.png', fullPage: true });
const entryOffersHelp = await page.evaluate(() => {
  const t = document.body.textContent;
  return /name|look|guess|candidate/i.test(t);
});
check('D10 unclear entry page offers a way forward', entryOffersHelp);

check('D11 no uncaught page errors in wrong-bird pass', pageErrors.length === 0, pageErrors.join(' | '));

await scenario('auto');
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
