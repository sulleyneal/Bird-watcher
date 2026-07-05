/* kit.js — small painted-UI builders shared by every screen. */

import { washSVG, panelSVG, splatSVG, inkLine, rng, nextId, wcFilter, hashString, PIGMENT, mix } from '../art/paint.js';
import { icon } from '../art/icons.js';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* painted panel background: call after the element is in the DOM (needs size) */
export function panelBg(seed, opts = {}) {
  return `<span class="panel-bg" aria-hidden="true">${panelSVG({ w: opts.w || 340, h: opts.h || 160, seed, fill: opts.fill || '#fbf6e8', ink: opts.ink || '#5b5140', inkOpacity: opts.inkOpacity != null ? opts.inkOpacity : 0.45, wobble: opts.wobble || 0.03 })}</span>`;
}

export function washBtn(label, opts = {}) {
  const { color = PIGMENT.moss, icon: ic = null, cls = '', id = '', dark = true, w = 190, h = 62 } = opts;
  const seed = `btn-${label}-${color}`;
  return `<button ${id ? `id="${id}"` : ''} class="btn ${dark ? 'btn-dark' : 'btn-light'} ${cls}" type="button">
    <span class="btn-bg" aria-hidden="true">${washSVG({ w, h, seed, color, opacity: dark ? 0.88 : 0.4, wobble: 0.14, inset: 7 })}</span>
    ${ic ? icon(ic) : ''}<span>${esc(label)}</span>
  </button>`;
}

export function ghostBtn(label, opts = {}) {
  return `<button ${opts.id ? `id="${opts.id}"` : ''} class="link-hand ${opts.cls || ''}" type="button">${esc(label)}</button>`;
}

export function chip(label, color = PIGMENT.moss, opts = {}) {
  const seed = `chip-${label}-${color}`;
  return `<span class="chip ${opts.dark ? 'on-dark' : ''}">
    <span class="chip-bg" aria-hidden="true">${washSVG({ w: 110, h: 36, seed, color, opacity: opts.opacity != null ? opts.opacity : 0.32, wobble: 0.18, inset: 4 })}</span>
    ${opts.icon ? icon(opts.icon) : ''}${esc(label)}</span>`;
}

export function headUnderline(color = PIGMENT.rust, seed = 'hu') {
  const r = rng(seed);
  const f = nextId('f');
  return `<div class="head-underline"><svg viewBox="0 0 220 12" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>${wcFilter(f, hashString(seed), 2.5, 0.06)}</defs>
    <path d="${inkLine([[4, 7], [70, 4.5], [150, 7.5], [216, 5]], r, 1.5)}" fill="none" stroke="${color}" stroke-width="4.4" stroke-linecap="round" opacity="0.55" filter="url(#${f})"/>
  </svg></div>`;
}

export function dividerInk(seed = 'div') {
  const r = rng(seed);
  const f = nextId('f');
  return `<div class="divider-ink"><svg viewBox="0 0 340 10" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>${wcFilter(f, hashString(seed), 2, 0.05)}</defs>
    <path d="${inkLine([[6, 5], [110, 3.6], [230, 6.4], [334, 4.4]], r, 1.2)}" fill="none" stroke="${PIGMENT.inkSoft}" stroke-width="1.5" stroke-linecap="round" opacity="0.6" filter="url(#${f})"/>
  </svg></div>`;
}

/* confidence meter: 1-5 pigment drops */
export function confMeter(confidence, color = PIGMENT.teal) {
  const n = Math.max(1, Math.min(5, Math.round(confidence * 5)));
  let drops = '';
  for (let i = 0; i < 5; i++) {
    const filled = i < n;
    drops += `<span class="drop">${splatSVG({ size: 22, seed: `drop-${i}-${filled}`, color: filled ? color : '#b9ad92', opacity: filled ? 0.85 : 0.3 })}</span>`;
  }
  const label = confidence >= 0.8 ? 'quite sure' : confidence >= 0.55 ? 'fairly sure' : 'a guess';
  return `<span class="conf-meter" title="Confidence">${drops}<span class="small muted">${label}</span></span>`;
}

export function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = el(`<div class="toast" role="status">${panelBg(`toast-${msg}`, { w: 260, h: 56 })}${esc(msg)}</div>`);
  document.body.appendChild(t);
  if (ms) setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 420); }, ms);
  return t;
}

export { icon, splatSVG, washSVG, panelSVG, PIGMENT };
