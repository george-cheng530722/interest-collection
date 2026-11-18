import { describe, expect, it } from 'vitest';
import { makeDevice, makeItem, preload, renderApp, screen, within } from '../helpers';

describe('電話', () => {
  it('卡片上有電話時顯示格式化號碼與撥打', async () => {
    const store = await makeDevice().open();
    await preload(store, [makeItem({ id: 'call', name: '阿明拉麵', placeName: '阿明拉麵', phone: '02-2345-6789', address: '台北市大同區' })]);
    await renderApp({ store });
    const card = screen.getByRole('button', { name: '阿明拉麵' });
    expect(within(card).getByTestId('item-phone')).toHaveTextContent('02-2345-6789');
    const call = within(card).getByTestId('item-call');
    expect(call).toHaveTextContent('撥打');
    expect(call).toHaveAttribute('href', 'tel:+886223456789');
    expect(within(card).queryByTestId('item-lookup')).toBeNull();
  });

  it('沒有電話時用店名和地址查電話', async () => {
    const store = await makeDevice().open();
    await preload(store, [makeItem({ id: 'look', name: '山海', placeName: '山海咖啡', address: '新北市林口區文化一路100號', phone: '' })]);
    await renderApp({ store });
    const card = screen.getByRole('button', { name: '山海' });
    expect(within(card).queryByTestId('item-call')).toBeNull();
    const lookup = within(card).getByTestId('item-lookup');
    expect(lookup).toHaveTextContent('查電話');
    expect(lookup.getAttribute('href')).toContain('maps/search/');
    expect(decodeURIComponent(lookup.getAttribute('href') || '')).toContain('山海咖啡');
    expect(decodeURIComponent(lookup.getAttribute('href') || '')).toContain('新北市林口區文化一路100號');
  });
});
