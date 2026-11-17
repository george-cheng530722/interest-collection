import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { idbStore, isKnownDemoItem, loadSettings, localStore, memoryStore, openIdb, removeStoredDemoItems, saveSettings, StorageFullError } from '../../src/lib/storage';
import { makeItem } from '../helpers';

describe('本機儲存', () => {
  it('IndexedDB：關掉重開資料仍在', async () => {
    const f = new IDBFactory();
    const s1 = idbStore(await openIdb(f));
    await s1.putItem(makeItem({ id: 'x', name: '測試店' }));
    const s2 = idbStore(await openIdb(f));
    expect((await s2.getItems()).map((i) => i.name)).toEqual(['測試店']);
  });

  it('全新儲存是空的，載入時只刪已知示範 id 或網址', async () => {
    const f = new IDBFactory();
    const s = idbStore(await openIdb(f));
    await removeStoredDemoItems(s);
    expect(await s.getItems()).toHaveLength(0);

    await s.putItem(makeItem({ id: 'demo-2', name: '改過的名字', url: 'https://www.instagram.com/mine/p/NOTDEMO/' }));
    await s.putItem(makeItem({ id: 'custom', name: '隱藏台北小吃', url: 'https://www.instagram.com/hidden.taipei.eats/p/PrivateNightMarket/' }));
    await s.putItem(makeItem({ id: 'mine', name: '河岸散策', url: 'https://www.instagram.com/coffee/p/MINE/' }));
    await removeStoredDemoItems(s);
    expect((await s.getItems()).map((i) => i.id)).toEqual(['mine']);
    expect(isKnownDemoItem({ id: 'demo-8', url: 'https://example.com/x' })).toBe(true);
    expect(isKnownDemoItem({ id: 'mine', url: 'https://www.instagram.com/p/DemoRiverCoffee' })).toBe(true);
    expect(isKnownDemoItem({ id: 'mine', url: 'https://www.instagram.com/coffee/p/MINE/' })).toBe(false);
  });

  it('localStorage 降級：序列化與重開', async () => {
    localStorage.clear();
    const s = localStore();
    await s.putItem(makeItem({ id: 'a', name: 'A', screenshot: 'data:image/jpeg;base64,AAAA' }));
    await s.putItem({ ...makeItem({ id: 'a', name: 'A2' }) });
    expect((await localStore().getItems()).map((i) => i.name)).toEqual(['A2']);
    await saveSettings(s, { proxyEnabled: true, proxyUrl: 'http://x' });
    expect(await loadSettings(localStore())).toEqual({ proxyEnabled: true, proxyUrl: 'http://x' });
    await s.deleteItem('a');
    expect(await localStore().getItems()).toHaveLength(0);
  });

  it('容量不足時丟出 StorageFullError（畫面會提示，不會整批遺失）', async () => {
    const full = { getItem: () => '[]', setItem: () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); }, removeItem: () => undefined } as unknown as Storage;
    await expect(localStore(full).putItem(makeItem({ id: 'a', name: 'A' }))).rejects.toBeInstanceOf(StorageFullError);
  });

  it('設定預設：代理關閉', async () => {
    expect(await loadSettings(memoryStore())).toMatchObject({ proxyEnabled: false });
  });
});
