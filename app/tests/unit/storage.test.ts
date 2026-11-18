import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { idbStore, isKnownDemoItem, isLegacyProxyUrl, loadSettings, localStore, memoryStore, migrateLegacyCities, migratePlaceAndSummary, openIdb, removeStoredDemoItems, saveSettings, StorageFullError } from '../../src/lib/storage';
import { DEFAULT_HOME_ADDRESS, DEFAULT_PROXY_URL, DEFAULT_SETTINGS, type Item, type Settings } from '../../src/lib/types';
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
    await saveSettings(s, { ...DEFAULT_SETTINGS, proxyUrl: 'https://proxy.example.com' });
    expect(await loadSettings(localStore())).toEqual({ ...DEFAULT_SETTINGS, proxyUrl: 'https://proxy.example.com' });
    await s.deleteItem('a');
    expect(await localStore().getItems()).toHaveLength(0);
  });

  it('容量不足時丟出 StorageFullError（畫面會提示，不會整批遺失）', async () => {
    const full = { getItem: () => '[]', setItem: () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); }, removeItem: () => undefined } as unknown as Storage;
    await expect(localStore(full).putItem(makeItem({ id: 'a', name: 'A' }))).rejects.toBeInstanceOf(StorageFullError);
  });

  it('設定預設：沒有存過設定 → 代理開啟，使用 Worker 網址', async () => {
    expect(await loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
  });

  it('舊設定是 localhost／127.0.0.1／空白 → 改成 Worker 網址、開啟，並寫回', async () => {
    for (const legacy of ['http://localhost:8787', 'https://localhost', 'localhost:3000', 'http://127.0.0.1:8787/', '127.0.0.1', '', '   ']) {
      const s = memoryStore();
      await s.setKv<Partial<Settings>>('settings', { proxyEnabled: false, proxyUrl: legacy });
      const want = { proxyEnabled: true, proxyUrl: DEFAULT_PROXY_URL, homeAddress: DEFAULT_HOME_ADDRESS };
      expect(await loadSettings(s)).toEqual(want);
      expect(await s.getKv('settings')).toEqual(want);
    }
    const missing = memoryStore();
    await missing.setKv('settings', { proxyEnabled: false });
    expect(await loadSettings(missing)).toEqual({ proxyEnabled: true, proxyUrl: DEFAULT_PROXY_URL, homeAddress: DEFAULT_HOME_ADDRESS });
    expect(isLegacyProxyUrl('https://localhost.example.com')).toBe(false);
  });

  it('使用者自己存的非本機代理網址（即使關閉）不會被改動', async () => {
    const s = memoryStore();
    const mine = { proxyEnabled: false, proxyUrl: 'https://my-proxy.example.workers.dev' };
    await s.setKv<Partial<Settings>>('settings', mine);
    expect(await loadSettings(s)).toEqual({ ...DEFAULT_SETTINGS, ...mine });
    expect(await s.getKv('settings')).toEqual(mine);
    await s.setKv<Partial<Settings>>('settings', { proxyEnabled: false, proxyUrl: DEFAULT_PROXY_URL });
    expect(await loadSettings(s)).toEqual({ ...DEFAULT_SETTINGS, proxyEnabled: false });
  });

  it('舊地區名稱（台北市…）轉成新名稱並寫回；自訂地區原樣保留', async () => {
    const s = memoryStore();
    const old: [string, string][] = [['台北市', '台北'], ['新北市', '新北'], ['桃園市', '桃竹'], ['台中市', '台中'], ['台南市', '台南'], ['高雄市', '高雄'], ['花蓮', '花蓮'], ['其他', '其他']];
    for (const [i, [city]] of old.entries()) await s.putItem(makeItem({ id: 'c' + i, name: city, city }));
    await migrateLegacyCities(s);
    const byId = new Map((await s.getItems()).map((it) => [it.id, it.city]));
    old.forEach(([, want], i) => expect(byId.get('c' + i)).toBe(want));
  });

  it('舊收藏補店名與短簡介；已填的值與新北地區都不改', async () => {
    const s = memoryStore();
    const legacy = makeItem({ id: 'old', name: '舊', city: '新北', caption: '店名：舊店\n林口也有人推薦，但這筆地區維持新北。' + '很長的句子。'.repeat(20) });
    delete (legacy as Partial<Item>).placeName;
    delete (legacy as Partial<Item>).summary;
    await s.putItem(legacy);
    await s.putItem(makeItem({ id: 'mine', name: '自訂', city: '新北', caption: '📍 別覆蓋', placeName: '', summary: '留白的簡介' }));
    await migratePlaceAndSummary(s);
    await migrateLegacyCities(s);
    const old = (await s.getItems()).find((i) => i.id === 'old')!;
    expect(old.city).toBe('新北');
    expect(old.placeName).toBe('舊店');
    expect(old.caption.startsWith('店名：舊店')).toBe(true);
    expect([...old.summary].length).toBeLessThanOrEqual(120);
    expect((await s.getItems()).find((i) => i.id === 'mine')).toMatchObject({ city: '新北', placeName: '', summary: '留白的簡介' });
  });
});
