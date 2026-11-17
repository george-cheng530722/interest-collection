import type { Category, City, Source } from './types';
import { DEFAULT_CITY } from './constants';

const URL_RE = /https?:\/\/[^\s<>"'（）「」『』，。、！？]+/gi;

export function detectSource(raw: string): Source | null {
  let host: string;
  try { host = new URL(raw.trim()).hostname.toLowerCase(); } catch { return null; }
  host = host.replace(/^(www|m|mobile)\./, '');
  if (host === 'instagram.com' || host === 'instagr.am') return 'Instagram';
  if (host === 'threads.net' || host === 'threads.com') return 'Threads';
  if (host === 'x.com' || host === 'twitter.com') return 'X';
  return null;
}

/**
 * 從貼上的文字（可能是 LINE 分享文字：「看看這個 https://… 」）找出第一個支援的貼文網址。
 * 會去掉 LINE／IG 常見的追蹤參數。找不到時回傳 null。
 */
export function extractPostUrl(text: string): string | null {
  const matches = (text || '').match(URL_RE) || [];
  for (const m of matches) {
    const cleaned = m.replace(/[)\]}>.,;:!?]+$/, '');
    if (detectSource(cleaned)) return normalizeUrl(cleaned);
  }
  return null;
}

const TRACKING = /^(utm_|igsh|igshid|img_index|s$|t$|ref_src|ref_url|xmt|slof|openExternalBrowser)/i;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    [...u.searchParams.keys()].forEach((k) => { if (TRACKING.test(k)) u.searchParams.delete(k); });
    if (u.hostname === 'twitter.com' || u.hostname === 'www.twitter.com' || u.hostname === 'mobile.twitter.com' || u.hostname === 'mobile.x.com') u.hostname = 'x.com';
    return u.toString();
  } catch { return raw.trim(); }
}

export function sameUrl(a: string, b: string): boolean {
  const n = (s: string) => normalizeUrl(s).replace(/^https?:\/\/(www\.)?/, '').replace(/threads\.com/, 'threads.net').replace(/\/$/, '').toLowerCase();
  return n(a) === n(b);
}

const IG_RESERVED = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'share']);
const X_RESERVED = new Set(['i', 'intent', 'share', 'home', 'search', 'hashtag']);

/** 從網址解析來源與帳號（不需網路） */
export function parseUrlMeta(raw: string): { source: Source | null; handle: string } {
  const source = detectSource(raw);
  let handle = '';
  try {
    const u = new URL(raw.trim());
    const parts = u.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
    if (source === 'Threads') {
      const at = parts.find((p) => p.startsWith('@'));
      if (at) handle = at.slice(1);
    } else if (source === 'X') {
      if (parts[0] && parts[1] === 'status' && !X_RESERVED.has(parts[0].toLowerCase())) handle = parts[0];
    } else if (source === 'Instagram') {
      if (parts[0] && !IG_RESERVED.has(parts[0].toLowerCase()) && parts[1] && ['p', 'reel', 'tv'].includes(parts[1])) handle = parts[0];
    }
  } catch { /* 非網址 */ }
  return { source, handle: handle.replace(/^@/, '') };
}

/** 依網址判斷是否為已知讀不到的私人／限制年齡貼文（示範與分享連結常見的標記） */
export function isLikelyUnreadable(url: string): boolean {
  return /private|age[-_]?gate|age[-_]?restricted|restricted/i.test(url);
}

export function classify(text: string): Category {
  const t = (text || '').toLowerCase();
  if (/follow|學習|筆記|設計|方法|動線|教學|課程/.test(t)) return '想 follow 學習';
  if (/喝|咖啡|手沖|手搖|茶|啤酒|烏龍|酒吧|latte|coffee|bar\b/.test(t)) return '喝';
  if (/吃|餐|拉麵|碗粿|雞排|火鍋|小吃|美食|叉燒|炸|香腸|夜市|早午餐|甜點|ramen|food/.test(t)) return '吃';
  if (/玩|旅|景點|一日|行程|九份|巷弄|路線|露營|步道|展覽|樂園|trip|travel/.test(t)) return '玩';
  return '有趣';
}

/** 依說明文字推斷地區；判斷不出來一律回傳「其他」 */
export function inferCity(text: string): City {
  const s = text || '';
  if (/新北|九份|淡水|三峽|板橋|林口|永和|中和|新店|三重|瑞芳|烏來/.test(s)) return '新北市';
  if (/台中|臺中|逢甲|一中街|審計新村/.test(s)) return '台中市';
  if (/台南|臺南|鹽水|安平|赤崁|國華街/.test(s)) return '台南市';
  if (/高雄|駁二|旗津|美濃/.test(s)) return '高雄市';
  if (/桃園|中壢|大溪/.test(s)) return '桃園市';
  if (/台北|臺北|師大|大稻埕|迪化街|松山|五分埔|永康|大同區|大安|信義區|西門|士林|中山站|北投/.test(s)) return '台北市';
  return DEFAULT_CITY;
}

export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/** Instagram／Facebook CDN 網址的 oe= 是 16 進位的到期時間（秒） */
export function thumbExpiryFromUrl(url?: string): number | undefined {
  if (!url) return undefined;
  try {
    const oe = new URL(url).searchParams.get('oe');
    if (oe && /^[0-9a-f]{6,10}$/i.test(oe)) return parseInt(oe, 16) * 1000;
  } catch { /* ignore */ }
  return undefined;
}
