import type { Category, City, Item, Source } from './types';
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

function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www|mobile|m)\./, '');
}

/**
 * 整理貼上的網址。
 * X／Twitter（含 iOS App 分享的 ?s=46&t=…、twitter.com、mobile.twitter.com、/i/web/status/）
 * 會改成 https://x.com/{帳號}/status/{id} 或 https://x.com/i/status/{id}，並去掉全部查詢參數。
 * oEmbed 不接受 /i/web/status/（會 404），所以要先改成 /i/status/。
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    const bare = bareHost(u.hostname);
    if (bare === 'x.com' || bare === 'twitter.com') {
      u.protocol = 'https:';
      u.hostname = 'x.com';
      u.search = '';
      const parts = u.pathname.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
      const statusAt = parts.findIndex((p) => p.toLowerCase() === 'status');
      const id = statusAt >= 0 ? parts[statusAt + 1] : '';
      if (id && /^\d+$/.test(id)) {
        const user = statusAt === 0 ? '' : parts[0];
        u.pathname = !user || user.toLowerCase() === 'i' ? `/i/status/${id}` : `/${user}/status/${id}`;
      } else {
        u.pathname = '/' + parts.join('/');
      }
      return u.toString();
    }
    [...u.searchParams.keys()].forEach((k) => { if (TRACKING.test(k)) u.searchParams.delete(k); });
    return u.toString();
  } catch { return raw.trim(); }
}

/**
 * 貼文本身的身分：IG／Threads 用貼文編號（不看帳號、reel 或 p），X 用 status id。
 * 編號保留大小寫。對不到編號時回傳 null，改由網址字串比較。
 */
export function postIdentity(raw: string): string | null {
  let u: URL;
  try { u = new URL(normalizeUrl(raw)); } catch { return null; }
  const host = bareHost(u.hostname);
  const segs = u.pathname.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const after = (labels: string[]) => {
    const i = segs.findIndex((p) => labels.includes(p.toLowerCase()));
    return i >= 0 ? segs[i + 1] || '' : '';
  };
  if (host === 'instagram.com' || host === 'instagr.am') {
    const id = after(['p', 'reel', 'reels', 'tv']);
    return id ? 'ig:' + id : null;
  }
  if (host === 'threads.net' || host === 'threads.com') {
    const id = after(['post']);
    return id ? 'th:' + id : null;
  }
  if (host === 'x.com' || host === 'twitter.com') {
    const id = after(['status']);
    return id ? 'x:' + id : null;
  }
  return null;
}

/** 同一則貼文的比對鍵：有貼文編號就用編號，否則用整理過的網址。 */
export function itemUrlKey(url: string): string {
  return postIdentity(url) || normalizeUrl(url).replace(/\/+$/, '').toLowerCase();
}

/** 已經收進清單、網址或貼文編號相同的項目，兩則以上才算一組。 */
export function duplicateGroups(items: Item[]): Item[][] {
  const map = new Map<string, Item[]>();
  for (const it of items) {
    const key = itemUrlKey(it.url);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(it);
    else map.set(key, [it]);
  }
  return [...map.values()].filter((g) => g.length > 1);
}

export function sameUrl(a: string, b: string): boolean {
  const ka = postIdentity(a);
  const kb = postIdentity(b);
  if (ka && kb) return ka === kb;
  const n = (s: string) => normalizeUrl(s).replace(/^https?:\/\/(www\.)?/, '').replace(/threads\.com/i, 'threads.net').replace(/\/+$/, '').toLowerCase();
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
  if (/合作|業配|邀約|聯名|商務/.test(t)) return '合作機會';
  if (/構想|點子|靈感/.test(t)) return '好構想';
  if (/生活技巧|小技巧|妙招|收納|撇步/.test(t)) return '生活技巧';
  return '有趣';
}

/** 依說明文字推斷地區；判斷不出來一律回傳「其他」 */
export function inferCity(text: string): City {
  const s = text || '';
  if (/林口/.test(s)) return '林口';
  if (/新北|九份|淡水|三峽|板橋|永和|中和|新店|三重|瑞芳|烏來/.test(s)) return '新北';
  if (/台中|臺中|逢甲|一中街|審計新村/.test(s)) return '台中';
  if (/台南|臺南|鹽水|安平|赤崁|國華街/.test(s)) return '台南';
  if (/高雄|駁二|旗津|美濃/.test(s)) return '高雄';
  if (/桃園|中壢|大溪|新竹|竹北|內灣/.test(s)) return '桃竹';
  if (/宜蘭|羅東|礁溪|頭城|蘇澳|冬山|五結|太平山/.test(s)) return '宜蘭';
  if (/台北|臺北|師大|大稻埕|迪化街|松山|五分埔|永康|大同區|大安|信義區|西門|士林|中山站|北投/.test(s)) return '台北';
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
