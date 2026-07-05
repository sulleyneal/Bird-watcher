/* checker-a.js — independent adversarial check of Claim A (full loop) and
   Claim C (offline capture). Verifies from rendered state, not builder code. */
import { launch, PHONE } from './browser.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(outDir, { recursive: true });

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + String(extra).slice(0, 120) : ''}`);
}
const pageErrors = [];
function hookErrors(p, label) {
  p.on('pageerror', e => { pageErrors.push(`[${label}] ${e.message}`); console.log(`PAGEERROR [${label}]:`, e.message); });
  p.on('console', m => { if (m.type() === 'error') console.log(`CONSOLE-ERR [${label}]:`, m.text().slice(0, 160)); });
}
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
      tx.objectStore('sightings').getAll().onsuccess = e => { out.sightings = e.target.result.map(s => ({ id: s.id, idStatus: s.idStatus, commonName: s.commonName || null, notes: s.notes || '' })); };
      tx.objectStore('species').getAll().onsuccess = e => { out.species = e.target.result.map(s => ({ key: s.key, count: s.count })); };
      tx.oncomplete = () => { db.close(); res(out); };
    };
  }));
}
const shot = (p, n) => p.screenshot({ path: outDir + 'checker2-' + n + '.png', fullPage: true }).catch(() => {});

const browser = await launch();
const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
hookErrors(page, 'page1');

/* fabricate a bird-ish JPEG */
const tmpDir = fileURLToPath(new URL('./tmp/', import.meta.url));
await mkdir(tmpDir, { recursive: true });
await page.goto('about:blank');
const dataURL = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d');
  x.fillStyle = '#b9cfda'; x.fillRect(0, 0, 640, 480);
  x.fillStyle = '#a33526';
  x.beginPath(); x.ellipse(320, 290, 60, 42, -0.15, 0, 7); x.fill();
  x.beginPath(); x.ellipse(372, 248, 26, 24, 0, 0, 7); x.fill();
  x.fillStyle = '#333'; x.beginPath(); x.arc(380, 242, 4, 0, 7); x.fill();
  return c.toDataURL('image/jpeg', 0.9);
});
const jpgPath = tmpDir + 'checker-bird.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));

await setMock('high');

/* ---- A1: cold load, empty journal ---- */
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check('A1 cold load @390x844 renders journal (empty state)', await page.locator('.empty-state').count() > 0);
check('A1 demo-mode honestly labeled on journal', /demo identification/i.test(await page.locator('#mode-note').textContent().catch(() => '')));
await shot(page, 'a01-coldload');

/* ---- A2: capture via upload ---- */
await page.evaluate(() => { location.hash = '#/spot'; });
await page.waitForSelector('#file-input', { timeout: 5000 });
await shot(page, 'a02-spot');
await page.setInputFiles('#file-input', jpgPath);
await page.waitForSelector('.photo-frame img', { timeout: 5000 });
const reviewImgOk = await page.$eval('.photo-frame img', i => i.naturalWidth > 0 && i.complete);
check('A2 review step shows the actual photo pixels', reviewImgOk);
await page.fill('#f-place', 'Checker Meadow');
await page.fill('#f-notes', 'Checker notes: rusty song from the maple.');
await shot(page, 'a03-review');
await page.click('#go-id');

/* ---- A3: identification result ---- */
await page.waitForSelector('#confirm-top', { timeout: 15000 });
const species1 = (await page.locator('.cel-species').first().textContent()).trim();
check('A3 identification proposes a species', species1.length > 3, species1);
const resultTxt = await page.locator('#spot-stage').textContent();
check('A3 result flags it as NEW species pre-confirm', /new species for you/i.test(resultTxt));
check('A3 confidence meter shown', await page.locator('.conf, .conf-meter, [class*=conf]').count() > 0);
await shot(page, 'a04-result');

/* nothing filed before user confirms */
let db = await dbState(page);
check('A3 NOT auto-filed before confirmation', db.species.length === 0 && db.sightings.every(s => s.idStatus !== 'confirmed'), JSON.stringify(db.species));

/* ---- A4: confirm -> celebration ---- */
await page.click('#confirm-top');
const cel = await page.waitForSelector('.celebrate-overlay', { timeout: 5000 }).catch(() => null);
check('A4 celebration appears for a NEW species', !!cel);
if (cel) {
  const celTxt = await page.locator('.celebrate-overlay').textContent();
  check('A4 celebration names the species', celTxt.includes(species1), celTxt.slice(0, 90));
}
await shot(page, 'a05-celebration');
await page.click('#cel-ok').catch(() => {});
await page.waitForTimeout(700);

/* ---- A5: lands in journal with notes + photo ---- */
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForSelector('.entry-card', { timeout: 5000 });
const card1 = await page.locator('.entry-card').first().textContent();
check('A5 entry in journal with species name', card1.includes(species1));
check('A5 entry keeps my notes', card1.includes('rusty song'));
check('A5 entry keeps my place', card1.includes('Checker Meadow'));
const cardImgOk = await page.$eval('.entry-card img.entry-photo', i => i.naturalWidth > 0).catch(() => false);
check('A5 entry card renders the photo', cardImgOk);
await shot(page, 'a06-journal');

/* ---- A6: SECOND sighting of the SAME species must NOT celebrate ---- */
await page.evaluate(() => { location.hash = '#/spot'; });
await page.waitForSelector('#file-input');
await page.setInputFiles('#file-input', jpgPath);
await page.waitForSelector('.photo-frame img');
await page.fill('#f-notes', 'Second look at the same bird.');
await page.click('#go-id');
await page.waitForSelector('#confirm-top', { timeout: 15000 });
/* mock cycles species, so use the manual path to file the SAME species again */
await page.click('#manual');
await page.waitForSelector('#f-species');
await page.fill('#f-species', species1);
await page.waitForTimeout(300);
const suggestion = page.locator('#suggestions .cand', { hasText: species1 }).first();
check('A6 manual search finds the species in the guide', await suggestion.count() > 0, species1);
await suggestion.click();
/* poll 2s: celebration must NOT appear for a repeat species */
let celebrated = false;
for (let i = 0; i < 10; i++) { if (await page.locator('.celebrate-overlay').count() > 0) { celebrated = true; break; } await page.waitForTimeout(200); }
check('A6 NO celebration for 2nd sighting of same species', !celebrated);
await page.waitForTimeout(600);
db = await dbState(page);
const sp1 = db.species.filter(s => true);
check('A6 still filed: 1 species, 2 confirmed sightings', db.species.length === 1 && db.sightings.filter(s => s.idStatus === 'confirmed').length === 2, JSON.stringify(sp1));
const statLine = await page.locator('.screen p.muted').first().textContent().catch(() => '');
check('A6 journal header says 1 species / 2 sightings', /1 species · 2 sightings/.test(statLine), statLine.trim());
await shot(page, 'a07-dedup');

/* ---- A7: close app, reopen OFFLINE ---- */
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await page.waitForTimeout(1500); // let precache settle
await ctx.setOffline(true);
const page2 = await ctx.newPage();
hookErrors(page2, 'page2-offline');
const nav = await page2.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' }).catch(e => null);
check('A7 offline reopen loads the app shell', !!nav);
const gotCards = await page2.waitForSelector('.entry-card', { timeout: 6000 }).catch(() => null);
check('A7 offline journal shows entries', !!gotCards);
const offCard = page2.locator('.entry-card', { hasText: 'rusty song' }).first();
check('A7 offline entry present w/ species+notes', await offCard.count() > 0 && (await offCard.textContent()).includes(species1));
const offPhotoOk = await offCard.locator('img.entry-photo').evaluate(i => i.naturalWidth > 0).catch(() => false);
check('A7 offline photo truly renders (naturalWidth>0)', offPhotoOk);
await shot(page2, 'a08-offline-journal');
await offCard.click();
await page2.waitForSelector('#edit-notes', { timeout: 5000 }).catch(() => {});
const offNotes = await page2.locator('#edit-notes').inputValue().catch(() => '');
check('A7 offline entry page keeps notes intact', offNotes.includes('rusty song'), offNotes);
const offEntryPhoto = await page2.$eval('.photo-frame img', i => i.naturalWidth > 0).catch(() => false);
check('A7 offline entry page renders photo', offEntryPhoto);
await shot(page2, 'a09-offline-entry');

/* ---- A8: all five tabs render offline ---- */
for (const [name, hash] of [['journal', '#/'], ['life', '#/life'], ['map', '#/map'], ['almanac', '#/almanac'], ['spot', '#/spot']]) {
  await page2.evaluate(h => { location.hash = h; }, hash);
  await page2.waitForTimeout(700);
  const txt = (await page2.locator('main.screen').textContent().catch(() => '')).trim();
  check(`A8 tab "${name}" renders offline`, txt.length > 10, txt.slice(0, 50));
  await shot(page2, `a10-offline-${name}`);
}

/* ---- C1: capture fully offline ---- */
await page2.evaluate(() => { location.hash = '#/spot'; });
await page2.waitForSelector('#file-input');
await page2.setInputFiles('#file-input', jpgPath);
await page2.waitForSelector('.photo-frame img');
await page2.fill('#f-notes', 'Offline capture: heard drumming on a dead oak.');
await page2.fill('#f-place', 'Offline Hollow');
await page2.click('#go-id');
await page2.waitForTimeout(1200);
check('C1 offline capture returns to journal (no dead end)', await page2.evaluate(() => location.hash) === '#/');
await page2.waitForSelector('.entry-card', { timeout: 5000 }).catch(() => {});
const qCard = page2.locator('.entry-card', { hasText: 'heard drumming' }).first();
check('C1 queued sighting saved with notes', await qCard.count() > 0);
const qTxt = await qCard.textContent().catch(() => '');
check('C1 visibly marked awaiting identification', /Awaiting identification/i.test(qTxt) && /will identify when back online/i.test(qTxt), qTxt.replace(/\s+/g, ' ').slice(0, 120));
const ribbon = await page2.locator('#mode-note').textContent().catch(() => '');
check('C1 journal ribbon says sightings waiting for connection', /waiting for a connection/i.test(ribbon), ribbon.trim().slice(0, 90));
await shot(page2, 'a11-offline-queued');
await qCard.click();
await page2.waitForTimeout(700);
const qEntry = await page2.locator('main.screen').textContent().catch(() => '');
check('C1 queued entry page explains auto-identify + offers manual naming', /identified automatically when a connection/i.test(qEntry) && /Name it myself/i.test(qEntry));
await shot(page2, 'a12-offline-queued-entry');

/* ---- C2: connection returns -> auto identify ---- */
await page2.evaluate(() => { location.hash = '#/'; });
await page2.waitForTimeout(400);
await setMock('high');
await ctx.setOffline(false);
let identified = false, idNote = '';
const t0 = Date.now();
while (Date.now() - t0 < 60000) {
  const t = await page2.locator('main.screen').textContent().catch(() => '');
  if (/tap to confirm — likely/i.test(t)) { identified = true; idNote = t.match(/tap to confirm — likely [^"”]*/i)?.[0] || ''; break; }
  await page2.waitForTimeout(1500);
}
check('C2 queued sighting auto-identifies within 60s of reconnect', identified, idNote.slice(0, 90) + ` (${Math.round((Date.now() - t0) / 1000)}s)`);
db = await dbState(page2);
const qRec = db.sightings.find(s => s.notes.includes('heard drumming'));
check('C2 reconnected sighting is needs_confirm (no silent auto-confirm)', qRec && qRec.idStatus === 'needs_confirm', qRec && qRec.idStatus);
await shot(page2, 'a13-reconnected');

/* confirm it from the entry page */
const rCard = page2.locator('.entry-card', { hasText: 'heard drumming' }).first();
await rCard.click();
await page2.waitForSelector('#confirm-top', { timeout: 6000 }).catch(() => {});
check('C2 entry page offers confirm UI after auto-ID', await page2.locator('#confirm-top').count() > 0);
await page2.click('#confirm-top').catch(() => {});
await page2.waitForTimeout(900);
if (await page2.locator('#cel-ok').count()) await page2.click('#cel-ok');
await page2.waitForTimeout(700);
db = await dbState(page2);
const qRec2 = db.sightings.find(s => s.notes.includes('heard drumming'));
check('C2 confirmed after reconnect, notes intact', qRec2 && qRec2.idStatus === 'confirmed' && !!qRec2.commonName, qRec2 && `${qRec2.commonName}`);
await shot(page2, 'a14-queued-confirmed');

check('NO uncaught page errors in A/C run', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
const fails = results.filter(r => !r.ok).length;
console.log(`\n${fails ? fails + ' FAILURE(S)' : 'ALL PASS'} (${results.length} checks)`);
