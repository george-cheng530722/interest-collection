export type Source = 'Instagram' | 'Threads' | 'X';
export type Category = '吃' | '喝' | '玩' | '有趣' | '想 follow 學習' | '合作機會' | '好構想' | '生活技巧';
/** 新增／編輯時可選的地區。舊資料或自訂值（例如「花蓮」）仍以原字串保存與顯示，見 Item.city */
export type City = '林口' | '台北' | '新北' | '桃竹' | '台中' | '台南' | '高雄' | '宜蘭' | '其他';
export type ItemStatus = '想體驗' | '已完成';
/** ok：正常；expired：已過期待更新；refreshing：更新中；fresh：剛更新成功；failed：更新失敗（保留既有縮圖或後備圖示） */
export type ThumbState = 'ok' | 'expired' | 'refreshing' | 'fresh' | 'failed';
export type FetchedVia = 'direct' | 'oembed' | 'proxy' | 'manual' | 'demo';

export interface Item {
  id: string;
  source: Source;
  url: string;
  handle: string;
  /** 貼文顯示名稱（多半是帳號名稱或標題），分享與匯出用 */
  name: string;
  /** 從標題／說明抽出的店家名稱；抽不到就是空字串，不猜 */
  placeName: string;
  /** 貼文全文 */
  caption: string;
  /** 卡片與收合時用的短簡介，最多約 120 字，在句號或換行處截斷 */
  summary: string;
  /** 貼文或使用者寫明的地址。沒有就空字串，不猜。 */
  address: string;
  /** 可撥打的電話。沒有明確號碼就空字串，不猜。 */
  phone: string;
  /** 地理編碼結果。失敗不填座標。 */
  lat?: number;
  lng?: number;
  geoState?: 'ok' | 'failed';
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
  /** 距離與導航的出發點。預設是林口住家，可在設定裡改。 */
  homeAddress: string;
  homeLat?: number;
  homeLng?: number;
}

/** 已部署的 Cloudflare Worker 中繼資料代理 */
export const DEFAULT_PROXY_URL = 'https://interest-collection-proxy.george-cheng.workers.dev';

export const DEFAULT_HOME_ADDRESS = '新北市林口區仁愛二路96號';

export const DEFAULT_SETTINGS: Settings = {
  proxyEnabled: true,
  proxyUrl: DEFAULT_PROXY_URL,
  homeAddress: DEFAULT_HOME_ADDRESS,
};
