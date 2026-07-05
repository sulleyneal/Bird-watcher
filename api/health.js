export default function handler(req, res) {
  res.status(200).json({ ok: true, mode: process.env.ANTHROPIC_API_KEY ? 'live' : 'mock' });
}
