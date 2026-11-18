// George 的 興趣收藏 — 中繼資料代理的本機開發版（外掛，非必要）
//
// App 預設使用已部署的 Cloudflare Worker（https://interest-collection-proxy.george-cheng.workers.dev），
// 不是這個本機版。要試這個版本，在 App「設定」把代理網址改成 http://localhost:8787（注意：舊預設的 localhost
// 網址在開啟時會自動改回 Worker）。App 只在裝置直接抓取失敗後才請求  GET {代理網址}/meta?url=<貼文網址>。
// 代理只做一件事：在伺服器端讀取公開貼文的 og 標籤，回傳 JSON。不儲存任何資料、沒有帳號。
//
// 啟動：  node proxy/server.mjs            （預設 http://localhost:8787）
//         PORT=9000 node proxy/server.mjs
// 停止：  Ctrl+C。App 端在設定關掉開關即可完全不使用。
// 注意：請勿部署成公開服務（會變成開放代理）；只允許 Instagram／Threads／X 網域。
import http from 'node:http';
import { pathToFileURL } from 'node:url';

export const ALLOWED_HOSTS = ['instagram.com', 'www.instagram.com', 'threads.net', 'www.threads.net', 'threads.com', 'www.threads.com', 'x.com', 'www.x.com', 'twitter.com', 'mobile.twitter.com'];
const UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const GEO_UA = 'GeorgesPicks/1.0 (https://george-cheng530722.github.io/interest-collection/)';
const geoCache = new Map();
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decode(s) {
  return (s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

export function extractOg(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const pick = (prop) => {
    for (const tag of tags) {
      const p = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
      if (p && p[1].toLowerCase() === prop) {
        const c = tag.match(/content\s*=\s*"([^"]*)"/i) || tag.match(/content\s*=\s*'([^']*)'/i);
        if (c) return decode(c[1]).trim();
      }
    }
    return undefined;
  };
  return { title: pick('og:title') ?? pick('twitter:title'), description: pick('og:description') ?? pick('twitter:description'), image: pick('og:image') ?? pick('twitter:image'), siteName: pick('og:site_name') };
}

export async function fetchMeta(target, fetchImpl = fetch) {
  let u;
  try { u = new URL(target); } catch { return { code: 400, body: { error: '網址格式錯誤' } }; }
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.includes(u.hostname.toLowerCase())) return { code: 400, body: { error: '只支援 Instagram、Threads、X 的 https 網址' } };
  try {
    const r = await fetchImpl(u.toString(), { redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8' }, signal: AbortSignal.timeout(12000) });
    const html = r.ok ? await r.text() : '';
    return { code: 200, body: { status: r.status, finalUrl: r.url, ...extractOg(html) } };
  } catch (e) {
    return { code: 502, body: { error: '上游讀取失敗：' + (e?.cause?.code || e?.message || 'unknown') } };
  }
}

/** Nominatim 地理編碼。快取在這個行程裡，並請上游快取一天。找不到不捏造座標。 */
export async function fetchGeo(query, fetchImpl = fetch) {
  const q = (query || '').trim().slice(0, 120);
  if (q.length < 2) return { code: 400, body: { error: '請提供地址或店名' } };
  if (geoCache.has(q)) return { code: 200, body: geoCache.get(q), cache: 'HIT' };
  const endpoint = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(q);
  try {
    const r = await fetchImpl(endpoint, { headers: { 'user-agent': GEO_UA, accept: 'application/json', 'accept-language': 'zh-TW' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { code: 502, body: { error: '地理編碼失敗' } };
    const arr = await r.json();
    const hit = Array.isArray(arr) ? arr[0] : null;
    const lat = hit ? Number(hit.lat) : NaN;
    const lng = hit ? Number(hit.lon) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { code: 404, body: { error: '找不到座標' } };
    const body = { lat, lng };
    geoCache.set(q, body);
    return { code: 200, body, cache: 'MISS' };
  } catch (e) {
    return { code: 502, body: { error: '地理編碼失敗：' + (e?.message || 'unknown') } };
  }
}

export function createServer({ fetchImpl = fetch, allowOrigin = process.env.ALLOW_ORIGIN || '*' } = {}) {
  return http.createServer(async (req, res) => {
    const cors = { 'access-control-allow-origin': allowOrigin, 'access-control-allow-methods': 'GET, OPTIONS', 'cache-control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const send = (code, body) => { res.writeHead(code, { ...cors, 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/meta') {
      const { code, body } = await fetchMeta(url.searchParams.get('url') || '', fetchImpl);
      return send(code, body);
    }
    if (req.method === 'GET' && url.pathname === '/geo') {
      const { code, body, cache } = await fetchGeo(url.searchParams.get('q') || '', fetchImpl);
      res.writeHead(code, { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': code === 200 ? 'public, max-age=86400' : 'no-store', 'x-geo-cache': cache || 'NONE' });
      res.end(JSON.stringify(body));
      return;
    }
    send(404, { error: 'not found' });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host, () => {
    console.log(`中繼資料代理（可選外掛）已啟動：http://${host === '127.0.0.1' ? 'localhost' : host}:${port}/meta?url=…`);
    console.log('App 預設使用已部署的 Worker；這是本機開發版。Ctrl+C 停止。');
  });
}
