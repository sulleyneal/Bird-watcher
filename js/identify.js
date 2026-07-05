/* identify.js — client for the species-identification service.
   The vision call needs a network round-trip, so it runs through a queue:
   capture works fully offline, and queued sightings identify themselves
   when a connection returns. */

import { getSightings, saveSighting, getSpecies, onChange } from './store.js';

let mode = null; // 'live' | 'mock' | null (unknown)
const modeListeners = new Set();
export function idMode() { return mode; }
export function onModeChange(fn) { modeListeners.add(fn); }

export async function checkHealth() {
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    const j = await r.json();
    mode = j.mode;
  } catch (e) { /* offline: leave unknown */ }
  modeListeners.forEach(fn => fn(mode));
  return mode;
}

/* One identification round-trip. Throws on network failure. */
export async function identifyPhoto(photoDataURL, extra = {}) {
  const m = photoDataURL.match(/^data:(image\/\w+);base64,(.*)$/s);
  if (!m) throw new Error('bad-photo');
  const body = {
    mediaType: m[1],
    image: m[2],
    month: new Date().getMonth() + 1,
    existingSpecies: getSpecies().map(s => s.commonName),
    ...extra,
  };
  const res = await fetch('api/identify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error('identify-failed');
    err.status = res.status;
    try { err.detail = (await res.json()).error; } catch (e) {}
    throw err;
  }
  const j = await res.json();
  mode = j.source || mode;
  modeListeners.forEach(fn => fn(mode));
  return j.result; // {kind, candidates:[{commonName,sciName,confidence,fieldNotes,plumage,traits,shape,rarity}], note}
}

/* Apply a result to a sighting record (does not confirm species —
   confirmation is always the birder's call). */
export function applyResult(sighting, result) {
  sighting.idResult = result;
  if (result.kind === 'bird' && result.candidates && result.candidates.length) {
    sighting.idStatus = 'needs_confirm';
    sighting.candidates = result.candidates;
  } else if (result.kind === 'not_bird') {
    sighting.idStatus = 'not_bird';
    sighting.candidates = [];
  } else {
    sighting.idStatus = 'unclear';
    sighting.candidates = result.candidates || [];
  }
  return sighting;
}

/* ---------------- offline queue ---------------- */

let processing = false;
const queueListeners = new Set();
export function onQueueEvent(fn) { queueListeners.add(fn); }
function announce(evt) { queueListeners.forEach(fn => fn(evt)); }

export function queuedCount() {
  return getSightings().filter(s => s.idStatus === 'queued').length;
}

export async function processQueue() {
  if (processing || !navigator.onLine) return;
  const queued = getSightings().filter(s => s.idStatus === 'queued');
  if (!queued.length) return;
  processing = true;
  try {
    for (const s of queued) {
      try {
        const result = await identifyPhoto(s.photo);
        applyResult(s, result);
        await saveSighting(s);
        announce({ type: 'identified', sighting: s });
      } catch (e) {
        if (!navigator.onLine) break; // lost connection again; keep queued
        // Server reachable but errored: leave queued, stop hammering.
        break;
      }
    }
  } finally {
    processing = false;
  }
}

export function initQueue() {
  window.addEventListener('online', () => { checkHealth(); processQueue(); });
  checkHealth().then(() => processQueue());
  // also retry occasionally while the app is open
  setInterval(() => processQueue(), 45000);
}
