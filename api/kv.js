import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const ALLOWED_KEYS = ['sft-visits-v1', 'sft-stores-v1', 'sft-users-v1'];

export default async function handler(req, res) {
  const key = req.query.key;
  if (!key || !ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ error: 'Invalid or missing key' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const value = await redis.get(key);
      if (value === null || value === undefined) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.status(200).json({ key, value });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const value = body && body.value;
      await redis.set(key, value);
      res.status(200).json({ key, value });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('kv handler error', e);
    res.status(500).json({ error: e && e.message ? e.message : 'internal error' });
  }
}
