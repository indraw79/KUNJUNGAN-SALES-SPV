import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const HASH_KEY = 'sft-fuel-claims-hash-v1';

function parseVal(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch (e) { return null; }
  }
  return v; // already an object (some client versions auto-parse)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    if (req.method === 'GET') {
      const all = await redis.hgetall(HASH_KEY);
      const claims = all ? Object.values(all).map(parseVal).filter(Boolean) : [];
      res.status(200).json({ claims: claims });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const claim = body && body.claim;
      if (!claim || !claim.id) {
        res.status(400).json({ error: 'claim dengan id wajib diisi' });
        return;
      }
      const field = {};
      field[claim.id] = JSON.stringify(claim);
      await redis.hset(HASH_KEY, field);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('fuel-claims handler error', e);
    res.status(500).json({ error: e && e.message ? e.message : 'internal error' });
  }
}
