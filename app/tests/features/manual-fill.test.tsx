import { describe, expect, it } from 'vitest';
import { IG_URL, dialog, makeDevice, pasteAndAdd, preload, renderApp, screen, within } from '../helpers';

const PRIVATE_URL = 'https://www.instagram.com/hidden.taipei.eats/p/PrivateNightMarket/';
const fresh = async () => { const store = await makeDevice().open(); await preload(store, []); return store; };

describe('功能: 讀不到貼文時手動補充', () => {
  it('情境: 判斷為讀不到的網址直接打開手動補充', async () => {
    const store = await fresh();
    const { user, fetchImpl } = await renderApp({ store });
    await pasteAndAdd(user, PRIVATE_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    expect(within(dlg).getByText(/私人或限制年齡/)).toBeInTheDocument();
    expect(within(dlg).getByText('Instagram')).toBeInTheDocument();
    expect(within(dlg).getByLabelText(/^帳號/)).toHaveValue('hidden.taipei.eats');
    expect(within(dlg).getByLabelText('連結')).toHaveValue(PRIVATE_URL);
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it('情境: 手動補充必填名稱、帳號、分類與地區', async () => {
    const store = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, IG_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    const save = within(dlg).getByRole('button', { name: '儲存並標記手動補充' });
    // 名稱空白
    expect(save).toBeDisabled();
    await user.type(within(dlg).getByLabelText(/^名稱/), '國家地理');
    expect(save).toBeEnabled();
    // 帳號空白
    await user.clear(within(dlg).getByLabelText(/^帳號/));
    expect(save).toBeDisabled();
    await user.type(within(dlg).getByLabelText(/^帳號/), 'natgeo');
    expect(save).toBeEnabled();
    // 分類空白
    const cats = within(dlg).getByRole('group', { name: '分類' });
    const activeCat = within(cats).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')!;
    await user.click(activeCat);
    expect(save).toBeDisabled();
    await user.click(within(cats).getByRole('button', { name: '玩' }));
    expect(save).toBeEnabled();
    // 地區空白
    await user.click(within(within(dlg).getByRole('group', { name: '地區' })).getByRole('button', { name: '其他' }));
    expect(save).toBeDisabled();
    await user.click(save);
    expect(await store.getItems()).toHaveLength(0);
  });

  it('情境: 儲存後標記為手動補充', async () => {
    const store = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, IG_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    await user.type(within(dlg).getByLabelText(/^名稱/), '海牛觀察');
    await user.type(within(dlg).getByLabelText('說明'), '佛州海牛保育日');
    await user.click(within(within(dlg).getByRole('group', { name: '分類' })).getByRole('button', { name: '想 follow 學習' }));
    await user.click(within(within(dlg).getByRole('group', { name: '地區' })).getByRole('button', { name: '其他' }));
    await user.click(within(within(dlg).getByRole('group', { name: '地區' })).getByRole('button', { name: '其他' }));
    await user.click(within(dlg).getByRole('button', { name: '儲存並標記手動補充' }));
    expect(await screen.findByTestId('detail-name')).toHaveTextContent('海牛觀察');
    expect(screen.getAllByText('手動補充').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '返回' }));
    const card = screen.getByRole('button', { name: '海牛觀察' });
    expect(within(card).getByText('手動補充')).toBeInTheDocument();
    expect((await store.getItems())[0]).toMatchObject({ manual: true, name: '海牛觀察', city: '其他', category: '想 follow 學習', caption: '佛州海牛保育日' });
  });

  it('情境: 可以附上截圖當縮圖並寫備註', async () => {
    const store = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, PRIVATE_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    await user.type(within(dlg).getByLabelText(/^名稱/), '隱藏台北小吃');
    const png = new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))], 'shot.png', { type: 'image/png' });
    await user.upload(within(dlg).getByLabelText('選擇截圖'), png);
    expect(await within(dlg).findByAltText('截圖縮圖', {}, { timeout: 5000 })).toBeInTheDocument();
    await user.type(within(dlg).getByLabelText('備註'), '朋友私訊分享');
    await user.click(within(dlg).getByRole('button', { name: '儲存並標記手動補充' }));
    await screen.findByTestId('detail-name');
    expect(screen.getByAltText('截圖縮圖').getAttribute('src')).toMatch(/^data:image\//);
    expect(screen.getByLabelText('備註')).toHaveValue('朋友私訊分享');
    const [saved] = await store.getItems();
    expect(saved.screenshot).toMatch(/^data:image\//);
    expect(saved.memo).toBe('朋友私訊分享');
  });
});
