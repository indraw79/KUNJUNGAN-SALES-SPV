import Anthropic from '@anthropic-ai/sdk';

const JENIS_BBM_OPTIONS = ['Pertalite', 'Pertamax', 'Pertamax Turbo', 'Solar', 'Dexlite', 'Lainnya'];

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

const RECORD_TOOL = {
  name: 'record_fuel_receipt',
  description: 'Catat data dari foto struk pembelian BBM (bahan bakar) di SPBU.',
  input_schema: {
    type: 'object',
    properties: {
      readable: {
        type: 'boolean',
        description: 'true hanya jika struk cukup jelas terbaca untuk menentukan ketiga nilai di bawah dengan yakin.',
      },
      jenisBBM: {
        type: 'string',
        enum: JENIS_BBM_OPTIONS,
        description: 'Jenis BBM yang tertulis di struk. Pilih "Lainnya" jika tidak cocok dengan pilihan lain atau tidak terbaca.',
      },
      liter: {
        type: 'number',
        description: 'Jumlah liter BBM yang dibeli, sesuai angka di struk. 0 jika tidak terbaca.',
      },
      nominal: {
        type: 'number',
        description: 'Total nominal rupiah yang dibayar (harga total, BUKAN harga per liter). 0 jika tidak terbaca.',
      },
    },
    required: ['readable', 'jenisBBM', 'liter', 'nominal'],
    additionalProperties: false,
  },
  strict: true,
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY belum diatur di Environment Variables Vercel' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const decoded = body && decodeDataUrl(body.imageBase64);
    if (!decoded) {
      res.status(400).json({ error: 'imageBase64 (data URL foto struk) wajib diisi' });
      return;
    }

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      tools: [RECORD_TOOL],
      tool_choice: { type: 'tool', name: 'record_fuel_receipt' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: decoded.mediaType, data: decoded.data } },
            { type: 'text', text: 'Ini foto struk pembelian BBM dari SPBU. Baca dan catat datanya dengan tool yang tersedia.' },
          ],
        },
      ],
    });

    const toolUse = message.content.find(function (b) { return b.type === 'tool_use'; });
    if (!toolUse || !toolUse.input) {
      res.status(502).json({ error: 'Model tidak mengembalikan hasil baca struk' });
      return;
    }
    res.status(200).json(toolUse.input);
  } catch (e) {
    console.error('parse-fuel-receipt handler error', e);
    res.status(500).json({ error: e && e.message ? e.message : 'internal error' });
  }
}
