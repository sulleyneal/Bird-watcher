/* checker6-flip.js — bar test C: flip-through demo journal at phone + tablet.
   Checks entry completeness, horizontal overflow, and page errors. */
import { launch, PHONE, TABLET } from './browser.js';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:8787';
const outDir = fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(outDir, { recursive: true });
let failures = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`); if (!ok) failures++; };

const browser = await launch();

async function flip(ctxOpts, label) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => { errs.push(e.message); console.log(`[${label}] PAGE ERROR:`, e.message); });

  const noHScroll = async (name) => {
    const m = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth, win: window.innerWidth,
    }));
    check(`[${label}] ${name}: no horizontal overflow`, m.doc <= m.win + 1, JSON.stringify(m));
  };

  await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  /* journal */
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('.entry-card')].map(c => ({
      hasArt: !!c.querySelector('svg'),
      text: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
      hasDate: /\b(20\d\d|AM|PM)\b/.test(c.textContent),
    })));
  check(`[${label}] journal has 18 entry cards`, cards.length === 18, `${cards.length}`);
  check(`[${label}] every journal card has an illustration`, cards.every(c => c.hasArt));
  check(`[${label}] every journal card carries a date`, cards.every(c => c.hasDate), JSON.stringify(cards.filter(c => !c.hasDate).slice(0, 2)));
  await noHScroll('journal');

  /* three entry pages */
  const ids = await page.evaluate(() => [...document.querySelectorAll('.entry-card')].slice(0, 8).map(c => (c.getAttribute('href') || '').replace('#/entry/', '')));
  const pick = [ids[0], ids[3], ids[7]].filter(Boolean);
  check(`[${label}] found 3 entry ids to open`, pick.length === 3, JSON.stringify(pick));
  let i = 0;
  for (const id of pick) {
    await page.goto(`${BASE}/#/entry/${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const d = await page.evaluate(() => ({
      title: (document.querySelector('.detail-title, h1, .cel-species') || {}).textContent || '',
      art: !!document.querySelector('svg'),
      date: /20\d\d/.test(document.body.textContent),
      metaLines: (document.querySelector('.meta-lines') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
      notes: (document.querySelector('#edit-notes') || {}).value || '',
      photo: (() => { const im = document.querySelector('.photo-frame img'); return im ? im.naturalWidth > 0 : false; })(),
    }));
    check(`[${label}] entry ${i + 1} complete (art/date/location/notes/photo)`,
      d.art && d.date && d.title.trim().length > 2 && d.metaLines.length > 5 && d.notes.length > 3 && d.photo,
      JSON.stringify({ t: d.title.trim(), meta: d.metaLines.slice(0, 50), n: d.notes.slice(0, 30), photo: d.photo }));
    await noHScroll(`entry ${i + 1}`);
    await page.screenshot({ path: `${outDir}checker6-flip-${label}-entry${i + 1}.png`, fullPage: true });
    i++;
  }

  /* life list */
  await page.goto(`${BASE}/#/life`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const life = await page.evaluate(() => ({
    rows: document.querySelectorAll('.life-row, .life-card, [class*="life"]').length,
    text: document.body.textContent,
  }));
  check(`[${label}] life list renders 16 species`, /16/.test(life.text) && life.rows >= 16, `${life.rows} rows`);
  await noHScroll('life list');
  await page.screenshot({ path: `${outDir}checker6-flip-${label}-life.png`, fullPage: true });

  /* map */
  await page.goto(`${BASE}/#/map`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const pins = await page.locator('.map-pin').count();
  check(`[${label}] map shows pins`, pins >= 10, `${pins}`);
  await noHScroll('map');
  await page.screenshot({ path: `${outDir}checker6-flip-${label}-map.png`, fullPage: true });

  /* almanac */
  await page.goto(`${BASE}/#/almanac`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const alm = await page.evaluate(() => document.body.textContent.includes('Almanac'));
  check(`[${label}] almanac renders`, alm);
  await noHScroll('almanac');
  await page.screenshot({ path: `${outDir}checker6-flip-${label}-almanac.png`, fullPage: true });

  check(`[${label}] no uncaught page errors during flip-through`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await flip(PHONE, 'phone');
await flip(TABLET, 'tablet');
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
