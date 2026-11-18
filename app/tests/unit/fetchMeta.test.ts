import { describe, expect, it, vi } from 'vitest';
import { fetchPostMeta } from '../../src/lib/fetchMeta';
import { extractOg, normalizeOg, textFromXEmbedHtml } from '../../src/lib/og';
import { DEFAULT_PROXY_URL, DEFAULT_SETTINGS } from '../../src/lib/types';

const IG = 'https://www.instagram.com/natgeo/p/DHrUZ11yOh0/';
const X = 'https://x.com/jack/status/20';
const TH = 'https://www.threads.net/@natgeo/post/C7XSa54NOw1';
const blocked = () => vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit): Promise<Response> => { throw new TypeError('Failed to fetch'); });
const urls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => String(c[0]));
const PROXY_META = 'https://interest-collection-proxy.george-cheng.workers.dev/meta?url=';
const NO_PROXY = { ...DEFAULT_SETTINGS, proxyEnabled: false };

describe('og 解析（以 2026-11-17 實測的真實標籤為樣本）', () => {
  it('Instagram', () => {
    const og = extractOg(`<meta property="og:title" content="National Geographic &#x5728; Instagram: &quot;Photo by &#064;carltonward | Today is Manatee Awareness Day.&quot;" /><meta property="og:description" content="72K likes, 134 comments -  natgeo &#x65bc; March 26, 2025 : &quot;Photo by &#064;carltonward | Today is Manatee Awareness Day.&quot;" /><meta property="og:image" content="https://scontent.cdninstagram.com/a.jpg?oe=6745A1B2&amp;x=1" />`);
    expect(og.image).toBe('https://scontent.cdninstagram.com/a.jpg?oe=6745A1B2&x=1');
    expect(normalizeOg('Instagram', og, '')).toEqual({ name: 'National Geographic', caption: 'Photo by @carltonward | Today is Manatee Awareness Day.', handle: 'natgeo', image: og.image });
  });
  it('Threads 與 X', () => {
    expect(normalizeOg('Threads', { title: 'Threads 上的 National Geographic（@natgeo）', description: 'Witness pure joy' }, '')).toMatchObject({ name: 'National Geographic', handle: 'natgeo', caption: 'Witness pure joy' });
    expect(normalizeOg('X', { title: 'X 上的 jack (@jack)', description: '“just setting up my twttr”' }, '')).toMatchObject({ name: 'jack', handle: 'jack', caption: 'just setting up my twttr' });
    expect(textFromXEmbedHtml('<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr</p>&mdash; jack (@jack)</blockquote>')).toBe('just setting up my twttr');
  });
});

describe('抓取流程：直接 → 公開 oEmbed → 代理（只在開啟時）', () => {
  it('Instagram 被 CORS 擋：回報 cors；代理關掉時不碰代理', async () => {
    const f = blocked();
    const r = await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: NO_PROXY, online: true });
    expect(r).toMatchObject({ ok: false, reason: 'cors' });
    expect(urls(f)).toEqual([IG]); // Instagram 沒有免金鑰的 oEmbed
  });
  it('Instagram 被 CORS 擋：預設設定下先直接抓，失敗才問預設代理；代理也失敗仍回報 cors', async () => {
    const f = blocked();
    const r = await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true });
    expect(r).toMatchObject({ ok: false, reason: 'cors' });
    expect(urls(f)).toEqual([IG, PROXY_META + encodeURIComponent(IG)]);
  });
  it('X：直接被擋，改讀 publish.x.com oEmbed，並用整理過的網址', async () => {
    const shared = 'https://x.com/i/web/status/20?s=46&t=abc';
    const f = vi.fn(async (u: RequestInfo | URL) => {
      const s = String(u);
      if (s.startsWith('https://publish.x.com/oembed')) {
        expect(s).toContain(encodeURIComponent('https://x.com/i/status/20'));
        expect(s).not.toContain('s%3D46');
        return new Response(JSON.stringify({ author_name: 'jack', author_url: 'https://x.com/jack', html: '<blockquote><p>just setting up my twttr</p></blockquote>' }));
      }
      return new Response('', { status: 403 });
    });
    const r = await fetchPostMeta(shared, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true });
    expect(r).toMatchObject({ ok: true, via: 'oembed', meta: { name: 'jack', handle: 'jack', caption: 'just setting up my twttr' } });
    expect(urls(f)[0]).toBe('https://x.com/i/status/20');
    expect(urls(f).some((u) => u.includes('publish.twitter.com'))).toBe(false);
  });
  it('publish.x.com 連不上時才改打 publish.twitter.com', async () => {
    const f = vi.fn(async (u: RequestInfo | URL) => {
      const s = String(u);
      if (s.startsWith('https://publish.x.com/oembed')) throw new TypeError('Load failed');
      if (s.startsWith('https://publish.twitter.com/oembed')) return new Response(JSON.stringify({ author_name: 'jack', author_url: 'https://x.com/jack', html: '<blockquote><p>just setting up my twttr</p></blockquote>' }));
      throw new TypeError('x');
    });
    const r = await fetchPostMeta('https://twitter.com/jack/status/20?s=46', { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true });
    expect(r).toMatchObject({ ok: true, via: 'oembed', meta: { name: 'jack', caption: 'just setting up my twttr' } });
    expect(urls(f).filter((u) => u.includes('/oembed'))).toHaveLength(2);
  });
  it('X oEmbed 404 → 判定連結失效，不再打備援', async () => {
    const f = vi.fn(async (u: RequestInfo | URL) => { if (String(u).includes('publish.x.com')) return new Response('', { status: 404 }); throw new TypeError('x'); });
    expect(await fetchPostMeta(X, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true })).toMatchObject({ ok: false, reason: 'dead' });
    expect(urls(f).some((u) => u.includes('publish.twitter.com'))).toBe(false);
  });
  it('Threads oEmbed 只能確認存在、沒有內容 → 改手動補充（不是失效）', async () => {
    const f = vi.fn(async (u: RequestInfo | URL) => { if (String(u).includes('graph.threads.net')) return new Response(JSON.stringify({ type: 'rich', html: '<blockquote></blockquote>', provider_name: 'Threads' })); throw new TypeError('x'); });
    expect(await fetchPostMeta(TH, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true })).toMatchObject({ ok: false, reason: 'empty' });
  });
  it('登入牆 → private', async () => {
    const f = vi.fn(async () => new Response('<meta property="og:title" content="Instagram">', { status: 200 }));
    expect(await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true })).toMatchObject({ ok: false, reason: 'private' });
  });
  it('離線時完全不送出請求', async () => {
    const f = blocked();
    expect(await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: { ...DEFAULT_SETTINGS, proxyEnabled: true }, online: false })).toMatchObject({ ok: false, reason: 'offline' });
    expect(f).not.toHaveBeenCalled();
  });
  it('代理預設開啟（Cloudflare Worker）：直接與 oEmbed 失敗後才請求並採用結果；關掉就絕不請求', async () => {
    expect(DEFAULT_SETTINGS).toEqual({ proxyEnabled: true, proxyUrl: 'https://interest-collection-proxy.george-cheng.workers.dev', homeAddress: '新北市林口區仁愛二路96號' });
    expect(DEFAULT_PROXY_URL).toBe(DEFAULT_SETTINGS.proxyUrl);
    const f = vi.fn(async (u: RequestInfo | URL) => {
      if (String(u).startsWith(PROXY_META)) return new Response(JSON.stringify({ status: 200, title: 'National Geographic 在 Instagram: "manatee"', description: '', image: 'https://cdn/x.jpg' }));
      throw new TypeError('Failed to fetch');
    });
    const on = await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true });
    expect(on).toMatchObject({ ok: true, via: 'proxy', meta: { name: 'National Geographic', caption: 'manatee', handle: 'natgeo', image: 'https://cdn/x.jpg' } });
    expect(urls(f)).toEqual([IG, PROXY_META + encodeURIComponent(IG)]); // 先直接抓，代理在最後

    f.mockClear();
    const off = await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: NO_PROXY, online: true });
    expect(off.ok).toBe(false);
    expect(urls(f).some((u) => u.includes('/meta?'))).toBe(false);
    expect(urls(f)).toEqual([IG]);
  });
});
