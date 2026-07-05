/* checker5-ui.js — cycle-2 adversarial re-check of fixes 4,5,6,7:
   share-card long notes, auto-growing notes textarea, map pin fan-out +
   legend, delete dialog dismissal. Usage: node test/checker5-ui.js */

import { launch, PHONE, TABLET } from './browser.js';
import { mkdir } from 'node:fs/promises';
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
const ctx = await browser.newContext({ ...PHONE, acceptDownloads: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGE ERROR:', e.message); });

/* seed demo data */
await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* find the Great Horned Owl entry id */
const owlId = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').getAll();
    t.onsuccess = () => {
      const owl = t.result.find(s => s.speciesKey === 'bubo-virginianus');
      res(owl ? owl.id : null);
    };
  };
}));
check('[setup] demo seeded with owl entry', !!owlId, String(owlId));

/* =============== FIX 5: notes textarea auto-grows =============== */
const LONG_NOTE = 'Heard first, a five-note bass line rolling out of the hemlocks well before dark — then the whole silhouette turned its head almost all the way around and fixed on me. Ear tufts like torn paper against the last light. It sat completely still for twenty minutes while the crows lost their minds two trees over, then dropped off the branch without a single wingbeat sound and was gone across the gorge. Absolute chills.';
await page.goto(`${BASE}/#/entry/${owlId}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
async function setNote(p, text) {
  await p.evaluate(t => {
    const ta = document.querySelector('#edit-notes');
    ta.value = t;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await p.waitForTimeout(900); // debounce save
}
await setNote(page, LONG_NOTE);
let m = await page.evaluate(() => {
  const ta = document.querySelector('#edit-notes');
  return { scrollH: ta.scrollHeight, clientH: ta.clientHeight, len: ta.value.length, overflowRight: ta.scrollWidth > ta.clientWidth + 1 };
});
check('[fix5] phone: 400+ char note fully visible, no inner scroll', m.scrollH <= m.clientH + 4 && !m.overflowRight, JSON.stringify(m));
await page.screenshot({ path: outDir + 'checker5-fix5-phone-longnote.png', fullPage: true });

const tabletPage = await (await browser.newContext(TABLET)).newPage();
tabletPage.on('pageerror', e => { pageErrors.push('tablet: ' + e.message); });
await tabletPage.goto(`${BASE}/#/entry/${owlId}`, { waitUntil: 'domcontentloaded' });
await tabletPage.waitForTimeout(900);
m = await tabletPage.evaluate(() => {
  const ta = document.querySelector('#edit-notes');
  return ta ? { scrollH: ta.scrollHeight, clientH: ta.clientHeight, len: ta.value.length } : null;
});
check('[fix5] tablet: saved long note fully visible, no inner scroll', m && m.len > 300 && m.scrollH <= m.clientH + 4, JSON.stringify(m));
await tabletPage.screenshot({ path: outDir + 'checker5-fix5-tablet-longnote.png', fullPage: true });
await tabletPage.context().close();

/* =============== FIX 4: share card with long notes =============== */
const dlPromise = page.waitForEvent('download', { timeout: 15000 });
await page.click('#share');
let dlPath = null;
try {
  const dl = await dlPromise;
  dlPath = outDir + 'checker5-fix4-sharecard-long.png';
  await dl.saveAs(dlPath);
  check('[fix4] share produced a PNG download', true, dl.suggestedFilename());
} catch (e) {
  check('[fix4] share produced a PNG download', false, e.message.slice(0, 120));
}

/* adversarial: one giant unbroken word */
await setNote(page, 'Superextraordinarilylongunbrokenobservationword'.repeat(4) + ' plus a tail of normal words after the monster token to see wrapping behaviour');
const dl2Promise = page.waitForEvent('download', { timeout: 15000 });
await page.click('#share');
try {
  const dl2 = await dl2Promise;
  await dl2.saveAs(outDir + 'checker5-fix4-sharecard-longword.png');
  check('[fix4] share with unbroken 180-char word produced a PNG', true);
} catch (e) {
  check('[fix4] share with unbroken word produced a PNG', false, e.message.slice(0, 120));
}
// restore a sane note
await setNote(page, LONG_NOTE);

/* =============== FIX 7: delete dialog dismissal =============== */
const overlayCount = () => page.evaluate(() => document.querySelectorAll('#overlay-root .celebrate-overlay, .celebrate-overlay').length);
// (a) Escape
await page.click('#delete');
await page.waitForTimeout(400);
check('[fix7] delete dialog opens', await overlayCount() === 1);
await page.screenshot({ path: outDir + 'checker5-fix7-dialog.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('[fix7] Escape closes delete dialog', await overlayCount() === 0);
// (b) backdrop click
await page.click('#delete');
await page.waitForTimeout(400);
await page.evaluate(() => {
  const ov = document.querySelector('.celebrate-overlay');
  ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); // target === overlay
});
await page.waitForTimeout(300);
check('[fix7] backdrop click closes delete dialog', await overlayCount() === 0);
// also a real click near the top-left corner (backdrop area)
await page.click('#delete');
await page.waitForTimeout(400);
await page.mouse.click(10, 100);
await page.waitForTimeout(300);
check('[fix7] real corner click closes delete dialog', await overlayCount() === 0);
// (c) navigate away
await page.click('#delete');
await page.waitForTimeout(400);
await page.evaluate(() => { location.hash = '#/life'; });
await page.waitForTimeout(700);
const leftovers = await page.evaluate(() => ({
  overlays: document.querySelectorAll('.celebrate-overlay').length,
  overlayRootChildren: document.getElementById('overlay-root').children.length,
}));
check('[fix7] navigation leaves no overlay anywhere', leftovers.overlays === 0 && leftovers.overlayRootChildren === 0, JSON.stringify(leftovers));
// leftover keydown listener must not blow up or delete anything
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const owlStill = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').getAll();
    t.onsuccess = () => res(t.result.some(s => s.speciesKey === 'bubo-virginianus'));
  };
}));
check('[fix7] Escape after navigation is inert (entry not deleted, no error)', owlStill);
await page.screenshot({ path: outDir + 'checker5-fix7-after-nav.png' });

/* delete dialog still actually deletes (did the fix break the happy path?) */
await page.goto(`${BASE}/#/entry/${owlId}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
await page.click('#delete');
await page.waitForTimeout(400);
await page.click('#del-yes');
await page.waitForTimeout(700);
const owlGone = await page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('field-journal');
  rq.onsuccess = () => {
    const t = rq.result.transaction('sightings').objectStore('sightings').getAll();
    t.onsuccess = () => res(!t.result.some(s => s.speciesKey === 'bubo-virginianus'));
  };
}));
check('[fix7] happy path still deletes the entry', owlGone);

/* =============== FIX 6: map pins fan out + legend =============== */
await page.goto(`${BASE}/?seed=demo#/map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
const pins = await page.evaluate(() => {
  return [...document.querySelectorAll('.map-pin')].map(p => {
    const m = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(p.getAttribute('transform') || '');
    return { id: p.dataset.id, x: m ? +m[1] : null, y: m ? +m[2] : null, label: p.getAttribute('aria-label') };
  });
});
check('[fix6] map has pins', pins.length >= 10, `${pins.length} pins`);
let minDist = Infinity, worstPair = '';
for (let i = 0; i < pins.length; i++) {
  for (let j = i + 1; j < pins.length; j++) {
    const d = Math.hypot(pins[i].x - pins[j].x, pins[i].y - pins[j].y);
    if (d < minDist) { minDist = d; worstPair = `${pins[i].label} vs ${pins[j].label}`; }
  }
}
check('[fix6] no overlapping pins (min pairwise distance >= 30 svg units)', minDist >= 30, `min=${minDist.toFixed(1)} (${worstPair})`);
const legendInfo = await page.evaluate(() => {
  const h = [...document.querySelectorAll('h3')].find(x => /pinned species/i.test(x.textContent));
  const chips = [...document.querySelectorAll('[data-entry]')];
  return { heading: !!h, chips: chips.length, sample: chips.slice(0, 3).map(c => c.textContent.replace(/\s+/g, ' ').trim()) };
});
check('[fix6] "Pinned species" legend present with species names', legendInfo.heading && legendInfo.chips >= 5, JSON.stringify(legendInfo));
await page.screenshot({ path: outDir + 'checker5-fix6-map.png', fullPage: true });
// legend chip click opens an entry
await page.locator('[data-entry]').first().click();
await page.waitForTimeout(800);
const hashNow = await page.evaluate(() => location.hash);
const entryOpened = /^#\/entry\//.test(hashNow) && (await page.locator('.detail-title').count()) > 0;
check('[fix6] clicking a legend chip opens the entry page', entryOpened, hashNow);
await page.screenshot({ path: outDir + 'checker5-fix6-legend-entry.png' });
// pin click too
await page.goto(`${BASE}/#/map`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await page.locator('.map-pin').first().dispatchEvent('click');
await page.waitForTimeout(700);
check('[fix6] clicking a pin opens an entry', /^#\/entry\//.test(await page.evaluate(() => location.hash)));

check('no uncaught page errors during UI attacks', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
