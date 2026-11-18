// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error — 純 JS 外掛模組
import { createServer, fetchGeo, fetchMeta } from '../../proxy/server.mjs';

describe('可選代理（外掛）', () => {
  it('只允許 IG／Threads／X，回傳 og JSON 與 CORS 標頭', async () => {
    const upstream = vi.fn(async () => new Response('<meta property="og:title" content="X 上的 jack (@jack)"><meta property="og:image" content="https://pbs/x.jpg">', { status: 200 }));
    expect((await fetchMeta('https://evil.example/a', upstream)).code).toBe(400);
    const srv = createServer({ fetchImpl: upstream });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
    const port = (srv.address() as { port: number }).port;
    const r = await fetch(`http://127.0.0.1:${port}/meta?url=` + encodeURIComponent('https://x.com/jack/status/20'));
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    expect(await r.json()).toMatchObject({ status: 200, title: 'X 上的 jack (@jack)', image: 'https://pbs/x.jpg' });
    srv.close();
  });

  it('地理編碼走 Nominatim、帶 User-Agent，並快取；找不到不捏造', async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('nominatim.openstreetmap.org');
      return new Response(JSON.stringify([{ lat: '25.077', lon: '121.391' }]), { status: 200 });
    });
    const hit = await fetchGeo('新北市林口區仁愛二路96號', upstream);
    expect(hit).toMatchObject({ code: 200, body: { lat: 25.077, lng: 121.391 } });
    const init = (upstream.mock.calls as unknown as Array<[string, { headers: Record<string, string> }]>)[0][1];
    expect(init.headers['user-agent']).toContain('GeorgesPicks');
    const again = await fetchGeo('新北市林口區仁愛二路96號', upstream);
    expect(again.cache).toBe('HIT');
    expect(upstream).toHaveBeenCalledTimes(1);
    const miss = await fetchGeo('沒有這家店zzz', vi.fn(async () => new Response('[]', { status: 200 })));
    expect(miss.code).toBe(404);
  });
});
