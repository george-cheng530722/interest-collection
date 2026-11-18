import type { Item } from './types';
import { APP_NAME } from './constants';

export function itemName(item: Pick<Item, 'name' | 'handle'>): string {
  return item.name?.trim() || (item.handle ? '@' + item.handle : '（未命名）');
}

export function itemDateLabel(t: number): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function shareItemText(item: Item): string {
  const lines = [APP_NAME, '', itemName(item), `地區：${item.city || '其他'}`, item.url];
  if (item.memo.trim()) lines.push(`備註：${item.memo.trim()}`);
  return lines.join('\n');
}

export function shareListText(listName: string, rows: Item[]): string {
  const lines = [`${APP_NAME}｜${listName}`, ''];
  rows.forEach((item, i) => { lines.push(`${i + 1}. ${itemName(item)}（${item.city || '其他'}）`, item.url, ''); });
  return lines.join('\n').trim();
}

/** LINE 官方分享網址：把文字（含名稱、地區、連結）帶進 LINE 選擇好友 */
export function lineShareUrl(text: string): string {
  return 'https://line.me/R/share?text=' + encodeURIComponent(text);
}

/** LINE 官方「只分享網址」的社群外掛網址（單則備用） */
export function lineItShareUrl(url: string): string {
  return 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url);
}

const csvCell = (v: string) => /[",\n\r]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export const EXPORT_COLUMNS = ['清單', '名稱', '地區', '連結'] as const;

export function exportCsv(rows: Item[]): string {
  return [EXPORT_COLUMNS.join(','), ...rows.map((it) => [it.status, itemName(it), it.city || '其他', it.url].map(csvCell).join(','))].join('\r\n') + '\r\n';
}

export function exportText(rows: Item[], listName?: string): string {
  const lines = [listName ? `${APP_NAME}｜${listName}` : APP_NAME, `欄位：${EXPORT_COLUMNS.join('、')}`, ''];
  rows.forEach((it, i) => { lines.push(`${i + 1}.`, `清單：${it.status}`, `名稱：${itemName(it)}`, `地區：${it.city || '其他'}`, `連結：${it.url}`, ''); });
  return lines.join('\n').trim() + '\n';
}

export function exportFileName(ext: 'csv' | 'txt', now = new Date()): string {
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `george-interest-collection-${d}.${ext}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* 改用舊方法 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand?.('copy') ?? false;
    ta.remove();
    return ok;
  } catch { return false; }
}

/** 下載文字檔；CSV 加上 UTF-8 BOM，讓 Excel／Numbers 正確顯示中文 */
export function downloadText(filename: string, text: string, mime: string): boolean {
  try {
    const body = mime.includes('csv') ? '﻿' + text : text;
    const blob = new Blob([body], { type: `${mime};charset=utf-8` });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    return true;
  } catch { return false; }
}
