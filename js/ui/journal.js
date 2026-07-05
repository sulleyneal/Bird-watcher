/* journal.js — the home screen: your growing field journal. */

import * as store from '../store.js';
import { el, esc, icon, panelBg, chip, headUnderline, washBtn, PIGMENT } from './kit.js';
import { birdSVG } from '../art/birds.js';
import { idMode, onModeChange, queuedCount } from '../identify.js';

export async function renderJournal(screen) {
  const sightings = store.getSightings().filter(s => s.idStatus !== 'not_bird');
  const st = store.stats();
  const season = store.seasonName();

  screen.innerHTML = `
    <header class="page-head">
      <h1>Field Journal</h1>
      ${st.streak > 1 ? chip(`${st.streak}-day streak`, PIGMENT.rust, { icon: 'tally' }) : ''}
    </header>
    ${headUnderline(PIGMENT.moss, 'home-underline')}
    <p class="muted" style="margin:0 2px 6px">${season} · ${st.speciesCount} species · ${st.totalSightings} sighting${st.totalSightings === 1 ? '' : 's'}</p>
    <div id="mode-note"></div>
    <div id="entries"></div>
  `;

  const entries = screen.querySelector('#entries');

  if (!sightings.length) {
    entries.appendChild(el(`<div class="empty-state">
      ${icon('binoculars')}
      <h2>No birds yet</h2>
      <p>Step outside, keep your ears open, and press <strong>Spot</strong> when a bird finds you.</p>
      ${washBtn('Spot your first bird', { color: PIGMENT.rust, icon: 'binoculars', id: 'first-spot', w: 250 })}
      ${window.__DEMO_LOCAL__ ? `<div style="margin-top:10px"><button class="link-hand" id="demo-fill">…or leaf through a sample journal</button></div>` : ''}
    </div>`));
    entries.querySelector('#first-spot').addEventListener('click', () => { location.hash = '#/spot'; });
    const fill = entries.querySelector('#demo-fill');
    if (fill) fill.addEventListener('click', async () => {
      fill.textContent = 'painting the pages…';
      const { seedDemo } = await import('../seed.js');
      await seedDemo('demo');
      renderJournal(screen);
    });
  } else {
    let lastMonth = '';
    sightings.forEach((s, i) => {
      const mo = s.dateISO.slice(0, 7);
      if (mo !== lastMonth) {
        lastMonth = mo;
        const d = new Date(s.dateISO);
        entries.appendChild(el(`<h3 class="script" style="font-size:1.5rem;margin:20px 2px 0;color:var(--ink-soft)">${d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>`));
      }
      entries.appendChild(entryCard(s, i));
    });
  }

  paintModeNote(screen);
  onModeChange(() => paintModeNote(screen));
}

function paintModeNote(screen) {
  const note = screen.querySelector('#mode-note');
  if (!note) return;
  const q = queuedCount();
  const parts = [];
  if (!navigator.onLine && q) {
    parts.push(`<span class="ribbon">${panelBg('offline-ribbon', { w: 250, h: 34 })}${icon('cloud')} ${q} sighting${q === 1 ? '' : 's'} waiting for a connection to be identified</span>`);
  }
  if (idMode() === 'mock') {
    parts.push(`<span class="ribbon">${panelBg('mock-ribbon', { w: 250, h: 34 })}${icon('question')} demo identification mode — set an API key for real IDs</span>`);
  }
  note.innerHTML = parts.join(' ');
}

export function entryCard(s, i = 0) {
  const tilt = i % 2 ? 'card-tilt-r' : 'card-tilt-l';
  const confirmed = s.idStatus === 'confirmed';
  const art = confirmed ? store.artFor(s.speciesKey) : null;
  const name = confirmed ? s.commonName
    : s.idStatus === 'needs_confirm' ? 'Who was this?'
    : s.idStatus === 'unclear' ? 'Too quick to tell'
    : 'Awaiting identification…';
  const rarity = confirmed && s.rarity && s.rarity !== 'common'
    ? chip(store.RARITY_LABEL[s.rarity], store.RARITY_COLOR[s.rarity], { icon: 'sparkle' }) : '';
  const pending = s.idStatus === 'queued'
    ? `<span class="pending-note">${icon('cloud')} ${navigator.onLine ? 'waiting for the guide — retrying shortly' : 'will identify when back online'}</span>`
    : s.idStatus === 'needs_confirm'
      ? `<span class="pending-note">${icon('question')} tap to confirm — likely ${esc(s.candidates && s.candidates[0] ? s.candidates[0].commonName : 'a bird')}</span>`
      : s.idStatus === 'unclear' ? `<span class="pending-note">${icon('question')} tap to take another look</span>` : '';

  const card = el(`<a class="entry-card ${tilt}" href="#/entry/${s.id}">
    ${panelBg('card-' + s.id, { w: 340, h: 150 })}
    <div class="entry-row">
      <div class="entry-art">${art ? birdSVG(art, { seed: s.speciesKey + '-' + (s.id.slice(-3)) }) : mysteryArt(s.id)}</div>
      <div class="entry-main">
        <p class="entry-name">${esc(name)}</p>
        ${confirmed ? `<span class="sci">${esc(s.sciName)}</span>` : ''}
        <div class="entry-meta">${esc(store.formatDate(s.dateISO))}${s.place ? ` · ${esc(s.place)}` : ''}</div>
        ${s.notes ? `<div class="entry-notes">“${esc(s.notes)}”</div>` : ''}
        <div class="entry-flags">${rarity}${pending}</div>
      </div>
      ${s.photo ? `<img class="entry-photo" src="${s.photo}" alt="Photo of this sighting">` : ''}
    </div>
  </a>`);
  return card;
}

/* Placeholder art for entries that aren't identified yet: an inked
   question-mark egg in a wash — still hand-painted, never a grey box. */
function mysteryArt(seed) {
  return `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-label="Unidentified bird">
    <g transform="translate(48,44) scale(3.9)" opacity="0.85">${icon('egg').replace(/<\/?svg[^>]*>/g, '')}</g>
  </svg>`;
}
