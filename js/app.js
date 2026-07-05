/* app.js — boot, hash router, painted bottom navigation. */

import * as store from './store.js';
import { initQueue, onQueueEvent, checkHealth } from './identify.js';
import { el, icon, washSVG, splatSVG, toast, PIGMENT } from './ui/kit.js';
import { panelSVG } from './art/paint.js';

import { renderJournal } from './ui/journal.js';
import { renderSpot, leaveSpot } from './ui/spot.js';
import { renderEntry } from './ui/entry.js';
import { renderLife } from './ui/life.js';
import { renderMap } from './ui/map.js';
import { renderAlmanac } from './ui/almanac.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');

const routes = [
  { match: /^#?\/?$/, render: renderJournal, nav: 'journal' },
  { match: /^#\/journal/, render: renderJournal, nav: 'journal' },
  { match: /^#\/spot/, render: renderSpot, nav: 'spot' },
  { match: /^#\/entry\/(.+)$/, render: (c, m) => renderEntry(c, m[1]), nav: 'journal' },
  { match: /^#\/life/, render: renderLife, nav: 'life' },
  { match: /^#\/map/, render: renderMap, nav: 'map' },
  { match: /^#\/almanac/, render: renderAlmanac, nav: 'almanac' },
];

let currentNav = 'journal';

async function route() {
  leaveSpot(); // stop any camera stream when navigating away
  const hash = location.hash || '#/';
  const r = routes.find(x => x.match.test(hash)) || routes[0];
  const m = hash.match(r.match);
  currentNav = r.nav;
  app.innerHTML = '';
  const screen = el('<main class="screen"></main>');
  app.appendChild(screen);
  await r.render(screen, m);
  paintNav();
  window.scrollTo(0, 0);
}

const NAV_ITEMS = [
  { id: 'journal', label: 'Journal', icon: 'journal', href: '#/' },
  { id: 'life', label: 'Life List', icon: 'feather', href: '#/life' },
  { id: 'spot', label: 'Spot', icon: 'binoculars', href: '#/spot', big: true },
  { id: 'map', label: 'Map', icon: 'map', href: '#/map' },
  { id: 'almanac', label: 'Almanac', icon: 'sun', href: '#/almanac' },
];

function paintNav() {
  nav.innerHTML = `<span class="nav-paper" aria-hidden="true">${panelSVG({ w: 420, h: 88, seed: 'navbar', fill: '#f0e8d2', ink: '#5b5140', inkOpacity: 0.4, wobble: 0.02, inset: 3 })}</span>` +
    NAV_ITEMS.map(item => {
      if (item.big) {
        return `<button class="nav-spot" data-href="${item.href}" aria-label="${item.label} a bird">
          <span class="spot-seal">${washSVG({ w: 66, h: 66, seed: 'spot-seal', color: PIGMENT.rust, opacity: 0.92, wobble: 0.13, inset: 5 })}${icon(item.icon)}</span>
          <span class="lbl">${item.label}</span>
        </button>`;
      }
      const active = currentNav === item.id;
      return `<button class="nav-btn ${active ? 'active' : ''}" data-href="${item.href}" aria-label="${item.label}" ${active ? 'aria-current="page"' : ''}>
        <span class="nav-blob">${washSVG({ w: 44, h: 34, seed: 'nav-' + item.id, color: PIGMENT.ochre, opacity: 0.38, wobble: 0.2, inset: 4 })}</span>
        ${icon(item.icon)}<span>${item.label}</span>
      </button>`;
    }).join('');
  nav.querySelectorAll('[data-href]').forEach(b =>
    b.addEventListener('click', () => { location.hash = b.dataset.href; }));
}

async function boot() {
  await store.load();

  // dev/demo seeding: ?seed=demo fills the journal with sample sightings
  const params = new URLSearchParams(location.search);
  if (params.get('seed')) {
    const { seedDemo, clearAll } = await import('./seed.js');
    if (params.get('seed') === 'clear') await clearAll();
    else await seedDemo(params.get('seed'));
    history.replaceState(null, '', location.pathname + (location.hash || '#/'));
  }

  window.addEventListener('hashchange', route);
  await route();

  initQueue();
  onQueueEvent(evt => {
    if (evt.type === 'identified') {
      const s = evt.sighting;
      if (s.idStatus === 'needs_confirm') {
        toast(`Identified: likely ${s.candidates[0].commonName} — tap the entry to confirm`, 4200);
      } else if (s.idStatus === 'not_bird') {
        toast('One photo turned out not to be a bird', 3600);
      }
      if (currentNav === 'journal' && !/^#\/entry/.test(location.hash)) route();
    }
  });

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('sw', e); }
  }
}

boot();
