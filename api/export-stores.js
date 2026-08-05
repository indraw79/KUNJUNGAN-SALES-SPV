import { Redis } from '@upstash/redis';
import * as XLSX from 'xlsx';

const redis = Redis.fromEnv();
const COLS = [{ wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 11 }, { wch: 11 }];

function parseVal(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch (e) { return null; }
  }
  return v;
}

function sanitizeSheetName(name, used) {
  var safe = String(name || 'Toko').replace(/[\\/?*[\]:]/g, '').trim().slice(0, 31) || 'Toko';
  var final = safe, i = 2;
  while (used.has(final)) { final = (safe.slice(0, 28) + '-' + i); i++; }
  used.add(final);
  return final;
}

export default async function handler(req, res) {
  try {
    const [stores, visitsHash] = await Promise.all([
      redis.get('sft-stores-v1'),
      redis.hgetall('sft-visits-hash-v1'),
    ]);
    const storesObj = stores || {};
    const visitsArr = visitsHash ? Object.values(visitsHash).map(parseVal).filter(Boolean) : [];

    const storeStats = {};
    visitsArr.forEach(function (v) {
      const key = String(v.storeName || '').trim().toLowerCase();
      if (!storeStats[key]) storeStats[key] = { count: 0, sales: new Set() };
      storeStats[key].count += 1;
      if (v.salesName) storeStats[key].sales.add(v.salesName);
    });

    const rows = Object.keys(storesObj).map(function (key) {
      const s = storesObj[key];
      const stat = storeStats[key] || { count: 0, sales: new Set() };
      return {
        Kota: s.kota || '(belum diketahui)',
        Kecamatan: s.kecamatan || '(belum diketahui)',
        Toko: s.name,
        'Radius (m)': s.radius || 100,
        'Terdaftar Oleh': s.createdBy || '',
        'Tanggal Terdaftar': s.createdAt ? new Date(s.createdAt).toLocaleDateString('id-ID') : '',
        'Jumlah Kunjungan': stat.count,
        'Sales yang Pernah Kunjung': Array.from(stat.sales).join(', '),
        Latitude: s.lat,
        Longitude: s.lng,
      };
    });

    rows.sort(function (a, b) {
      return (a.Kota + a.Kecamatan + a.Toko).localeCompare(b.Kota + b.Kecamatan + b.Toko);
    });

    const wb = XLSX.utils.book_new();
    const wsAll = XLSX.utils.json_to_sheet(rows);
    wsAll['!cols'] = COLS;
    XLSX.utils.book_append_sheet(wb, wsAll, 'Semua Toko');

    const byKota = {};
    rows.forEach(function (r) { (byKota[r.Kota] = byKota[r.Kota] || []).push(r); });
    const usedNames = new Set(['Semua Toko']);
    Object.keys(byKota).sort().forEach(function (kota) {
      const ws = XLSX.utils.json_to_sheet(byKota[kota]);
      ws['!cols'] = COLS;
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(kota, usedNames));
    });

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="data-toko-' + new Date().toISOString().slice(0, 10) + '.xlsx"');
    res.status(200).send(Buffer.from(buf));
  } catch (e) {
    console.error('export-stores error', e);
    res.status(500).json({ error: e && e.message ? e.message : 'Gagal membuat file export' });
  }
}
