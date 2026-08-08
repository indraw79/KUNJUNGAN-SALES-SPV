import { put } from '@vercel/blob';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB safety cap on the already-compressed photo

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const visitId = body && body.visitId;
    const decoded = body && decodeDataUrl(body.imageBase64);
    if (!visitId || !decoded) {
      res.status(400).json({ error: 'visitId dan imageBase64 (data URL foto) wajib diisi' });
      return;
    }
    if (decoded.buffer.length > MAX_BYTES) {
      res.status(400).json({ error: 'Ukuran foto terlalu besar' });
      return;
    }
    const ext = decoded.contentType.split('/')[1] || 'jpg';
    const blob = await put(`payment-photos/${visitId}-${Date.now()}.${ext}`, decoded.buffer, {
      access: 'public',
      contentType: decoded.contentType,
    });
    res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error('upload-photo handler error', e);
    res.status(500).json({ error: e && e.message ? e.message : 'internal error' });
  }
}
