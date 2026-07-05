/* seed.js — fills the journal with sample sightings (?seed=demo).
   Photos are generated on a canvas so the demo works fully offline and
   ships no copyrighted images. ?seed=clear empties everything. */

import { db, newId } from './db.js';
import * as store from './store.js';
import { SPECIES_ART } from './art/birds.js';

export async function clearAll() {
  await db.clear('sightings');
  await db.clear('species');
  await store.load();
}

const PLACES = [
  { place: 'Stewart Park', lat: 42.4614, lon: -76.5044 },
  { place: 'Sapsucker Woods', lat: 42.4801, lon: -76.4512 },
  { place: 'Backyard feeder', lat: 42.4433, lon: -76.5019 },
  { place: 'Cascadilla Gorge', lat: 42.4423, lon: -76.4855 },
  { place: 'Beebe Lake trail', lat: 42.4519, lon: -76.4785 },
  { place: 'Community garden', lat: 42.4380, lon: -76.5100 },
];

const NOTES = {
  'cardinalis-cardinalis': ['Singing from the top of the spruce, bright as a wax seal.', 'Pair at the feeder — she does all the deciding.'],
  'poecile-atricapillus': ['Took a seed from my palm! Braver than me.', 'Chick-a-dee-dee-dee — three dees. Mild alarm, probably me.'],
  'turdus-migratorius': ['Head cocked, listening to the lawn like a safecracker.'],
  'cyanocitta-cristata': ['Screamed like a hawk, fooled everyone including me.'],
  'spinus-tristis': ['Bouncing flight over the thistle patch, dipped like a ribbon.'],
  'dryobates-pubescens': ['Working the dead maple limb, quiet taps, very businesslike.'],
  'buteo-jamaicensis': ['Kettle of two riding the thermal over the gorge.'],
  'zenaida-macroura': ['Wings whistled on takeoff from the wire.'],
  'thryothorus-ludovicianus': ['Tea-kettle-tea-kettle from inside the woodpile. Tiny voice, huge opinion.'],
  'bombycilla-cedrorum': ['A dozen of them stripping the serviceberry in complete silence.'],
  'piranga-olivacea': ['A coal burning in the green canopy. Stood still for ten minutes.'],
  'passerina-ciris': ['Cannot believe it. Looked hand-colored. Shaking a little.'],
  'sitta-carolinensis': ['Upside down on the trunk, judging gravity.'],
  'anas-platyrhynchos': ['Tails-up in the shallows, extremely undignified.'],
  'megaceryle-alcyon': ['Rattled past twice, patrolling the creek like a beat cop.'],
  'bubo-virginianus': ['Heard first — then the whole silhouette turned its head. Chills.'],
};

/* deterministic pseudo-random from a string */
function srand(seed) {
  let a = 0;
  for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

/* a plausible "photo": sky wash matched to time of day, habitat, and a
   silhouette matched to the species' body shape — canvas-made */
function fakePhoto(key, i, hour = 10) {
  const r = srand(key + i);
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 640;
  const ctx = canvas.getContext('2d');
  const art = SPECIES_ART[key];
  const shape = art && art.traits && art.traits.shape ? art.traits.shape : 'songbird';
  const night = hour >= 20 || hour < 6;
  const dusk = !night && (hour >= 18 || hour < 8);
  const skies = night ? [['#2e3444', '#1d2230']]
    : dusk ? [['#e8cfae', '#c9a184'], ['#dfc4b0', '#b394a0']]
    : [['#cfe0e8', '#a8c3d1'], ['#e8e3cf', '#c9d1a8'], ['#dfe8ea', '#b3c4cc']];
  const sky = skies[Math.floor(r() * skies.length)];
  const g = ctx.createLinearGradient(0, 0, 0, 640);
  g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 480, 640);
  const water = shape === 'duck' || shape === 'longneck';
  // soft foliage / shore blobs
  for (let b = 0; b < 5; b++) {
    const shade = night ? 30 : 90;
    ctx.fillStyle = `rgba(${shade + r() * 40},${shade + 20 + r() * 40},${shade - 20 + r() * 30},0.25)`;
    ctx.beginPath();
    ctx.ellipse(r() * 480, r() * 300, 90 + r() * 120, 60 + r() * 90, r(), 0, Math.PI * 2);
    ctx.fill();
  }
  const dark = night ? '#20222a' : (art ? art.colors.body : '#333');
  let bx = 180 + r() * 120, byy;
  if (water) {
    // waterline scene
    const wy = 400 + r() * 60;
    ctx.fillStyle = night ? 'rgba(40,50,66,0.9)' : 'rgba(120,150,155,0.7)';
    ctx.fillRect(0, wy, 480, 640 - wy);
    for (let k2 = 0; k2 < 8; k2++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); const ry = wy + 20 + r() * 160;
      ctx.moveTo(r() * 300, ry); ctx.lineTo(100 + r() * 340, ry); ctx.stroke();
    }
    byy = wy - 4;
    ctx.fillStyle = dark; ctx.globalAlpha = 0.92;
    if (shape === 'duck') {
      ctx.beginPath(); ctx.ellipse(bx, byy - 20, 56, 30, 0, 0, Math.PI * 2); ctx.fill();     // body on water
      ctx.beginPath(); ctx.ellipse(bx + 42, byy - 58, 17, 15, 0, 0, Math.PI * 2); ctx.fill(); // head
      ctx.beginPath(); ctx.moveTo(bx + 56, byy - 60); ctx.lineTo(bx + 80, byy - 54); ctx.lineTo(bx + 56, byy - 50); ctx.fill();
      ctx.fillRect(bx + 36, byy - 48, 10, 14); // neck
    } else {
      ctx.beginPath(); ctx.ellipse(bx, byy - 90, 40, 26, 0.1, 0, Math.PI * 2); ctx.fill();   // heron body
      ctx.fillRect(bx + 18, byy - 150, 8, 66);                                                // neck
      ctx.beginPath(); ctx.ellipse(bx + 26, byy - 152, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 37, byy - 154); ctx.lineTo(bx + 72, byy - 148); ctx.lineTo(bx + 37, byy - 144); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(bx - 8, byy - 68); ctx.lineTo(bx - 10, byy + 4); ctx.moveTo(bx + 10, byy - 66); ctx.lineTo(bx + 14, byy + 4); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    // branch scene
    ctx.strokeStyle = night ? '#15161c' : '#4a3a28'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    const by = 380 + r() * 120;
    ctx.beginPath(); ctx.moveTo(-10, by + 30); ctx.quadraticCurveTo(240, by - 20, 500, by + 10); ctx.stroke();
    byy = by - 40;
    ctx.fillStyle = dark; ctx.globalAlpha = 0.92;
    if (shape === 'owl') {
      ctx.beginPath(); ctx.ellipse(bx, byy - 20, 44, 56, 0, 0, Math.PI * 2); ctx.fill();      // upright body
      ctx.beginPath(); ctx.ellipse(bx, byy - 74, 34, 26, 0, 0, Math.PI * 2); ctx.fill();      // big head
      ctx.beginPath(); ctx.moveTo(bx - 30, byy - 92); ctx.lineTo(bx - 20, byy - 116); ctx.lineTo(bx - 10, byy - 94); ctx.fill(); // tufts
      ctx.beginPath(); ctx.moveTo(bx + 30, byy - 92); ctx.lineTo(bx + 20, byy - 116); ctx.lineTo(bx + 10, byy - 94); ctx.fill();
    } else if (shape === 'raptor') {
      ctx.beginPath(); ctx.ellipse(bx, byy - 16, 48, 62, 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx + 14, byy - 80, 22, 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 32, byy - 84); ctx.lineTo(bx + 48, byy - 76); ctx.lineTo(bx + 32, byy - 70); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 20, byy + 30); ctx.lineTo(bx - 44, byy + 74); ctx.lineTo(bx - 26, byy + 80); ctx.lineTo(bx - 6, byy + 40); ctx.fill(); // tail
    } else {
      ctx.beginPath(); ctx.ellipse(bx, byy, 46, 34, -0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx + 38, byy - 28, 22, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 40, byy); ctx.lineTo(bx - 88, byy + 26); ctx.lineTo(bx - 78, byy + 40); ctx.lineTo(bx - 34, byy + 16); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 58, byy - 30); ctx.lineTo(bx + 76, byy - 24); ctx.lineTo(bx + 58, byy - 20); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (night) { // moonlight rim
    ctx.fillStyle = 'rgba(232,226,200,0.85)';
    ctx.beginPath(); ctx.arc(390, 90, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sky[0];
    ctx.beginPath(); ctx.arc(378, 82, 30, 0, Math.PI * 2); ctx.fill();
  }
  // grain
  for (let n = 0; n < 900; n++) {
    ctx.fillStyle = `rgba(60,50,40,${r() * 0.06})`;
    ctx.fillRect(r() * 480, r() * 640, 1.4, 1.4);
  }
  return canvas.toDataURL('image/jpeg', 0.82);
}

/* (speciesKey, daysAgo, hour, placeIndex) */
const PLAN = [
  ['poecile-atricapillus',      0,  6.8, 2],
  ['cardinalis-cardinalis',     0,  7.5, 2],
  ['turdus-migratorius',        1,  8.2, 0],
  ['spinus-tristis',            1, 17.4, 5],
  ['cyanocitta-cristata',       2,  9.1, 1],
  ['dryobates-pubescens',       4, 10.3, 1],
  ['zenaida-macroura',          6, 19.0, 2],
  ['thryothorus-ludovicianus',  8,  7.9, 3],
  ['cardinalis-cardinalis',     9, 18.2, 2],
  ['buteo-jamaicensis',        11, 13.6, 3],
  ['sitta-carolinensis',       13,  9.8, 1],
  ['anas-platyrhynchos',       16, 11.2, 0],
  ['megaceryle-alcyon',        18,  8.6, 4],
  ['bombycilla-cedrorum',      21, 12.4, 4],
  ['poecile-atricapillus',     24,  7.2, 2],
  ['piranga-olivacea',         27, 10.9, 1],
  ['bubo-virginianus',         33, 21.8, 3],
  ['passerina-ciris',          41,  9.4, 5],
];

export async function seedDemo(variant = 'demo') {
  await clearAll();
  const now = new Date();
  const usedNotes = {};
  // oldest first so species first-seen dates are right
  const plan = [...PLAN].sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < plan.length; i++) {
    const [key, daysAgo, hour, placeIdx] = plan[i];
    const art = SPECIES_ART[key];
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, Math.floor(hour), Math.round((hour % 1) * 60));
    const loc = PLACES[placeIdx];
    const r = srand(key + daysAgo);
    const noteList = NOTES[key] || ['Lovely look through the glasses.'];
    const ni = (usedNotes[key] = (usedNotes[key] || 0)) % noteList.length;
    usedNotes[key]++;
    const sighting = {
      id: newId() + '-' + i,
      dateISO: d.toISOString(),
      photo: fakePhoto(key, i, hour),
      place: loc.place,
      lat: loc.lat + (r() - 0.5) * 0.006,
      lon: loc.lon + (r() - 0.5) * 0.006,
      notes: noteList[ni],
      idStatus: 'queued',
      candidates: [],
    };
    await store.saveSighting(sighting);
    await store.confirmSighting(sighting, {
      commonName: art.common, sciName: art.sci, confidence: 0.95,
      fieldNotes: art.habitat ? `${art.habitat}.` : '',
    });
  }
  if (variant === 'states') {
    // add a queued and a needs-confirm entry for testing pending states
    const q = {
      id: newId(), dateISO: new Date().toISOString(), photo: fakePhoto('cardinalis-cardinalis', 99),
      place: 'Backyard feeder', lat: 42.4433, lon: -76.5019, notes: 'Quick flash of red, camera slower than the bird.',
      idStatus: 'queued', candidates: [],
    };
    await store.saveSighting(q);
    const nc = {
      id: newId(), dateISO: new Date().toISOString(), photo: fakePhoto('spinus-tristis', 98),
      place: 'Community garden', lat: 42.438, lon: -76.51, notes: 'Yellow blur on the fence.',
      idStatus: 'needs_confirm',
      candidates: [
        { commonName: 'American Goldfinch', sciName: 'Spinus tristis', confidence: 0.55, fieldNotes: 'Small yellow finch, dark wings.' },
        { commonName: 'Yellow Warbler', sciName: 'Setophaga petechia', confidence: 0.3, fieldNotes: 'All-yellow warbler with plain face.' },
      ],
    };
    await store.saveSighting(nc);
  }
}
