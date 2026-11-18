import type { Item, Settings } from './types';
import { DEFAULT_PROXY_URL, DEFAULT_SETTINGS } from './types';
import { canonicalCity, DEMO_ITEM_IDS, DEMO_ITEM_URLS } from './constants';
import { extractAddress, extractPlaceName, shortSummary } from './place';
import { sameUrl } from './parse';

export type StoreKind = 'indexeddb' | 'localstorage' | 'memory';

export class StorageFullError extends Error {
  constructor() { super('裝置儲存空間不足'); this.name = 'StorageFullError'; }
}

/** 本機資料層：所有收藏只存在這台裝置，沒有任何同步或後端 */
export interface Store {
  kind: StoreKind;
  getItems(): Promise<Item[]>;
  putItem(item: Item): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getKv<T>(key: string): Promise<T | undefined>;
  setKv<T>(key: string, value: T): Promise<void>;
}

const DB_NAME = 'george-interest-collection';
const DB_VERSION = 1;
const LS_PREFIX = 'gic:';

const isQuota = (e: unknown) => {
  const n = (e as { name?: string })?.name;
  return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED';
};

/** 只保留可序列化的欄位，避免把 undefined／函式等寫進儲存 */
export function serializeItem(item: Item): Item {
  return JSON.parse(JSON.stringify(item)) as Item;
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error('transaction aborted'));
  });
}

export function openIdb(idb: IDBFactory = indexedDB, timeoutMs = 3000): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('IndexedDB 開啟逾時')), timeoutMs);
    let req: IDBOpenDBRequest;
    try { req = idb.open(DB_NAME, DB_VERSION); } catch (e) { clearTimeout(timer); reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
    req.onerror = () => { clearTimeout(timer); reject(req.error); };
    req.onblocked = () => { clearTimeout(timer); reject(new Error('IndexedDB blocked')); };
  });
}

export function idbStore(db: IDBDatabase): Store {
  const run = async <T>(store: 'items' | 'kv', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const tx = db.transaction(store, mode);
    const r = fn(tx.objectStore(store));
    try {
      const [val] = await Promise.all([reqP(r), txDone(tx)]);
      return val;
    } catch (e) { if (isQuota(e)) throw new StorageFullError(); throw e; }
  };
  return {
    kind: 'indexeddb',
    getItems: () => run('items', 'readonly', (s) => s.getAll() as IDBRequest<Item[]>),
    putItem: async (item) => { await run('items', 'readwrite', (s) => s.put(serializeItem(item))); },
    deleteItem: async (id) => { await run('items', 'readwrite', (s) => s.delete(id)); },
    getKv: <T,>(key: string) => run('kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
    setKv: async (key, value) => { await run('kv', 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(value)), key)); },
  };
}

export function localStore(ls: Storage = localStorage): Store {
  const KEY = LS_PREFIX + 'items';
  const read = (): Item[] => { try { return JSON.parse(ls.getItem(KEY) || '[]') as Item[]; } catch { return []; } };
  const write = (items: Item[]) => {
    try { ls.setItem(KEY, JSON.stringify(items.map(serializeItem))); } catch (e) { if (isQuota(e)) throw new StorageFullError(); throw e; }
  };
  return {
    kind: 'localstorage',
    getItems: async () => read(),
    putItem: async (item) => { const all = read(); const i = all.findIndex((x) => x.id === item.id); if (i >= 0) all[i] = item; else all.push(item); write(all); },
    deleteItem: async (id) => { write(read().filter((x) => x.id !== id)); },
    getKv: async <T,>(key: string) => { const v = ls.getItem(LS_PREFIX + 'kv:' + key); return v == null ? undefined : (JSON.parse(v) as T); },
    setKv: async (key, value) => { try { ls.setItem(LS_PREFIX + 'kv:' + key, JSON.stringify(value)); } catch (e) { if (isQuota(e)) throw new StorageFullError(); throw e; } },
  };
}

export function memoryStore(): Store {
  const items = new Map<string, Item>();
  const kv = new Map<string, unknown>();
  return {
    kind: 'memory',
    getItems: async () => [...items.values()].map(serializeItem),
    putItem: async (item) => { items.set(item.id, serializeItem(item)); },
    deleteItem: async (id) => { items.delete(id); },
    getKv: async <T,>(key: string) => kv.get(key) as T | undefined,
    setKv: async (key, value) => { kv.set(key, value); },
  };
}

/**
 * 依序嘗試 IndexedDB → localStorage → 記憶體（最後一種重整就會消失，畫面會警告）。
 * Safari 以 file:// 開啟單檔 HTML 時，IndexedDB 可能丟出 SecurityError 或開不起來，就會降級。
 */
export async function openBestStore(): Promise<Store> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await openIdb();
      const s = idbStore(db);
      await s.getKv('probe');
      return s;
    }
  } catch { /* 降級 */ }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_PREFIX + 'probe', '1');
      localStorage.removeItem(LS_PREFIX + 'probe');
      return localStore();
    }
  } catch { /* 降級 */ }
  return memoryStore();
}

const DEMO_IDS = new Set<string>(DEMO_ITEM_IDS);

/** 舊版寫進裝置裡的示範資料：id 或網址對上才算，不看名稱 */
export function isKnownDemoItem(item: Pick<Item, 'id' | 'url'>): boolean {
  if (DEMO_IDS.has(item.id)) return true;
  return DEMO_ITEM_URLS.some((u) => sameUrl(u, item.url));
}

/** 開啟時刪掉已知示範資料。使用者自己加的收藏留在原處，之後也不會再寫入範例。 */
export async function removeStoredDemoItems(store: Store): Promise<void> {
  const items = await store.getItems();
  for (const it of items) {
    if (isKnownDemoItem(it)) await store.deleteItem(it.id);
  }
}

/** 舊版把代理預設成本機（localhost／127.0.0.1）或留空；這些都改成已部署的 Worker 並開啟 */
export function isLegacyProxyUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return true;
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url.trim());
}

/**
 * 讀設定並與預設合併。代理網址空白或指向 localhost／127.0.0.1 時，
 * 改成預設 Worker 網址並開啟代理，再寫回（下次載入就是乾淨的）。
 * 使用者自己存的其他網址與開關不會被動到。
 */
export async function loadSettings(store: Store): Promise<Settings> {
  const saved = await store.getKv<Partial<Settings>>('settings');
  if (!saved) return { ...DEFAULT_SETTINGS };
  const merged: Settings = { ...DEFAULT_SETTINGS, ...saved };
  if (!isLegacyProxyUrl(saved.proxyUrl)) return merged;
  const migrated: Settings = { ...merged, proxyUrl: DEFAULT_PROXY_URL, proxyEnabled: true };
  try { await saveSettings(store, migrated); } catch { /* 寫不回去也照常使用，下次載入再遷移 */ }
  return migrated;
}

/**
 * 舊收藏沒有店家名稱或短簡介時補上並寫回。
 * 已經有字串（含使用者留白的空字串）不覆蓋。全文 caption 原樣保留。地區也不在這裡改。
 */
export async function migratePlaceAndSummary(store: Store): Promise<void> {
  const items = await store.getItems();
  for (const it of items) {
    const raw = it as Item & { placeName?: unknown; summary?: unknown; address?: unknown };
    const next: Item = {
      ...it,
      placeName: typeof raw.placeName === 'string' ? raw.placeName : '',
      summary: typeof raw.summary === 'string' ? raw.summary : '',
      address: typeof raw.address === 'string' ? raw.address : '',
    };
    let changed = false;
    if (typeof raw.placeName !== 'string') {
      next.placeName = extractPlaceName(it.name || '', it.caption || '');
      changed = true;
    }
    if (typeof raw.summary !== 'string') {
      next.summary = shortSummary(it.caption || '');
      changed = true;
    }
    if (typeof raw.address !== 'string') {
      next.address = extractAddress(it.caption || '');
      changed = true;
    }
    if (changed) await store.putItem(next);
  }
}

/** 舊版正式地區名稱（台北市…）轉成新名稱並寫回；不認得的自訂地區原樣保留。不會把新北改成林口。 */
export async function migrateLegacyCities(store: Store): Promise<void> {
  const items = await store.getItems();
  for (const it of items) {
    const city = canonicalCity(it.city);
    if (city !== it.city) await store.putItem({ ...it, city });
  }
}

export async function saveSettings(store: Store, s: Settings): Promise<void> {
  await store.setKv('settings', s);
}

export async function requestPersistence(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch { return null; }
}
