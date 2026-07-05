/* paint.js — procedural watercolor toolkit.
   Every visual in the app is generated here or in birds.js: no stock UI,
   no external art. Self-contained SVG strings with unique filter ids so
   they work inline anywhere (including Safari, which is picky about
   cross-SVG filter references). */

let uid = 0;
export function nextId(prefix = 'wc') { return `${prefix}-${(++uid).toString(36)}`; }

/* Deterministic RNG (mulberry32) so a given seed always paints the same. */
export function rng(seed) {
  let a = (typeof seed === 'string') ? hashString(seed) : (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* A closed organic blob path: radial harmonics + jitter. */
export function blobPath(cx, cy, rx, ry, rand, points = 12, wobble = 0.14) {
  const pts = [];
  const p1 = rand() * Math.PI * 2, p2 = rand() * Math.PI * 2;
  const a1 = wobble * (0.5 + rand() * 0.8), a2 = wobble * 0.6 * rand();
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const w = 1 + a1 * Math.sin(t * 2 + p1) + a2 * Math.sin(t * 5 + p2) + (rand() - 0.5) * wobble * 0.7;
    pts.push([cx + Math.cos(t) * rx * w, cy + Math.sin(t) * ry * w]);
  }
  return smoothClosed(pts);
}

/* Catmull-Rom -> bezier smoothing for a closed polygon. */
export function smoothClosed(pts) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

/* Open hand-drawn line with jitter (ink strokes, underlines, twigs). */
export function inkLine(pts, rand, jitter = 1.2) {
  const q = pts.map(([x, y]) => [x + (rand() - 0.5) * jitter, y + (rand() - 0.5) * jitter]);
  let d = `M${q[0][0].toFixed(1)},${q[0][1].toFixed(1)}`;
  for (let i = 1; i < q.length; i++) {
    const mid = [(q[i - 1][0] + q[i][0]) / 2 + (rand() - 0.5) * jitter, (q[i - 1][1] + q[i][1]) / 2 + (rand() - 0.5) * jitter];
    d += `Q${mid[0].toFixed(1)},${mid[1].toFixed(1)} ${q[i][0].toFixed(1)},${q[i][1].toFixed(1)}`;
  }
  return d;
}

/* Watercolor edge filter defs. scale controls edge raggedness. */
export function wcFilter(id, seedNum, scale = 7, freq = 0.035) {
  return `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seedNum % 100}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
}

export function wcSoftFilter(id, seedNum, scale = 10, freq = 0.03, blur = 0.7) {
  return `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seedNum % 100}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${blur}"/>
  </filter>`;
}

/* Pigment granulation: subtle darker speckle inside a wash. */
export function grainFilter(id, seedNum) {
  return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seedNum % 100}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0.6 0.6 0 0" result="a"/>
    <feComposite in="a" in2="SourceGraphic" operator="in"/>
  </filter>`;
}

/* A layered watercolor wash blob as a self-contained SVG string.
   opts: {w,h,seed,color,color2,opacity,wobble,inset} */
export function washSVG(opts = {}) {
  const { w = 300, h = 120, seed = 'wash', color = '#7a8b5c', color2 = null,
    opacity = 0.5, wobble = 0.1, inset = 10, rx = null, ry = null } = opts;
  const rand = rng(seed);
  const sn = hashString(String(seed));
  const f1 = nextId('f'), f2 = nextId('f'), g = nextId('g');
  const cx = w / 2, cy = h / 2;
  const RX = rx || (w / 2 - inset), RY = ry || (h / 2 - inset);
  const d1 = blobPath(cx, cy, RX, RY, rand, 14, wobble);
  const d2 = blobPath(cx + (rand() - 0.5) * 6, cy + (rand() - 0.5) * 5, RX * 0.96, RY * 0.94, rand, 12, wobble * 1.3);
  const c2 = color2 || shade(color, -18);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
  <defs>${wcSoftFilter(f1, sn, 9)}${wcFilter(f2, sn + 7, 6)}
  <radialGradient id="${g}" cx="0.4" cy="0.35" r="0.9">
    <stop offset="0%" stop-color="${lighten(color, 14)}"/><stop offset="70%" stop-color="${color}"/><stop offset="100%" stop-color="${c2}"/>
  </radialGradient></defs>
  <path d="${d1}" fill="url(#${g})" opacity="${opacity}" filter="url(#${f1})"/>
  <path d="${d2}" fill="${c2}" opacity="${opacity * 0.45}" filter="url(#${f2})"/>
</svg>`;
}

/* Paper-panel: a card background that reads as a wash of paper with a
   fine ink rim, slightly wobbly. Used behind cards/panels. */
export function panelSVG(opts = {}) {
  const { w = 340, h = 200, seed = 'panel', fill = '#fbf6e8', ink = '#5b5140',
    inkOpacity = 0.5, wobble = 0.035, inset = 6 } = opts;
  const rand = rng(seed);
  const sn = hashString(String(seed));
  const f1 = nextId('f');
  const d = roundedWobbleRect(inset, inset, w - inset * 2, h - inset * 2, 14, rand, wobble * Math.min(w, h));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
  <defs>${wcFilter(f1, sn, 4, 0.02)}</defs>
  <path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="1.4" stroke-opacity="${inkOpacity}" filter="url(#${f1})"/>
</svg>`;
}

/* Wobbly rounded-rect-ish closed path. */
export function roundedWobbleRect(x, y, w, h, r, rand, jitter = 4) {
  const pts = [];
  const per = 2 * (w + h);
  const steps = Math.max(14, Math.round(per / 46));
  for (let i = 0; i < steps; i++) {
    const t = i / steps * per;
    let px, py;
    if (t < w) { px = x + t; py = y; }
    else if (t < w + h) { px = x + w; py = y + (t - w); }
    else if (t < 2 * w + h) { px = x + w - (t - w - h); py = y + h; }
    else { px = x; py = y + h - (t - 2 * w - h); }
    pts.push([px + (rand() - 0.5) * jitter, py + (rand() - 0.5) * jitter]);
  }
  return smoothClosed(pts);
}

/* Small pigment splat (for confetti, pins, bullets). */
export function splatSVG(opts = {}) {
  const { size = 40, seed = 'splat', color = '#b0603f', opacity = 0.75 } = opts;
  const rand = rng(seed);
  const sn = hashString(String(seed));
  const f = nextId('f');
  const c = size / 2;
  let dots = '';
  const nd = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < nd; i++) {
    const a = rand() * Math.PI * 2, r = c * (0.55 + rand() * 0.45);
    dots += `<circle cx="${(c + Math.cos(a) * r).toFixed(1)}" cy="${(c + Math.sin(a) * r).toFixed(1)}" r="${(size * 0.05 * (0.5 + rand())).toFixed(1)}" fill="${color}" opacity="${opacity * 0.8}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">
  <defs>${wcSoftFilter(f, sn, 5, 0.09, 0.4)}</defs>
  <g filter="url(#${f})"><path d="${blobPath(c, c, c * 0.62, c * 0.58, rand, 9, 0.35)}" fill="${color}" opacity="${opacity}"/>${dots}</g>
</svg>`;
}

/* Data-URI helper so generated SVG can be used in CSS background-image. */
export function svgURI(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, ' ')}")`;
}

/* ---- color helpers ---- */
export function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
export function rgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function shade(hex, amt) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + amt, g + amt, b + amt); }
export function lighten(hex, amt) { return shade(hex, Math.abs(amt)); }
export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/* Shared pigment palette (kept muted / granulated like real pans). */
export const PIGMENT = {
  ink: '#42392b',
  inkSoft: '#6b5f4c',
  paper: '#f5efdd',
  paperDeep: '#ece3cb',
  moss: '#7c8b58',
  fern: '#5d7350',
  teal: '#4e7d78',
  sky: '#8aa7b5',
  slate: '#5f7382',
  rust: '#b0603f',
  ochre: '#c39a4a',
  gold: '#d9b25f',
  plum: '#7d5a72',
  rose: '#c48a7e',
  berry: '#9d4a44',
  sand: '#d8c49a',
};
