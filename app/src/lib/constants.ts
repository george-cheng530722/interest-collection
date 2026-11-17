import type { Category, City, Item, Source } from './types';

export const APP_NAME = 'George 的 興趣收藏';
export const CATEGORIES: Category[] = ['吃', '喝', '玩', '有趣', '想 follow 學習'];
/** 「其他」是無法判斷時的預設地區；不使用「線上」或「未指定」 */
export const CITIES: City[] = ['其他', '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'];
export const DEFAULT_CITY: City = '其他';
export const SOURCES: Source[] = ['Instagram', 'Threads', 'X'];

/** 「填入私人貼文範例」用的網址（路徑含 private，會直接走手動補充） */
export const PRIVATE_SAMPLE_URL = 'https://www.instagram.com/secret.night.table/p/PrivateOmakase/';
/** 「填入範例」輪流使用的真實公開貼文網址 */
export const PUBLIC_SAMPLE_URLS = [
  'https://x.com/jack/status/20',
  'https://www.threads.net/@natgeo/post/C7XSa54NOw1',
  'https://www.instagram.com/natgeo/p/DHrUZ11yOh0/',
];

export function defaultEmoji(c: Category | ''): string {
  return c === '吃' ? '🍜' : c === '喝' ? '☕' : c === '玩' ? '🗺️' : c === '想 follow 學習' ? '📓' : '✨';
}

type SeedInput = Pick<Item, 'id' | 'source' | 'url' | 'handle' | 'name' | 'caption' | 'category' | 'city' | 'emoji'> & Partial<Item>;

function seed(p: SeedInput, daysAgo: number): Item {
  const t = Date.UTC(2026, 10, 17) - daysAgo * 86400000;
  return {
    status: '想體驗', memo: '', rating: 0, review: '', manual: false, linkDead: false,
    thumbState: 'ok', createdAt: t, updatedAt: t, fetchedVia: 'demo', demo: true, ...p,
  };
}

/** 首次開啟時寫入一次的示範資料。寫入後會記下旗標，之後即使全部刪掉也不會再寫回。 */
export function seedItems(): Item[] {
  return [
    seed({ id: 'demo-1', source: 'Instagram', url: 'https://www.instagram.com/p/DemoSkyChicken/', handle: 'taipeieats_demo', name: 'Taipei Eats Demo', caption: '師大夜市這家雞排外酥內嫩，辣椒醬一定要加。晚上七點過後要排。', category: '吃', city: '台北市', memo: '下次路過師大先買', emoji: '🍗' }, 5),
    // 縮圖已過期（oe= 是過去的時間）：打開 App 時會自動嘗試更新，示範「縮圖過期」流程
    seed({ id: 'demo-2', source: 'Instagram', url: 'https://www.instagram.com/p/DemoRiverCoffee/', handle: 'coffeewalk_tw', name: '河岸散策', caption: '大稻埕河岸手沖，午後光線打進來超美。單品豆每季更換。', category: '喝', city: '台北市', emoji: '☕', thumbUrl: 'https://scontent.cdninstagram.com/v/demo-river-coffee.jpg?oe=65000000', thumbExpiresAt: 0x65000000 * 1000, thumbState: 'expired' }, 7),
    seed({ id: 'demo-3', source: 'Threads', url: 'https://www.threads.net/@weekend.north/post/DemoJiufenWalk/', handle: 'weekend.north', name: '北部週末', caption: '避開九份老街人潮的巷弄路線，傍晚看山城燈火。建議平日去。', category: '玩', city: '新北市', memo: '等天氣好再排', emoji: '⛰️' }, 9),
    seed({ id: 'demo-4', source: 'X', url: 'https://x.com/streetcats_tpe/status/DemoOrangeCat/', handle: 'streetcats_tpe', name: '街角貓直播', caption: '永康街咖啡店的橘貓店長會自己坐在櫃臺，客人離開還會送一下。', category: '有趣', city: '台北市', emoji: '🐱' }, 3),
    seed({ id: 'demo-5', source: 'Threads', url: 'https://www.threads.net/@studio.table/post/DemoShopFlow/', handle: 'studio.table', name: '餐飲空間筆記', caption: '從動線看為什麼這間拉麵店尖峰時段不會卡住。座位、出餐口、候位是分開的。', category: '想 follow 學習', city: '其他', memo: '想看他其他店的案例', emoji: '📐' }, 11),
    seed({ id: 'demo-6', source: 'Instagram', url: 'https://www.instagram.com/p/DemoBowlRice/', handle: 'southfood.diary', name: '南部食記', caption: '鹽水碗粿配蒜泥醬油，早上七點出爐，晚到就沒了。', category: '吃', city: '台南市', status: '已完成', memo: '上次去已吃過，先留著當推薦', rating: 5, review: '碗粿很嫩，蒜泥醬油夠味。要早到，七點後可能賣完。會再推薦給朋友。', emoji: '🍚' }, 18),
    seed({ id: 'demo-7', source: 'X', url: 'https://x.com/centralfood_demo/status/DemoFengjia/', handle: 'centralfood_demo', name: '中部小吃筆記', caption: '逢甲這家烤香腸外皮有炭香，收攤前還是很脆。建議晚上再去，人會少一點。', category: '吃', city: '台中市', emoji: '🌭' }, 2),
    seed({ id: 'demo-8', source: 'Instagram', url: 'https://www.instagram.com/hidden.taipei.eats/p/PrivateNightMarket/', handle: 'hidden.taipei.eats', name: '隱藏台北小吃', caption: '週末限定的夜市小攤，沒有公開店名。這則貼文僅限追蹤者可見，當時讀取失敗，已改為手動補充。', category: '吃', city: '台北市', memo: '朋友私訊分享，店休日不固定。', manual: true, fetchedVia: 'manual', emoji: '🏮' }, 1),
  ];
}
