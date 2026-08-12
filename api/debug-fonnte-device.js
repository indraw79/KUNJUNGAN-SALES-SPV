export default async function handler(req, res) {
  try {
    const token = process.env.FONNTE_TOKEN;
    if (!token) {
      res.status(500).json({ error: 'no token' });
      return;
    }
    const r = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: { Authorization: token },
    });
    const text = await r.text();
    res.status(200).json({ fonnteStatus: r.status, fonnteBody: text });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
}
