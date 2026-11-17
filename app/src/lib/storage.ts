import type { Item, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { seedItems } from './constants';

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

/** 第一次開啟才寫入示範資料；之後即使使用者刪除，也不會再寫回 */
export async function ensureSeeded(store: Store): Promise<void> {
  const seeded = await store.getKv<boolean>('seeded');
  if (seeded) return;
  const existing = await store.getItems();
  if (existing.length === 0) for (const it of seedItems()) await store.putItem(it);
  await store.setKv('seeded', true);
}

export async function loadSettings(store: Store): Promise<Settings> {
  const s = await store.getKv<Partial<Settings>>('settings');
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
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
