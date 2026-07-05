/* icons.js — hand-inked icon set. Every icon is drawn as jittered strokes
   so nothing reads as a geometric system icon. Deterministic per name. */
import { rng, inkLine, nextId, wcFilter, hashString, blobPath, PIGMENT } from './paint.js';

const STROKE = PIGMENT.ink;

function wrap(name, inner, opts = {}) {
  const { vb = 32, sw = 1.9, color = STROKE } = opts;
  const f = nextId('if');
  const sn = hashString(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" class="ink-icon" aria-hidden="true">
  <defs>${wcFilter(f, sn, 1.6, 0.09)}</defs>
  <g filter="url(#${f})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;
}

function L(name, pts, r) { return `<path d="${inkLine(pts, r, 0.9)}"/>`; }

export const icons = {
  journal(color) {
    const r = rng('ic-journal');
    return wrap('journal',
      L('', [[7, 5], [7, 27]], r) +
      L('', [[7, 5], [24, 4.5], [25, 26.5], [7, 27]], r) +
      L('', [[11, 11], [21, 10.5]], r) + L('', [[11, 15.5], [21, 15]], r) + L('', [[11, 20], [17, 19.7]], r),
      { color });
  },
  feather(color) {
    const r = rng('ic-feather');
    return wrap('feather',
      `<path d="${inkLine([[25, 5], [16, 10], [9, 19], [7, 26]], r, 0.8)}"/>` +
      `<path d="${inkLine([[25, 5], [24, 14], [17, 22], [9, 25]], r, 0.8)}"/>` +
      L('', [[23, 8], [12, 20]], r) + L('', [[14.5, 14.5], [18, 16.5]], r) + L('', [[17.5, 11], [21.5, 13]], r),
      { color });
  },
  binoculars(color) {
    const r = rng('ic-binoc');
    return wrap('binoculars',
      `<circle cx="9.5" cy="21" r="5.4"/><circle cx="22.5" cy="21" r="5.4"/>` +
      L('', [[12, 9], [8, 16.5]], r) + L('', [[20, 9], [24, 16.5]], r) +
      L('', [[12, 9], [20, 9]], r) + L('', [[14.8, 21], [17.2, 21]], r),
      { color });
  },
  map(color) {
    const r = rng('ic-map');
    return wrap('map',
      L('', [[5, 8], [12, 5.5], [20, 8.5], [27, 6], [27, 24], [20, 26.5], [12, 24], [5, 26.5], [5, 8]], r) +
      L('', [[12, 6], [12, 24]], r) + L('', [[20, 9], [20, 26]], r) +
      `<circle cx="16" cy="14.5" r="1.4" fill="${color || STROKE}" stroke="none"/>`,
      { color });
  },
  sun(color) {
    const r = rng('ic-sun');
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.2;
      rays += L('', [[16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9], [16 + Math.cos(a) * 12.5, 16 + Math.sin(a) * 12.5]], r);
    }
    return wrap('sun', `<circle cx="16" cy="16" r="5.6"/>` + rays, { color });
  },
  camera(color) {
    const r = rng('ic-camera');
    return wrap('camera',
      L('', [[5, 11], [12, 10.7], [13.5, 7.5], [19, 7.3], [20.5, 10.5], [27, 10.8], [26.7, 25], [5.4, 25.3], [5, 11]], r) +
      `<circle cx="16" cy="17.5" r="4.6"/><circle cx="23.5" cy="13.5" r="0.8" fill="${color || STROKE}" stroke="none"/>`,
      { color });
  },
  upload(color) {
    const r = rng('ic-upload');
    return wrap('upload',
      L('', [[16, 20], [16, 6]], r) + L('', [[10.5, 11.5], [16, 5.5], [21.5, 11.5]], r) +
      L('', [[6, 20], [6, 26], [26, 26.3], [26, 20]], r),
      { color });
  },
  pin(color) {
    const r = rng('ic-pin');
    return wrap('pin',
      L('', [[16, 27], [16, 27.2]], r) +
      `<path d="${inkLine([[16, 27], [10, 17], [9.6, 11.5], [13, 6.8], [19, 6.8], [22.4, 11.5], [22, 17], [16, 27]], r, 0.7)}"/>` +
      `<circle cx="16" cy="12.5" r="2.6"/>`,
      { color });
  },
  pencil(color) {
    const r = rng('ic-pencil');
    return wrap('pencil',
      L('', [[7, 25], [8.5, 19.5], [22, 6], [26, 10], [12.5, 23.5], [7, 25]], r) +
      L('', [[20, 8], [24, 12]], r), { color });
  },
  share(color) {
    const r = rng('ic-share');
    return wrap('share',
      L('', [[16, 4.5], [16, 19]], r) + L('', [[10.5, 9.5], [16, 4], [21.5, 9.5]], r) +
      L('', [[7, 15], [7, 27], [25, 27.3], [25, 15]], r), { color });
  },
  trash(color) {
    const r = rng('ic-trash');
    return wrap('trash',
      L('', [[7, 9], [25, 9.3]], r) + L('', [[12.5, 9], [13, 5.5], [19, 5.3], [19.5, 9]], r) +
      L('', [[9, 9.5], [10, 27], [22, 27.3], [23, 9.5]], r) + L('', [[13.5, 13.5], [13.8, 23]], r) + L('', [[18.5, 13.3], [18.3, 23]], r), { color });
  },
  check(color) {
    const r = rng('ic-check');
    return wrap('check', L('', [[6, 17], [13, 24.5], [26.5, 7.5]], r), { color, sw: 2.4 });
  },
  close(color) {
    const r = rng('ic-close');
    return wrap('close', L('', [[8, 8], [24, 24.3]], r) + L('', [[24, 8.4], [8.3, 24]], r), { color, sw: 2.2 });
  },
  back(color) {
    const r = rng('ic-back');
    return wrap('back', L('', [[22, 5.5], [10, 16], [22.3, 26.5]], r), { color, sw: 2.3 });
  },
  sparkle(color) {
    const r = rng('ic-sparkle');
    return wrap('sparkle',
      L('', [[16, 5], [17.8, 13.6], [27, 16], [17.8, 18.4], [16, 27], [14.2, 18.4], [5, 16], [14.2, 13.6], [16, 5]], r) +
      L('', [[25, 5.5], [25.4, 9.5]], r) + L('', [[23.4, 7.6], [27.2, 7.4]], r), { color });
  },
  question(color) {
    const r = rng('ic-question');
    return wrap('question',
      `<path d="${inkLine([[11, 11], [12, 7.6], [16, 6], [20, 7.6], [21, 11], [19, 14], [16, 15.7], [16, 19.5]], r, 0.7)}"/>` +
      `<circle cx="16" cy="25" r="1.2" fill="${color || STROKE}" stroke="none"/>`, { color });
  },
  cloud(color) {
    const r = rng('ic-cloud-off');
    return wrap('cloud-off',
      `<path d="${inkLine([[8, 22], [5.5, 19], [6.5, 15], [10, 13.8], [11, 10], [15.5, 8], [20, 9.5], [21.5, 13], [25.5, 14], [26.6, 18], [24.5, 21.6], [8, 22]], r, 0.7)}"/>`, { color });
  },
  egg(color) {
    const r = rng('ic-egg');
    return wrap('egg',
      `<path d="${inkLine([[16, 5], [10, 12], [8.6, 19], [11, 25], [16, 27], [21, 25], [23.4, 19], [22, 12], [16, 5]], r, 0.6)}"/>` +
      L('', [[12.5, 16], [14.5, 18]], r) + L('', [[17.5, 13], [19.5, 15]], r), { color });
  },
  branch(color) {
    const r = rng('ic-branch');
    return wrap('branch',
      L('', [[4, 24], [12, 20], [20, 13], [28, 8]], r) + L('', [[13, 19.3], [15, 23]], r) +
      L('', [[20, 13], [19, 9]], r) +
      `<path d="${inkLine([[15, 23], [17.6, 24.6], [19.5, 23.4]], r, 0.5)}"/>`, { color });
  },
  tally(color) {
    const r = rng('ic-tally');
    return wrap('tally',
      L('', [[8, 8], [7.4, 24]], r) + L('', [[13, 7.6], [12.5, 24.3]], r) + L('', [[18, 8.2], [17.6, 24]], r) +
      L('', [[23, 7.8], [22.6, 24.2]], r) + L('', [[4.5, 22], [26.5, 10]], r), { color });
  },
  moon(color) {
    const r = rng('ic-moon');
    return wrap('moon',
      `<path d="${inkLine([[19, 5.5], [13, 8], [10.4, 14], [12, 20.5], [17.5, 24.5], [24, 24], [19.8, 27.4], [12.5, 27], [6.8, 22], [5.6, 14.5], [9, 8], [15, 4.8], [19, 5.5]], r, 0.6)}"/>`, { color });
  },
  seal(color) {
    const r = rng('ic-seal');
    const sn = hashString('seal-blob');
    return wrap('seal', `<path d="${blobPath(16, 16, 10, 10, r, 10, 0.22)}"/>` + `<circle cx="16" cy="16" r="4.5"/>`, { color });
  },
};

export function icon(name, color) {
  const fn = icons[name];
  return fn ? fn(color) : icons.question(color);
}
