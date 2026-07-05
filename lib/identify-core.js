/* identify-core.js — shared identification logic for both the local
   zero-dependency server (server.js) and serverless deploys (api/*).
   The vision call is the only server-side feature the app has; the key
   NEVER ships to the client. */

export const MODEL = 'claude-sonnet-4-6';

const RESPONSE_SPEC = `Respond with ONLY a JSON object (no markdown fences, no prose) shaped exactly like this:
{
  "kind": "bird" | "not_bird" | "unclear",
  "note": "one friendly sentence, shown to the birder, explaining the verdict (required for not_bird and unclear)",
  "candidates": [
    {
      "commonName": "Northern Cardinal",
      "sciName": "Cardinalis cardinalis",
      "confidence": 0.93,
      "fieldNotes": "2-3 warm, specific field-guide sentences about this bird as seen in THIS photo",
      "rarity": "common" | "uncommon" | "rare" | "legendary",
      "plumage": { "body": "#hex", "head": "#hex", "wing": "#hex", "breast": "#hex", "beak": "#hex", "accent": "#hex" },
      "traits": { "shape": "songbird"|"owl"|"duck"|"longneck"|"hummer"|"raptor", "crest": false, "mask": false, "capped": false, "eyeStripe": false, "wingbar": false, "longTail": false, "throatPatch": false, "plump": false },
      "matchesExisting": "exact name from the birder's list, or null"
    }
  ]
}
Rules:
- "kind":"bird" needs 1-3 candidates, most likely first, honest confidence between 0 and 1.
- If the photo clearly shows no bird (a cat, a plane, a blurry thumb), use "kind":"not_bird" with an empty candidates array and a kind, lightly humorous note.
- If a bird is probably present but the photo is too blurry/distant to be sure, use "kind":"unclear" and include up to 3 low-confidence guesses.
- Never invent certainty: a poor photo means low confidence numbers.
- "plumage" hex colors should be muted, watercolor-like tones sampled from the bird's true colors.
- rarity reflects how often a casual birder in the bird's normal range would see it.`;

export function buildUserPrompt({ month, existingSpecies = [] }) {
  const monthName = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month] || '';
  return `You are the identification engine inside a hand-painted bird-watching field journal app. A birder just photographed this. Identify the species.
Context: it is ${monthName}. The birder's life list so far: ${existingSpecies.length ? existingSpecies.join(', ') : '(empty — every bird is new)'}.
${RESPONSE_SPEC}`;
}

export function parseModelJSON(text) {
  // tolerate accidental fences or leading prose
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no-json');
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  if (!obj.kind) throw new Error('bad-shape');
  obj.candidates = Array.isArray(obj.candidates) ? obj.candidates.slice(0, 3) : [];
  for (const c of obj.candidates) {
    c.confidence = Math.max(0, Math.min(1, Number(c.confidence) || 0));
  }
  return obj;
}

export async function identifyLive({ image, mediaType, month, existingSpecies, apiKey, baseURL = 'https://api.anthropic.com', fetchFn = fetch }) {
  const res = await fetchFn(`${baseURL}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
          { type: 'text', text: buildUserPrompt({ month, existingSpecies }) },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`anthropic-${res.status}`);
    err.status = res.status;
    err.body = body.slice(0, 400);
    throw err;
  }
  const j = await res.json();
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseModelJSON(text);
}

/* ------------------------------------------------------------------ */
/* Mock engine — used when no ANTHROPIC_API_KEY is configured, so the  */
/* whole loop can be exercised in development. The UI labels this mode */
/* honestly as "demo identification".                                  */
/* ------------------------------------------------------------------ */

const MOCK_BIRDS = [
  { commonName: 'Northern Cardinal', sciName: 'Cardinalis cardinalis', rarity: 'common',
    fieldNotes: 'A male cardinal, all ember-red with a proud crest and a black mask. The heavy coral bill is built for cracking seeds.' },
  { commonName: 'Black-capped Chickadee', sciName: 'Poecile atricapillus', rarity: 'common',
    fieldNotes: 'Tiny and round, with a neat black cap and bib over buffy flanks. Bold enough to scold anything, including you.' },
  { commonName: 'American Goldfinch', sciName: 'Spinus tristis', rarity: 'common',
    fieldNotes: 'Lemon-bright body against black wings with a clean white bar. Its flight bounces like a skipped stone.' },
  { commonName: 'Eastern Bluebird', sciName: 'Sialia sialis', rarity: 'uncommon',
    fieldNotes: 'A soft blue back over a rusty chest — a fence-post bird with a gentle, warbling call.' },
  { commonName: 'Cedar Waxwing', sciName: 'Bombycilla cedrorum', rarity: 'uncommon',
    fieldNotes: 'Silky fawn plumage, a rakish crest and black mask, with sealing-wax red tips on the wing.' },
  { commonName: 'Scarlet Tanager', sciName: 'Piranga olivacea', rarity: 'rare',
    fieldNotes: 'Impossible red body with jet-black wings, glowing in the canopy shade like a coal.' },
];

const MOCK_ALTS = {
  'Northern Cardinal': [
    { commonName: 'Scarlet Tanager', sciName: 'Piranga olivacea', rarity: 'rare', fieldNotes: 'Also vivid red, but with black wings and no crest.' },
    { commonName: 'House Finch', sciName: 'Haemorhous mexicanus', rarity: 'common', fieldNotes: 'Rosy on the head and chest with streaky brown sides.' }],
  'American Goldfinch': [
    { commonName: 'Yellow Warbler', sciName: 'Setophaga petechia', rarity: 'common', fieldNotes: 'All-yellow with a plain face and thin insect-eater bill.' },
    { commonName: 'Pine Warbler', sciName: 'Setophaga pinus', rarity: 'uncommon', fieldNotes: 'Olive-yellow with soft wing bars, usually up in the pines.' }],
  'Black-capped Chickadee': [
    { commonName: 'Carolina Chickadee', sciName: 'Poecile carolinensis', rarity: 'common', fieldNotes: 'Nearly identical southern cousin — cleaner wing, faster song.' },
    { commonName: 'White-breasted Nuthatch', sciName: 'Sitta carolinensis', rarity: 'common', fieldNotes: 'Grey-blue above, white below, walks headfirst down trunks.' }],
  'Eastern Bluebird': [
    { commonName: 'Indigo Bunting', sciName: 'Passerina cyanea', rarity: 'uncommon', fieldNotes: 'Whole-body indigo, no rusty chest.' },
    { commonName: 'Blue Jay', sciName: 'Cyanocitta cristata', rarity: 'common', fieldNotes: 'Much bigger and louder, with a crest and white wing flash.' }],
  'Cedar Waxwing': [
    { commonName: 'Tufted Titmouse', sciName: 'Baeolophus bicolor', rarity: 'common', fieldNotes: 'Grey crest but plain grey overall, no mask.' },
    { commonName: 'Bohemian Waxwing', sciName: 'Bombycilla garrulus', rarity: 'rare', fieldNotes: 'Bulkier northern waxwing with rusty undertail.' }],
  'Scarlet Tanager': [
    { commonName: 'Northern Cardinal', sciName: 'Cardinalis cardinalis', rarity: 'common', fieldNotes: 'Red with a crest and black face rather than black wings.' },
    { commonName: 'Summer Tanager', sciName: 'Piranga rubra', rarity: 'rare', fieldNotes: 'Red all over — wings too — with a pale, heavier bill.' }],
};

let mockCounter = 0;
let mockScenario = 'auto'; // auto | high | low | not_bird | unclear

export function setMockScenario(s) {
  mockScenario = ['auto', 'high', 'low', 'not_bird', 'unclear'].includes(s) ? s : 'auto';
  return mockScenario;
}
export function getMockScenario() { return mockScenario; }

export function identifyMock({ existingSpecies = [] } = {}) {
  const scenario = mockScenario === 'auto' ? 'high' : mockScenario;
  if (scenario === 'not_bird') {
    return {
      kind: 'not_bird',
      note: 'The guide squinted hard, but this looks like a photo without a bird in it. Even the best birders photograph a fence post now and then.',
      candidates: [],
    };
  }
  const pick = MOCK_BIRDS[mockCounter++ % MOCK_BIRDS.length];
  const alts = (MOCK_ALTS[pick.commonName] || []).map((a, i) => ({
    ...a, confidence: scenario === 'unclear' ? 0.22 - i * 0.06 : 0.3 - i * 0.12,
    matchesExisting: existingSpecies.includes(a.commonName) ? a.commonName : null,
  }));
  const main = {
    ...pick,
    confidence: scenario === 'high' ? 0.92 : scenario === 'unclear' ? 0.34 : 0.55,
    matchesExisting: existingSpecies.includes(pick.commonName) ? pick.commonName : null,
  };
  if (scenario === 'unclear') {
    return {
      kind: 'unclear',
      note: 'The photo is a little too soft to be certain — here is the guide\'s best squint.',
      candidates: [main, ...alts],
    };
  }
  return {
    kind: 'bird',
    note: '',
    candidates: scenario === 'high' ? [main, ...alts.slice(0, 1)] : [main, ...alts],
  };
}

/* Entry used by both servers. */
export async function identify(body, env = {}) {
  const { image, mediaType, month, existingSpecies } = body || {};
  if (!image || typeof image !== 'string' || image.length < 100) {
    const e = new Error('missing-image'); e.status = 400; throw e;
  }
  if (image.length > 8_000_000) {
    const e = new Error('image-too-large'); e.status = 413; throw e;
  }
  const apiKey = env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const result = await identifyLive({ image, mediaType, month, existingSpecies, apiKey, baseURL: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com' });
    return { source: 'live', result };
  }
  return { source: 'mock', result: identifyMock({ existingSpecies }) };
}
