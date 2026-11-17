import type { Item } from './types';
import { fetchPostMeta, type FetchDeps } from './fetchMeta';
import { thumbExpiryFromUrl } from './parse';

/** 縮圖是否過期：狀態被標為過期，或遠端網址的到期時間已過 */
export function isThumbExpired(item: Item, now = Date.now()): boolean {
  if (item.screenshot) return false; // 本機截圖不會過期
  if (item.thumbState === 'expired') return true;
  if (item.thumbState === 'refreshing' || item.thumbState === 'failed') return false;
  return !!item.thumbUrl && !!item.thumbExpiresAt && item.thumbExpiresAt <= now;
}

export type RefreshOutcome =
  | { kind: 'updated'; patch: Partial<Item> }
  | { kind: 'failed'; patch: Partial<Item> }
  | { kind: 'dead'; patch: Partial<Item> };

/**
 * 真的重新抓一次貼文資訊（直接 → oEmbed → 代理[若開啟]）來換新縮圖。
 * 失敗時保留既有縮圖網址（載不到就顯示後備圖示），絕不刪除或清空這則收藏。
 */
export async function refreshThumb(item: Item, deps: FetchDeps, now = Date.now()): Promise<RefreshOutcome> {
  const res = await fetchPostMeta(item.url, deps);
  if (res.ok && res.meta.image) {
    return { kind: 'updated', patch: { thumbUrl: res.meta.image, thumbExpiresAt: thumbExpiryFromUrl(res.meta.image), thumbState: 'fresh', thumbCheckedAt: now } };
  }
  if (!res.ok && res.reason === 'dead') {
    return { kind: 'dead', patch: { thumbState: 'failed', thumbCheckedAt: now, linkDead: true } };
  }
  return { kind: 'failed', patch: { thumbState: 'failed', thumbCheckedAt: now } };
}

export function thumbLabel(item: Item): string {
  switch (item.thumbState) {
    case 'expired': return '縮圖已過期';
    case 'refreshing': return '縮圖已過期 → 正在更新…';
    case 'fresh': return '已更新';
    case 'failed': return item.thumbUrl ? '更新失敗，保留原縮圖' : '更新失敗，使用預設圖示';
    default: return item.screenshot ? '截圖縮圖' : '';
  }
}
