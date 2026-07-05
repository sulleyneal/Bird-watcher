/* birds.js — parameterized watercolor bird illustrations.
   Every species is painted from a palette + trait set: layered translucent
   washes with turbulence-displaced edges, granulation, ink accents.
   Species the app has never heard of get painted from the plumage colors
   and traits the vision model reports, so nothing falls back to stock art. */

import {
  rng, hashString, nextId, blobPath, smoothClosed, inkLine,
  wcFilter, wcSoftFilter, grainFilter, shade, lighten, mix, PIGMENT,
} from './paint.js';

export function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ------------------------------------------------------------------ */
/* Species art database: palette + traits + rarity + season months.   */
/* Months are 1-12 (when you'd expect the bird in a typical northern  */
/* temperate backyard); habitat is a field-guide one-liner.           */
/* ------------------------------------------------------------------ */

const S = (common, sci, rarity, months, habitat, colors, traits = {}) =>
  ({ common, sci, rarity, months, habitat, colors, traits });

export const SPECIES_ART = {
  'cardinalis-cardinalis': S('Northern Cardinal', 'Cardinalis cardinalis', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Thickets, feeders, and wood edges',
    { body:'#b8402e', belly:'#c4553b', head:'#b8402e', wing:'#9c3322', tail:'#8f2d1f', beak:'#cc6b3d', accent:'#33261f' },
    { crest:true, mask:true }),
  'cyanocitta-cristata': S('Blue Jay', 'Cyanocitta cristata', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Oak woods and noisy backyards',
    { body:'#6d8fac', belly:'#e6deca', head:'#5d81a3', wing:'#4a6f96', tail:'#44688f', beak:'#3a3630', accent:'#32404e' },
    { crest:true, wingbar:true, necklace:true }),
  'turdus-migratorius': S('American Robin', 'Turdus migratorius', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Lawns, tugging at earthworms',
    { body:'#7b6a56', belly:'#c4683c', head:'#4e453a', wing:'#6f6152', tail:'#5d5244', beak:'#d3a04a', accent:'#4e453a' },
    { eyeRing:true }),
  'poecile-atricapillus': S('Black-capped Chickadee', 'Poecile atricapillus', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Cheerful acrobat of winter feeders',
    { body:'#a9a08c', belly:'#d6cbb2', head:'#e6ddc6', wing:'#8d8674', tail:'#8d8674', beak:'#3a332a', accent:'#33291f' },
    { capped:true, throatPatch:true, plump:true }),
  'baeolophus-bicolor': S('Tufted Titmouse', 'Baeolophus bicolor', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Echoing "peter-peter" in the canopy',
    { body:'#97a0a8', belly:'#d8cfc0', head:'#9aa3ab', wing:'#8b959e', tail:'#8b959e', beak:'#3f3a33', accent:'#8a959e' },
    { crest:true, plump:true }),
  'haemorhous-mexicanus': S('House Finch', 'Haemorhous mexicanus', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Rosy chatter on porch feeders',
    { body:'#a08b74', belly:'#cbbfa8', head:'#b5533f', wing:'#8f7d68', tail:'#8f7d68', beak:'#8a7457', accent:'#b5533f' },
    { streaked:true }),
  'spinus-tristis': S('American Goldfinch', 'Spinus tristis', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Bouncing flight over thistle fields',
    { body:'#d9b93f', belly:'#e3cc6a', head:'#d9b93f', wing:'#3b362c', tail:'#3b362c', beak:'#c98f45', accent:'#2e2a22' },
    { capped:true, wingbar:true }),
  'dryobates-pubescens': S('Downy Woodpecker', 'Dryobates pubescens', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Tapping softly on dead limbs',
    { body:'#e0d8c4', belly:'#e6dfcc', head:'#e3dbc6', wing:'#33302a', tail:'#33302a', beak:'#3a352c', accent:'#b8402e' },
    { capped:true, wingbar:true, spotted:true, longBeak:true }),
  'buteo-jamaicensis': S('Red-tailed Hawk', 'Buteo jamaicensis', 'uncommon', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Circling high over open fields',
    { body:'#8a7256', belly:'#d6c7a8', head:'#7c664c', wing:'#6f5b44', tail:'#a5563a', beak:'#4a4238', accent:'#5e4c39' },
    { shape:'raptor' }),
  'zenaida-macroura': S('Mourning Dove', 'Zenaida macroura', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Soft coos from the wires at dusk',
    { body:'#b3a288', belly:'#c9b596', head:'#b8a68b', wing:'#a5947a', tail:'#93826a', beak:'#4c443a', accent:'#6b5f4c' },
    { longTail:true, spotted:true, smallHead:true }),
  'mimus-polyglottos': S('Northern Mockingbird', 'Mimus polyglottos', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Singing every song but its own',
    { body:'#a9a496', belly:'#cfc9b8', head:'#9c978a', wing:'#7c776b', tail:'#6b675c', beak:'#3f3a33', accent:'#7c776b' },
    { longTail:true, wingbar:true }),
  'sturnus-vulgaris': S('European Starling', 'Sturnus vulgaris', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Glossy mobs whistling on rooftops',
    { body:'#4b4f46', belly:'#55584e', head:'#43463f', wing:'#3d4038', tail:'#3d4038', beak:'#cfc23f', accent:'#5d6157' },
    { spotted:true }),
  'passer-domesticus': S('House Sparrow', 'Passer domesticus', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Bickering in the hedge by the café',
    { body:'#9b8668', belly:'#c0b096', head:'#8a7a62', wing:'#8a6f50', tail:'#7c6448', beak:'#443c31', accent:'#3c332a' },
    { capped:true, throatPatch:true, wingbar:true }),
  'melospiza-melodia': S('Song Sparrow', 'Melospiza melodia', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Streaky soloist of brushy edges',
    { body:'#9d8a6d', belly:'#d3c7ab', head:'#8f7b5e', wing:'#8a744f', tail:'#8a744f', beak:'#57493a', accent:'#6e5b45' },
    { streaked:true, eyeStripe:true }),
  'sitta-carolinensis': S('White-breasted Nuthatch', 'Sitta carolinensis', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Walking headfirst down the trunk',
    { body:'#93a0ab', belly:'#e3dcc8', head:'#93a0ab', wing:'#7f8c98', tail:'#7f8c98', beak:'#3c3933', accent:'#2e3339' },
    { capped:true, longBeak:true, shortTail:true }),
  'thryothorus-ludovicianus': S('Carolina Wren', 'Thryothorus ludovicianus', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Tea-kettle! from the woodpile',
    { body:'#a5714a', belly:'#d0a878', head:'#9c683f', wing:'#96653f', tail:'#96653f', beak:'#57493a', accent:'#e8dfc8' },
    { eyeStripe:true, cockedTail:true, plump:true }),
  'agelaius-phoeniceus': S('Red-winged Blackbird', 'Agelaius phoeniceus', 'common', [2,3,4,5,6,7,8,9,10],
    'Flashing epaulets over the cattails',
    { body:'#35302a', belly:'#3a352e', head:'#35302a', wing:'#322d27', tail:'#2c2822', beak:'#3a352d', accent:'#b8402e' },
    { epaulet:true }),
  'quiscalus-quiscula': S('Common Grackle', 'Quiscalus quiscula', 'common', [2,3,4,5,6,7,8,9,10,11],
    'Iridescent swagger across the lawn',
    { body:'#3c3a40', belly:'#43414a', head:'#34405c', wing:'#38363e', tail:'#302e35', beak:'#3a3630', accent:'#d8d2b8' },
    { longTail:true, paleEye:true }),
  'hirundo-rustica': S('Barn Swallow', 'Hirundo rustica', 'common', [4,5,6,7,8,9],
    'Skimming low over summer pastures',
    { body:'#46608a', belly:'#cf9a70', head:'#3f5880', wing:'#3c527a', tail:'#3c527a', beak:'#33302a', accent:'#a5522f' },
    { forkedTail:true, throatPatch:true, slim:true }),
  'archilochus-colubris': S('Ruby-throated Hummingbird', 'Archilochus colubris', 'uncommon', [4,5,6,7,8,9],
    'A spark hovering at the bee balm',
    { body:'#6d8b4f', belly:'#cfc9ae', head:'#5f7d45', wing:'#7d8b7a', tail:'#4e5e42', beak:'#3a352c', accent:'#b03a3f' },
    { shape:'hummer', throatPatch:true }),
  'ardea-herodias': S('Great Blue Heron', 'Ardea herodias', 'uncommon', [3,4,5,6,7,8,9,10,11],
    'Statue-still in the shallows',
    { body:'#7d8b94', belly:'#9aa5aa', head:'#d8d5c4', wing:'#6f7d87', tail:'#6f7d87', beak:'#c9a44a', accent:'#33302a' },
    { shape:'longneck' }),
  'anas-platyrhynchos': S('Mallard', 'Anas platyrhynchos', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Dabbling tails-up in the park pond',
    { body:'#97846a', belly:'#a89577', head:'#3d6b4a', wing:'#8a785f', tail:'#d8d2c0', beak:'#c9b93f', accent:'#6e4a38' },
    { shape:'duck', neckRing:true }),
  'branta-canadensis': S('Canada Goose', 'Branta canadensis', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Honking wedges across the sky',
    { body:'#8a7d64', belly:'#b3a789', head:'#33302a', wing:'#7c7057', tail:'#33302a', beak:'#33302a', accent:'#e6dfca' },
    { shape:'duck', longNeck:true, chinstrap:true }),
  'megaceryle-alcyon': S('Belted Kingfisher', 'Megaceryle alcyon', 'uncommon', [3,4,5,6,7,8,9,10,11],
    'Rattling patrol along the creek',
    { body:'#4e7d8b', belly:'#d5cdb8', head:'#46727f', wing:'#42707d', tail:'#42707d', beak:'#3a352c', accent:'#4e7d8b' },
    { crest:true, longBeak:true, bigHead:true, necklace:true }),
  'bombycilla-cedrorum': S('Cedar Waxwing', 'Bombycilla cedrorum', 'uncommon', [1,2,5,6,7,8,9,10,11,12],
    'Silky flocks stripping the berries',
    { body:'#a88d68', belly:'#c9b578', head:'#a8895f', wing:'#8f7a58', tail:'#8f7a58', beak:'#33302a', accent:'#33291f' },
    { crest:true, mask:true, waxTips:true }),
  'junco-hyemalis': S('Dark-eyed Junco', 'Junco hyemalis', 'common', [1,2,3,4,10,11,12],
    'Little snowbirds under the feeder',
    { body:'#5c5a58', belly:'#d8d2c0', head:'#4e4c4a', wing:'#565452', tail:'#4e4c4a', beak:'#cfae9c', accent:'#4e4c4a' },
    { plump:true }),
  'sialia-sialis': S('Eastern Bluebird', 'Sialia sialis', 'uncommon', [2,3,4,5,6,7,8,9,10,11],
    'A scrap of sky on a fence post',
    { body:'#5a7fa8', belly:'#e0d5bd', head:'#52779e', wing:'#4a6f96', tail:'#4a6f96', beak:'#3a352c', accent:'#cf8a5c' },
    { breastPatch:true, plump:true }),
  'icterus-galbula': S('Baltimore Oriole', 'Icterus galbula', 'uncommon', [4,5,6,7,8,9],
    'Flame in the elm tops, whistling',
    { body:'#d98a2e', belly:'#dd9838', head:'#2e2a24', wing:'#33302a', tail:'#2e2a24', beak:'#8a8272', accent:'#2e2a24' },
    { hooded:true, wingbar:true }),
  'passerina-cyanea': S('Indigo Bunting', 'Passerina cyanea', 'uncommon', [4,5,6,7,8,9],
    'Pure indigo singing on the wire',
    { body:'#4c5fa5', belly:'#5a6cae', head:'#44579e', wing:'#3e5090', tail:'#3e5090', beak:'#6b6455', accent:'#3e5090' },
    { slim:true }),
  'piranga-olivacea': S('Scarlet Tanager', 'Piranga olivacea', 'rare', [5,6,7,8,9],
    'A burning coal hidden in the canopy',
    { body:'#c23b28', belly:'#c94a35', head:'#c23b28', wing:'#2e2a24', tail:'#2e2a24', beak:'#b8a06a', accent:'#2e2a24' },
    {}),
  'bubo-virginianus': S('Great Horned Owl', 'Bubo virginianus', 'rare', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Deep hoots owning the midnight woods',
    { body:'#8a7458', belly:'#b3a084', head:'#7c684e', wing:'#75634b', tail:'#75634b', beak:'#3a342c', accent:'#d9a83f' },
    { shape:'owl' }),
  'dryocopus-pileatus': S('Pileated Woodpecker', 'Dryocopus pileatus', 'rare', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Crow-sized carpenter of deep woods',
    { body:'#33302a', belly:'#3c3831', head:'#e3dbc6', wing:'#2e2b26', tail:'#2e2b26', beak:'#8a8272', accent:'#b8402e' },
    { crest:true, eyeStripe:true, longBeak:true }),
  'corvus-brachyrhynchos': S('American Crow', 'Corvus brachyrhynchos', 'common', [1,2,3,4,5,6,7,8,9,10,11,12],
    'Clever black sentries, always talking',
    { body:'#33312e', belly:'#3a3835', head:'#2e2c29', wing:'#2b2926', tail:'#2b2926', beak:'#33312e', accent:'#44423e' },
    { bigBeak:true }),
  'bubo-scandiacus': S('Snowy Owl', 'Bubo scandiacus', 'legendary', [11,12,1,2],
    'An arctic ghost on the winter jetty',
    { body:'#e3ddc9', belly:'#e8e3d2', head:'#e6e1cf', wing:'#d5cfba', tail:'#d5cfba', beak:'#3a342c', accent:'#d9b93f' },
    { shape:'owl', spotted:true, noTufts:true }),
  'passerina-ciris': S('Painted Bunting', 'Passerina ciris', 'legendary', [4,5,6,7,8],
    'The bird that looks hand-colored',
    { body:'#6d8b4f', belly:'#c94a3f', head:'#4c5fa5', wing:'#5f7d45', tail:'#4e5e42', beak:'#8a8272', accent:'#c94a3f' },
    { slim:true }),
};

export function artForSpecies({ sciName, commonName, plumage, traits, shape } = {}) {
  const key = slugify(sciName || commonName || 'mystery-bird');
  const known = SPECIES_ART[key];
  if (known) return { key, ...known };
  /* Unknown species: paint from what the identifier told us, or from a
     seeded palette so the journal never shows a placeholder. */
  const seedRand = rng(key);
  const bases = ['#7c8b58', '#4e7d78', '#b0603f', '#7d5a72', '#5f7382', '#c39a4a', '#9d4a44', '#5a7fa8'];
  const base = bases[Math.floor(seedRand() * bases.length)];
  const p = plumage || {};
  const colors = {
    body: p.body || base,
    belly: p.breast || p.belly || lighten(p.body || base, 45),
    head: p.head || p.body || base,
    wing: p.wing || shade(p.body || base, -25),
    tail: p.tail || shade(p.wing || p.body || base, -15),
    beak: p.beak || '#57493a',
    accent: p.accent || shade(p.head || base, -35),
  };
  return {
    key, common: commonName || 'Mystery bird', sci: sciName || '',
    rarity: 'uncommon', months: [1,2,3,4,5,6,7,8,9,10,11,12],
    habitat: '', colors, traits: { ...(traits || {}), shape: shape || (traits && traits.shape) },
  };
}

/* ------------------------------------------------------------------ */
/* The painter                                                         */
/* ------------------------------------------------------------------ */

function paintLayers(d, color, f1, f2, opts = {}) {
  const { op = 0.62, dx = 1.4, dy = 1.0, darker = -28 } = opts;
  return `<path d="${d}" fill="${color}" opacity="${op}" filter="url(#${f1})"/>` +
    `<path d="${d}" fill="${shade(color, darker)}" opacity="${op * 0.4}" filter="url(#${f2})" transform="translate(${dx},${dy})"/>`;
}
function paintSoft(d, color, f, op = 0.5) {
  return `<path d="${d}" fill="${color}" opacity="${op}" filter="url(#${f})"/>`;
}

/* Main entry: returns a self-contained SVG string, viewBox 0 0 220 220. */
export function birdSVG(art, opts = {}) {
  const { seed = art.key || 'bird', withBackdrop = true, withGround = true } = opts;
  const rand = rng(seed + '-paint');
  const sn = hashString(String(seed));
  const c = art.colors, t = art.traits || {};
  const shape = t.shape || art.shape || 'songbird';
  const f1 = nextId('f'), f2 = nextId('f'), f3 = nextId('f'), fg = nextId('f'), fi = nextId('f');
  const defs = wcSoftFilter(f1, sn, 8, 0.032, 0.6) + wcFilter(f2, sn + 3, 11, 0.045) +
    wcSoftFilter(f3, sn + 9, 6, 0.05, 0.5) + grainFilter(fg, sn + 5) + wcFilter(fi, sn + 13, 2.2, 0.08);

  let bg = '';
  if (withBackdrop) {
    const bgc = t.shape === 'duck' || shape === 'duck' || shape === 'longneck' ? PIGMENT.sky : mix(PIGMENT.sand, c.body, 0.18);
    bg = paintSoft(blobPath(112, 112, 88, 84, rand, 13, 0.16), mix(bgc, PIGMENT.paper, 0.35), f1, 0.5) +
      paintSoft(blobPath(120, 104, 62, 58, rand, 11, 0.2), mix(bgc, PIGMENT.paper, 0.15), f3, 0.28);
  }

  let body = '';
  switch (shape) {
    case 'owl': body = owlBody(c, t, rand, f1, f2, f3, fi); break;
    case 'duck': body = duckBody(c, t, rand, f1, f2, f3, fi, withGround); break;
    case 'longneck': body = longneckBody(c, t, rand, f1, f2, f3, fi, withGround); break;
    case 'hummer': body = hummerBody(c, t, rand, f1, f2, f3, fi); break;
    case 'raptor': body = raptorBody(c, t, rand, f1, f2, f3, fi, withGround); break;
    default: body = songbirdBody(c, t, rand, f1, f2, f3, fi, withGround);
  }

  /* pigment granulation over the whole painting, clipped to itself */
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" class="bird-art" role="img" aria-label="Watercolor illustration of ${esc(art.common || 'a bird')}">
  <defs>${defs}</defs>${bg}${body}
</svg>`;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

function ink(d, rand, f, w = 1.6, op = 0.65, color = PIGMENT.ink) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round" filter="url(#${f})"/>`;
}

/* legs + feet as ink */
function legs(rand, fi, x1, x2, yTop, yBot, color = '#5b4a35') {
  return ink(inkLine([[x1, yTop], [x1 - 1, yBot]], rand, 0.8), rand, fi, 2.0, 0.8, color) +
    ink(inkLine([[x2, yTop - 2], [x2 + 1, yBot]], rand, 0.8), rand, fi, 2.0, 0.8, color) +
    ink(inkLine([[x1 - 5, yBot + 1], [x1 + 4, yBot + 2]], rand, 0.7), rand, fi, 1.6, 0.7, color) +
    ink(inkLine([[x2 - 4, yBot + 1], [x2 + 5, yBot + 2]], rand, 0.7), rand, fi, 1.6, 0.7, color);
}

function branch(rand, fi, y = 172, leafColor = PIGMENT.fern) {
  const d = inkLine([[16, y + 8], [60, y + 3], [120, y], [170, y - 3], [206, y - 8]], rand, 1.4);
  const twig = inkLine([[150, y - 2], [166, y - 14], [176, y - 18]], rand, 1);
  let leaves = '';
  for (let i = 0; i < 3; i++) {
    const lx = 160 + i * 12 + rand() * 6, ly = y - 12 - i * 5 - rand() * 4;
    leaves += `<path d="${blobPath(lx, ly, 6.5, 3.2, rand, 7, 0.25)}" fill="${leafColor}" opacity="0.45" transform="rotate(${-30 + i * 18} ${lx} ${ly})"/>`;
  }
  return `<g filter="url(#${fi})">` +
    `<path d="${d}" fill="none" stroke="#6b543c" stroke-width="3.4" stroke-opacity="0.75" stroke-linecap="round"/>` +
    `<path d="${twig}" fill="none" stroke="#6b543c" stroke-width="1.8" stroke-opacity="0.65" stroke-linecap="round"/>` +
    leaves + `</g>`;
}

/* ------------------ SONGBIRD (default, faces right) ------------------ */
function songbirdBody(c, t, rand, f1, f2, f3, fi, withGround) {
  let out = '';
  const plump = t.plump ? 1.12 : t.slim ? 0.9 : 1;
  const bodyCx = 104, bodyCy = 116, bodyRx = 40 * plump, bodyRy = 33 * plump;
  const headCx = 140, headCy = 78, headR = t.bigHead ? 26 : t.smallHead ? 19 : 22.5;

  if (withGround) out += branch(rand, fi);

  /* tail */
  const tailLen = t.longTail ? 1.35 : t.shortTail ? 0.7 : 1;
  const cocked = t.cockedTail;
  const tx = bodyCx - bodyRx + 6, ty = bodyCy + 6;
  let tailPts;
  if (cocked) tailPts = [[tx + 8, ty - 2], [tx - 14 * tailLen, ty - 34 * tailLen], [tx - 24 * tailLen, ty - 30 * tailLen], [tx + 2, ty + 12]];
  else if (t.forkedTail) tailPts = [[tx + 10, ty - 4], [tx - 40 * tailLen, ty + 26 * tailLen], [tx - 28 * tailLen, ty + 26 * tailLen], [tx - 20, ty + 14], [tx - 26 * tailLen, ty + 40 * tailLen], [tx - 38 * tailLen, ty + 42 * tailLen], [tx + 4, ty + 12]];
  else tailPts = [[tx + 10, ty - 6], [tx - 34 * tailLen, ty + 26 * tailLen], [tx - 26 * tailLen, ty + 36 * tailLen], [tx + 6, ty + 14]];
  out += paintLayers(smoothClosed(tailPts.map(p => [p[0] + (rand() - .5) * 2, p[1] + (rand() - .5) * 2])), c.tail, f1, f2, { op: 0.6 });

  /* legs behind belly */
  if (withGround) out += legs(rand, fi, 96, 118, bodyCy + bodyRy - 6, 170);

  /* body */
  out += paintLayers(blobPath(bodyCx, bodyCy, bodyRx, bodyRy, rand, 12, 0.09), c.body, f1, f2, { op: 0.66 });
  /* belly / breast wash */
  out += paintSoft(blobPath(bodyCx + 12, bodyCy + 10, bodyRx * 0.72, bodyRy * 0.66, rand, 10, 0.12), c.belly, f3, 0.65);
  if (t.breastPatch) out += paintSoft(blobPath(bodyCx + 20, bodyCy - 2, bodyRx * 0.5, bodyRy * 0.5, rand, 9, 0.15), c.accent, f3, 0.55);

  /* wing */
  const wingD = smoothClosed([[bodyCx + 8, bodyCy - 22], [bodyCx - 18, bodyCy - 10], [bodyCx - 34, bodyCy + 16], [bodyCx - 26, bodyCy + 22], [bodyCx - 2, bodyCy + 10], [bodyCx + 14, bodyCy - 10]]);
  out += paintLayers(wingD, c.wing, f1, f2, { op: 0.62 });
  if (t.wingbar) {
    out += ink(inkLine([[bodyCx - 2, bodyCy - 8], [bodyCx - 22, bodyCy + 8]], rand, 1), rand, fi, 3, 0.7, mix(c.belly, '#ffffff', 0.5));
    out += ink(inkLine([[bodyCx + 2, bodyCy - 1], [bodyCx - 16, bodyCy + 14]], rand, 1), rand, fi, 2.2, 0.55, mix(c.belly, '#ffffff', 0.5));
  }
  if (t.spotted) {
    for (let i = 0; i < 7; i++) {
      const sx = bodyCx - 26 + rand() * 32, sy = bodyCy - 14 + rand() * 30;
      out += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${(1.2 + rand()).toFixed(1)}" fill="${mix(c.belly, '#ffffff', 0.4)}" opacity="0.7" filter="url(#${fi})"/>`;
    }
  }
  if (t.streaked) {
    for (let i = 0; i < 6; i++) {
      const sx = bodyCx + 4 + rand() * 22, sy = bodyCy - 4 + rand() * 26;
      out += ink(inkLine([[sx, sy], [sx - 3, sy + 7 + rand() * 4]], rand, 0.8), rand, fi, 1.5, 0.5, shade(c.body, -35));
    }
  }
  if (t.epaulet) out += paintSoft(blobPath(bodyCx + 6, bodyCy - 16, 9, 6, rand, 8, 0.2), c.accent, f3, 0.85) +
    paintSoft(blobPath(bodyCx + 2, bodyCy - 10, 7, 4, rand, 8, 0.2), '#d9a13f', f3, 0.8);

  /* head */
  out += paintLayers(blobPath(headCx, headCy, headR, headR * 0.94, rand, 11, 0.09), c.head, f1, f2, { op: 0.68 });
  if (t.hooded) out += paintSoft(blobPath(headCx - 2, headCy + 2, headR * 1.05, headR, rand, 10, 0.1), c.accent, f3, 0.8);
  if (t.capped) out += paintSoft(smoothClosed([[headCx - headR, headCy - 2], [headCx - headR * 0.6, headCy - headR * 0.95], [headCx + headR * 0.5, headCy - headR * 1.02], [headCx + headR * 0.95, headCy - headR * 0.25], [headCx + headR * 0.4, headCy - headR * 0.3], [headCx - headR * 0.4, headCy - headR * 0.15]]), c.accent, f3, 0.82);
  if (t.crest) {
    const crestD = smoothClosed([[headCx - 6, headCy - headR + 4], [headCx - 2, headCy - headR - 14], [headCx + 7, headCy - headR - 17], [headCx + 12, headCy - headR - 6], [headCx + headR * 0.7, headCy - headR * 0.5], [headCx, headCy - headR * 0.6]]);
    out += paintLayers(crestD, t.capped ? c.accent : c.head, f1, f2, { op: 0.65 });
  }
  if (t.mask) out += paintSoft(smoothClosed([[headCx + 2, headCy - 8], [headCx + headR - 1, headCy - 6], [headCx + headR + 6, headCy + 4], [headCx + headR - 2, headCy + 9], [headCx + 4, headCy + 6], [headCx - 1, headCy - 2]]), c.accent, f3, 0.8);
  if (t.eyeStripe) out += ink(inkLine([[headCx - headR * 0.7, headCy - 7], [headCx + headR * 0.85, headCy - 8]], rand, 0.8), rand, fi, 3.2, 0.6, mix(c.accent === c.head ? '#e8dfc8' : (t.shape === undefined && c.accent) || '#e8dfc8', '#ffffff', 0.2));
  if (t.throatPatch) out += paintSoft(blobPath(headCx + 4, headCy + headR * 0.75, headR * 0.55, headR * 0.42, rand, 8, 0.18), c.accent, f3, 0.85);
  if (t.necklace) out += ink(inkLine([[headCx - 14, headCy + headR - 2], [headCx + 2, headCy + headR + 5], [headCx + 15, headCy + headR - 3]], rand, 1), rand, fi, 3.4, 0.55, c.accent);
  if (t.eyeRing) out += `<circle cx="${headCx + 6}" cy="${headCy - 3}" r="4.6" fill="none" stroke="${mix(c.belly, '#ffffff', 0.5)}" stroke-width="1.6" opacity="0.8" filter="url(#${fi})"/>`;

  /* beak */
  const bl = t.longBeak ? 20 : t.bigBeak ? 15 : 11;
  const bw = t.bigBeak ? 6.5 : t.longBeak ? 3.4 : 4.6;
  const bx = headCx + headR - 3, by = headCy + 1;
  out += paintLayers(smoothClosed([[bx, by - bw], [bx + bl, by - 0.5], [bx + bl * 0.94, by + 1.6], [bx, by + bw]]), c.beak, f3, f2, { op: 0.85, darker: -35 });
  out += ink(inkLine([[bx + 1, by + 0.5], [bx + bl * 0.85, by + 0.5]], rand, 0.5), rand, fi, 0.9, 0.5);

  /* eye */
  const eyeC = t.paleEye ? c.accent : '#2e2620';
  out += `<circle cx="${headCx + 6}" cy="${headCy - 3}" r="3.1" fill="${eyeC}" filter="url(#${fi})"/>` +
    `<circle cx="${headCx + 7.1}" cy="${headCy - 4.2}" r="0.9" fill="#f6f1e3" opacity="0.9"/>`;

  /* ink contour accents */
  out += ink(inkLine([[headCx - headR * 0.6, headCy - headR * 0.75], [headCx + headR * 0.5, headCy - headR * 0.95], [headCx + headR * 0.95, headCy - headR * 0.3]], rand, 1.2), rand, fi, 1.3, 0.5);
  out += ink(inkLine([[bodyCx - bodyRx * 0.8, bodyCy + bodyRy * 0.55], [bodyCx + 6, bodyCy + bodyRy * 0.95], [bodyCx + bodyRx * 0.75, bodyCy + bodyRy * 0.55]], rand, 1.2), rand, fi, 1.3, 0.45);
  out += ink(inkLine([[bodyCx - 10, bodyCy - 20], [bodyCx - 30, bodyCy + 12]], rand, 1), rand, fi, 1.1, 0.35);
  return out;
}

/* ------------------ OWL ------------------ */
function owlBody(c, t, rand, f1, f2, f3, fi) {
  let out = branch(rand, fi, 178);
  out += legs(rand, fi, 96, 122, 158, 176, '#5b4a35');
  out += paintLayers(blobPath(108, 122, 45, 52, rand, 12, 0.08), c.body, f1, f2, { op: 0.66 });
  out += paintSoft(blobPath(108, 136, 32, 34, rand, 10, 0.1), c.belly, f3, 0.6);
  /* barring on chest */
  for (let i = 0; i < 5; i++) {
    const y = 116 + i * 11;
    out += ink(inkLine([[88 + rand() * 6, y], [128 - rand() * 6, y + 2]], rand, 1.4), rand, fi, 1.5, 0.4, shade(c.body, -40));
  }
  /* head */
  out += paintLayers(blobPath(108, 72, 37, 31, rand, 11, 0.07), c.head, f1, f2, { op: 0.7 });
  if (!t.noTufts) {
    out += paintLayers(smoothClosed([[80, 58], [70, 34], [84, 44], [92, 52]]), c.head, f1, f2, { op: 0.65 });
    out += paintLayers(smoothClosed([[136, 58], [146, 34], [132, 44], [124, 52]]), c.head, f1, f2, { op: 0.65 });
  }
  /* facial discs */
  out += paintSoft(blobPath(93, 74, 15, 14, rand, 9, 0.1), mix(c.belly, '#ffffff', 0.15), f3, 0.55);
  out += paintSoft(blobPath(123, 74, 15, 14, rand, 9, 0.1), mix(c.belly, '#ffffff', 0.15), f3, 0.55);
  out += `<circle cx="93" cy="74" r="6.4" fill="${c.accent}" opacity="0.9" filter="url(#${fi})"/>` +
    `<circle cx="123" cy="74" r="6.4" fill="${c.accent}" opacity="0.9" filter="url(#${fi})"/>` +
    `<circle cx="93" cy="74" r="2.8" fill="#2e2620"/><circle cx="123" cy="74" r="2.8" fill="#2e2620"/>` +
    `<circle cx="94" cy="72.6" r="0.9" fill="#f6f1e3" opacity="0.9"/><circle cx="124" cy="72.6" r="0.9" fill="#f6f1e3" opacity="0.9"/>`;
  /* beak */
  out += paintSoft(smoothClosed([[104, 80], [112, 80], [108.5, 92]]), c.beak, f3, 0.9);
  if (t.spotted) {
    for (let i = 0; i < 10; i++) {
      out += ink(inkLine([[76 + rand() * 64, 100 + rand() * 60], [78 + rand() * 64, 104 + rand() * 60]], rand, 0.5), rand, fi, 1.8, 0.35, shade(c.body, -50));
    }
  }
  out += ink(inkLine([[76, 52], [108, 42], [140, 52]], rand, 1.4), rand, fi, 1.3, 0.5);
  return out;
}

/* ------------------ DUCK / GOOSE (on water) ------------------ */
function duckBody(c, t, rand, f1, f2, f3, fi, withGround) {
  let out = '';
  const waterY = 152;
  if (withGround) {
    out += paintSoft(blobPath(110, waterY + 34, 100, 26, rand, 12, 0.12), PIGMENT.teal, f1, 0.32);
    out += paintSoft(blobPath(120, waterY + 26, 80, 14, rand, 10, 0.15), mix(PIGMENT.sky, PIGMENT.teal, 0.5), f3, 0.3);
  }
  /* tail nub */
  out += paintLayers(smoothClosed([[62, 128], [44, 116], [40, 124], [58, 140]]), c.tail, f1, f2, { op: 0.6 });
  /* body sits on the waterline */
  out += paintLayers(blobPath(108, 130, 52, 27, rand, 12, 0.08), c.body, f1, f2, { op: 0.66 });
  out += paintSoft(blobPath(112, 140, 40, 15, rand, 10, 0.12), c.belly, f3, 0.5);
  /* chest (mallard rust) */
  out += paintSoft(blobPath(146, 126, 16, 15, rand, 9, 0.14), c.accent, f3, t.chinstrap ? 0 : 0.6);
  /* wing fold */
  out += paintLayers(smoothClosed([[120, 112], [88, 116], [72, 130], [86, 138], [116, 132], [128, 118]]), c.wing, f1, f2, { op: 0.6 });
  /* neck + head */
  const neckC = t.longNeck ? c.head : c.head;
  if (t.longNeck) {
    out += paintLayers(smoothClosed([[148, 128], [150, 84], [156, 62], [166, 60], [168, 84], [162, 112], [162, 128]]), neckC, f1, f2, { op: 0.7 });
    out += paintLayers(blobPath(163, 56, 13, 11, rand, 9, 0.1), c.head, f1, f2, { op: 0.72 });
    if (t.chinstrap) out += paintSoft(smoothClosed([[156, 60], [163, 68], [170, 60], [166, 54], [159, 54]]), c.accent, f3, 0.9);
    out += paintLayers(smoothClosed([[174, 52], [188, 55], [188, 58], [174, 60]]), c.beak, f3, f2, { op: 0.85 });
    out += `<circle cx="166" cy="53" r="2.4" fill="#2e2620" filter="url(#${fi})"/>`;
  } else {
    out += paintLayers(smoothClosed([[142, 130], [146, 106], [154, 96], [166, 96], [170, 108], [164, 124], [158, 132]]), neckC, f1, f2, { op: 0.68 });
    out += paintLayers(blobPath(160, 96, 16, 14, rand, 9, 0.1), c.head, f1, f2, { op: 0.72 });
    if (t.neckRing) out += ink(inkLine([[148, 112], [168, 112]], rand, 0.8), rand, fi, 3, 0.8, '#e8e0cc');
    out += paintLayers(smoothClosed([[174, 92], [192, 95], [191, 100], [174, 101]]), c.beak, f3, f2, { op: 0.9 });
    out += `<circle cx="163" cy="92" r="2.6" fill="#2e2620" filter="url(#${fi})"/>` +
      `<circle cx="164" cy="91" r="0.8" fill="#f6f1e3" opacity="0.9"/>`;
  }
  /* ripples */
  if (withGround) {
    out += ink(inkLine([[48, waterY + 12], [92, waterY + 15], [128, waterY + 12]], rand, 1.4), rand, fi, 1.4, 0.4, PIGMENT.teal);
    out += ink(inkLine([[120, waterY + 22], [160, waterY + 24], [190, waterY + 20]], rand, 1.4), rand, fi, 1.2, 0.35, PIGMENT.teal);
    out += ink(inkLine([[30, waterY + 24], [66, waterY + 27]], rand, 1.2), rand, fi, 1.2, 0.3, PIGMENT.teal);
  }
  return out;
}

/* ------------------ LONGNECK (heron) ------------------ */
function longneckBody(c, t, rand, f1, f2, f3, fi, withGround) {
  let out = '';
  if (withGround) {
    out += paintSoft(blobPath(110, 196, 95, 18, rand, 12, 0.14), PIGMENT.teal, f1, 0.28);
  }
  /* legs */
  out += ink(inkLine([[100, 158], [98, 200]], rand, 1), rand, fi, 2.4, 0.75, '#5b4a35');
  out += ink(inkLine([[116, 156], [122, 200]], rand, 1), rand, fi, 2.4, 0.75, '#5b4a35');
  /* tail/wing tip */
  out += paintLayers(smoothClosed([[76, 128], [56, 148], [64, 154], [86, 142]]), c.wing, f1, f2, { op: 0.6 });
  /* body */
  out += paintLayers(blobPath(104, 132, 40, 27, rand, 11, 0.09), c.body, f1, f2, { op: 0.66 });
  out += paintSoft(blobPath(100, 140, 28, 16, rand, 9, 0.12), c.belly, f3, 0.5);
  out += paintLayers(smoothClosed([[118, 112], [86, 118], [74, 134], [90, 144], [116, 136], [126, 120]]), c.wing, f1, f2, { op: 0.55 });
  /* S-neck */
  out += paintLayers(smoothClosed([[124, 124], [122, 96], [132, 70], [146, 56], [152, 60], [144, 78], [138, 102], [138, 124]]), mix(c.body, c.head, 0.4), f1, f2, { op: 0.66 });
  /* head */
  out += paintLayers(blobPath(150, 54, 13.5, 10.5, rand, 9, 0.1), c.head, f1, f2, { op: 0.72 });
  /* plume stripe */
  out += ink(inkLine([[144, 47], [160, 44], [170, 50]], rand, 0.8), rand, fi, 2.6, 0.7, c.accent);
  /* dagger beak */
  out += paintLayers(smoothClosed([[161, 52], [190, 57], [161, 60]]), c.beak, f3, f2, { op: 0.9 });
  out += `<circle cx="153" cy="52" r="2.5" fill="#2e2620" filter="url(#${fi})"/>` +
    `<circle cx="154" cy="51" r="0.8" fill="#f6f1e3" opacity="0.9"/>`;
  /* reeds */
  if (withGround) {
    for (let i = 0; i < 4; i++) {
      const x = 30 + i * 14 + rand() * 8;
      out += ink(inkLine([[x, 200], [x + 4 - rand() * 8, 158 - rand() * 18]], rand, 1.2), rand, fi, 1.5, 0.45, PIGMENT.fern);
    }
    out += ink(inkLine([[150, 196], [190, 199]], rand, 1.2), rand, fi, 1.2, 0.3, PIGMENT.teal);
  }
  return out;
}

/* ------------------ HUMMINGBIRD (hovering at a flower) ------------------ */
function hummerBody(c, t, rand, f1, f2, f3, fi) {
  let out = '';
  /* flower */
  const fx = 62, fy = 142;
  out += ink(inkLine([[fx + 4, 200], [fx, fy + 10]], rand, 1), rand, fi, 2, 0.6, PIGMENT.fern);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    out += paintSoft(blobPath(fx + Math.cos(a) * 12, fy + Math.sin(a) * 12, 10, 7, rand, 8, 0.2), PIGMENT.rose, f3, 0.6);
  }
  out += paintSoft(blobPath(fx, fy, 6, 6, rand, 8, 0.2), PIGMENT.ochre, f3, 0.8);
  out += ink(inkLine([[fx - 10, fy + 24], [fx - 2, fy + 14]], rand, 0.8), rand, fi, 1.4, 0.5, PIGMENT.fern);
  /* blurred wings (two, suggesting motion) */
  out += paintSoft(blobPath(112, 76, 26, 11, rand, 9, 0.2), mix(c.wing, PIGMENT.paper, 0.3), f1, 0.35);
  out += paintSoft(blobPath(126, 82, 24, 10, rand, 9, 0.2), mix(c.wing, PIGMENT.paper, 0.2), f1, 0.3);
  /* tail */
  out += paintLayers(smoothClosed([[104, 116], [84, 134], [92, 140], [110, 124]]), c.tail, f1, f2, { op: 0.6 });
  /* body angled toward flower */
  out += paintLayers(blobPath(118, 106, 23, 17, rand, 10, 0.1), c.body, f1, f2, { op: 0.68 });
  out += paintSoft(blobPath(112, 112, 15, 11, rand, 9, 0.14), c.belly, f3, 0.6);
  /* head */
  out += paintLayers(blobPath(134, 92, 12, 11, rand, 9, 0.1), c.head, f1, f2, { op: 0.7 });
  /* gorget */
  out += paintSoft(blobPath(134, 100, 8, 5.5, rand, 8, 0.2), c.accent, f3, 0.85);
  /* needle beak reaching the flower... points down-left toward flower */
  out += ink(inkLine([[126, 100], [86, 126]], rand, 0.5), rand, fi, 2.2, 0.85, c.beak);
  out += `<circle cx="138" cy="89" r="2.2" fill="#2e2620" filter="url(#${fi})"/>` +
    `<circle cx="138.8" cy="88.2" r="0.7" fill="#f6f1e3" opacity="0.9"/>`;
  return out;
}

/* ------------------ RAPTOR ------------------ */
function raptorBody(c, t, rand, f1, f2, f3, fi, withGround) {
  let out = '';
  if (withGround) {
    out += `<g filter="url(#${fi})"><path d="${inkLine([[20, 180], [80, 176], [150, 174], [204, 178]], rand, 1.5)}" fill="none" stroke="#6b543c" stroke-width="5" stroke-opacity="0.75" stroke-linecap="round"/></g>`;
  }
  /* tail (red-tail fan below) */
  out += paintLayers(smoothClosed([[92, 150], [76, 182], [86, 188], [108, 186], [116, 156]]), c.tail, f1, f2, { op: 0.62 });
  /* body upright */
  out += paintLayers(blobPath(108, 118, 40, 48, rand, 12, 0.07), c.body, f1, f2, { op: 0.66 });
  out += paintSoft(blobPath(104, 134, 27, 30, rand, 10, 0.1), c.belly, f3, 0.62);
  /* belly band streaks */
  for (let i = 0; i < 5; i++) {
    const sx = 88 + rand() * 30, sy = 130 + rand() * 20;
    out += ink(inkLine([[sx, sy], [sx - 2, sy + 6]], rand, 0.7), rand, fi, 1.6, 0.5, shade(c.body, -30));
  }
  /* wing fold */
  out += paintLayers(smoothClosed([[124, 88], [96, 96], [82, 128], [88, 152], [104, 150], [122, 120]]), c.wing, f1, f2, { op: 0.6 });
  /* head */
  out += paintLayers(blobPath(120, 68, 21, 19, rand, 10, 0.08), c.head, f1, f2, { op: 0.7 });
  /* brow + hooked beak */
  out += ink(inkLine([[126, 58], [140, 60]], rand, 0.7), rand, fi, 2, 0.7, shade(c.head, -35));
  out += paintLayers(smoothClosed([[136, 62], [150, 66], [148, 74], [140, 72], [136, 70]]), c.beak, f3, f2, { op: 0.9 });
  out += ink(inkLine([[147, 67], [146, 73]], rand, 0.4), rand, fi, 1.2, 0.6);
  out += `<circle cx="130" cy="64" r="3" fill="#3a2e1c" filter="url(#${fi})"/>` +
    `<circle cx="131" cy="63" r="0.9" fill="#f6f1e3" opacity="0.9"/>`;
  /* talons */
  if (withGround) {
    out += legs(rand, fi, 98, 120, 160, 176, '#c9b47c');
  }
  out += ink(inkLine([[96, 76], [104, 92], [96, 128]], rand, 1.2), rand, fi, 1.2, 0.4);
  return out;
}

/* Small circular "stamp" version for chips/lists: bird head only? No —
   scaled-down full bird reads fine; this helper just wraps it. */
export function birdStampSVG(art, opts = {}) {
  return birdSVG(art, { ...opts, withBackdrop: opts.withBackdrop !== false, withGround: false });
}
