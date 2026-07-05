/* almanac.js — "birds likely near you this week": a seasonal checklist
   built from the field guide's month ranges, checked off against your
   own journal. */

import * as store from '../store.js';
import { esc, icon, panelBg, chip, headUnderline, PIGMENT } from './kit.js';
import { birdSVG } from '../art/birds.js';

export async function renderAlmanac(screen) {
  const month = new Date().getMonth() + 1;
  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });
  const season = store.seasonName(month);
  const likely = store.likelyThisMonth(month);
  const seenCount = likely.filter(l => l.seenThisMonth).length;

  screen.innerHTML = `
    <header class="page-head"><h1>Almanac</h1>${chip(season, seasonColor(season), { icon: 'sun' })}</header>
    ${headUnderline(PIGMENT.ochre, 'alm-underline')}
    <p class="muted" style="margin:0 2px 4px">Birds likely near you in ${monthName} — ${seenCount} of ${likely.length} checked off this month.</p>
    <div class="panel" style="margin-top:14px">
      ${panelBg('alm-progress', { w: 340, h: 60 })}
      ${progressTallies(seenCount, likely.length)}
    </div>
    <div id="alm-rows"></div>
    <p class="small muted" style="margin-top:18px">The almanac keeps a northern-temperate calendar. It checks a species off when you record it in the same month.</p>
  `;

  const rows = screen.querySelector('#alm-rows');
  rows.innerHTML = likely.map((sp, i) => `
    <div class="week-row ${i % 2 ? 'card-tilt-r' : 'card-tilt-l'}">
      ${panelBg('alm-' + sp.key, { w: 340, h: 74, fill: sp.seenThisMonth ? '#f2ecd6' : '#fbf6e8' })}
      <div class="entry-art">${birdSVG({ key: sp.key, ...sp }, { seed: 'alm-' + sp.key, withGround: false })}</div>
      <div style="min-width:0">
        <p class="entry-name" style="font-size:1.28rem;${sp.seenThisMonth ? 'text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:var(--rust)' : ''}">${esc(sp.common)}</p>
        <div class="small muted">${esc(sp.habitat)}</div>
        <div style="margin-top:3px">${sp.rarity !== 'common' ? chip(store.RARITY_LABEL[sp.rarity], store.RARITY_COLOR[sp.rarity]) : ''}
        ${sp.everSeen && !sp.seenThisMonth ? `<span class="small muted">on your life list</span>` : ''}</div>
      </div>
      <div class="seen-stamp">${sp.seenThisMonth ? icon('check', PIGMENT.rust) : `<span class="small muted">not yet</span>`}</div>
    </div>`).join('');
}

function progressTallies(done, total) {
  // groups-of-five tally marks, the naturalist's score-keeping
  const groups = [];
  let remaining = total, marked = done;
  while (remaining > 0) {
    const g = Math.min(5, remaining);
    const gDone = Math.max(0, Math.min(g, marked));
    groups.push({ g, gDone });
    remaining -= g; marked -= g;
  }
  return `<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
    ${groups.map((grp, gi) => tallyGroup(grp.g, grp.gDone, gi)).join('')}
    <span class="hand-lg" style="margin-left:auto">${done}/${total}</span>
  </div>`;
}

function tallyGroup(size, done, seed) {
  let s = `<svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true">`;
  for (let i = 0; i < Math.min(size, 4); i++) {
    const x = 5 + i * 7, on = i < done && !(done === 5 && size === 5);
    const active = i < done;
    s += `<path d="M${x} ${4 + (i % 2)} L${x - 1} ${26 - (i % 2)}" stroke="${active ? '#b0603f' : '#b9ad92'}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="${active ? 0.9 : 0.5}"/>`;
  }
  if (size === 5) {
    s += `<path d="M1 22 L33 7" stroke="${done >= 5 ? '#b0603f' : '#b9ad92'}" stroke-width="2.4" stroke-linecap="round" opacity="${done >= 5 ? 0.9 : 0.35}"/>`;
  }
  return s + '</svg>';
}

function seasonColor(season) {
  return { Winter: PIGMENT.slate, Spring: PIGMENT.moss, Summer: PIGMENT.ochre, Autumn: PIGMENT.rust }[season] || PIGMENT.moss;
}
