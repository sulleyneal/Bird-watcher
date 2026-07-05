/* life.js — the life list: every species you've ever met, plus streaks
   and wax-seal badges. */

import * as store from '../store.js';
import { el, esc, icon, panelBg, chip, headUnderline, washBtn, washSVG, PIGMENT } from './kit.js';
import { birdSVG } from '../art/birds.js';

export async function renderLife(screen) {
  const species = [...store.getSpecies()].sort((a, b) => a.firstSeenISO.localeCompare(b.firstSeenISO));
  const st = store.stats();
  const badgeList = store.badges();
  const earned = badgeList.filter(b => b.earned);

  screen.innerHTML = `
    <header class="page-head"><h1>Life List</h1></header>
    ${headUnderline(PIGMENT.teal, 'life-underline')}

    <div class="stat-strip">
      ${statBlob(st.speciesCount, 'species', PIGMENT.teal)}
      ${statBlob(st.totalSightings, 'sightings', PIGMENT.moss)}
      ${statBlob(st.streak, 'day streak', PIGMENT.rust)}
      ${statBlob(earned.length, 'badges', PIGMENT.ochre)}
    </div>

    <div id="life-rows"></div>

    <h2 style="font-size:1.8rem;margin:26px 2px 2px">Badges</h2>
    <div class="badge-grid">
      ${badgeList.map(b => `<div class="badge ${b.earned ? '' : 'locked'}" title="${esc(b.desc)}">
        <div class="seal">${washSVG({ w: 74, h: 74, seed: 'badge-' + b.id, color: b.color, opacity: b.earned ? 0.9 : 0.5, wobble: 0.16, inset: 6 })}${icon(b.icon)}</div>
        <div class="bname">${esc(b.name)}</div>
        <div class="small muted" style="line-height:1.15">${esc(b.desc)}</div>
      </div>`).join('')}
    </div>
  `;

  const rows = screen.querySelector('#life-rows');
  if (!species.length) {
    rows.appendChild(el(`<div class="empty-state">
      ${icon('feather')}
      <h2>An empty list is a promise</h2>
      <p>Every birder starts at zero. Your first species is waiting outside.</p>
      ${washBtn('Spot a bird', { color: PIGMENT.rust, icon: 'binoculars', id: 'go-spot', w: 190 })}
    </div>`));
    rows.querySelector('#go-spot').addEventListener('click', () => { location.hash = '#/spot'; });
    return;
  }

  species.forEach((sp, i) => {
    const art = store.artFor(sp);
    const latest = store.getSightings().find(s => s.speciesKey === sp.key && s.idStatus === 'confirmed');
    const row = el(`<a class="life-row ${i % 2 ? 'card-tilt-r' : 'card-tilt-l'}" href="#/entry/${latest ? latest.id : ''}">
      ${panelBg('life-' + sp.key, { w: 340, h: 84 })}
      <div class="entry-art">${birdSVG(art, { seed: sp.key + '-life', withGround: false })}</div>
      <div style="min-width:0">
        <p class="entry-name" style="font-size:1.35rem">${esc(sp.commonName)}</p>
        <span class="sci small">${esc(sp.sciName)}</span>
        <div class="entry-meta">first met ${esc(store.formatDate(sp.firstSeenISO, { withTime: false }))}</div>
        <div style="margin-top:4px">${sp.rarity !== 'common' ? chip(store.RARITY_LABEL[sp.rarity], store.RARITY_COLOR[sp.rarity]) : ''}</div>
      </div>
      <div class="life-count">${washSVG({ w: 46, h: 46, seed: 'count-' + sp.key, color: PIGMENT.sand, opacity: 0.5, wobble: 0.18, inset: 4 })}×${sp.count}</div>
    </a>`);
    rows.appendChild(row);
  });
}

function statBlob(num, label, color) {
  return `<div class="stat-blob">
    <svg class="bg" viewBox="0 0 100 70" preserveAspectRatio="none">${inner(washSVG({ w: 100, h: 70, seed: 'stat-' + label, color, opacity: 0.28, wobble: 0.14, inset: 6 }))}</svg>
    <div class="num">${num}</div><div class="lab">${label}</div>
  </div>`;
}
function inner(svg) { return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''); }
