import type { Category, City, Source } from './types';

export const APP_NAME = 'George 的 興趣收藏';
export const CATEGORIES: Category[] = ['吃', '喝', '玩', '有趣', '想 follow 學習'];
/** 「其他」是無法判斷時的預設地區；不使用「線上」或「未指定」 */
export const CITIES: City[] = ['其他', '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'];
export const DEFAULT_CITY: City = '其他';
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
