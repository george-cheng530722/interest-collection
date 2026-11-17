// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error — 純 JS 外掛模組
import { createServer, fetchMeta } from '../../proxy/server.mjs';

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
});
