/* api/identify.js — serverless variant (Vercel/Netlify style) of the
   identification endpoint. Set ANTHROPIC_API_KEY in the deployment's
   environment variables; the key never reaches the browser. */

import { identify } from '../lib/identify-core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }
  try {
    const out = await identify(req.body, process.env);
    res.status(200).json(out);
  } catch (e) {
    res.status(e.status && e.status < 500 ? e.status : 502).json({ error: e.message || 'identify-failed' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };
