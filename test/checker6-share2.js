/* checker6-share2.js — share card with a URL-only note to exercise the hyphen hard-break path */
import { launch, PHONE } from './browser.js';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
const browser = await launch();
const ctx = await browser.newContext({ ...PHONE, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
const id = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').getAll();
    t.onsuccess = () => res(t.result.find(s => s.idStatus === 'confirmed').id);
  };
}));
await page.goto(`${BASE}/#/entry/${id}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await page.evaluate(() => {
  const ta = document.querySelector('#edit-notes');
  ta.value = 'https://wwwmaximumwidthwwwww.example.com/observations/mmmmwwwmmmwww-4457';
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(900);
const dlP = page.waitForEvent('download', { timeout: 15000 });
await page.click('#share');
const dl = await dlP;
await dl.saveAs(outDir + 'checker6-fix3-sharecard-urlonly.png');
console.log('saved', outDir + 'checker6-fix3-sharecard-urlonly.png');
await browser.close();
