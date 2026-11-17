import { describe, expect, it, vi } from 'vitest';
import { IG_URL, THREADS_URL, X_URL, calledUrls, corsBlockedFetch, dialog, htmlResponse, makeDevice, pasteAndAdd, preload, renderApp, screen, waitFor, within } from '../helpers';

const fresh = async () => { const d = makeDevice(); const store = await d.open(); await preload(store, []); return { d, store }; };

describe('功能: 從貼文網址加入收藏（背景：本機開啟、未啟用中繼資料代理）', () => {
  it('情境: 辨識 Instagram 網址並顯示來源', async () => {
    const { store } = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, IG_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    expect(within(dlg).getAllByText('Instagram').length).toBeGreaterThan(0);
    expect(within(dlg).getByLabelText(/^帳號/)).toHaveValue('natgeo');
  });

  it('情境: 辨識 X 網址並顯示來源', async () => {
    const { store } = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, X_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    expect(within(dlg).getAllByText('X').length).toBeGreaterThan(0);
    expect(within(dlg).getByLabelText(/^帳號/)).toHaveValue('jack');
  });

  it('情境: 辨識 Threads 網址並顯示來源', async () => {
    const { store } = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, THREADS_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    expect(within(dlg).getAllByText('Threads').length).toBeGreaterThan(0);
    expect(within(dlg).getByLabelText(/^帳號/)).toHaveValue('natgeo');
  });

  it('情境: 先嘗試在手機上直接抓取連結資訊', async () => {
    const { store } = await fresh();
    const fetchImpl = corsBlockedFetch();
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await pasteAndAdd(user, IG_URL);
    await dialog('讀取失敗，請手動補充');
    const urls = calledUrls(fetchImpl);
    expect(urls[0]).toBe(IG_URL); // 第一個請求就是裝置直接抓貼文本身
    expect(urls.some((u) => u.includes('8787') || u.includes('/meta?'))).toBe(false); // 不呼叫代理
  });

  it('情境: 直接抓取成功時帶到確認畫面', async () => {
    const { store } = await fresh();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === IG_URL) return htmlResponse(`<html><head>
        <meta property="og:title" content="阿明拉麵 在 Instagram: &quot;大稻埕的叉燒拉麵&quot;">
        <meta property="og:description" content="1K likes, 20 comments - aming.ramen 於 November 1, 2026 : &quot;大稻埕的叉燒拉麵，湯頭很濃。&quot;">
        <meta property="og:image" content="https://scontent.cdninstagram.com/v/x.jpg?oe=7FFFFFFF"></head></html>`);
      throw new TypeError('Failed to fetch');
    });
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await pasteAndAdd(user, IG_URL);
    const dlg = await dialog('確認地區後加入');
    expect(within(dlg).getByText('大稻埕的叉燒拉麵，湯頭很濃。')).toBeInTheDocument();
    expect(within(dlg).getByLabelText('名稱')).toHaveValue('阿明拉麵');
    expect(within(dlg).getByText('@natgeo')).toBeInTheDocument();
    expect(within(dlg).getByText('Instagram')).toBeInTheDocument();
    // 地區已依說明預填（大稻埕 → 台北市），必須確認後才完成
    const cityGroup = within(dlg).getByRole('group', { name: '地區' });
    expect(within(cityGroup).getByRole('button', { name: '台北市' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(cityGroup).getByRole('button', { name: '台北市' })); // 取消選取 → 空白
    expect(within(dlg).getByRole('button', { name: '加入收藏' })).toBeDisabled();
    await user.click(within(cityGroup).getByRole('button', { name: '台北市' }));
    await user.click(within(dlg).getByRole('button', { name: '加入收藏' }));
    expect(await screen.findByTestId('detail-name')).toHaveTextContent('阿明拉麵');
    const saved = await store.getItems();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ city: '台北市', manual: false, fetchedVia: 'direct', category: '吃' });
  });

  it('情境: 被 CORS 或網路擋下時改走手動補充並預填欄位', async () => {
    const { store } = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, 'https://www.instagram.com/natgeo/p/DHrUZ11yOh0/');
    const dlg = await dialog('讀取失敗，請手動補充');
    expect(screen.queryByText(/無法收藏/)).toBeNull();
    expect(within(dlg).getByLabelText('連結')).toHaveValue(IG_URL);
    expect(within(dlg).getByText('Instagram')).toBeInTheDocument();
    expect(within(dlg).getByLabelText(/^帳號/)).toHaveValue('natgeo');
    expect(within(dlg).getByText(/CORS/)).toBeInTheDocument();
  });

  it('情境: 無法判斷地區時預設為其他', async () => {
    const { store } = await fresh();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('https://publish.x.com/')) {
        return new Response(JSON.stringify({ author_name: 'jack', author_url: 'https://x.com/jack', html: '<blockquote><p>just setting up my twttr</p></blockquote>' }), { status: 200 });
      }
      throw new TypeError('Failed to fetch');
    });
    const { user } = await renderApp({ store, fetchImpl: fetchImpl as unknown as typeof fetch });
    await pasteAndAdd(user, X_URL);
    const dlg = await dialog('確認地區後加入');
    const cityGroup = within(dlg).getByRole('group', { name: '地區' });
    expect(within(cityGroup).getByRole('button', { name: '其他' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('線上')).toBeNull();
    expect(screen.queryByText('未指定')).toBeNull();
    await user.click(within(dlg).getByRole('button', { name: '加入收藏' }));
    await screen.findByTestId('detail-name');
    expect((await store.getItems())[0].city).toBe('其他');
  });

  it('情境: 沒有地區不能完成加入', async () => {
    const { store } = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, IG_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    await user.type(within(dlg).getByLabelText(/^名稱/), '測試');
    const save = within(dlg).getByRole('button', { name: '儲存並標記手動補充' });
    expect(save).toBeEnabled();
    await user.click(within(within(dlg).getByRole('group', { name: '地區' })).getByRole('button', { name: '其他' }));
    expect(save).toBeDisabled();
    expect(within(dlg).getByText(/請填寫：地區/)).toBeInTheDocument();
    await user.click(save);
    expect(await store.getItems()).toHaveLength(0);
  });

  it('情境: 接受從 LINE 分享進來的網址', async () => {
    const { store } = await fresh();
    const { user, fetchImpl } = await renderApp({ store });
    await pasteAndAdd(user, '[LINE] George 分享了一則貼文：\n看看這家 https://www.threads.net/@natgeo/post/C7XSa54NOw1?xmt=AQGz 很讚！');
    const dlg = await dialog('讀取失敗，請手動補充');
    expect(within(dlg).getByLabelText('連結')).toHaveValue(THREADS_URL);
    expect(within(dlg).getByLabelText(/^帳號/)).toHaveValue('natgeo');
    expect(calledUrls(fetchImpl as never)[0]).toBe(THREADS_URL);
  });

  it('從捷徑以 ?url= 打開時自動走同一套加入流程', async () => {
    const { store } = await fresh();
    await renderApp({ store, initialShared: IG_URL });
    const dlg = await dialog('讀取失敗，請手動補充');
    expect(within(dlg).getByLabelText('連結')).toHaveValue(IG_URL);
  });

  it('不支援的網址會提示，不會加入', async () => {
    const { store } = await fresh();
    const { user, fetchImpl } = await renderApp({ store });
    await pasteAndAdd(user, 'https://www.facebook.com/some/post');
    expect(await screen.findByText(/目前支援 Instagram、X 與 Threads/)).toBeInTheDocument();
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it('重複的網址會提示已在清單裡', async () => {
    const { store } = await fresh();
    const { user } = await renderApp({ store });
    await pasteAndAdd(user, IG_URL);
    const dlg = await dialog('讀取失敗，請手動補充');
    await user.type(within(dlg).getByLabelText(/^名稱/), '國家地理');
    await user.click(within(dlg).getByRole('button', { name: '儲存並標記手動補充' }));
    await user.click(await screen.findByRole('button', { name: '返回' }));
    await pasteAndAdd(user, IG_URL + '?igsh=abc');
    await waitFor(() => expect(screen.getByText(/這則已在清單裡/)).toBeInTheDocument());
  });
});
