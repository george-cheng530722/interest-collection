import type { Category, City, Source } from './types';

export const APP_NAME = 'George 的 興趣收藏';
export const CATEGORIES: Category[] = ['吃', '喝', '玩', '有趣', '想 follow 學習'];
/**
 * 地區下拉選單與地區篩選的選項（依此順序，「其他」放最後）。
 * 「其他」是無法判斷時的預設地區；不使用「線上」或「未指定」。
 */
export const CITIES: City[] = ['台北', '新北', '桃竹', '台中', '台南', '高雄', '宜蘭', '其他'];
export const DEFAULT_CITY: City = '其他';

/** 舊版的正式名稱 → 新地區名稱。載入時轉換一次並寫回；其他自訂值原樣保留 */
export const LEGACY_CITY_MAP: Readonly<Record<string, City>> = {
  台北市: '台北', 新北市: '新北', 桃園市: '桃竹', 台中市: '台中', 台南市: '台南', 高雄市: '高雄',
};

export function canonicalCity(city: string): string {
  return LEGACY_CITY_MAP[city] ?? city;
}

export function isKnownCity(city: string): city is City {
  return (CITIES as string[]).includes(city);
}
export const SOURCES: Source[] = ['Instagram', 'Threads', 'X'];

/**
 * 舊版第一次開啟時寫進本機的示範資料。
 * 載入時只刪這些 id 或網址；名稱碰巧一樣、但是使用者自己加的收藏會留下。
 */
export const DEMO_ITEM_IDS = ['demo-1', 'demo-2', 'demo-3', 'demo-4', 'demo-5', 'demo-6', 'demo-7', 'demo-8'] as const;
export const DEMO_ITEM_URLS = [
  'https://www.instagram.com/p/DemoSkyChicken/',
  'https://www.instagram.com/p/DemoRiverCoffee/',
  'https://www.threads.net/@weekend.north/post/DemoJiufenWalk/',
  'https://x.com/streetcats_tpe/status/DemoOrangeCat/',
  'https://www.threads.net/@studio.table/post/DemoShopFlow/',
  'https://www.instagram.com/p/DemoBowlRice/',
  'https://x.com/centralfood_demo/status/DemoFengjia/',
  'https://www.instagram.com/hidden.taipei.eats/p/PrivateNightMarket/',
];

export function defaultEmoji(c: Category | ''): string {
  return c === '吃' ? '🍜' : c === '喝' ? '☕' : c === '玩' ? '🗺️' : c === '想 follow 學習' ? '📓' : '✨';
}
