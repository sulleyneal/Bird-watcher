/* entry.js — a single journal page: the full spread for one sighting,
   plus a shareable painted card (PNG) and note editing. */

import * as store from '../store.js';
import { el, esc, icon, panelBg, chip, headUnderline, washBtn, ghostBtn, toast, PIGMENT } from './kit.js';
import { birdSVG } from '../art/birds.js';
import { fmtCoords } from '../geo.js';
import { showResultStep } from './spot.js';
import { panelSVG, washSVG } from '../art/paint.js';

export async function renderEntry(screen, id) {
  const s = store.getSighting(id);
  if (!s) {
    screen.innerHTML = `<div class="empty-state">${icon('question')}<h2>That page fluttered away</h2>
      <p>This entry doesn't exist any more.</p>${washBtn('Back to journal', { color: PIGMENT.moss, id: 'back-home', w: 200 })}</div>`;
    screen.querySelector('#back-home').addEventListener('click', () => { location.hash = '#/'; });
    return;
  }

  const backBtn = `<button class="link-hand" id="back" style="display:inline-flex;align-items:center;gap:4px">${icon('back')} journal</button>`;

  if (s.idStatus !== 'confirmed') {
    screen.innerHTML = `${backBtn}
      <header class="page-head"><h1>${s.idStatus === 'queued' ? 'Waiting on the wire' : 'Who was this?'}</h1></header>
      ${headUnderline(PIGMENT.teal, 'entry-underline')}
      <div style="text-align:center;margin:10px 0"><div class="photo-frame" style="max-width:70%"><img src="${s.photo}" alt="Sighting photo"></div></div>
      <div id="resolve-stage"></div>`;
    screen.querySelector('#back').addEventListener('click', () => { location.hash = '#/'; });
    const stage = screen.querySelector('#resolve-stage');
    if (s.idStatus === 'queued') {
      stage.innerHTML = `<div class="empty-state" style="padding-top:8px">
        <p class="muted">This sighting is saved and will be identified automatically when a connection is available.</p>
        <div class="btn-row" style="justify-content:center">${washBtn('Name it myself', { color: PIGMENT.teal, icon: 'pencil', id: 'name-now', w: 200 })}
        ${ghostBtn('Delete this entry', { id: 'del-q' })}</div></div>`;
      stage.querySelector('#name-now').addEventListener('click', async () => {
        const { showManualStep } = await import('./spot.js');
        showManualStep(stage, s, () => renderEntry(screen, id));
      });
      stage.querySelector('#del-q').addEventListener('click', () => confirmDelete(s));
    } else {
      showResultStep(stage, s, () => { renderEntry(screen, id); });
    }
    return;
  }

  const art = store.artFor(s.speciesKey);
  const sp = store.getSpeciesByKey(s.speciesKey);
  const rarity = s.rarity || (sp && sp.rarity) || 'common';

  screen.innerHTML = `
    ${backBtn}
    <div class="entry-hero">
      <div class="entry-art-lg">${birdSVG(art, { seed: s.speciesKey + '-hero' })}</div>
      <h1 class="detail-title">${esc(s.commonName)}</h1>
      <div class="sci">${esc(s.sciName)}</div>
      <div style="margin-top:8px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        ${chip(store.RARITY_LABEL[rarity], store.RARITY_COLOR[rarity], { icon: 'sparkle' })}
        ${sp ? chip(`sighting ${countOrdinal(s, sp)} of ${sp.count}`, PIGMENT.slate) : ''}
      </div>
    </div>

    <div class="meta-lines">
      <div class="meta-line">${icon('sun')} ${esc(store.formatDate(s.dateISO))}</div>
      ${s.place || (s.lat != null) ? `<div class="meta-line">${icon('pin')} ${esc(s.place || '')}${s.place && s.lat != null ? ' · ' : ''}${s.lat != null ? esc(fmtCoords(s.lat, s.lon)) : ''}</div>` : ''}
    </div>

    ${s.photo ? `<div style="text-align:center;margin:16px 0"><div class="photo-frame" style="max-width:82%"><img src="${s.photo}" alt="Photo of the ${esc(s.commonName)}"></div></div>` : ''}

    <div class="panel">
      ${panelBg('notes-' + s.id, { w: 340, h: 130 })}
      <label class="small muted" style="text-transform:uppercase;letter-spacing:.06em">My field notes ${icon('pencil')}</label>
      <div class="field" style="margin:4px 0 0"><textarea id="edit-notes" rows="3" placeholder="scratch something down…">${esc(s.notes || '')}</textarea></div>
    </div>

    ${s.fieldNotes ? `<div class="panel card-tilt-r">${panelBg('ai-notes-' + s.id, { w: 340, h: 110 })}
      <p class="small muted" style="margin:0;text-transform:uppercase;letter-spacing:.06em">From the guide</p>
      <p style="margin:6px 0 0;font-style:italic">“${esc(s.fieldNotes)}”</p></div>` : ''}

    <div class="btn-row" style="justify-content:center;margin-top:20px">
      ${washBtn('Share this page', { color: PIGMENT.plum, icon: 'share', id: 'share', w: 210 })}
      ${ghostBtn('Delete entry', { id: 'delete' })}
    </div>
    <p class="small muted" style="text-align:center" id="share-hint"></p>
  `;

  screen.querySelector('#back').addEventListener('click', () => { location.hash = '#/'; });

  const notesEl = screen.querySelector('#edit-notes');
  let saveTimer = null;
  notesEl.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      s.notes = notesEl.value.trim();
      await store.saveSighting(s);
    }, 500);
  });

  screen.querySelector('#delete').addEventListener('click', () => confirmDelete(s));
  screen.querySelector('#share').addEventListener('click', async () => {
    const hint = screen.querySelector('#share-hint');
    hint.textContent = 'Painting your card…';
    try {
      await shareCard(s, art);
      hint.textContent = '';
    } catch (e) {
      console.error(e);
      hint.textContent = 'Could not paint the card on this device.';
    }
  });
}

function countOrdinal(s, sp) {
  const all = store.getSightings().filter(x => x.speciesKey === s.speciesKey && x.idStatus === 'confirmed')
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const i = all.findIndex(x => x.id === s.id);
  return i >= 0 ? `#${i + 1}` : '#?';
}

function confirmDelete(s) {
  const overlay = el(`<div class="celebrate-overlay">
    <div class="celebrate-card" style="max-width:300px">
      ${panelBg('del-confirm', { w: 300, h: 200 })}
      <h2 style="font-size:1.7rem">Tear out this page?</h2>
      <p class="muted small">The sighting and photo will be gone for good.</p>
      <div class="btn-row" style="justify-content:center;margin-top:12px">
        ${washBtn('Tear it out', { color: PIGMENT.berry, icon: 'trash', id: 'del-yes', w: 170 })}
        ${ghostBtn('Keep it', { id: 'del-no' })}
      </div>
    </div></div>`);
  overlay.querySelector('#del-no').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#del-yes').addEventListener('click', async () => {
    await store.deleteSighting(s.id);
    overlay.remove();
    toast('Page removed');
    location.hash = '#/';
  });
  document.getElementById('overlay-root').appendChild(overlay);
}

/* ---------------- shareable card ---------------- */

let fontCSSCache = null;
async function embeddedFontCSS() {
  if (fontCSSCache) return fontCSSCache;
  const load = async (path) => {
    const buf = await (await fetch(path)).arrayBuffer();
    let bin = ''; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(bin);
  };
  const [caveat, alegreya, alegreyaIt] = await Promise.all([
    load('fonts/caveat-700.woff2'), load('fonts/alegreya-500.woff2'), load('fonts/alegreya-400-italic.woff2'),
  ]);
  fontCSSCache = `
    @font-face{font-family:'Caveat';font-weight:700;src:url(data:font/woff2;base64,${caveat}) format('woff2')}
    @font-face{font-family:'Alegreya';font-weight:500;src:url(data:font/woff2;base64,${alegreya}) format('woff2')}
    @font-face{font-family:'Alegreya';font-style:italic;font-weight:400;src:url(data:font/woff2;base64,${alegreyaIt}) format('woff2')}`;
  return fontCSSCache;
}

async function shareCard(s, art) {
  const W = 1080, H = 1350;
  const fontCSS = await embeddedFontCSS();
  const birdArt = birdSVG(art, { seed: s.speciesKey + '-share' });
  const dateLine = store.formatDate(s.dateISO);
  const placeLine = s.place || (s.lat != null ? fmtCoords(s.lat, s.lon) : '');
  const notes = (s.notes || s.fieldNotes || '').slice(0, 160);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>${fontCSS}
    .t{font-family:'Caveat';font-weight:700;fill:#42392b}
    .s{font-family:'Alegreya';font-style:italic;fill:#6b5f4c}
    .b{font-family:'Alegreya';font-weight:500;fill:#42392b}
  </style>
  <rect width="${W}" height="${H}" fill="#f5efdd"/>
  <g opacity="0.5">${stripSvg(washSVG({ w: W, h: H, seed: 'share-bg-' + s.id, color: '#e7dcbd', opacity: 0.5, wobble: 0.08, inset: 40 }))}</g>
  <g transform="translate(60,40)">${stripSvg(panelSVG({ w: 960, h: 1270, seed: 'share-panel-' + s.id, fill: '#faf5e6', wobble: 0.012 }))}</g>
  <g transform="translate(240,90) scale(2.75)">${stripSvg(birdArt)}</g>
  <text x="${W / 2}" y="780" text-anchor="middle" class="t" font-size="92">${escXML(s.commonName)}</text>
  <text x="${W / 2}" y="838" text-anchor="middle" class="s" font-size="40">${escXML(s.sciName || '')}</text>
  ${s.photo ? `<g transform="translate(120,880) rotate(-2)">
     <rect x="-14" y="-14" width="288" height="288" fill="#fdfaf1" stroke="#d8cfb4"/>
     <image href="${s.photo}" x="0" y="0" width="260" height="260" preserveAspectRatio="xMidYMid slice"/>
   </g>` : ''}
  <text x="${s.photo ? 440 : 140}" y="940" class="b" font-size="36">${escXML(dateLine)}</text>
  ${placeLine ? `<text x="${s.photo ? 440 : 140}" y="994" class="b" font-size="36">${escXML(placeLine)}</text>` : ''}
  ${notes ? `<text x="${s.photo ? 440 : 140}" y="1064" class="t" font-size="46">${escXML('“' + notes + '”')}</text>` : ''}
  <text x="${W / 2}" y="1268" text-anchor="middle" class="s" font-size="32">— from my Field Journal —</text>
</svg>`;

  const png = await svgToPNG(svg, W, H);
  const file = new File([png], `${(s.commonName || 'bird').replace(/\W+/g, '-').toLowerCase()}-journal-page.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: s.commonName });
      return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(png);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Journal card saved as an image');
}

function stripSvg(svg) { return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''); }
function escXML(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

function svgToPNG(svg, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg render failed')); };
    img.src = url;
  });
}
