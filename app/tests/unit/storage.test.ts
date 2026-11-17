import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { ensureSeeded, idbStore, loadSettings, localStore, memoryStore, openIdb, saveSettings, StorageFullError } from '../../src/lib/storage';
import { seedItems } from '../../src/lib/constants';
import { makeItem } from '../helpers';

describe('本機儲存', () => {
  it('IndexedDB：關掉重開資料仍在', async () => {
    const f = new IDBFactory();
    const s1 = idbStore(await openIdb(f));
    await s1.putItem(makeItem({ id: 'x', name: '測試店' }));
    const s2 = idbStore(await openIdb(f));
    expect((await s2.getItems()).map((i) => i.name)).toEqual(['測試店']);
  });

  it('示範資料只寫一次：刪光後重開不會被寫回', async () => {
    const f = new IDBFactory();
    const s = idbStore(await openIdb(f));
    await ensureSeeded(s);
    expect(await s.getItems()).toHaveLength(seedItems().length);
    for (const it of await s.getItems()) await s.deleteItem(it.id);
    const again = idbStore(await openIdb(f));
    await ensureSeeded(again);
    expect(await again.getItems()).toHaveLength(0);
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
