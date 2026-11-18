/** 店家名稱與短簡介。只靠規則，不猜測。抽不到店名就回傳空字串。 */

export const SUMMARY_MAX = 120;
const SUMMARY_MIN_BREAK = 24;
const PLACE_MAX = 24;

const NOT_A_PLACE = new Set([
  '食記', '開箱', '分享', '推薦', '美食', '探店', '日常', '廣告', '業配', '抽獎', '心得', '遊記', '紀錄', '開幕', '新店', '限動', '打卡', '吃貨',
  '美食推薦', '日常分享', '餐廳推薦', '美食記', 'vlog', 'reels', 'ig',
  '這裡', '這家', '這間', '店', '店家', '店名', '地址', '位置', '地標', '未知', '無', '沒有',
  '林口', '台北', '新北', '桃竹', '台中', '台南', '高雄', '宜蘭', '其他',
  '台北市', '新北市', '桃園', '桃園市', '新竹', '新竹市', '新竹縣', '台中市', '台南市', '高雄市', '宜蘭縣', '宜蘭市',
  '台灣', '臺灣', '線上',
]);

function norm(s: string): string {
  return (s || '').replace(/\u3000/g, ' ').replace(/\r\n/g, '\n');
}

function isStreetAddress(s: string): boolean {
  return /(?:路|街|巷|弄|大道|段).{0,16}\d+\s*號/.test(s) || /[市縣].{0,8}[區鄉鎮市].{0,24}(?:路|街|巷|弄)/.test(s);
}

/** 把抓到的片段收成短店名；不像店名就回傳空字串 */
export function finalizePlaceName(raw: string): string {
  let s = norm(raw).split('\n')[0] ?? '';
  s = (s.split(/https?:\/\//i)[0] ?? '').split(/[#＃]/)[0] ?? '';
  s = (s.split(/[。！？!?]/)[0] ?? '').split(/\s*[|｜／/]\s*/)[0] ?? '';
  s = s.trim().replace(/^["“「『]+|["”」』]+$/g, '').trim();
  s = s.replace(/\s*[（(][^）)]*[）)]\s*$/u, '').trim();
  s = s.replace(/[\s,，、。！？!?:：;；.]+$/g, '').trim();
  if (!s) return '';
  if ([...s].length > PLACE_MAX) {
    const token = s.split(/\s+/)[0] ?? '';
    if (token && token !== s) return finalizePlaceName(token);
    return '';
  }
  if ([...s].length < 2) return '';
  if (NOT_A_PLACE.has(s) || NOT_A_PLACE.has(s.toLowerCase())) return '';
  if (/^(這[家間個]|不是|沒有|未知)/.test(s)) return '';
  if (isStreetAddress(s)) return '';
  if (!/[0-9A-Za-z\u3400-\u9fff]/.test(s)) return '';
  return s;
}

function nameFromPinBody(body: string): string {
  const hm = body.trim().match(/^@([A-Za-z0-9._]{2,30})(?:\s+(.+))?$/);
  if (hm) {
    const rest = hm[2] ? finalizePlaceName(hm[2]) : '';
    return rest || hm[1];
  }
  return finalizePlaceName(body);
}

function nextLine(text: string, match: string): string {
  const at = text.indexOf(match);
  if (at < 0) return '';
  return text.slice(at + match.length).split('\n').map((s) => s.trim()).find(Boolean) ?? '';
}

function labeledStore(text: string): string {
  const patterns = [
    /「\s*店名\s*」\s*[:：]?\s*([^\n]*)/,
    /(?:^|\n|\s)店名\s*[:：]\s*([^\n]*)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const value = (m[1] ?? '').trim() || nextLine(text, m[0]);
    const name = nameFromPinBody(value);
    if (name) return name;
  }
  return '';
}

function fromPin(text: string): string {
  const m = text.match(/(?:\u{1F4CD}|\u{1F3E0})[ \t]*([^\n]*)/u);
  if (!m) return '';
  const body = m[1].trim() || nextLine(text, m[0]);
  return body ? nameFromPinBody(body) : '';
}

function fromLocationHandle(text: string): string {
  const m = text.match(/(?:位置|地標|標註位置|打卡地點|location)\s*[:：]?\s*@([A-Za-z0-9._]{2,30})/i);
  return m ? m[1] : '';
}

function leadingBracket(text: string): string {
  const m = text.trim().match(/^(?:【([^】\n]{1,40})】|「([^」\n]{1,40})」)/);
  if (!m) return '';
  const inner = (m[1] ?? m[2] ?? '').trim();
  if (!inner || inner === '店名') return '';
  return finalizePlaceName(inner);
}

function fromAddress(text: string): string {
  const m = text.match(/(?:^|\n)\s*地址\s*[:：]\s*([^\n]+)/);
  if (!m) return '';
  const line = m[1].trim();
  if (!isStreetAddress(line)) {
    const whole = finalizePlaceName(line);
    if (whole) return whole;
  }
  const lead = line.match(/^([^\s,，]{2,24})\s*[,，]\s*/) || line.match(/^([^\s,，]{2,24})\s+(?=[\u4e00-\u9fff])/);
  if (!lead) return '';
  const name = finalizePlaceName(lead[1]);
  return name && !isStreetAddress(name) ? name : '';
}

function fromText(text: string): string {
  const src = norm(text);
  if (!src.trim()) return '';
  return labeledStore(src) || fromPin(src) || fromLocationHandle(src) || leadingBracket(src) || fromAddress(src) || '';
}

/** 先看說明，再看標題。沒有可靠店名就回傳空字串。 */
export function extractPlaceName(title: string, caption: string): string {
  return fromText(caption) || fromText(title) || '';
}

/** 最多約 120 個字，盡量在句號或換行處截斷。不超過上限。 */
export function shortSummary(text: string, max = SUMMARY_MAX): string {
  const t = norm(text).trim();
  const chars = [...t];
  if (chars.length <= max) return t;
  const slice = chars.slice(0, max).join('');
  const re = /[。！？!?\n]/g;
  let best = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice))) {
    if (m.index + 1 >= SUMMARY_MIN_BREAK) best = m.index;
  }
  if (best >= 0) return (slice[best] === '\n' ? slice.slice(0, best) : slice.slice(0, best + 1)).trim();
  return slice.trim();
}

/** 卡片與收合狀態用的短簡介。已存的 summary 優先，沒有才從全文現算。 */
export function cardBlurb(item: { caption?: string; summary?: string }): string {
  const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
  if (summary) return summary;
  return shortSummary(item.caption || '');
}
