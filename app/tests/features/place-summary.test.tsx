import { describe, expect, it, vi } from 'vitest';
import { cardBlurb, shortSummary } from '../../src/lib/place';
import { dialog, htmlResponse, makeDevice, makeItem, pasteAndAdd, renderApp, screen, within } from '../helpers';
import type { Item } from '../../src/lib/types';

const URL = 'https://www.instagram.com/food.note/p/PlaceName01/';

function og(caption: string) {
  return htmlResponse(`<html><head>
    <meta property="og:title" content="吃貨日記 在 Instagram: &quot;週五&quot;">
    <meta property="og:description" content="1K likes, 20 comments - food.note 於 November 1, 2026 : &quot;${caption.replace(/"/g, '&quot;')}&quot;">
    <meta property="og:image" content="https://scontent.cdninstagram.com/v/x.jpg?oe=7FFFFFFF">
  </head></html>`);
}

describe('功能: 店家名稱與短簡介', () => {
  it('情境: 從說明抽出店家名稱並顯示在卡片上', async () => {
    const store = await makeDevice().open();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === URL) return og('週五中午只想吃麵。\n📍 阿明拉麵\n叉燒厚、湯頭濃。');
      throw new TypeError('Failed to fetch');
    });
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await pasteAndAdd(user, URL);
    const confirm = await dialog('確認地區後加入');
    expect(within(confirm).getByLabelText('店家名稱')).toHaveValue('阿明拉麵');
    await user.clear(within(confirm).getByLabelText('店家名稱'));
    await user.type(within(confirm).getByLabelText('店家名稱'), '本店拉麵');
    await user.click(within(confirm).getByRole('button', { name: '加入收藏' }));
    expect(await screen.findByTestId('detail-place')).toHaveTextContent('本店拉麵');
    await user.click(screen.getByRole('button', { name: '返回' }));
    const card = screen.getByRole('button', { name: '吃貨日記' });
    expect(within(card).getByTestId('item-place')).toHaveTextContent('本店拉麵');
    expect((await store.getItems())[0].placeName).toBe('本店拉麵');
  });

  it('情境: 說明裡沒有可靠店名時店家名稱留白', async () => {
    const store = await makeDevice().open();
    const caption = '今天雲很多，去公園走走。沒有進店。';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === URL) return og(caption);
      throw new TypeError('Failed to fetch');
    });
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await pasteAndAdd(user, URL);
    const confirm = await dialog('確認地區後加入');
    expect(within(confirm).getByLabelText('店家名稱')).toHaveValue('');
    await user.click(within(confirm).getByRole('button', { name: '加入收藏' }));
    await screen.findByTestId('detail-name');
    expect(screen.queryByTestId('detail-place')).toBeNull();
    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(within(screen.getByRole('button', { name: '吃貨日記' })).queryByTestId('item-place')).toBeNull();
    expect((await store.getItems())[0]).toMatchObject({ name: '吃貨日記', placeName: '' });
  });

  it('情境: 卡片簡介最多三行，詳情點一下展開全文', async () => {
    const tail = '這段不該出現在卡片上的尾巴TAIL。';
    const caption = '週五中午只想吃麵，湯頭很濃。'.repeat(12) + tail;
    const store = await makeDevice().open();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === URL) return og(caption);
      throw new TypeError('Failed to fetch');
    });
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await pasteAndAdd(user, URL);
    await user.click(within(await dialog('確認地區後加入')).getByRole('button', { name: '加入收藏' }));
    const saved = (await store.getItems())[0];
    expect(saved.caption).toContain('TAIL');
    expect([...saved.summary].length).toBeLessThanOrEqual(120);
    expect(saved.summary).not.toContain('TAIL');
    expect(screen.getByTestId('detail-caption')).toHaveTextContent(saved.summary);
    expect(screen.getByTestId('detail-caption')).not.toHaveTextContent('TAIL');
    await user.click(screen.getByRole('button', { name: '展開全文' }));
    expect(screen.getByTestId('detail-caption')).toHaveTextContent('TAIL');
    await user.click(screen.getByRole('button', { name: '返回' }));
    const summary = screen.getByTestId('item-summary');
    expect(summary).toHaveClass('clamp3');
    expect(summary).toHaveTextContent(saved.summary);
    expect(summary).not.toHaveTextContent('TAIL');
    expect(cardBlurb(saved)).toBe(shortSummary(caption));
  });

  it('情境: 舊收藏補上短簡介與店家名稱且不覆蓋已填的值', async () => {
    const store = await makeDevice().open();
    const long = '店名：舊時光咖啡\n' + '這家店的手沖很穩定，座位靠窗。'.repeat(6);
    const legacy = makeItem({ id: 'old', name: '舊貼文', caption: long });
    delete (legacy as Partial<Item>).placeName;
    delete (legacy as Partial<Item>).summary;
    await store.putItem(legacy);
    await store.putItem(makeItem({ id: 'kept', name: '已填', caption: '📍 不該用這個', placeName: '我自己寫的', summary: '自訂短句' }));
    await store.putItem(makeItem({ id: 'blank', name: '留白', caption: '📍 也不該填回來', placeName: '', summary: '已有簡介' }));
    await renderApp({ store });
    const items = await store.getItems();
    const old = items.find((i) => i.id === 'old')!;
    expect(old.placeName).toBe('舊時光咖啡');
    expect(old.caption).toBe(long);
    expect([...old.summary].length).toBeLessThanOrEqual(120);
    expect(old.summary.length).toBeGreaterThan(0);
    expect(items.find((i) => i.id === 'kept')).toMatchObject({ placeName: '我自己寫的', summary: '自訂短句', caption: '📍 不該用這個' });
    expect(items.find((i) => i.id === 'blank')).toMatchObject({ placeName: '', summary: '已有簡介' });
    const card = screen.getByRole('button', { name: '舊貼文' });
    expect(within(card).getByTestId('item-place')).toHaveTextContent('舊時光咖啡');
    expect(within(card).getByTestId('item-summary')).toHaveClass('clamp3');
  });
});
