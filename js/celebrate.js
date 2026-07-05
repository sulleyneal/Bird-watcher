/* celebrate.js — the "new species!" moment. Pigment splats bloom across
   the page and the illustration paints itself in. */

import { el, panelBg, splatSVG, washBtn, esc, PIGMENT } from './ui/kit.js';
import { birdSVG } from './art/birds.js';
import { rng } from './art/paint.js';

const CEL_COLORS = [PIGMENT.rust, PIGMENT.ochre, PIGMENT.teal, PIGMENT.plum, PIGMENT.moss, PIGMENT.rose];

export function celebrate(art, opts = {}) {
  return new Promise(resolve => {
    const kicker = opts.kicker || 'A new bird for your journal!';
    const overlay = el(`<div class="celebrate-overlay" role="dialog" aria-label="New species">
      <div class="celebrate-card">
        ${panelBg('celebrate', { w: 340, h: 430, wobble: 0.04 })}
        <div class="cel-kicker">${esc(kicker)}</div>
        <div class="entry-art-lg">${birdSVG(art, { seed: art.key + '-cel' })}</div>
        <div class="cel-species">${esc(art.common)}</div>
        <div class="sci">${esc(art.sci)}</div>
        <div style="margin-top:16px">${washBtn('Add to my journal', { color: PIGMENT.rust, icon: 'feather', id: 'cel-ok', w: 230 })}</div>
      </div>
    </div>`);
    const r = rng('cel-' + art.key);
    // pigment splat burst
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('span');
      s.className = 'splat-burst';
      const size = 26 + r() * 60;
      s.style.left = `${6 + r() * 82}%`;
      s.style.top = `${4 + r() * 86}%`;
      s.style.width = s.style.height = `${size}px`;
      s.style.animationDelay = `${(r() * 0.5).toFixed(2)}s`;
      s.innerHTML = splatSVG({ size: 60, seed: `cel-splat-${i}-${art.key}`, color: CEL_COLORS[i % CEL_COLORS.length], opacity: 0.55 });
      overlay.appendChild(s);
    }
    const done = () => { overlay.remove(); resolve(); };
    overlay.querySelector('#cel-ok').addEventListener('click', done);
    document.getElementById('overlay-root').appendChild(overlay);
  });
}
