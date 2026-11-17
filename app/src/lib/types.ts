export type Source = 'Instagram' | 'Threads' | 'X';
export type Category = '吃' | '喝' | '玩' | '有趣' | '想 follow 學習';
export type City = '其他' | '台北市' | '新北市' | '桃園市' | '台中市' | '台南市' | '高雄市';
export type ItemStatus = '想體驗' | '已完成';
/** ok：正常；expired：已過期待更新；refreshing：更新中；fresh：剛更新成功；failed：更新失敗（保留既有縮圖或後備圖示） */
export type ThumbState = 'ok' | 'expired' | 'refreshing' | 'fresh' | 'failed';
export type FetchedVia = 'direct' | 'oembed' | 'proxy' | 'manual' | 'demo';

export interface Item {
  id: string;
  source: Source;
  url: string;
  handle: string;
  /** 名稱（顯示名稱／店名），分享與匯出用 */
  name: string;
  /** 說明 */
  caption: string;
  category: Category | '';
  city: City | '';
  status: ItemStatus;
  memo: string;
  /** 0 = 尚未評分；1–5 */
  rating: number;
  review: string;
  manual: boolean;
  linkDead: boolean;
  /** 遠端縮圖網址（og:image 等，可能會過期） */
  thumbUrl?: string;
  /** 從相簿選的截圖（壓縮後的 data URL，存在本機，不會過期） */
  screenshot?: string;
  thumbState: ThumbState;
  /** 遠端縮圖過期時間（毫秒）。Instagram CDN 網址的 oe= 參數可推得 */
  thumbExpiresAt?: number;
  thumbCheckedAt?: number;
  emoji: string;
  createdAt: number;
  updatedAt: number;
  fetchedVia: FetchedVia;
  demo?: boolean;
}

export interface Settings {
  proxyEnabled: boolean;
  proxyUrl: string;
}

export const DEFAULT_SETTINGS: Settings = { proxyEnabled: false, proxyUrl: 'http://localhost:8787' };
