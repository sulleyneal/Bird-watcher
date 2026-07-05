/* checker6-fixes.js — cycle-3 final verification of the 4 landed fixes.
   Pixel/DB evidence, not code reading. Usage: node test/checker6-fixes.js */

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
const ctx = await browser.newContext({ ...PHONE, acceptDownloads: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGE ERROR:', e.message); });

/* bird fixture */
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
const jpgPath = tmpDir + 'bird6.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));

const dbDump = () => page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const db = rq.result;
    const t = db.transaction(['sightings', 'species']);
    const a = t.objectStore('sightings').getAll();
    const b = t.objectStore('species').getAll();
    t.oncomplete = () => res({
      sightings: a.result.map(s => ({ id: s.id, idStatus: s.idStatus, speciesKey: s.speciesKey || null, notes: s.notes })),
      species: b.result.map(s => ({ key: s.key, count: s.count })),
    });
  };
}));

/* Compare two element screenshots inside the browser; return stats about
   the pixels that changed (i.e. the selection highlight). */
async function diffStats(b64a, b64b) {
  return page.evaluate(async ([a, b]) => {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const cv = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = cv(ia), db = cv(ib);
    let n = 0, r = 0, g = 0, bl = 0;
    for (let i = 0; i < da.length; i += 4) {
      const dr = Math.abs(da[i] - db[i]), dg = Math.abs(da[i + 1] - db[i + 1]), dbb = Math.abs(da[i + 2] - db[i + 2]);
      if (dr + dg + dbb > 30) { n++; r += db[i]; g += db[i + 1]; bl += db[i + 2]; }
    }
    return n ? { changed: n, total: w * h, r: Math.round(r / n), g: Math.round(g / n), b: Math.round(bl / n) } : { changed: 0, total: w * h };
  }, [b64a, b64b]);
}

/* select all text inside a DOM node (or a textarea range) and measure */
async function selectionColorOn(label, selector, mode = 'range') {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await page.waitForTimeout(150);
  const before = (await loc.screenshot()).toString('base64');
  if (mode === 'textarea') {
    await page.evaluate(sel => {
      const ta = document.querySelector(sel);
      ta.focus(); ta.setSelectionRange(0, Math.min(ta.value.length, 80));
    }, selector);
  } else {
    await page.evaluate(sel => {
      const el = document.querySelector(sel);
      const range = document.createRange();
      range.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges(); s.addRange(range);
    }, selector);
  }
  await page.waitForTimeout(200);
  const after = (await loc.screenshot()).toString('base64');
  await writeFile(outDir + `checker6-sel-${label}.png`, Buffer.from(after, 'base64'));
  const st = await diffStats(before, after);
  const warm = st.changed > 100 && st.r > st.b + 10 && st.r > st.g;
  const blue = st.changed > 100 && st.b > st.r + 10;
  check(`[fix1-selection] ${label}: highlight is warm rust wash, not blue`,
    warm && !blue, JSON.stringify(st));
  await page.evaluate(() => window.getSelection().removeAllRanges());
  return st;
}

/* ============ FIX 1: text selection is a pigment wash ============ */
console.log('\n--- fix 1: ::selection pigment wash ---');
await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await selectionColorOn('journal-card', '.entry-card');
/* entry page */
const anyId = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').getAll();
    t.onsuccess = () => { const c = t.result.find(s => s.idStatus === 'confirmed' && s.notes); res(c ? c.id : t.result[0].id); };
  };
}));
await page.goto(`${BASE}/#/entry/${anyId}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await selectionColorOn('entry-notes', '#edit-notes', 'textarea');
await selectionColorOn('entry-meta', '.meta-lines');
/* review step */
await scenario('high');
await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
await page.setInputFiles('#file-input', jpgPath);
await page.waitForSelector('#go-id', { timeout: 5000 });
await page.evaluate(() => { document.querySelector('#f-notes').value = 'Selecting this review-step note text to test the wash'; });
await selectionColorOn('review-notes', '#f-notes', 'textarea');
await selectionColorOn('review-label', '.field label');

/* ============ FIX 2: double-click "Identify" click-through guard ============ */
console.log('\n--- fix 2: double-click go-id guard ---');
await scenario('high');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.setInputFiles('#file-input', jpgPath);
await page.waitForSelector('#go-id', { timeout: 5000 });
await page.waitForTimeout(150);
await page.click('#go-id', { clickCount: 2, delay: 50 }).catch(e => console.log('  (dblclick note)', e.message.slice(0, 80)));
await page.waitForSelector('#confirm-top, .celebrate-overlay', { timeout: 9000 }).catch(() => {});
await page.waitForTimeout(800);
const cel = await page.locator('.celebrate-overlay').count();
const confirmBtn = await page.locator('#confirm-top').count();
let dump = await dbDump();
await page.screenshot({ path: outDir + 'checker6-fix2-dblclick.png' });
check('[fix2] no celebration auto-fired', cel === 0, `${cel} overlays`);
check('[fix2] result card awaits the user (#confirm-top visible)', confirmBtn === 1);
check('[fix2] exactly 1 sighting, idStatus=needs_confirm, no species confirmed',
  dump.sightings.length === 1 && dump.sightings[0].idStatus === 'needs_confirm' && dump.species.length === 0,
  JSON.stringify({ s: dump.sightings, sp: dump.species }));

/* nastier: second click delayed to land right when result renders (~mock latency) */
for (const delay of [250, 450, 700]) {
  await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.setInputFiles('#file-input', jpgPath);
  await page.waitForSelector('#go-id');
  const box = await page.locator('#go-id').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(delay);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // ghost tap where the button was
  await page.waitForTimeout(2500);
  const cel2 = await page.locator('.celebrate-overlay').count();
  dump = await dbDump();
  const confirmed = dump.sightings.filter(s => s.idStatus === 'confirmed').length;
  check(`[fix2] ghost tap at +${delay}ms cannot auto-confirm`, confirmed === 0 && cel2 === 0,
    JSON.stringify(dump.sightings));
  if (cel2) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
}

/* ============ FIX 3: share card hard-breaks long URLs ============ */
console.log('\n--- fix 3: share card long-token wrap ---');
await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
const owlId = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').getAll();
    t.onsuccess = () => { const o = t.result.find(s => s.idStatus === 'confirmed'); res(o ? o.id : null); };
  };
}));
await page.goto(`${BASE}/#/entry/${owlId}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const URL_NOTE = 'Logged the full observation at https://observations.fieldjournal.example.com/2026/07/05/great-horned-owl-hemlock-grove-dusk-permalink-4457 before it flew off across the gorge.';
await page.evaluate(t => {
  const ta = document.querySelector('#edit-notes');
  ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
}, URL_NOTE);
await page.waitForTimeout(900);
const dlP = page.waitForEvent('download', { timeout: 15000 });
await page.click('#share');
try {
  const dl = await dlP;
  await dl.saveAs(outDir + 'checker6-fix3-sharecard-url.png');
  check('[fix3] share with 100-char URL note produced a PNG', true, dl.suggestedFilename());
} catch (e) {
  check('[fix3] share with 100-char URL note produced a PNG', false, e.message.slice(0, 120));
}

/* ============ FIX 4: unique map pin labels ============ */
console.log('\n--- fix 4: map pin labels unique per species ---');
await page.goto(`${BASE}/?seed=demo#/map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
const pinInfo = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').getAll();
    t.onsuccess = () => {
      const byId = new Map(t.result.map(s => [String(s.id), s]));
      const pins = [...document.querySelectorAll('.map-pin')].map(p => {
        const s = byId.get(String(p.dataset.id)) || {};
        return { label: (p.querySelector('text') || {}).textContent || '', species: s.speciesKey, name: s.commonName };
      });
      res(pins);
    };
  };
}));
console.log('  pins:', JSON.stringify(pinInfo));
const byLabel = new Map();
let clash = null;
for (const p of pinInfo) {
  if (!byLabel.has(p.label)) byLabel.set(p.label, p.species);
  else if (byLabel.get(p.label) !== p.species) clash = `${p.label}: ${byLabel.get(p.label)} vs ${p.species}`;
}
check('[fix4] map rendered pins', pinInfo.length >= 5, `${pinInfo.length} pins`);
check('[fix4] no two different species share a pin label', !clash, clash || 'all distinct');
check('[fix4] every pin label non-empty', pinInfo.every(p => p.label.trim().length > 0));
await page.screenshot({ path: outDir + 'checker6-fix4-map.png', fullPage: true });

check('\nno uncaught page errors during fix verification', pageErrors.length === 0, pageErrors.join(' | '));

await scenario('auto');
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
