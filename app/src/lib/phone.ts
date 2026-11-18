/** 從貼文抽出台灣電話。只有格式明確才填，不猜。 */

const FULLWIDTH_DIGIT = /[０-９]/g;

function normalizeText(text: string): string {
  return (text || '')
    .replace(FULLWIDTH_DIGIT, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[‐‑–—－]/g, '-');
}

function toLocal(rawDigits: string): string | null {
  let d = rawDigits.replace(/\D/g, '');
  if (d.startsWith('886')) {
    d = d.slice(3);
    if (!d.startsWith('0')) d = '0' + d;
  }
  return isTaiwanLocal(d) ? d : null;
}

/** 市話 02／03–08，手機 09。長度必須剛好。 */
export function isTaiwanLocal(d: string): boolean {
  if (/^09\d{8}$/.test(d)) return true;
  if (/^02\d{8}$/.test(d)) return true;
  if (/^0[3-8]\d{7}$/.test(d)) return true;
  if (/^0[3-8]\d{8}$/.test(d)) return true;
  return false;
}

export function formatPhone(local: string): string {
  if (/^09\d{8}$/.test(local)) return `${local.slice(0, 4)}-${local.slice(4, 7)}-${local.slice(7)}`;
  if (/^02\d{8}$/.test(local)) return `${local.slice(0, 2)}-${local.slice(2, 6)}-${local.slice(6)}`;
  if (/^0[3-8]\d{7}$/.test(local)) return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  if (/^0[3-8]\d{8}$/.test(local)) return `${local.slice(0, 2)}-${local.slice(2, 6)}-${local.slice(6)}`;
  return local;
}

/** 撥打用。02-2345-6789 → tel:+886223456789 */
export function telHref(phone: string): string {
  const local = toLocal(phone);
  if (!local) return '';
  return 'tel:+886' + local.slice(1);
}

function lineScore(line: string): number {
  if (/訂位/.test(line)) return 3;
  if (/預約/.test(line)) return 2;
  if (/電話|Tel\.?|📞|☎/i.test(line)) return 1;
  return 0;
}

const PHONE_RE = /(?<![\d])(?:\+886[\s\-.]?(?:\(0?[2-8]\)|0?[2-9])|(?:\(0[2-8]\)|0[2-9]))(?:[\s\-.]?\d){7,8}(?![\d])/g;

function candidates(text: string): Array<{ local: string; score: number; index: number }> {
  const out: Array<{ local: string; score: number; index: number }> = [];
  for (const m of text.matchAll(PHONE_RE)) {
    const raw = m[0];
    if (/[，,]/.test(raw)) continue;
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(raw)) continue;
    const local = toLocal(raw);
    if (!local) continue;
    const index = m.index ?? 0;
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const lineEnd = text.indexOf('\n', index);
    const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
    out.push({ local, score: lineScore(line), index });
  }
  return out;
}

/** 回傳格式化後的電話，沒有明確號碼就回傳空字串。多個時優先訂位、預約、電話。 */
export function extractPhone(...parts: string[]): string {
  const text = normalizeText(parts.filter(Boolean).join('\n'));
  const found = candidates(text);
  if (!found.length) return '';
  found.sort((a, b) => b.score - a.score || a.index - b.index);
  return formatPhone(found[0].local);
}

/** 使用者輸入：能辨認就格式化，不能就保留原文（空字串表示沒填）。 */
export function commitPhone(typed: string, ...fallback: string[]): string {
  const raw = typed.trim();
  if (raw) {
    const local = toLocal(raw);
    return local ? formatPhone(local) : raw;
  }
  return extractPhone(...fallback);
}
