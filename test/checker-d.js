/* checker-d.js — reproduce & photograph the user-visible symptoms of defects:
   D1 not_bird orphan after navigating away, D2 dblclick-identify phantom entry,
   D3 dblclick-confirm count inflation on life list / entry page. */
import { launch, PHONE } from './browser.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
const results = [];
function check(name, ok, extra = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + String(extra).replace(/\s+/g, ' ').slice(0, 140) : ''}`);
}
async function setMock(s) {
  await fetch(`${BASE}/api/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: s }) });
}
const browser = await launch();
const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('about:blank');
const dataURL = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d'); x.fillStyle = '#cddbe4'; x.fillRect(0, 0, 640, 480);
  x.fillStyle = '#7a4a2a'; x.beginPath(); x.ellipse(320, 280, 66, 44, 0, 0, 7); x.fill();
  return c.toDataURL('image/jpeg', 0.9);
});
const tmpDir = fileURLToPath(new URL('./tmp/', import.meta.url));
const jpgPath = tmpDir + 'checker-d.jpg';
await writeFile(jpgPath, Buffer.from(dataURL.split(',')[1], 'base64'));
async function upload() {
  await page.evaluate(() => { location.hash = '#/spot'; });
  await page.waitForSelector('#file-input', { timeout: 5000 });
  await page.setInputFiles('#file-input', jpgPath);
  await page.waitForSelector('.photo-frame img', { timeout: 5000 });
}

/* D2+D3: dblclick identify, confirm once via dblclick, look at journal + life list */
await setMock('high');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await upload();
await page.locator('#go-id').dblclick();
await page.waitForSelector('#confirm-top', { timeout: 15000 });
await page.locator('#confirm-top').dblclick();
await page.waitForTimeout(1200);
if (await page.locator('#cel-ok').count()) await page.click('#cel-ok');
await page.waitForTimeout(600);
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForTimeout(700);
const cards = await page.locator('.entry-card').count();
const jTxt = (await page.locator('main.screen').textContent()).replace(/\s+/g, ' ');
check('D2 symptom: journal shows phantom duplicate card', cards === 2 && /Who was this\?/.test(jTxt), `${cards} cards; header: ${jTxt.slice(0, 90)}`);
await page.screenshot({ path: outDir + 'checker2-d01-phantom-duplicate.png', fullPage: true });
await page.evaluate(() => { location.hash = '#/life'; });
await page.waitForTimeout(700);
const lifeTxt = (await page.locator('main.screen').textContent()).replace(/\s+/g, ' ');
check('D3 symptom: life list shows inflated sighting count', /2 sighting|seen 2|× ?2|2 time/i.test(lifeTxt), lifeTxt.slice(0, 200));
await page.screenshot({ path: outDir + 'checker2-d02-inflated-lifelist.png', fullPage: true });
const confirmedCard = page.locator('.entry-card').first();
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForTimeout(500);
/* open the confirmed entry (the one that is not "Who was this?") */
const hrefs = await page.locator('.entry-card').evaluateAll(els => els.map(e => ({ href: e.getAttribute('href'), t: e.textContent })));
const conf = hrefs.find(h => !/Who was this/.test(h.t));
await page.evaluate(h => { location.hash = h; }, conf.href.replace(/^.*#/, '#'));
await page.waitForTimeout(700);
const eTxt = (await page.locator('main.screen').textContent()).replace(/\s+/g, ' ');
check('D3 symptom: entry page says "sighting #1 of 2" for a single sighting', /#1 of 2/.test(eTxt), (eTxt.match(/sighting [^ ]+ of \d+/i) || [''])[0]);
await page.screenshot({ path: outDir + 'checker2-d03-inflated-entry.png', fullPage: true });

/* D1: not_bird orphan — user-visible? check life/map/journal all hide it, storage keeps it */
await setMock('not_bird');
await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await upload();
await page.click('#go-id');
await page.waitForSelector('#nb-discard', { timeout: 15000 });
await page.evaluate(() => { location.hash = '#/'; });  // wander off without discarding
await page.waitForTimeout(600);
const orphan = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').getAll();
    t.onsuccess = () => res(t.result.map(s => ({ id: s.id, idStatus: s.idStatus, photoBytes: (s.photo || '').length })));
  };
}));
check('D1 symptom: hidden not_bird record with photo persists in IndexedDB with no UI to remove it',
  orphan.length === 1 && orphan[0].idStatus === 'not_bird' && orphan[0].photoBytes > 1000,
  JSON.stringify(orphan));
await setMock('auto');
await browser.close();
console.log(results.every(Boolean) ? '\nSYMPTOMS REPRODUCED' : '\nsome symptom checks did not reproduce');
