import { DEFAULT_PROXY_URL } from './types';

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 直線距離，例如「距家 3.2 km」。十公里以上取整數。 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  const n = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `距家 ${n} km`;
}

export function mapsNavigateUrl(origin: string, destination: string): string {
  return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(origin) + '&destination=' + encodeURIComponent(destination);
}

export function mapsSearchUrl(query: string): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

export type GeoResult = { lat: number; lng: number } | null | 'unsupported';

/** 經由中繼資料代理的 /geo 問 Nominatim。代理沒有這個路徑時回傳 unsupported，不在瀏覽器直接打 Nominatim。 */
export async function geocodePlace(query: string, proxyUrl = DEFAULT_PROXY_URL, fetchImpl: typeof fetch = fetch): Promise<GeoResult> {
  const q = query.trim();
  if (!q) return null;
  const base = (proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, '');
  try {
    const r = await fetchImpl(base + '/geo?q=' + encodeURIComponent(q), { headers: { accept: 'application/json' } });
    if (r.status === 404) return 'unsupported';
    if (!r.ok) return null;
    const j = await r.json() as { lat?: unknown; lng?: unknown };
    if (typeof j.lat !== 'number' || typeof j.lng !== 'number' || !Number.isFinite(j.lat) || !Number.isFinite(j.lng)) return null;
    return { lat: j.lat, lng: j.lng };
  } catch {
    return null;
  }
}
