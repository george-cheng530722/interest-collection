import type { Source } from './types';

export interface RawOg { title?: string; description?: string; image?: string; siteName?: string }
export interface PostMeta { name: string; caption: string; handle: string; image?: string }

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };
export function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

/** 從 HTML 字串取出 og 標籤（不依賴 DOM，代理與瀏覽器共用相同邏輯） */
export function extractOg(html: string): RawOg {
  const pick = (prop: string): string | undefined => {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    for (const tag of tags) {
      const p = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
      if (p && p[1].toLowerCase() === prop) {
        const c = tag.match(/content\s*=\s*"([^"]*)"/i) || tag.match(/content\s*=\s*'([^']*)'/i);
        if (c) return decodeEntities(c[1]).trim();
      }
    }
    return undefined;
  };
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return {
    title: pick('og:title') ?? pick('twitter:title') ?? (titleTag ? decodeEntities(titleTag[1]).trim() : undefined),
    description: pick('og:description') ?? pick('twitter:description') ?? pick('description'),
    image: pick('og:image') ?? pick('twitter:image'),
    siteName: pick('og:site_name'),
  };
}

const stripQuotes = (s: string) => s.trim().replace(/^["“「]+|["”」]+$/g, '').trim();

/** 判斷是否為登入牆／私人貼文（只拿到通用標題、沒有內容） */
export function looksLikeLoginWall(og: RawOg): boolean {
  const t = (og.title || '').trim();
  return (!og.description && /^(instagram|threads|x|login\b.*|log in.*|登入.*)$/i.test(t)) || /login|log in|登入/i.test(t) && !og.description;
}

/** 把各平台 og 標題／說明整理成 名稱、說明、帳號 */
export function normalizeOg(source: Source, og: RawOg, fallbackHandle: string): PostMeta | null {
  const title = (og.title || '').trim();
  const desc = (og.description || '').trim();
  if (!title && !desc) return null;
  let name = title;
  let caption = desc;
  let handle = fallbackHandle;
  if (source === 'Instagram') {
    const m = title.match(/^(.*?)\s*(?:在|on)\s*Instagram\s*[:：]\s*(.*)$/i);
    if (m) { name = m[1].trim(); if (!caption) caption = stripQuotes(m[2]); }
    const d = desc.match(/-\s*([A-Za-z0-9._]+)\s*(?:於|on)\s*[^:]*:\s*([\s\S]*)$/);
    if (d) { handle = handle || d[1]; caption = stripQuotes(d[2]); }
  } else if (source === 'Threads') {
    const m = title.match(/^Threads\s*上的\s*(.*?)\s*[（(]@([^）)]+)[）)]/) || title.match(/^(.*?)\s*[（(]@([^）)]+)[）)]\s*(?:on Threads)?/i);
    if (m) { name = m[1].trim(); handle = handle || m[2]; }
  } else if (source === 'X') {
    const m = title.match(/^X\s*上的\s*(.*?)\s*[（(]@([^）)]+)[）)]/) || title.match(/^(.*?)\s*[（(]@([^）)]+)[）)]\s*(?:on X)?/i) || title.match(/^(.*?)\s+on X\s*[:：]\s*(.*)$/i);
    if (m) { name = m[1].trim(); if (m[2] && /^[A-Za-z0-9_]+$/.test(m[2])) handle = handle || m[2]; }
    caption = stripQuotes(caption);
  }
  return { name: name || handle, caption, handle, image: og.image };
}

/** X oEmbed 回傳的 html 取出推文文字 */
export function textFromXEmbedHtml(html: string): string {
  const p = (html || '').match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!p) return '';
  return decodeEntities(p[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
}
