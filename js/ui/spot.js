/* spot.js — the core loop: viewfinder → photo → identification →
   confirmation → journal. Works fully offline (identification queues). */

import * as store from '../store.js';
import { startCamera, stopCamera, captureFrame, fileToDataURL } from '../camera.js';
import { getLocation, fmtCoords } from '../geo.js';
import { identifyPhoto, applyResult } from '../identify.js';
import { el, esc, icon, panelBg, washBtn, ghostBtn, chip, confMeter, headUnderline, toast, washSVG, splatSVG, PIGMENT } from './kit.js';
import { birdSVG, artForSpecies, SPECIES_ART, slugify } from '../art/birds.js';
import { celebrate } from '../celebrate.js';

let camActive = false;

export function leaveSpot() {
  if (camActive) { stopCamera(); camActive = false; }
}

export async function renderSpot(screen) {
  screen.innerHTML = `
    <header class="page-head"><h1>Spot a bird</h1></header>
    ${headUnderline(PIGMENT.rust, 'spot-underline')}
    <div id="spot-stage"></div>
  `;
  const stage = screen.querySelector('#spot-stage');
  showCameraStep(stage);
}

/* ---------------- step 1: camera / upload ---------------- */

function showCameraStep(stage) {
  stage.innerHTML = `
    <div class="viewfinder">
      <video playsinline muted autoplay style="display:none"></video>
      <div class="vf-fallback" style="display:none"></div>
      <span class="vf-frame" aria-hidden="true">${panelBg('viewfinder', { w: 320, h: 420, wobble: 0.02, inkOpacity: 0.75, fill: 'none' }).replace('class="panel-bg"', 'class="panel-bg" style="position:absolute;inset:0"')}</span>
    </div>
    <div class="shutter-row">
      <label class="btn btn-light" style="cursor:pointer">
        <span class="btn-bg">${washSVG({ w: 150, h: 56, seed: 'upload-btn', color: PIGMENT.sand, opacity: 0.55, wobble: 0.16, inset: 6 })}</span>
        ${icon('upload')}<span>Upload</span>
        <input id="file-input" type="file" accept="image/*" class="sr-only">
      </label>
      <button class="shutter" id="shutter" aria-label="Take photo" style="display:none">
        ${washSVG({ w: 84, h: 84, seed: 'shutter', color: PIGMENT.rust, opacity: 0.92, wobble: 0.12, inset: 6 })}
        ${icon('camera')}
      </button>
    </div>
    <p class="muted small" style="text-align:center" id="cam-hint">Opening the camera…</p>
  `;

  const video = stage.querySelector('video');
  const hint = stage.querySelector('#cam-hint');
  const shutter = stage.querySelector('#shutter');
  const fallback = stage.querySelector('.vf-fallback');

  startCamera(video).then(() => {
    camActive = true;
    video.style.display = 'block';
    shutter.style.display = 'block';
    hint.textContent = 'Frame the bird and press the seal.';
  }).catch(() => {
    // graceful fallback: painted upload invitation inside the frame
    fallback.style.display = 'flex';
    fallback.style.cssText += ';aspect-ratio:3/4;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px';
    fallback.innerHTML = `${icon('camera')}<p class="hand-lg" style="margin:0">The camera is shy here.</p><p class="muted small" style="max-width:230px">Upload a photo instead — the journal doesn't mind where the picture came from.</p>`;
    hint.textContent = '';
  });

  shutter.addEventListener('click', () => {
    try {
      const photo = captureFrame(video);
      leaveSpot();
      showReviewStep(stage, photo);
    } catch (e) { toast('Could not read the camera yet — try again'); }
  });

  stage.querySelector('#file-input').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const photo = await fileToDataURL(file);
      leaveSpot();
      showReviewStep(stage, photo);
    } catch (err) { toast('That file did not want to open'); }
  });
}

/* ---------------- step 2: review + details ---------------- */

async function showReviewStep(stage, photo) {
  stage.innerHTML = `
    <div style="text-align:center"><div class="photo-frame" style="max-width:78%"><img src="${photo}" alt="Your bird photo"></div></div>
    <div class="field"><label for="f-place">Where</label>
      <input type="text" id="f-place" placeholder="finding your spot…" autocomplete="off"></div>
    <div class="field"><label for="f-notes">Field notes</label>
      <textarea id="f-notes" rows="2" placeholder="what was it doing? what did you hear?"></textarea></div>
    <div class="btn-row" style="justify-content:center;margin-top:14px">
      ${washBtn('Identify this bird', { color: PIGMENT.teal, icon: 'sparkle', id: 'go-id', w: 220 })}
      ${ghostBtn('Retake', { id: 'retake' })}
    </div>
  `;
  const placeInput = stage.querySelector('#f-place');
  let coords = null;
  getLocation().then(loc => {
    coords = loc;
    if (placeInput.placeholder === 'finding your spot…') {
      placeInput.placeholder = loc ? `near ${fmtCoords(loc.lat, loc.lon)} — name this place?` : 'name this place (optional)';
    }
  });

  stage.querySelector('#retake').addEventListener('click', () => showCameraStep(stage));

  stage.querySelector('#go-id').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true; // a double tap must not file two sightings
    const sighting = {
      dateISO: new Date().toISOString(),
      photo,
      place: placeInput.value.trim(),
      notes: stage.querySelector('#f-notes').value.trim(),
      lat: coords ? coords.lat : null,
      lon: coords ? coords.lon : null,
      idStatus: 'queued',
      candidates: [],
    };
    await store.saveSighting(sighting);

    if (!navigator.onLine) {
      toast('Saved to your journal — it will be identified when you\'re back online', 4200);
      location.hash = '#/';
      return;
    }
    showIdentifyingStep(stage, sighting);
  });
}

/* ---------------- step 3: identifying ---------------- */

function showIdentifyingStep(stage, sighting) {
  stage.innerHTML = `
    <div class="empty-state" style="padding-top:60px">
      <div style="width:90px;height:90px;margin:0 auto;animation:art-bloom 1.6s ease-in-out infinite alternate">${splatSVG({ size: 90, seed: 'thinking', color: PIGMENT.teal, opacity: 0.6 })}</div>
      <h2>Leafing through the guide…</h2>
      <p>Comparing plumage, beak, and posture.</p>
    </div>`;
  identifyPhoto(sighting.photo)
    .then(async result => {
      applyResult(sighting, result);
      await store.saveSighting(sighting);
      if (!stage.isConnected) return; // user navigated away; entry updates in place
      showResultStep(stage, sighting, () => { location.hash = '#/'; });
    })
    .catch(async err => {
      // it's already saved as queued, so nothing is lost either way
      if (!navigator.onLine) toast('No connection — saved, and it will be identified later', 4200);
      else toast('The guide is unreachable right now — saved, will retry shortly', 4200);
      if (stage.isConnected) location.hash = '#/';
    });
}

/* ---------------- step 4: result / confirm (shared with entry page) ---------------- */

export function showResultStep(stage, sighting, onDone) {
  const result = sighting.idResult || {};
  const cands = sighting.candidates || [];

  // brief input guard: a fast identification must not let the tail of a
  // double-tap "Identify" click-through-confirm a species unseen
  stage.style.pointerEvents = 'none';
  setTimeout(() => { stage.style.pointerEvents = ''; }, 450);

  if (sighting.idStatus === 'not_bird') {
    stage.innerHTML = `
      <div class="empty-state">
        ${icon('question')}
        <h2>Hmm — no bird in this one</h2>
        <p>${esc(result.note || 'The guide looked closely, but this photo doesn\'t seem to show a bird.')}</p>
        <div class="btn-row" style="justify-content:center">
          ${washBtn('Try another photo', { color: PIGMENT.teal, icon: 'camera', id: 'nb-retry', w: 210 })}
          ${ghostBtn('Discard it', { id: 'nb-discard' })}
        </div>
      </div>`;
    stage.querySelector('#nb-retry').addEventListener('click', async () => {
      await store.deleteSighting(sighting.id);
      location.hash = '#/spot';
      showCameraStep(stage);
    });
    stage.querySelector('#nb-discard').addEventListener('click', async () => {
      await store.deleteSighting(sighting.id);
      toast('Discarded');
      onDone();
    });
    return;
  }

  if (sighting.idStatus === 'unclear' && !cands.length) {
    stage.innerHTML = `
      <div class="empty-state">
        ${icon('cloud')}
        <h2>Too quick for the guide</h2>
        <p>${esc(result.note || 'The photo is too blurry or distant to name the bird with any honesty.')}</p>
        <div class="btn-row" style="justify-content:center">
          ${washBtn('Try another photo', { color: PIGMENT.teal, icon: 'camera', id: 'uc-retry', w: 210 })}
          ${ghostBtn('Keep it unnamed', { id: 'uc-keep' })}
        </div>
        <div style="margin-top:8px">${ghostBtn('I know what it was', { id: 'uc-manual' })}</div>
      </div>`;
    stage.querySelector('#uc-retry').addEventListener('click', async () => {
      await store.deleteSighting(sighting.id);
      location.hash = '#/spot';
      showCameraStep(stage);
    });
    stage.querySelector('#uc-keep').addEventListener('click', () => { toast('Kept — you can name it later from its page'); onDone(); });
    stage.querySelector('#uc-manual').addEventListener('click', () => showManualStep(stage, sighting, onDone));
    return;
  }

  const top = cands[0];
  const lowConfidence = !top || (top.confidence || 0) < 0.7;
  const topArt = top ? artForSpecies(top) : null;
  const existing = top ? store.getSpeciesByKey(slugify(top.sciName || top.commonName)) : null;

  stage.innerHTML = `
    ${top ? `
    <div class="panel card-tilt-l" style="text-align:center">
      ${panelBg('result-' + sighting.id, { w: 340, h: 360, wobble: 0.035 })}
      <p class="cel-kicker" style="margin:2px 0 0">${lowConfidence ? 'Best guess — your call:' : 'The guide says:'}</p>
      <div class="entry-art-lg" style="width:180px;height:180px;margin:0 auto">${birdSVG(topArt, { seed: 'confirm-top' })}</div>
      <p class="cel-species" style="margin:0">${esc(top.commonName)}</p>
      <div class="sci">${esc(top.sciName || '')}</div>
      <div style="display:flex;justify-content:center;margin:8px 0 4px">${confMeter(top.confidence || 0.5)}</div>
      ${existing ? `<p class="small muted">${icon('feather')} already on your life list — seen ${existing.count} time${existing.count === 1 ? '' : 's'}</p>` : `<p class="small" style="color:var(--rust);font-weight:700">${icon('sparkle')} would be a new species for you!</p>`}
      ${top.fieldNotes ? `<p class="small muted" style="max-width:300px;margin:6px auto">“${esc(top.fieldNotes)}”</p>` : ''}
      <div style="margin-top:10px">${washBtn('Yes — that\'s the bird', { color: PIGMENT.moss, icon: 'check', id: 'confirm-top', w: 230 })}</div>
    </div>` : ''}
    <div id="alts"></div>
    <div class="btn-row" style="justify-content:center;margin-top:10px">
      ${ghostBtn(cands.length > 1 ? 'None of these — I\'ll name it' : 'Not this one — I\'ll name it', { id: 'manual' })}
      ${ghostBtn('Discard sighting', { id: 'discard' })}
    </div>
  `;

  const alts = stage.querySelector('#alts');
  if (cands.length > 1) {
    alts.innerHTML = `<h3 style="font-size:1.4rem;margin:16px 2px 2px;color:var(--ink-soft)">Or was it…</h3>` +
      cands.slice(1, 4).map((c, i) => {
        const art = artForSpecies(c);
        return `<div class="cand" data-i="${i + 1}" role="button" tabindex="0">
          ${panelBg('cand-' + i + '-' + sighting.id, { w: 340, h: 90 })}
          <div class="entry-art">${birdSVG(art, { seed: 'cand-' + i, withGround: false })}</div>
          <div><p class="entry-name" style="font-size:1.3rem">${esc(c.commonName)}</p>
          <span class="sci small">${esc(c.sciName || '')}</span>
          <div>${confMeter(c.confidence || 0.3)}</div></div>
        </div>`;
      }).join('');
    alts.querySelectorAll('.cand').forEach(row =>
      row.addEventListener('click', () => finishConfirm(stage, sighting, cands[+row.dataset.i], onDone)));
  }

  const btnTop = stage.querySelector('#confirm-top');
  if (btnTop) btnTop.addEventListener('click', () => finishConfirm(stage, sighting, top, onDone));
  stage.querySelector('#manual').addEventListener('click', () => showManualStep(stage, sighting, onDone));
  stage.querySelector('#discard').addEventListener('click', async () => {
    await store.deleteSighting(sighting.id);
    toast('Discarded');
    onDone();
  });
}

/* manual species entry: search the guide or write your own */
export function showManualStep(stage, sighting, onDone) {
  stage.innerHTML = `
    <h2 style="font-size:1.8rem;margin:8px 2px">Name this bird</h2>
    <div class="field"><label for="f-species">Species</label>
      <input type="search" id="f-species" placeholder="start writing a name…" autocomplete="off"></div>
    <div id="suggestions"></div>
    <div class="btn-row" style="justify-content:center;margin-top:8px">${ghostBtn('Back', { id: 'back' })}</div>
  `;
  const input = stage.querySelector('#f-species');
  const sugg = stage.querySelector('#suggestions');
  const all = Object.entries(SPECIES_ART).map(([key, v]) => ({ key, ...v }));

  const paint = () => {
    const q = input.value.trim().toLowerCase();
    const hits = q ? all.filter(s => s.common.toLowerCase().includes(q) || s.sci.toLowerCase().includes(q)).slice(0, 6) : [];
    sugg.innerHTML = hits.map(h => `<div class="cand" data-key="${h.key}" role="button" tabindex="0">
        ${panelBg('sugg-' + h.key, { w: 340, h: 80 })}
        <div class="entry-art">${birdSVG({ key: h.key, ...h }, { seed: 'sugg-' + h.key, withGround: false })}</div>
        <div><p class="entry-name" style="font-size:1.25rem">${esc(h.common)}</p><span class="sci small">${esc(h.sci)}</span></div>
      </div>`).join('') +
      (q ? `<div class="cand" data-custom="1" role="button" tabindex="0">${panelBg('sugg-custom', { w: 340, h: 60 })}
        <div style="width:44px;text-align:center">${icon('pencil')}</div>
        <p class="entry-name" style="font-size:1.2rem">Use “${esc(input.value.trim())}” as the species</p></div>` : '');
    sugg.querySelectorAll('.cand').forEach(row => row.addEventListener('click', () => {
      let cand;
      if (row.dataset.custom) {
        cand = { commonName: input.value.trim(), sciName: '', confidence: 1, manual: true };
      } else {
        const h = all.find(x => x.key === row.dataset.key);
        cand = { commonName: h.common, sciName: h.sci, confidence: 1, manual: true };
      }
      finishConfirm(stage, sighting, cand, onDone);
    }));
  };
  input.addEventListener('input', paint);
  input.focus();
  stage.querySelector('#back').addEventListener('click', () => showResultStep(stage, sighting, onDone));
}

const confirming = new WeakSet();
async function finishConfirm(stage, sighting, cand, onDone) {
  if (confirming.has(sighting)) return; // double-tap guard
  confirming.add(sighting);
  stage.querySelectorAll('button, .cand').forEach(b => { b.style.pointerEvents = 'none'; });
  const { isNew } = await store.confirmSighting(sighting, cand);
  if (isNew) {
    const art = store.artFor(sighting.speciesKey);
    await celebrate(art);
    toast(`${cand.commonName} added — a lifer!`, 3000);
  } else {
    toast(`${cand.commonName} added to your journal`);
  }
  onDone();
}
