// Reverse-geocodes a lat/lng into Indonesian kecamatan/kota labels via
// OpenStreetMap Nominatim. Server-side only (Vercel function), so the app's
// connect-src 'self' CSP does not apply to this outbound call.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'kunjungan-sales-spv/1.0 (absensi sales lapangan; contact: indrawahyudi.1979@gmail.com)';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: 'lat dan lng wajib diisi' });
    return;
  }

  try {
    const url = NOMINATIM_URL + '?format=jsonv2&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) + '&zoom=14&addressdetails=1';
    const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'id' } });
    if (!resp.ok) {
      res.status(200).json({});
      return;
    }
    const data = await resp.json();
    const addr = data && data.address ? data.address : {};
    const kecamatan = addr.city_district || addr.suburb || addr.subdistrict || '';
    const kota = addr.city || addr.county || addr.state_district || '';
    res.status(200).json({ kecamatan: kecamatan, kota: kota });
  } catch (e) {
    console.error('geocode handler error', e);
    // Non-fatal from the client's point of view (index.html treats this as best-effort).
    res.status(200).json({});
  }
}
