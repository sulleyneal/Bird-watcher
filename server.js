/* server.js — zero-dependency Node server: serves the PWA and hosts the
   identification endpoint. The Anthropic key is read from the
   ANTHROPIC_API_KEY environment variable and never reaches the client.
   Without a key it runs in clearly-labeled mock/demo mode.

   Run:  ANTHROPIC_API_KEY=sk-ant-... node server.js            */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identify, setMockScenario, getMockScenario } from './lib/identify-core.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8787;
const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readBody(req, limit = 12_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too-large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    /* ---------- API ---------- */
    if (path === '/api/health') {
      return json(res, 200, { ok: true, mode: HAS_KEY ? 'live' : 'mock' });
    }
    if (path === '/api/identify' && req.method === 'POST') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch (e) { return json(res, e.status || 400, { error: 'bad-request' }); }
      try {
        const out = await identify(body, process.env);
        return json(res, 200, out);
      } catch (e) {
        console.error('[identify]', e.message, e.body || '');
        return json(res, e.status && e.status < 500 ? e.status : 502, { error: e.message || 'identify-failed' });
      }
    }
    /* mock scenario control — only exists in mock mode, for testing */
    if (path === '/api/mock' && !HAS_KEY) {
      if (req.method === 'POST') {
        let body = {};
        try { body = JSON.parse(await readBody(req)); } catch (e) {}
        return json(res, 200, { scenario: setMockScenario(body.scenario) });
      }
      return json(res, 200, { scenario: getMockScenario() });
    }

    /* ---------- static ---------- */
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return json(res, 405, { error: 'method-not-allowed' });
    }
    let file = normalize(path).replace(/^([.\\/])+/, '');
    if (file === '' || file === '/') file = 'index.html';
    const full = join(ROOT, file);
    if (!full.startsWith(ROOT)) { return json(res, 403, { error: 'forbidden' }); }
    let target = full;
    try {
      const st = await stat(target);
      if (st.isDirectory()) target = join(target, 'index.html');
    } catch (e) {
      // SPA-ish fallback: unknown non-asset paths get the shell
      if (!extname(target)) target = join(ROOT, 'index.html');
      else { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    }
    const data = await readFile(target);
    const ext = extname(target).toLowerCase();
    const cacheable = ['.woff2', '.png', '.jpg', '.svg', '.ico'].includes(ext);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': cacheable ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(data);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: 'server-error' });
  }
});

server.listen(PORT, () => {
  console.log(`Field Journal on http://localhost:${PORT} — identification: ${HAS_KEY ? 'LIVE (Anthropic ' + 'vision)' : 'MOCK (set ANTHROPIC_API_KEY for real IDs)'}`);
});
