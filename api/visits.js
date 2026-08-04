import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const HASH_KEY = 'sft-visits-hash-v1';
const LEGACY_KEY = 'sft-visits-v1'; // old single-array storage, kept only for one-time migration
const MIGRATION_FLAG_KEY = 'sft-visits-migrated-v1';

function parseVal(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch (e) { return null; }
  }
  return v; // already an object (some client versions auto-parse)
}

async function migrateFromLegacyIfNeeded() {
  const already = await redis.get(MIGRATION_FLAG_KEY);
  if (already) return;
  const legacy = await redis.get(LEGACY_KEY);
  const legacyArr = Array.isArray(legacy) ? legacy : (typeof legacy === 'string' ? (function () { try { return JSON.parse(legacy); } catch (e) { return []; } })() : []);
  if (Array.isArray(legacyArr) && legacyArr.length > 0) {
    const toWrite = {};
    legacyArr.forEach(function (v) {
      if (!v) return;
      var id = v.id || ((v.salesName || 'x') + '|' + (v.checkinTime || Date.now()) + '|' + Math.random().toString(36).slice(2, 8));
      v.id = id;
      toWrite[id] = JSON.stringify(v);
    });
    if (Object.keys(toWrite).length > 0) {
      await redis.hset(HASH_KEY, toWrite);
    }
  }
  await redis.set(MIGRATION_FLAG_KEY, '1');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      let all = await redis.hgetall(HASH_KEY);
      if (!all || Object.keys(all).length === 0) {
        await migrateFromLegacyIfNeeded();
        all = await redis.hgetall(HASH_KEY);
      }
      const visits = all ? Object.values(all).map(parseVal).filter(Boolean) : [];
      res.status(200).json({ visits: visits });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const visit = body && body.visit;
      if (!visit || !visit.id) {
        res.status(400).json({ error: 'visit dengan id wajib diisi' });
        return;
      }
      const field = {};
      field[visit.id] = JSON.stringify(visit);
      await redis.hset(HASH_KEY, field);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      await redis.del(HASH_KEY);
      await redis.set(MIGRATION_FLAG_KEY, '1');
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('visits handler error', e);
    res.status(500).json({ error: e && e.message ? e.message : 'internal error' });
  }
}
