/* store.js — app state over IndexedDB, plus every derived number the
   journal shows: life list, streaks, badges, seasonal progress. */

import { db, newId } from './db.js';
import { SPECIES_ART, artForSpecies, slugify } from './art/birds.js';

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

let cache = { sightings: [], species: [] };
let loaded = false;

export async function load() {
  const [sightings, species] = await Promise.all([db.all('sightings'), db.all('species')]);
  // purge not-a-bird records left behind by a mid-flow exit: they are
  // invisible in every view, so keeping them would just leak photos
  const orphans = sightings.filter(s => s.idStatus === 'not_bird');
  for (const o of orphans) await db.del('sightings', o.id);
  const kept = sightings.filter(s => s.idStatus !== 'not_bird');
  kept.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  cache = { sightings: kept, species };
  loaded = true;
  return cache;
}
export function ready() { return loaded; }
export function getSightings() { return cache.sightings; }
export function getSighting(id) { return cache.sightings.find(s => s.id === id); }
export function getSpecies() { return cache.species; }
export function getSpeciesByKey(key) { return cache.species.find(s => s.key === key); }

export async function saveSighting(s) {
  if (!s.id) s.id = newId();
  await db.put('sightings', s);
  const i = cache.sightings.findIndex(x => x.id === s.id);
  if (i >= 0) cache.sightings[i] = s; else cache.sightings.push(s);
  cache.sightings.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  emit();
  return s;
}

export async function deleteSighting(id) {
  const s = getSighting(id);
  await db.del('sightings', id);
  cache.sightings = cache.sightings.filter(x => x.id !== id);
  if (s && s.speciesKey) await recountSpecies(s.speciesKey);
  emit();
}

async function recountSpecies(key) {
  const remaining = cache.sightings.filter(x => x.speciesKey === key && x.idStatus === 'confirmed');
  if (remaining.length === 0) {
    await db.del('species', key);
    cache.species = cache.species.filter(x => x.key !== key);
  } else {
    const sp = getSpeciesByKey(key);
    if (sp) {
      sp.count = remaining.length;
      sp.firstSeenISO = remaining[remaining.length - 1].dateISO;
      await db.put('species', sp);
    }
  }
}

/* Confirm an identification: attach species to the sighting, grow the
   life list, report whether this is a brand-new species (celebration!). */
export async function confirmSighting(sighting, cand) {
  const key = slugify(cand.sciName || cand.commonName);
  const known = SPECIES_ART[key];
  const art = artForSpecies({
    sciName: cand.sciName, commonName: cand.commonName,
    plumage: cand.plumage, traits: cand.traits, shape: cand.shape,
  });
  sighting.idStatus = 'confirmed';
  sighting.speciesKey = key;
  sighting.commonName = cand.commonName;
  sighting.sciName = cand.sciName || (known ? known.sci : '');
  sighting.fieldNotes = cand.fieldNotes || sighting.fieldNotes || '';
  sighting.rarity = known ? known.rarity : (cand.rarity || 'uncommon');

  let sp = getSpeciesByKey(key);
  const isNew = !sp;
  if (!sp) {
    sp = {
      key,
      commonName: cand.commonName,
      sciName: sighting.sciName,
      rarity: sighting.rarity,
      firstSeenISO: sighting.dateISO,
      count: 0,
      art: known ? null : { colors: art.colors, traits: art.traits },
    };
    cache.species.push(sp);
  }
  await saveSighting(sighting);
  // recount from the source of truth so a double confirm stays idempotent
  const mine = cache.sightings.filter(x => x.speciesKey === key && x.idStatus === 'confirmed');
  sp.count = mine.length;
  sp.firstSeenISO = mine.reduce((a, x) => (x.dateISO < a ? x.dateISO : a), sighting.dateISO);
  await db.put('species', sp);
  sighting.isNewSpecies = isNew;
  return { isNew, species: sp };
}

export function artFor(keyOrRecord) {
  if (typeof keyOrRecord === 'string') {
    const sp = getSpeciesByKey(keyOrRecord);
    if (sp) return artFor(sp);
    const known = SPECIES_ART[keyOrRecord];
    if (known) return { key: keyOrRecord, ...known };
    return artForSpecies({ sciName: keyOrRecord });
  }
  const rec = keyOrRecord;
  const known = SPECIES_ART[rec.key];
  if (known && !rec.art) return { key: rec.key, ...known };
  return artForSpecies({
    sciName: rec.sciName, commonName: rec.commonName,
    plumage: rec.art && rec.art.colors, traits: rec.art && rec.art.traits,
  });
}

/* ---------------- derived stats ---------------- */

function dayKey(iso) { return iso.slice(0, 10); }

export function stats() {
  const sightings = cache.sightings.filter(s => s.idStatus !== 'not_bird');
  const confirmed = sightings.filter(s => s.idStatus === 'confirmed');
  const days = [...new Set(sightings.map(s => dayKey(s.dateISO)))].sort();
  const streak = currentStreak(days);
  const places = new Set(confirmed.map(s => (s.place || '').trim().toLowerCase()).filter(Boolean));
  return {
    totalSightings: sightings.length,
    speciesCount: cache.species.length,
    streak,
    places: places.size,
    rarest: rarest(),
  };
}

function currentStreak(dayKeys) {
  if (!dayKeys.length) return 0;
  const set = new Set(dayKeys);
  const today = new Date();
  let d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const fmt = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  // A streak may end today or yesterday and still count as "alive".
  if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
export function rarest() {
  let best = null;
  for (const sp of cache.species) {
    if (!best || (RARITY_ORDER[sp.rarity] || 0) > (RARITY_ORDER[best.rarity] || 0)) best = sp;
  }
  return best;
}

export const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };
export const RARITY_COLOR = { common: '#7c8b58', uncommon: '#4e7d78', rare: '#7d5a72', legendary: '#c39a4a' };

/* ---------------- badges ---------------- */

export const BADGES = [
  { id: 'first-feather', name: 'First Feather', icon: 'feather', color: '#7c8b58', desc: 'Record your first sighting', test: st => st.totalSightings >= 1 },
  { id: 'ten-pages', name: 'Ten Pages', icon: 'journal', color: '#4e7d78', desc: '10 sightings in the journal', test: st => st.totalSightings >= 10 },
  { id: 'field-hand', name: 'Field Hand', icon: 'pencil', color: '#5f7382', desc: '30 sightings in the journal', test: st => st.totalSightings >= 30 },
  { id: 'five-species', name: 'Five Lifers', icon: 'egg', color: '#c39a4a', desc: '5 species on the life list', test: st => st.speciesCount >= 5 },
  { id: 'fifteen-species', name: 'Full Aviary', icon: 'binoculars', color: '#b0603f', desc: '15 species on the life list', test: st => st.speciesCount >= 15 },
  { id: 'rare-find', name: 'Rare Find', icon: 'sparkle', color: '#7d5a72', desc: 'Spot a rare bird', test: (st, ctx) => ctx.species.some(sp => sp.rarity === 'rare' || sp.rarity === 'legendary') },
  { id: 'legend', name: 'Once in a Life', icon: 'seal', color: '#c39a4a', desc: 'Spot a legendary bird', test: (st, ctx) => ctx.species.some(sp => sp.rarity === 'legendary') },
  { id: 'streak-3', name: 'Three Dawn Walk', icon: 'tally', color: '#7c8b58', desc: 'Bird 3 days in a row', test: st => st.streak >= 3 },
  { id: 'streak-7', name: 'Week in the Field', icon: 'sun', color: '#b0603f', desc: 'Bird 7 days in a row', test: st => st.streak >= 7 },
  { id: 'early-bird', name: 'Early Bird', icon: 'sun', color: '#d9b25f', desc: 'A sighting before 7 am', test: (st, ctx) => ctx.sightings.some(s => s.idStatus === 'confirmed' && +s.dateISO.slice(11, 13) < 7) },
  { id: 'night-owl', name: 'Night Owl', icon: 'moon', color: '#5f7382', desc: 'A sighting after 9 pm', test: (st, ctx) => ctx.sightings.some(s => s.idStatus === 'confirmed' && +s.dateISO.slice(11, 13) >= 21) },
  { id: 'wanderer', name: 'Wanderer', icon: 'map', color: '#4e7d78', desc: 'Bird in 5 different places', test: st => st.places >= 5 },
];

export function badges() {
  const st = stats();
  const ctx = { sightings: cache.sightings, species: cache.species };
  return BADGES.map(b => ({ ...b, earned: !!b.test(st, ctx) }));
}

/* ---------------- almanac: likely this month ---------------- */

export function likelyThisMonth(month = new Date().getMonth() + 1) {
  const out = [];
  for (const [key, sp] of Object.entries(SPECIES_ART)) {
    if (!sp.months.includes(month)) continue;
    const seen = getSpeciesByKey(key);
    const seenThisSeason = cache.sightings.some(s =>
      s.speciesKey === key && s.idStatus === 'confirmed' &&
      +s.dateISO.slice(5, 7) === month);
    out.push({ key, ...sp, everSeen: !!seen, seenThisMonth: seenThisSeason });
  }
  const order = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  out.sort((a, b) => (order[a.rarity] - order[b.rarity]) || a.common.localeCompare(b.common));
  return out;
}

export function formatDate(iso, opts = {}) {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', ...opts.date });
  if (opts.withTime === false) return date;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function seasonName(month = new Date().getMonth() + 1) {
  if ([12, 1, 2].includes(month)) return 'Winter';
  if ([3, 4, 5].includes(month)) return 'Spring';
  if ([6, 7, 8].includes(month)) return 'Summer';
  return 'Autumn';
}
