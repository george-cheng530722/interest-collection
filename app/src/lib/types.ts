export type Source = 'Instagram' | 'Threads' | 'X';
export type Category = '吃' | '喝' | '玩' | '有趣' | '想 follow 學習';
/** 新增／編輯時可選的地區。舊資料或自訂值（例如「花蓮」）仍以原字串保存與顯示，見 Item.city */
export type City = '台北' | '新北' | '桃竹' | '台中' | '台南' | '高雄' | '宜蘭' | '其他';
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
  /** 通常是 City；舊版正式名稱以外的自訂值原樣保留；'' 表示尚未選擇 */
  city: City | (string & {});
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

/** 已部署的 Cloudflare Worker 中繼資料代理 */
export const DEFAULT_PROXY_URL = 'https://interest-collection-proxy.george-cheng.workers.dev';

export const DEFAULT_SETTINGS: Settings = {
  proxyEnabled: true,
  proxyUrl: DEFAULT_PROXY_URL,
};
