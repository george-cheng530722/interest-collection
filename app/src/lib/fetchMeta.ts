import type { Settings, Source } from './types';
import { extractOg, looksLikeLoginWall, normalizeOg, textFromXEmbedHtml, type PostMeta, type RawOg } from './og';
import { normalizeUrl, parseUrlMeta } from './parse';

export type FailReason = 'cors' | 'network' | 'offline' | 'private' | 'dead' | 'empty';

export interface Attempt { via: 'direct' | 'oembed' | 'proxy'; target: string; outcome: string }

export type MetaResult =
  | { ok: true; meta: PostMeta; via: 'direct' | 'oembed' | 'proxy'; attempts: Attempt[] }
  | { ok: false; reason: FailReason; attempts: Attempt[] };

export interface FetchDeps {
  fetchImpl?: typeof fetch;
  settings: Settings;
  online?: boolean;
  timeoutMs?: number;
}

/**
 * 公開、不需金鑰的 oEmbed 端點。
 * X 先打 publish.x.com：publish.twitter.com 現在 301 到 publish.x.com，
 * iOS Safari 對這個跨網域 CORS 重新導向會直接失敗（本機 Chrome 測試會跟著走完，所以以前看不出來）。
 * publish.twitter.com 只在 publish.x.com 連不上時才當備援。404／410 視為貼文失效，不再改打備援。
 */
export function oembedUrls(source: Source, url: string): string[] {
  if (source === 'X') {
    const q = 'omit_script=1&dnt=1&url=' + encodeURIComponent(normalizeUrl(url));
    return ['https://publish.x.com/oembed?' + q, 'https://publish.twitter.com/oembed?' + q];
  }
  if (source === 'Threads') return ['https://graph.threads.net/v1.0/oembed?url=' + encodeURIComponent(url)];
  return []; // Instagram oEmbed 需要 Meta 的 access token，前端無法使用
}

export function oembedUrl(source: Source, url: string): string | null {
  return oembedUrls(source, url)[0] ?? null;
}

export function proxyEndpoint(settings: Settings, url: string): string {
  return settings.proxyUrl.replace(/\/+$/, '') + '/meta?url=' + encodeURIComponent(url);
}

async function timed(fetchImpl: typeof fetch, input: string, ms: number): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => ctrl?.abort(), ms);
  try {
    return await fetchImpl(input, { mode: 'cors', credentials: 'omit', redirect: 'follow', signal: ctrl?.signal });
  } finally { clearTimeout(timer); }
}

const isDeadStatus = (s: number) => s === 404 || s === 410;

/**
 * 取得貼文資訊。順序：
 *   1. 裝置直接 fetch 貼文網址，讀 og 標籤（IG／Threads／X 幾乎都會被 CORS 擋）
 *   2. 公開 oEmbed（X：publish.x.com，失敗再 publish.twitter.com；Threads：graph.threads.net，只能確認存在）
 *   3. 前兩步都拿不到資料、且設定中的中繼資料代理是開啟的（預設開啟），才請求代理
 * 全部失敗就回傳失敗原因，由畫面改開手動補充表單。
 */
export async function fetchPostMeta(url: string, deps: FetchDeps): Promise<MetaResult> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const timeoutMs = deps.timeoutMs ?? 8000;
  const attempts: Attempt[] = [];
  const { source, handle } = parseUrlMeta(url);
  if (!source) return { ok: false, reason: 'empty', attempts };
  const online = deps.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  if (!online || !fetchImpl) {
    attempts.push({ via: 'direct', target: url, outcome: '裝置離線，未送出請求' });
    return { ok: false, reason: 'offline', attempts };
  }

  let reason: FailReason = 'empty';
  let corsBlocked = false;
  let exists = false;
  const canonical = source === 'X' ? normalizeUrl(url) : url;

  // 1. 直接抓
  try {
    const r = await timed(fetchImpl, canonical, timeoutMs);
    if (isDeadStatus(r.status)) {
      attempts.push({ via: 'direct', target: canonical, outcome: `HTTP ${r.status}` });
      reason = 'dead';
    } else if (r.ok) {
      const html = await r.text();
      const og = extractOg(html);
      attempts.push({ via: 'direct', target: canonical, outcome: `HTTP ${r.status}` });
      if (looksLikeLoginWall(og)) reason = 'private';
      else {
        const meta = normalizeOg(source, og, handle);
        if (meta && (meta.caption || meta.name)) return { ok: true, meta, via: 'direct', attempts };
      }
    } else {
      // 401／403 多半是平台擋機器人（例如 x.com），不代表私人貼文
      attempts.push({ via: 'direct', target: canonical, outcome: `HTTP ${r.status}` });
    }
  } catch (e) {
    corsBlocked = true;
    attempts.push({ via: 'direct', target: canonical, outcome: `被擋下（CORS 或網路）：${(e as Error)?.name || 'Error'}` });
  }

  // 2. 公開 oEmbed（X 有備援端點；404 不再往下打）
  for (const oe of oembedUrls(source, canonical)) {
    try {
      const r = await timed(fetchImpl, oe, timeoutMs);
      attempts.push({ via: 'oembed', target: oe, outcome: `HTTP ${r.status}` });
      if (r.ok) {
        exists = true;
        const j = await r.json() as { author_name?: string; author_url?: string; html?: string; thumbnail_url?: string; title?: string };
        const text = source === 'X' ? textFromXEmbedHtml(j.html || '') : (j.title || '');
        const authorHandle = (j.author_url || '').split('/').filter(Boolean).pop() || '';
        if (j.author_name || text) {
          return { ok: true, via: 'oembed', attempts, meta: { name: j.author_name || handle, caption: text, handle: handle || authorHandle, image: j.thumbnail_url } };
        }
        break;
      }
      if (isDeadStatus(r.status) || (source === 'Threads' && r.status === 400)) {
        reason = 'dead';
        break;
      }
    } catch (e) {
      attempts.push({ via: 'oembed', target: oe, outcome: `被擋下（CORS 或網路）：${(e as Error)?.name || 'Error'}` });
    }
  }

  // 3. 可選代理（預設開啟；使用者關掉時絕不送出）
  if (deps.settings.proxyEnabled && deps.settings.proxyUrl) {
    const target = proxyEndpoint(deps.settings, canonical);
    try {
      const r = await timed(fetchImpl, target, timeoutMs + 4000);
      attempts.push({ via: 'proxy', target, outcome: `HTTP ${r.status}` });
      if (r.ok) {
        const j = await r.json() as RawOg & { status?: number };
        if (j.status && isDeadStatus(j.status)) reason = 'dead';
        else if (looksLikeLoginWall(j)) reason = 'private';
        else {
          const meta = normalizeOg(source, j, handle);
          if (meta && (meta.caption || meta.name)) return { ok: true, meta, via: 'proxy', attempts };
        }
      }
    } catch (e) {
      attempts.push({ via: 'proxy', target, outcome: `代理無回應：${(e as Error)?.name || 'Error'}` });
    }
  }

  if (reason === 'dead' && exists) reason = 'empty';
  if (reason === 'empty' && corsBlocked && !exists) reason = 'cors';
  return { ok: false, reason, attempts };
}

export function failMessage(reason: FailReason): string {
  switch (reason) {
    case 'cors': return '這個網站不允許手機直接讀取（CORS），請手動補充。';
    case 'network': return '網路無法連線，請手動補充。';
    case 'offline': return '目前離線，請手動補充；連線後也不必重抓。';
    case 'private': return '這則貼文可能是私人或限制年齡，公開欄位讀不到，請手動補充。';
    case 'dead': return '這個連結似乎已失效（找不到貼文），仍可手動補充保存。';
    default: return '讀不到貼文的標題與說明，請手動補充。';
  }
}
