/* identify-core.test.js — unit checks for the live-API path (prompt build,
   response parsing, error handling) with a stubbed fetch, since the real
   key only exists in production. Run: node test/identify-core.test.js */

import assert from 'node:assert';
import { buildUserPrompt, parseModelJSON, identifyLive, identify } from '../lib/identify-core.js';

let failures = 0;
function t(name, fn) {
  return Promise.resolve().then(fn).then(
    () => console.log('PASS ', name),
    e => { console.log('FAIL ', name, '—', e.message); failures++; });
}

await t('prompt includes month + life list + JSON spec', () => {
  const p = buildUserPrompt({ month: 7, existingSpecies: ['Blue Jay'] });
  assert(p.includes('July') && p.includes('Blue Jay') && p.includes('"kind"'));
  const empty = buildUserPrompt({ month: 1, existingSpecies: [] });
  assert(empty.includes('every bird is new'));
});

await t('parseModelJSON handles clean JSON', () => {
  const r = parseModelJSON('{"kind":"bird","candidates":[{"commonName":"X","confidence":0.9}]}');
  assert.equal(r.kind, 'bird');
  assert.equal(r.candidates[0].confidence, 0.9);
});

await t('parseModelJSON strips fences and prose, clamps confidence, caps candidates', () => {
  const raw = 'Here you go:\n```json\n{"kind":"bird","candidates":[' +
    '{"commonName":"A","confidence":1.7},{"commonName":"B","confidence":-2},' +
    '{"commonName":"C","confidence":0.5},{"commonName":"D","confidence":0.1}]}\n```';
  const r = parseModelJSON(raw);
  assert.equal(r.candidates.length, 3);
  assert.equal(r.candidates[0].confidence, 1);
  assert.equal(r.candidates[1].confidence, 0);
});

await t('parseModelJSON rejects garbage', () => {
  assert.throws(() => parseModelJSON('the bird is a cardinal, cheers'));
});

await t('identifyLive sends image + parses response', async () => {
  let captured;
  const fetchFn = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body), headers: opts.headers };
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"kind":"bird","candidates":[{"commonName":"Northern Cardinal","sciName":"Cardinalis cardinalis","confidence":0.93}]}' }] }),
    };
  };
  const r = await identifyLive({ image: 'AAAA', mediaType: 'image/jpeg', month: 7, existingSpecies: [], apiKey: 'k', fetchFn });
  assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(captured.headers['x-api-key'], 'k');
  assert.equal(captured.body.model, 'claude-sonnet-4-6');
  assert.equal(captured.body.messages[0].content[0].source.data, 'AAAA');
  assert.equal(r.candidates[0].commonName, 'Northern Cardinal');
});

await t('identifyLive surfaces API errors with status', async () => {
  const fetchFn = async () => ({ ok: false, status: 429, text: async () => 'rate limited' });
  await assert.rejects(
    identifyLive({ image: 'AAAA', apiKey: 'k', fetchFn }),
    e => e.status === 429);
});

await t('identify() rejects missing/oversized images', async () => {
  await assert.rejects(identify({ image: '' }, {}), e => e.status === 400);
  await assert.rejects(identify({ image: 'x'.repeat(9_000_000) }, {}), e => e.status === 413);
});

await t('identify() uses mock when no key present', async () => {
  const out = await identify({ image: 'A'.repeat(200) }, {});
  assert.equal(out.source, 'mock');
  assert(out.result.kind);
});

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
