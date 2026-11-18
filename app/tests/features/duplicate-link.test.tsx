import { describe, expect, it } from 'vitest';
import { itemDateLabel } from '../../src/lib/share';
import { IG_URL, dialog, makeDevice, pasteAndAdd, renderApp, screen, within } from '../helpers';

async function saveFirst(url = IG_URL) {
  const store = await makeDevice().open();
  const { user } = await renderApp({ store });
  await pasteAndAdd(user, url);
  const manual = await dialog('讀取失敗，請手動補充');
  await user.type(within(manual).getByLabelText(/^名稱/), '國家地理');
  await user.click(within(manual).getByRole('button', { name: '儲存並標記手動補充' }));
  await user.click(await screen.findByRole('button', { name: '返回' }));
  return { store, user };
}

describe('功能: 重複連結要先警告', () => {
  it('情境: 貼上已收藏的連結會警告且尚未再存一筆', async () => {
    const { store, user } = await saveFirst();
    const saved = (await store.getItems())[0];
    await pasteAndAdd(user, IG_URL + '?igsh=abc&utm_source=ig');
    const dup = await dialog('這則已經收藏過了');
    expect(within(dup).getByText('國家地理')).toBeInTheDocument();
    expect(within(dup).getByText(new RegExp(itemDateLabel(saved.createdAt)))).toBeInTheDocument();
    expect(await store.getItems()).toHaveLength(1);
    expect(screen.queryByRole('dialog', { name: '讀取失敗，請手動補充' })).toBeNull();
  });

  it('情境: 打開已收藏的那一則或取消', async () => {
    const { user } = await saveFirst();
    await pasteAndAdd(user, IG_URL);
    const dup = await dialog('這則已經收藏過了');
    await user.click(within(dup).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog', { name: '這則已經收藏過了' })).toBeNull();
    expect(screen.getByRole('heading', { name: "George's Picks" })).toBeInTheDocument();
    await pasteAndAdd(user, 'https://instagram.com/reel/DHrUZ11yOh0/');
    await user.click(within(await dialog('這則已經收藏過了')).getByRole('button', { name: '打開這則' }));
    expect(await screen.findByTestId('detail-name')).toHaveTextContent('國家地理');
  });

  it('情境: 仍要儲存才會再加入一筆', async () => {
    const { store, user } = await saveFirst();
    await pasteAndAdd(user, IG_URL);
    await user.click(within(await dialog('這則已經收藏過了')).getByRole('button', { name: '仍要儲存' }));
    const manual = await dialog('讀取失敗，請手動補充');
    await user.type(within(manual).getByLabelText(/^名稱/), '再存一筆');
    await user.click(within(manual).getByRole('button', { name: '儲存並標記手動補充' }));
    expect(await store.getItems()).toHaveLength(2);
  });

  it('情境: 相同貼文編號即使網址寫法不同也算重複', async () => {
    const { user } = await saveFirst('https://www.instagram.com/natgeo/p/DHrUZ11yOh0/');
    await pasteAndAdd(user, 'https://instagram.com/p/DHrUZ11yOh0?igsh=zzz');
    expect(await dialog('這則已經收藏過了')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '取消' }));
    await pasteAndAdd(user, 'https://www.threads.net/@natgeo/post/SamePost01/');
    const manual = await dialog('讀取失敗，請手動補充');
    await user.type(within(manual).getByLabelText(/^名稱/), '串文');
    await user.click(within(manual).getByRole('button', { name: '儲存並標記手動補充' }));
    await user.click(await screen.findByRole('button', { name: '返回' }));
    await pasteAndAdd(user, 'https://threads.com/@someone/post/SamePost01/?xmt=1');
    expect(await dialog('這則已經收藏過了')).toBeInTheDocument();
  });
});
