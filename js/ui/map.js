/* map.js — a hand-painted sighting map. Not a tile map: a watercolor
   terrain sketch with your sightings plotted on it, so it works offline
   and stays inside the journal's world. */

import * as store from '../store.js';
import { el, esc, icon, headUnderline, washBtn, PIGMENT } from './kit.js';
import { rng, blobPath, inkLine, wcSoftFilter, wcFilter, nextId, hashString, mix } from '../art/paint.js';
import { splatSVG } from './kit.js';

export async function renderMap(screen) {
  const placed = store.getSightings().filter(s => s.idStatus === 'confirmed' && s.lat != null && s.lon != null);
  const unplaced = store.getSightings().filter(s => s.idStatus === 'confirmed' && (s.lat == null || s.lon == null));

  screen.innerHTML = `
    <header class="page-head"><h1>Sighting Map</h1></header>
    ${headUnderline(PIGMENT.slate, 'map-underline')}
    <div id="map-holder"></div>
    <div id="map-caption"></div>
  `;

  const holder = screen.querySelector('#map-holder');

  if (!placed.length) {
    holder.innerHTML = `<div class="empty-state">
      ${icon('map')}
      <h2>The map is still blank paper</h2>
      <p>${unplaced.length ? 'Your sightings so far don\'t carry a location — allow location when spotting and pins will bloom here.' : 'Record sightings with location on, and pins will bloom across this page.'}</p>
      ${washBtn('Spot a bird', { color: PIGMENT.rust, icon: 'binoculars', id: 'go-spot', w: 190 })}
    </div>`;
    holder.querySelector('#go-spot').addEventListener('click', () => { location.hash = '#/spot'; });
    return;
  }

  // Normalize coordinates into the painted region with padding.
  const lats = placed.map(s => s.lat), lons = placed.map(s => s.lon);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const padLat = Math.max((maxLat - minLat) * 0.25, 0.004);
  const padLon = Math.max((maxLon - minLon) * 0.25, 0.004);
  minLat -= padLat; maxLat += padLat; minLon -= padLon; maxLon += padLon;

  const W = 700, H = 560;
  const X = lon => 60 + (lon - minLon) / (maxLon - minLon) * (W - 120);
  const Y = lat => H - 70 - (lat - minLat) / (maxLat - minLat) * (H - 140);

  holder.innerHTML = `<div class="field-map">${terrainSVG(W, H, placed, X, Y)}</div>`;

  holder.querySelectorAll('.map-pin').forEach(pin => {
    pin.addEventListener('click', () => { location.hash = `#/entry/${pin.dataset.id}`; });
  });

  const spots = [...new Set(placed.map(s => s.place).filter(Boolean))];
  screen.querySelector('#map-caption').innerHTML = `
    <p class="muted small" style="text-align:center;margin-top:10px">${placed.length} pinned sighting${placed.length === 1 ? '' : 's'}${spots.length ? ` across ${esc(spots.slice(0, 3).join(', '))}${spots.length > 3 ? '…' : ''}` : ''} — tap a bird to open its page.</p>
    ${unplaced.length ? `<p class="muted small" style="text-align:center">${unplaced.length} more sighting${unplaced.length === 1 ? ' has' : 's have'} no location recorded.</p>` : ''}`;
}

function terrainSVG(W, H, placed, X, Y) {
  const rand = rng('terrain');
  const f1 = nextId('f'), f2 = nextId('f'), fi = nextId('f');
  let g = `<defs>${wcSoftFilter(f1, 21, 12, 0.02, 1)}${wcSoftFilter(f2, 33, 9, 0.03, 0.7)}${wcFilter(fi, 44, 2.5, 0.06)}</defs>`;

  // parchment ground
  g += `<path d="${blobPath(W / 2, H / 2, W / 2 - 14, H / 2 - 14, rand, 16, 0.05)}" fill="#efe7cf" stroke="#5b5140" stroke-opacity="0.5" stroke-width="1.6" filter="url(#${f2})"/>`;
  // washes of terrain: meadows, woods, water
  g += `<path d="${blobPath(W * 0.32, H * 0.36, W * 0.26, H * 0.22, rand, 12, 0.2)}" fill="${PIGMENT.moss}" opacity="0.22" filter="url(#${f1})"/>`;
  g += `<path d="${blobPath(W * 0.7, H * 0.62, W * 0.24, H * 0.2, rand, 12, 0.22)}" fill="${PIGMENT.fern}" opacity="0.18" filter="url(#${f1})"/>`;
  g += `<path d="${blobPath(W * 0.62, H * 0.24, W * 0.18, H * 0.13, rand, 11, 0.24)}" fill="${PIGMENT.sky}" opacity="0.25" filter="url(#${f1})"/>`;
  g += `<path d="${blobPath(W * 0.26, H * 0.74, W * 0.17, H * 0.12, rand, 11, 0.22)}" fill="${PIGMENT.sand}" opacity="0.3" filter="url(#${f1})"/>`;
  // a winding stream
  g += `<path d="${inkLine([[W * 0.08, H * 0.6], [W * 0.3, H * 0.52], [W * 0.48, H * 0.6], [W * 0.66, H * 0.5], [W * 0.9, H * 0.56]], rand, 5)}" fill="none" stroke="${PIGMENT.teal}" stroke-width="7" stroke-opacity="0.3" stroke-linecap="round" filter="url(#${f2})"/>`;
  // little tree and grass glyphs
  for (let i = 0; i < 9; i++) {
    const tx = 70 + rand() * (W - 150), ty = 70 + rand() * (H - 170);
    if (rand() > 0.5) {
      g += `<g filter="url(#${fi})" opacity="0.55">
        <path d="${inkLine([[tx, ty + 12], [tx, ty + 3]], rand, 0.6)}" stroke="#6b543c" stroke-width="1.6" fill="none"/>
        <path d="${blobPath(tx, ty - 3, 7.5, 8.5, rand, 8, 0.25)}" fill="${PIGMENT.fern}" opacity="0.7"/></g>`;
    } else {
      g += `<g filter="url(#${fi})" opacity="0.45" stroke="${PIGMENT.moss}" stroke-width="1.3" fill="none">
        <path d="${inkLine([[tx - 4, ty + 6], [tx - 2, ty - 2]], rand, 0.5)}"/><path d="${inkLine([[tx, ty + 7], [tx + 1, ty - 4]], rand, 0.5)}"/><path d="${inkLine([[tx + 4, ty + 6], [tx + 5, ty - 1]], rand, 0.5)}"/></g>`;
    }
  }
  // compass rose
  const cx = W - 82, cy = 88;
  g += `<g filter="url(#${fi})" opacity="0.7">
    <circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="#5b5140" stroke-width="1.4"/>
    <path d="${inkLine([[cx, cy + 18], [cx, cy - 18]], rand, 0.8)}" stroke="#5b5140" stroke-width="1.6" fill="none"/>
    <path d="M${cx} ${cy - 18} l-5 9 l5 -3 l5 3 Z" fill="${PIGMENT.rust}" opacity="0.85"/>
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-family="Caveat" font-size="19" fill="#42392b" font-weight="700">N</text>
  </g>`;

  // pins: cluster-aware simple jitter
  const seen = new Map();
  for (const s of placed) {
    const k = `${Math.round(X(s.lon) / 30)}:${Math.round(Y(s.lat) / 30)}`;
    const n = seen.get(k) || 0; seen.set(k, n + 1);
    const jx = (n % 3) * 24 - 24, jy = Math.floor(n / 3) * 26 - 10;
    const x = X(s.lon) + jx, y = Y(s.lat) + jy;
    const art = store.artFor(s.speciesKey);
    const color = art.colors.body;
    g += `<g class="map-pin" data-id="${s.id}" transform="translate(${x - 17},${y - 34})" role="button" tabindex="0" aria-label="${esc(s.commonName)}">
      ${splatToGroup(splatSVG({ size: 34, seed: 'pin-' + s.id, color, opacity: 0.85 }))}
      <path d="M17 30 L17 40" stroke="#42392b" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      <circle cx="17" cy="14" r="5.5" fill="#f6f1e3" opacity="0.85"/>
      <text x="17" y="19" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="14" fill="#42392b">${esc(initials(s.commonName))}</text>
    </g>`;
  }

  return `<svg class="terrain" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hand-painted map of your sightings">${g}</svg>`;
}

function splatToGroup(svg) {
  return svg.replace(/^<svg[^>]*>/, '<g>').replace(/<\/svg>$/, '</g>');
}
function initials(name) {
  return (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
