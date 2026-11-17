import { describe, expect, it, vi } from 'vitest';
import { fetchPostMeta } from '../../src/lib/fetchMeta';
import { extractOg, normalizeOg, textFromXEmbedHtml } from '../../src/lib/og';
import { DEFAULT_SETTINGS } from '../../src/lib/types';

const IG = 'https://www.instagram.com/natgeo/p/DHrUZ11yOh0/';
const X = 'https://x.com/jack/status/20';
const TH = 'https://www.threads.net/@natgeo/post/C7XSa54NOw1';
const blocked = () => vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit): Promise<Response> => { throw new TypeError('Failed to fetch'); });
const urls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => String(c[0]));

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
  it('Instagram 被 CORS 擋：回報 cors，且不碰代理', async () => {
    const f = blocked();
    const r = await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true });
    expect(r).toMatchObject({ ok: false, reason: 'cors' });
    expect(urls(f)).toEqual([IG]); // Instagram 沒有免金鑰的 oEmbed
  });
  it('X：直接被擋，改讀公開 oEmbed 成功', async () => {
    const f = vi.fn(async (u: RequestInfo | URL) => {
      if (String(u).startsWith('https://publish.twitter.com/oembed')) return new Response(JSON.stringify({ author_name: 'jack', author_url: 'https://x.com/jack', html: '<blockquote><p>just setting up my twttr</p></blockquote>' }));
      return new Response('', { status: 403 });
    });
    const r = await fetchPostMeta(X, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true });
    expect(r).toMatchObject({ ok: true, via: 'oembed', meta: { name: 'jack', handle: 'jack', caption: 'just setting up my twttr' } });
    expect(urls(f)[0]).toBe(X);
  });
  it('X oEmbed 404 → 判定連結失效', async () => {
    const f = vi.fn(async (u: RequestInfo | URL) => { if (String(u).includes('publish.twitter.com')) return new Response('', { status: 404 }); throw new TypeError('x'); });
    expect(await fetchPostMeta(X, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true })).toMatchObject({ ok: false, reason: 'dead' });
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
  it('代理預設關閉：絕不請求代理；開啟後才請求並採用結果', async () => {
    expect(DEFAULT_SETTINGS.proxyEnabled).toBe(false);
    const f = vi.fn(async (u: RequestInfo | URL) => {
      if (String(u).startsWith('http://localhost:8787/meta')) return new Response(JSON.stringify({ status: 200, title: 'National Geographic 在 Instagram: "manatee"', description: '', image: 'https://cdn/x.jpg' }));
      throw new TypeError('Failed to fetch');
    });
    const off = await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true });
    expect(off.ok).toBe(false);
    expect(urls(f).some((u) => u.includes('8787'))).toBe(false);
    const on = await fetchPostMeta(IG, { fetchImpl: f as unknown as typeof fetch, settings: { ...DEFAULT_SETTINGS, proxyEnabled: true }, online: true });
    expect(on).toMatchObject({ ok: true, via: 'proxy', meta: { name: 'National Geographic', caption: 'manatee', handle: 'natgeo', image: 'https://cdn/x.jpg' } });
  });
});
