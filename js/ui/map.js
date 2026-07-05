/* map.js — a hand-painted sighting map. Not a tile map: a watercolor
   terrain sketch with your sightings plotted on it, so it works offline
   and stays inside the journal's world. */

import * as store from '../store.js';
import { el, esc, icon, headUnderline, washBtn, PIGMENT } from './kit.js';
import { rng, blobPath, inkLine, wcSoftFilter, wcFilter, nextId, hashString, mix, hexToRgb } from '../art/paint.js';

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
  const labels = pinLabels(placed); // same short labels the pins carry
  const bySpecies = new Map();
  for (const s of placed) if (!bySpecies.has(s.speciesKey)) bySpecies.set(s.speciesKey, s);
  const legend = [...bySpecies.values()].map(s => {
    const art = store.artFor(s.speciesKey);
    const r = rng('leg-' + s.speciesKey);
    return `<span class="chip" style="cursor:pointer" data-entry="${s.id}">
      <span style="display:inline-block;width:15px;height:15px"><svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg">
        <path d="${blobPath(7.5, 7.5, 5.2, 5, r, 8, 0.2)}" fill="${pinColor(art.colors.body)}" stroke="#42392b" stroke-width="0.9" stroke-opacity="0.55" opacity="0.9"/>
      </svg></span>
      <span class="small">${esc(labels.get(s.speciesKey))} — ${esc(s.commonName)}</span></span>`;
  }).join('');
  screen.querySelector('#map-caption').innerHTML = `
    <p class="muted small" style="text-align:center;margin-top:10px">${placed.length} pinned sighting${placed.length === 1 ? '' : 's'}${spots.length ? ` across ${esc(spots.slice(0, 3).join(', '))}${spots.length > 3 ? '…' : ''}` : ''} — tap a bird to open its page.</p>
    ${unplaced.length ? `<p class="muted small" style="text-align:center">${unplaced.length} more sighting${unplaced.length === 1 ? ' has' : 's have'} no location recorded.</p>` : ''}
    <h3 class="script" style="font-size:1.4rem;margin:14px 2px 6px;color:var(--ink-soft)">Pinned species</h3>
    <div style="display:flex;flex-wrap:wrap;gap:8px 14px">${legend}</div>`;
  screen.querySelectorAll('[data-entry]').forEach(c =>
    c.addEventListener('click', () => { location.hash = `#/entry/${c.dataset.entry}`; }));
}

function terrainSVG(W, H, placed, X, Y) {
  const labels = pinLabels(placed);
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

  // pins: place at true coordinates, then relax collisions so clustered
  // sightings fan out instead of stacking
  const pts = placed.map(s => ({ s, x: X(s.lon), y: Y(s.lat) }));
  const MIN = 34;
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < MIN) {
          const push = (MIN - d) / 2;
          const ux = dx / d, uy = dy / d;
          pts[i].x -= ux * push; pts[i].y -= uy * push;
          pts[j].x += ux * push; pts[j].y += uy * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  for (const p of pts) {
    p.x = Math.max(66, Math.min(W - 66, p.x));
    p.y = Math.max(80, Math.min(H - 76, p.y));
  }

  // handwritten place-name labels at each place's centroid (under the pins)
  const byPlace = new Map();
  for (const p of pts) {
    const name = (p.s.place || '').trim();
    if (!name) continue;
    if (!byPlace.has(name)) byPlace.set(name, []);
    byPlace.get(name).push(p);
  }
  let li = 0;
  for (const [name, group] of byPlace) {
    const lx = group.reduce((a, p) => a + p.x, 0) / group.length;
    const ly = Math.min(...group.map(p => p.y)) - 44;
    const yy = Math.max(58, ly);
    const rot = (li++ % 2 ? 1.6 : -1.8);
    g += `<g filter="url(#${fi})" opacity="0.85" transform="rotate(${rot} ${lx} ${yy})">
      <text x="${lx}" y="${yy}" text-anchor="middle" font-family="Caveat" font-weight="600" font-size="19" fill="#6b5f4c">${esc(name)}</text>
      <path d="${inkLine([[lx - name.length * 4.4, yy + 5], [lx + name.length * 4.4, yy + 4]], rand, 1)}" stroke="#8d8168" stroke-width="1.1" fill="none" opacity="0.6"/>
    </g>`;
  }

  // hand-inked teardrop pins in the species' pigment
  for (const { s, x, y } of pts) {
    const art = store.artFor(s.speciesKey);
    const color = pinColor(art.colors.body);
    g += `<g class="map-pin" data-id="${s.id}" transform="translate(${x - 17},${y - 38})" role="button" tabindex="0" aria-label="${esc(s.commonName)}">
      <ellipse cx="17" cy="38.5" rx="6" ry="2" fill="#42392b" opacity="0.18" filter="url(#${fi})"/>
      <path d="M17 38 C 12.5 29 6.5 24 6.5 14.5 A 10.5 10.5 0 1 1 27.5 14.5 C 27.5 24 21.5 29 17 38 Z"
            fill="${color}" opacity="0.9" stroke="#42392b" stroke-width="1.5" stroke-opacity="0.65" filter="url(#${fi})"/>
      <circle cx="17" cy="14.5" r="7" fill="#f8f3e4" opacity="0.95" filter="url(#${fi})"/>
      <text x="17" y="19" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="12.5" fill="#42392b">${esc(labels.get(s.speciesKey))}</text>
    </g>`;
  }

  // distance scale so the sketch reads as real geography
  g += scaleBar(W, H, placed, X, rand, fi);

  return `<svg class="terrain" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hand-painted map of your sightings">${g}</svg>`;
}

/* dark plumage would read as an ink smudge; lift it toward pigment */
function pinColor(hex) {
  const [r, gg, b] = hexToRgb(hex);
  const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  return lum < 96 ? mix(hex, '#c9b98f', 0.45) : hex;
}

/* a hand-drawn scale bar: how far across is this stretch of ground? */
function scaleBar(W, H, placed, X, rand, fi) {
  if (placed.length < 2) return '';
  const lons = placed.map(s => s.lon), lats = placed.map(s => s.lat);
  const lonSpan = Math.max(...lons) - Math.min(...lons);
  if (!lonSpan) return '';
  const midLat = lats.reduce((a, v) => a + v, 0) / lats.length;
  const kmPerPx = (lonSpan * 111.32 * Math.cos(midLat * Math.PI / 180)) /
    (X(Math.max(...lons)) - X(Math.min(...lons)));
  // pick a friendly round distance that fits ~120px
  const targets = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 25];
  const km = targets.find(t => t / kmPerPx >= 70 && t / kmPerPx <= 190) || targets[targets.length - 1];
  const px = Math.min(200, km / kmPerPx);
  const label = km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;
  const bx = 74, by = H - 46;
  return `<g filter="url(#${fi})" opacity="0.75">
    <path d="${inkLine([[bx, by], [bx + px, by]], rand, 1)}" stroke="#5b5140" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="${inkLine([[bx, by - 5], [bx, by + 5]], rand, 0.6)}" stroke="#5b5140" stroke-width="1.6" fill="none"/>
    <path d="${inkLine([[bx + px, by - 5], [bx + px, by + 5]], rand, 0.6)}" stroke="#5b5140" stroke-width="1.6" fill="none"/>
    <text x="${bx + px / 2}" y="${by - 9}" text-anchor="middle" font-family="Caveat" font-weight="600" font-size="17" fill="#5b5140">${label}</text>
  </g>`;
}

function initials(name) {
  return (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* unique short labels per species: extend with letters until distinct
   (Carolina Wren vs Cedar Waxwing → CaW / CeW) */
function pinLabels(placed) {
  const keys = [...new Set(placed.map(s => s.speciesKey))];
  const names = new Map(keys.map(k => [k, placed.find(s => s.speciesKey === k).commonName || '?']));
  const labels = new Map();
  for (const [key, name] of names) {
    for (let extra = 0; ; extra++) {
      const label = shortLabel(name, extra);
      const clash = [...names].some(([k2, n2]) => k2 !== key && shortLabel(n2, extra) === label);
      if (!clash || extra >= 3) { labels.set(key, label); break; }
    }
  }
  return labels;
}
function shortLabel(name, extra) {
  const words = name.split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2 + extra);
  const first = words[0][0] + words[0].slice(1, 1 + extra).toLowerCase();
  return first + words[words.length - 1][0].toUpperCase();
}
