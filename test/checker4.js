/* checker4.js — adversarial design re-check, cycle 2. */
import { launch, PHONE, TABLET } from './browser.js';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:8787';
const out = fileURLToPath(new URL('./shots/', import.meta.url));
const jpg = fileURLToPath(new URL('./tmp/bird.jpg', import.meta.url));
const browser = await launch();

const shot = (page, name, opts = {}) => page.screenshot({ path: `${out}checker4-${name}.png`, ...opts });

// ---------- PHONE ----------
{
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

  // 1. search input: type char-by-char, close-up of input + report native cancel-button state
  await page.goto(`${BASE}/?seed=states#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const pending = page.locator('.entry-card:has-text("Who was this?")').first();
  await pending.click();
  await page.waitForTimeout(900);
  await page.click('#manual');
  await page.waitForTimeout(400);
  await page.click('#f-species');
  await page.keyboard.type('Cardin', { delay: 60 });
  await page.waitForTimeout(600);
  const box = await page.locator('#f-species').boundingBox();
  await shot(page, 'phone-search-typed-closeup', { clip: { x: 0, y: box.y - 60, width: 390, height: 200 } });
  await shot(page, 'phone-search-typed-full');
  const cancelBtn = await page.evaluate(() => {
    const i = document.querySelector('#f-species');
    const cs = getComputedStyle(i, '::-webkit-search-cancel-button');
    return { type: i.type, display: cs.display, appearance: cs.webkitAppearance || cs.appearance };
  });
  console.log('search cancel-button:', JSON.stringify(cancelBtn));

  // focused search input close-up (focus ring check on input)
  await shot(page, 'phone-search-focused-closeup', { clip: { x: 0, y: box.y - 100, width: 390, height: 260 } });

  // 2. selection highlight — select the field notes text
  await page.evaluate(() => {
    const h = document.querySelector('h1, h2');
    const r = document.createRange(); r.selectNodeContents(document.body);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await page.waitForTimeout(300);
  await shot(page, 'phone-selection');
  await page.evaluate(() => getSelection().removeAllRanges());

  // 3. Tab focus walk: screenshot first 8 focus stops on journal
  await page.goto(`${BASE}/?seed=demo#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  for (let i = 1; i <= 8; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    if (i === 1 || i === 4 || i === 6 || i === 8) {
      const info = await page.evaluate(() => {
        const a = document.activeElement;
        const cs = getComputedStyle(a);
        return { tag: a.tagName, cls: a.className && a.className.baseVal !== undefined ? '(svg)' : String(a.className).slice(0, 40), outline: cs.outlineStyle + ' ' + cs.outlineColor };
      });
      console.log(`focus stop ${i}:`, JSON.stringify(info));
      await shot(page, `phone-tabfocus-${i}`);
    }
  }

  // 4. delete dialog: open, shot, Escape, shot, reopen, backdrop click, shot
  const card = page.locator('.entry-card:not(:has-text("Who was this?")):not(:has-text("Awaiting"))').first();
  await card.click();
  await page.waitForTimeout(900);
  await page.locator('#delete').click();
  await page.waitForTimeout(500);
  await shot(page, 'phone-delete-dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  console.log('overlay after Escape:', await page.locator('.celebrate-overlay').count());
  await shot(page, 'phone-delete-after-escape');
  await page.locator('#delete').click();
  await page.waitForTimeout(400);
  await page.mouse.click(195, 100); // backdrop
  await page.waitForTimeout(400);
  console.log('overlay after backdrop click:', await page.locator('.celebrate-overlay').count());
  await shot(page, 'phone-delete-after-backdrop');

  // focus the Delete entry + Share buttons
  await page.locator('#share') && null;

  // 5. entry page scrolled to bottom (nav bleed check)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, 'phone-entry-bottom');

  // 6. capture flow: upload → review (focused notes textarea) → identify wait → result → confirm → celebration → toast
  await page.goto(`${BASE}/#/spot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.setInputFiles('#file-input', jpg);
  await page.waitForTimeout(1000);
  await shot(page, 'phone-review');
  const notes = page.locator('#f-notes');
  if (await notes.count()) {
    await notes.click();
    await page.keyboard.type('Rust-red flash in the hedge', { delay: 20 });
    await page.waitForTimeout(300);
    await shot(page, 'phone-review-notes-typed');
  }
  const place = page.locator('#f-place');
  if (await place.count()) {
    await place.click();
    await page.waitForTimeout(200);
    await shot(page, 'phone-review-place-focused');
  }
  // identify
  const idBtn = page.locator('button:has-text("Identify"), #identify');
  await idBtn.first().click();
  await page.waitForTimeout(600);
  await shot(page, 'phone-identify-wait');
  await page.waitForTimeout(4000);
  await shot(page, 'phone-result');
  // confirm (first wash button on result)
  const confirmBtn = page.locator('#confirm, button:has-text("Add to journal"), button:has-text("That’s the one")');
  if (await confirmBtn.count()) {
    await confirmBtn.first().click();
    await page.waitForTimeout(700);
    await shot(page, 'phone-celebration');
    await page.waitForTimeout(2600);
    await shot(page, 'phone-post-celebration-toast');
  } else {
    console.log('no confirm button found on result');
  }

  await ctx.close();
}

// ---------- PHONE empty states ----------
{
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?seed=clear#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  for (const [hash, name] of [['#/', 'journal'], ['#/life', 'life'], ['#/map', 'map'], ['#/almanac', 'almanac'], ['#/spot', 'spot']]) {
    await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await shot(page, `phone-empty-${name}`);
  }
  await ctx.close();
}

// ---------- TABLET ----------
{
  const ctx = await browser.newContext(TABLET);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

  // spot with camera during identify (frame containment under motion)
  await page.goto(`${BASE}/?seed=demo#/spot`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, 'tablet-spot-camera');
  await page.setInputFiles('#file-input', jpg);
  await page.waitForTimeout(900);
  await shot(page, 'tablet-review');
  // typed search on tablet
  const idBtn = page.locator('button:has-text("Identify"), #identify');
  await idBtn.first().click();
  await page.waitForTimeout(600);
  await shot(page, 'tablet-identify-wait');
  await page.waitForTimeout(4200);
  await shot(page, 'tablet-result');

  // delete dialog on tablet
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const card = page.locator('.entry-card:not(:has-text("Who was this?")):not(:has-text("Awaiting"))').first();
  await card.click();
  await page.waitForTimeout(900);
  await page.locator('#delete').click();
  await page.waitForTimeout(500);
  await shot(page, 'tablet-delete-dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // lifelist scrolled to badges
  await page.goto(`${BASE}/#/life`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, 'tablet-life-bottom');

  // almanac scrolled mid (nav bleed on tablet)
  await page.goto(`${BASE}/#/almanac`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(400);
  await shot(page, 'tablet-almanac-scrolled');

  await ctx.close();
}

await browser.close();
console.log('checker4 done');
