import { describe, expect, it, vi } from 'vitest';
import { distanceKm, formatDistance, geocodePlace, mapsNavigateUrl, mapsSearchUrl } from '../../src/lib/geo';
import { extractAddress } from '../../src/lib/place';

describe('距離與地理編碼', () => {
  it('直線距離與導航網址', () => {
    const km = distanceKm({ lat: 25.077, lng: 121.39 }, { lat: 25.09, lng: 121.4 });
    expect(km).toBeGreaterThan(1);
    expect(km).toBeLessThan(3);
    expect(formatDistance(3.24)).toBe('距家 3.2 km');
    expect(formatDistance(12.4)).toBe('距家 12 km');
    expect(mapsNavigateUrl('住家', '山海咖啡')).toBe('https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent('住家') + '&destination=' + encodeURIComponent('山海咖啡'));
    expect(mapsSearchUrl('山海咖啡')).toContain('maps/search/');
  });

  it('只抽出地址行，沒有就不捏造', () => {
    expect(extractAddress('店名：山海咖啡\n地址：新北市林口區文化一路100號\n好喝。')).toBe('新北市林口區文化一路100號');
    expect(extractAddress('📍 山海咖啡\n今天喝手沖。')).toBe('');
  });

  it('代理沒有 /geo 時回報不支援，不把錯誤當成座標', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":"not found"}', { status: 404 }));
    expect(await geocodePlace('林口', 'https://proxy.example', fetchImpl as unknown as typeof fetch)).toBe('unsupported');
    const bad = vi.fn(async () => new Response('{"lat":"x"}', { status: 200 }));
    expect(await geocodePlace('林口', 'https://proxy.example', bad as unknown as typeof fetch)).toBeNull();
  });
});
