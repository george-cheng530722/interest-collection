import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME_ADDRESS, DEFAULT_SETTINGS } from '../../src/lib/types';
import { makeDevice, makeItem, preload, renderApp, screen, within } from '../helpers';

describe('功能: 重複收藏與距離', () => {
  it('情境: 已存在的重複收藏會標示並可留下一則', async () => {
    const store = await makeDevice().open();
    await preload(store, [
      makeItem({ id: 'old', name: '舊的一則', url: 'https://www.instagram.com/natgeo/p/SameID11/', createdAt: 1_700_000_000_000 }),
      makeItem({ id: 'new', name: '新的一則', url: 'https://instagram.com/reel/SameID11/?igsh=1', createdAt: 1_700_000_100_000 }),
    ]);
    const { user } = await renderApp({ store });
    expect(screen.getAllByText('重複')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '有 1 組重複收藏' }));
    expect(screen.getByRole('heading', { name: '重複收藏' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '刪除其餘 1 則' }));
    const confirm = await screen.findByRole('dialog', { name: '刪除重複收藏？' });
    await user.click(within(confirm).getByRole('button', { name: '確定刪除' }));
    expect(await store.getItems()).toHaveLength(1);
    expect((await store.getItems())[0].name).toBe('新的一則');
    expect(screen.queryByRole('button', { name: /組重複收藏/ })).toBeNull();
  });

  it('情境: 有地址時顯示距離與導航，沒有座標就不捏造地址', async () => {
    const store = await makeDevice().open();
    await store.setKv('settings', { ...DEFAULT_SETTINGS, homeLat: 25.077, homeLng: 121.39 });
    await preload(store, [
      makeItem({
        id: 'cafe', name: '山海', placeName: '山海咖啡', address: '新北市林口區文化一路100號',
        lat: 25.09, lng: 121.4, geoState: 'ok', category: '喝',
      }),
      makeItem({
        id: 'miss', name: '日記', placeName: '沒有地址的店', address: '', geoState: 'failed',
        url: 'https://www.instagram.com/p/NoAddr1/',
      }),
    ]);
    await renderApp({ store });
    const cafe = screen.getByRole('button', { name: '山海' });
    expect(within(cafe).getByTestId('item-address')).toHaveTextContent('新北市林口區文化一路100號');
    expect(within(cafe).getByTestId('item-distance').textContent).toMatch(/^距家 \d+(\.\d)? km$/);
    const nav = within(cafe).getByTestId('item-nav');
    expect(nav).toHaveTextContent('導航');
    expect(nav.getAttribute('href')).toContain('https://www.google.com/maps/dir/?api=1&origin=');
    expect(nav.getAttribute('href')).toContain(encodeURIComponent(DEFAULT_HOME_ADDRESS));
    expect(nav.getAttribute('href')).toContain(encodeURIComponent('新北市林口區文化一路100號'));
    const miss = screen.getByRole('button', { name: '日記' });
    expect(within(miss).queryByTestId('item-address')).toBeNull();
    expect(within(miss).queryByTestId('item-distance')).toBeNull();
    expect(within(miss).getByTestId('item-nav')).toHaveTextContent('在地圖上搜尋');
    expect(within(miss).getByTestId('item-nav').getAttribute('href')).toContain('https://www.google.com/maps/search/');
  });
});
