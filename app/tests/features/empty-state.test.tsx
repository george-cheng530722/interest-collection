import { describe, expect, it } from 'vitest';
import { makeDevice, makeItem, renderApp, screen } from '../helpers';

describe('空白的開始', () => {
  it('初次開啟顯示空白狀態', async () => {
    const store = await makeDevice().open();
    await renderApp({ store });
    const empty = screen.getByTestId('empty-state');
    expect(empty).toHaveTextContent('還沒有收藏');
    expect(empty).toHaveTextContent('貼上 Instagram、X 或 Threads 的連結');
    expect(screen.queryAllByTestId('item-card')).toHaveLength(0);
    expect(screen.getByLabelText('貼上社群來源的連結')).toHaveAttribute('placeholder', '填上IG、X跟Threads、LINE');
    expect(screen.queryByRole('button', { name: '填入範例' })).toBeNull();
    expect(screen.queryByRole('button', { name: '填入私人貼文範例' })).toBeNull();
    expect(screen.queryByRole('button', { name: '模擬縮圖過期' })).toBeNull();
    expect(await store.getItems()).toHaveLength(0);
  });

  it('舊裝置裡的示範資料會被拿掉，自己的收藏留下', async () => {
    const store = await makeDevice().open();
    await store.putItem(makeItem({ id: 'demo-2', name: '河岸散策', url: 'https://www.instagram.com/p/DemoRiverCoffee/' }));
    await store.putItem(makeItem({ id: 'renamed', name: '隱藏台北小吃', url: 'https://www.instagram.com/hidden.taipei.eats/p/PrivateNightMarket/' }));
    await store.putItem(makeItem({ id: 'mine', name: '我的拉麵', url: 'https://www.instagram.com/mine/p/REAL1/' }));
    await renderApp({ store });
    expect(screen.queryByRole('button', { name: '河岸散策' })).toBeNull();
    expect(screen.queryByRole('button', { name: '隱藏台北小吃' })).toBeNull();
    expect(screen.getByRole('button', { name: '我的拉麵' })).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).toBeNull();
    expect((await store.getItems()).map((i) => i.id)).toEqual(['mine']);
  });
});
