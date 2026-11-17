import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../../src/App';
import { corsBlockedFetch, dialog, htmlResponse, jsonResponse, makeDevice, makeItem, preload, renderApp, screen, waitFor, within } from '../helpers';

describe('功能: 刪除、失效連結與縮圖更新', () => {
  it('情境: 刪除前要確認', async () => {
    const device = makeDevice();
    const store = await device.open(); // 使用首次開啟的示範資料
    const { user, unmount } = await renderApp({ store });
    await user.click(screen.getByRole('button', { name: '北部週末' }));
    await user.click(screen.getByRole('button', { name: '刪除這則收藏' }));
    let dlg = await dialog('刪除這則收藏？');
    await user.click(within(dlg).getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByRole('button', { name: '北部週末' })).toBeInTheDocument();
    expect((await store.getItems()).some((i) => i.name === '北部週末')).toBe(true);

    await user.click(screen.getByRole('button', { name: '北部週末' }));
    await user.click(screen.getByRole('button', { name: '刪除這則收藏' }));
    dlg = await dialog('刪除這則收藏？');
    await user.click(within(dlg).getByRole('button', { name: '確定刪除' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '北部週末' })).toBeNull());
    await waitFor(async () => expect((await store.getItems()).some((i) => i.name === '北部週末')).toBe(false));

    // 重整：資料在本機，刪除仍有效；示範資料也不會被寫回
    unmount();
    render(<App store={await device.open()} fetchImpl={corsBlockedFetch() as unknown as typeof fetch} />);
    await screen.findByRole('button', { name: '河岸散策' });
    expect(screen.queryByRole('button', { name: '北部週末' })).toBeNull();
  });

  it('情境: 連結失效時詢問是否刪除', async () => {
    const store = await makeDevice().open();
    await preload(store, [makeItem({ id: 'd', name: '已刪貼文', source: 'X', url: 'https://x.com/someone/status/1' })]);
    // 真的偵測：X 公開 oEmbed 回 404 → 判定失效
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('https://publish.twitter.com/oembed')) return new Response('', { status: 404 });
      throw new TypeError('Failed to fetch');
    });
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await user.click(screen.getByRole('button', { name: '已刪貼文' }));
    await user.click(screen.getByRole('button', { name: '檢查連結與更新縮圖' }));
    let dlg = await dialog('連結似乎已失效');
    expect(within(dlg).getByText(/要刪除這則收藏嗎/)).toBeInTheDocument();
    await user.click(within(dlg).getByRole('button', { name: '先保留' }));
    await user.click(screen.getByRole('button', { name: '返回' }));
    const card = screen.getByRole('button', { name: '已刪貼文' });
    expect(within(card).getByText('連結失效')).toBeInTheDocument();
    expect((await store.getItems())[0].linkDead).toBe(true);

    // 用示範按鈕重現，選擇刪除（刪除仍需再確認一次）
    await user.click(card);
    await user.click(screen.getByRole('button', { name: '模擬連結失效' }));
    dlg = await dialog('連結似乎已失效');
    await user.click(within(dlg).getByRole('button', { name: '刪除' }));
    await user.click(within(await dialog('刪除這則收藏？')).getByRole('button', { name: '確定刪除' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '已刪貼文' })).toBeNull());
    expect(await store.getItems()).toHaveLength(0);
  });

  it('情境: 縮圖過期會自動更新', async () => {
    const store = await makeDevice().open();
    const oldThumb = 'https://scontent.cdninstagram.com/v/old.jpg?oe=65000000';
    await preload(store, [makeItem({ id: 't', name: '河岸散策', url: 'https://www.instagram.com/coffeewalk_tw/p/RIVER/', thumbUrl: oldThumb, thumbExpiresAt: 0x65000000 * 1000 })]);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === 'https://www.instagram.com/coffeewalk_tw/p/RIVER/') {
        await gate;
        return htmlResponse('<meta property="og:title" content="河岸散策 在 Instagram: &quot;手沖&quot;"><meta property="og:image" content="https://scontent.cdninstagram.com/v/new.jpg?oe=7FFFFFFF">');
      }
      throw new TypeError('Failed to fetch');
    });
    await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    // 沒有按任何按鈕，就自動開始更新
    await waitFor(() => expect(screen.getByTestId('thumb')).toHaveAttribute('data-thumb-state', 'refreshing'));
    expect(screen.getByText('縮圖已過期 → 正在更新…')).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.getByTestId('thumb')).toHaveAttribute('data-thumb-state', 'fresh'));
    expect(screen.getByText('已更新')).toBeInTheDocument();
    expect(screen.getByAltText('貼文縮圖')).toHaveAttribute('src', 'https://scontent.cdninstagram.com/v/new.jpg?oe=7FFFFFFF');
    const [saved] = await store.getItems();
    expect(saved.thumbUrl).toContain('new.jpg');
    expect(saved.thumbExpiresAt).toBe(0x7fffffff * 1000);
  });

  it('情境: 縮圖更新失敗且沒有伺服器時保留現有圖或後備圖示', async () => {
    const store = await makeDevice().open();
    const oldThumb = 'https://scontent.cdninstagram.com/v/old.jpg?oe=65000000';
    await preload(store, [makeItem({ id: 't', name: '河岸散策', thumbUrl: oldThumb, thumbState: 'expired' })]);
    const fetchImpl = corsBlockedFetch();
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await waitFor(() => expect(screen.getByTestId('thumb')).toHaveAttribute('data-thumb-state', 'failed'));
    expect(fetchImpl).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '河岸散策' })).toBeInTheDocument();
    expect(screen.getByAltText('貼文縮圖')).toHaveAttribute('src', oldThumb); // 保留既有縮圖
    expect(screen.getByText('更新失敗，保留原縮圖')).toBeInTheDocument();
    const [saved] = await store.getItems();
    expect(saved).toMatchObject({ thumbUrl: oldThumb, thumbState: 'failed', name: '河岸散策' });

    // 「模擬縮圖過期」會再跑一次真的更新邏輯；沒有既有圖時顯示後備圖示
    await user.click(screen.getByRole('button', { name: '河岸散策' }));
    const calls = fetchImpl.mock.calls.length;
    await user.click(screen.getByRole('button', { name: '模擬縮圖過期' }));
    await waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThan(calls));
    await waitFor(() => expect(screen.getByTestId('thumb')).toHaveAttribute('data-thumb-state', 'failed'));
    expect(screen.getByTestId('detail-name')).toHaveTextContent('河岸散策');
  });

  it('遠端縮圖載入失敗時顯示後備圖示並自動嘗試更新', async () => {
    const store = await makeDevice().open();
    await preload(store, [makeItem({ id: 'z', name: '無圖', emoji: '🍜', thumbUrl: 'https://cdn.example/broken.jpg' })]);
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));
    await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    const img = screen.getByAltText('貼文縮圖');
    img.dispatchEvent(new Event('error'));
    await waitFor(() => expect(screen.getByTestId('thumb')).toHaveAttribute('data-thumb-state', 'failed'));
    expect(screen.getByText('🍜')).toBeInTheDocument();
    expect(screen.getByText('更新失敗，使用預設圖示')).toBeInTheDocument();
  });
});
