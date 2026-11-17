import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../../src/App';
import { IG_URL, X_URL, calledUrls, corsBlockedFetch, dialog, makeDevice, makeItem, pasteAndAdd, preload, renderApp, screen, waitFor, within } from '../helpers';

afterEach(() => vi.restoreAllMocks());

async function manualAdd(user: Awaited<ReturnType<typeof renderApp>>['user'], url: string, name: string) {
  await pasteAndAdd(user, url);
  const dlg = await dialog('讀取失敗，請手動補充');
  await user.type(within(dlg).getByLabelText(/^名稱/), name);
  await user.click(within(dlg).getByRole('button', { name: '儲存並標記手動補充' }));
  await screen.findByTestId('detail-name');
}

describe('功能: 單機儲存與離線使用', () => {
  it('情境: 不需登入或帳號', async () => {
    const store = await makeDevice().open();
    await renderApp({ store });
    expect(screen.queryAllByRole('button', { name: /登入|註冊|綁定|sign in|log in/i })).toHaveLength(0);
    expect(screen.queryByLabelText(/密碼|password|email/i)).toBeNull();
    expect(screen.getAllByTestId('item-card').length).toBeGreaterThan(0); // 直接看到收藏
  });

  it('情境: 收藏資料只存在本機', async () => {
    const store = await makeDevice().open();
    await preload(store, []);
    const fetchImpl = corsBlockedFetch();
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await manualAdd(user, IG_URL, '本機測試');
    const saved = await store.getItems();
    expect(saved.map((i) => i.name)).toEqual(['本機測試']);
    expect(store.kind).toBe('indexeddb');
    // 唯一的網路請求是對貼文本身的讀取（GET），沒有任何上傳／同步
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(String(url)).toBe(IG_URL);
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
      expect((init as RequestInit | undefined)?.body).toBeUndefined();
    }
  });

  it('情境: 重整後資料仍在', async () => {
    const device = makeDevice();
    const store = await device.open();
    const { user, unmount } = await renderApp({ store });
    await manualAdd(user, 'https://www.instagram.com/shop/p/TEST1/', '測試店');
    unmount();
    render(<App store={await device.open()} fetchImpl={corsBlockedFetch() as unknown as typeof fetch} />);
    expect(await screen.findByRole('button', { name: '測試店' })).toBeInTheDocument();
  });

  it('情境: 加到主畫面後離線仍能開啟與編輯', async () => {
    // 殼層離線開啟由 Playwright e2e（tests/e2e/offline.spec.ts）以真的 Service Worker 驗證；此處驗證離線時的本機操作
    const device = makeDevice();
    const store = await device.open();
    await preload(store, [makeItem({ id: 'a', name: '阿明拉麵' }), makeItem({ id: 'b', name: '要刪的' })]);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchImpl = vi.fn(async () => { throw new Error('離線時不應發出請求'); });
    const { user, unmount } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(screen.getByText('離線中')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '阿明拉麵' }));
    await user.type(screen.getByLabelText('備註'), '離線寫的備註');
    await user.click(screen.getByRole('button', { name: '儲存備註' }));
    await user.click(screen.getByRole('button', { name: '標為已完成' }));
    const dlg = await dialog('完成並留下評價');
    await user.click(within(dlg).getByRole('radio', { name: '5 分' }));
    await user.type(within(dlg).getByLabelText('評價說明'), '好吃');
    await user.click(within(dlg).getByRole('button', { name: '完成並送出評價' }));
    await user.click(screen.getByRole('button', { name: '返回' }));
    await user.click(screen.getByRole('button', { name: /^想體驗/ }));
    await user.click(screen.getByRole('button', { name: '要刪的' }));
    await user.click(screen.getByRole('button', { name: '刪除這則收藏' }));
    await user.click(within(await dialog('刪除這則收藏？')).getByRole('button', { name: '確定刪除' }));
    await waitFor(async () => expect(await store.getItems()).toHaveLength(1));
    expect(fetchImpl).not.toHaveBeenCalled();
    unmount();
    render(<App store={await device.open()} fetchImpl={fetchImpl as unknown as typeof fetch} />);
    await screen.findByRole('heading', { name: 'George 的 興趣收藏' });
    const [it] = await store.getItems();
    expect(it).toMatchObject({ name: '阿明拉麵', memo: '離線寫的備註', status: '已完成', rating: 5, review: '好吃' });
  });

  it('情境: 離線新增時若抓取失敗則走手動補充', async () => {
    const store = await makeDevice().open();
    await preload(store, []);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await pasteAndAdd(user, X_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    expect(within(dlg).getByText(/目前離線/)).toBeInTheDocument();
    expect(within(dlg).getByLabelText('連結')).toHaveValue(X_URL);
    expect(within(dlg).getByText('X')).toBeInTheDocument();
    expect(within(dlg).getByLabelText(/^帳號/)).toHaveValue('jack');
    await user.type(within(dlg).getByLabelText(/^名稱/), '第一則推文');
    await user.click(within(dlg).getByRole('button', { name: '儲存並標記手動補充' }));
    await screen.findByTestId('detail-name');
    expect((await store.getItems())[0]).toMatchObject({ name: '第一則推文', manual: true, city: '其他' });
  });

  it('情境: 中繼資料代理預設關閉且可被關掉', async () => {
    const device = makeDevice();
    const store = await device.open();
    await preload(store, []);
    const fetchImpl = corsBlockedFetch();
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    const proxyCalls = () => calledUrls(fetchImpl).filter((u) => u.startsWith('http://localhost:8787'));

    await user.click(screen.getByRole('button', { name: '設定' }));
    let sw = within(await dialog('設定')).getByRole('switch', { name: '中繼資料代理（外掛）' });
    expect(sw).not.toBeChecked();
    await user.click(within(await dialog('設定')).getByRole('button', { name: '關閉' }));
    await pasteAndAdd(user, IG_URL);
    await user.click(within(await dialog('讀取失敗，請手動補充')).getByRole('button', { name: '取消' }));
    expect(proxyCalls()).toHaveLength(0);

    // 開啟 → 才會向代理請求
    await user.click(screen.getByRole('button', { name: '設定' }));
    sw = within(await dialog('設定')).getByRole('switch', { name: '中繼資料代理（外掛）' });
    await user.click(sw);
    await user.click(within(await dialog('設定')).getByRole('button', { name: '關閉' }));
    await pasteAndAdd(user, IG_URL);
    await user.click(within(await dialog('讀取失敗，請手動補充')).getByRole('button', { name: '取消' }));
    expect(proxyCalls()).toEqual(['http://localhost:8787/meta?url=' + encodeURIComponent(IG_URL)]);
    expect((await store.getKv<{ proxyEnabled: boolean }>('settings'))?.proxyEnabled).toBe(true);

    // 關掉 → 只直接抓，失敗就手動補充，不再向代理送出
    await user.click(screen.getByRole('button', { name: '設定' }));
    await user.click(within(await dialog('設定')).getByRole('switch', { name: '中繼資料代理（外掛）' }));
    await user.click(within(await dialog('設定')).getByRole('button', { name: '關閉' }));
    const before = fetchImpl.mock.calls.length;
    await pasteAndAdd(user, X_URL);
    await dialog('讀取失敗，請手動補充');
    const after = calledUrls(fetchImpl).slice(before);
    expect(after[0]).toBe(X_URL);
    expect(after.some((u) => u.includes('8787'))).toBe(false);
    expect(proxyCalls()).toHaveLength(1);
  });
});
