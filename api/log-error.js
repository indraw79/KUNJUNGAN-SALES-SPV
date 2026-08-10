import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const KEY = 'sft-error-log-v1';
const MAX_ENTRIES = 200;

// Client-side error reporting so failures on a sales rep's phone are visible
// server-side instead of only in their own browser console (nobody ever sees that).
// POST /api/log-error  body: {message, stack, context, salesUsername, salesName, visitId, userAgent, url, timestamp}
// GET  /api/log-error  -> { entries: [...] } most recent first

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const entry = {
        message: (body && body.message) || '',
        stack: (body && body.stack) || '',
        context: (body && body.context) || '',
        salesUsername: (body && body.salesUsername) || '',
        salesName: (body && body.salesName) || '',
        visitId: (body && body.visitId) || '',
        userAgent: (body && body.userAgent) || '',
        url: (body && body.url) || '',
        timestamp: (body && body.timestamp) || new Date().toISOString(),
      };
      await redis.lpush(KEY, JSON.stringify(entry));
      await redis.ltrim(KEY, 0, MAX_ENTRIES - 1);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'GET') {
      const raw = await redis.lrange(KEY, 0, MAX_ENTRIES - 1);
      const entries = (raw || []).map(function (v) {
        if (typeof v === 'string') {
          try { return JSON.parse(v); } catch (e) { return null; }
        }
        return v;
      }).filter(Boolean);
      res.status(200).json({ entries: entries });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('log-error handler error', e);
    res.status(500).json({ error: e && e.message ? e.message : 'internal error' });
  }
}
