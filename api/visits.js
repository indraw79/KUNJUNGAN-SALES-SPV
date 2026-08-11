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

// Notifikasi WA saat kunjungan baru selesai checkout DENGAN order/pembayaran (bukan setiap
// checkout). Token & nomor tujuan dari Vercel Environment Variables, bukan hardcode/Redis --
// mengikuti pola Redis.fromEnv()/Blob token yang sudah ada di codebase ini. Kalau env var belum
// diisi, lewati diam-diam (jangan sampai simpan kunjungan gagal gara-gara notifikasi belum setup).
async function kirimNotifikasiWA(visit) {
  const token = process.env.FONNTE_TOKEN;
  const targetsRaw = process.env.WA_NOTIF_TARGETS;
  if (!token || !targetsRaw) return;

  const targets = targetsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  if (targets.length === 0) return;

  const orders = Array.isArray(visit.orders) ? visit.orders : [];
  const daftarBarang = orders.length
    ? orders.map(function (o, i) {
        return (i + 1) + '. ' + o.product + ' - ' + o.qty + ' x Rp' + Number(o.price || 0).toLocaleString('id-ID');
      }).join('\n')
    : '-';
  const totalBayar = Number(visit.payment) > 0 ? 'Rp' + Number(visit.payment).toLocaleString('id-ID') : '-';

  const pesan = '📍 Kunjungan Sales Baru!\n' +
    'Toko: ' + (visit.storeName || '-') + '\n' +
    'Sales: ' + (visit.salesName || '-') + '\n' +
    'Catatan: ' + (visit.notes || '-') + '\n\n' +
    'Daftar Order:\n' + daftarBarang + '\n\n' +
    'Pembayaran: ' + totalBayar;

  await Promise.all(targets.map(function (target) {
    return fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: target, message: pesan }),
    });
  }));
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
  res.setHeader('Cache-Control', 'no-store, max-age=0');
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
      const oldVisit = parseVal(await redis.hget(HASH_KEY, visit.id));

      const field = {};
      field[visit.id] = JSON.stringify(visit);
      await redis.hset(HASH_KEY, field);

      // Deteksi "baru pertama kali checkout dengan order/pembayaran" lewat transisi status
      // active->done, supaya edit kunjungan lama (submitEditVisit, sudah done sebelumnya) tidak
      // ikut memicu notifikasi berulang.
      const baruSelesai = (!oldVisit || oldVisit.status !== 'done') && visit.status === 'done';
      const adaOrderAtauBayar = (Array.isArray(visit.orders) && visit.orders.length > 0) || Number(visit.payment) > 0;
      if (baruSelesai && adaOrderAtauBayar) {
        await kirimNotifikasiWA(visit).catch(function (e) {
          console.error('gagal kirim notifikasi WA', e);
        });
      }

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
