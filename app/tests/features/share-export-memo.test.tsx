import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../../src/App';
import { dialog, makeDevice, makeItem, preload, renderApp, screen, within } from '../helpers';

const A = makeItem({ id: 'a', name: '阿明拉麵', city: '台北', url: 'https://www.instagram.com/p/AAA/', createdAt: 2 });
const B = makeItem({ id: 'b', name: '鹽水碗粿', city: '台南', url: 'https://x.com/food/status/123', source: 'X', createdAt: 1 });
const C = makeItem({ id: 'c', name: '收攤前香腸', city: '其他', url: 'https://www.threads.net/@s/post/CCC', source: 'Threads', createdAt: 3, status: '已完成', rating: 4, review: '好吃' });

async function setup() {
  const device = makeDevice();
  const store = await device.open();
  await preload(store, [A, B, C]);
  return { device, store, ...(await renderApp({ store })) };
}
const decodeLine = (href: string) => {
  expect(href.startsWith('https://line.me/R/share?text=')).toBe(true);
  return decodeURIComponent(href.slice('https://line.me/R/share?text='.length));
};

describe('功能: 備註、分享到 LINE 與匯出', () => {
  it('情境: 在詳情新增或修改備註', async () => {
    const { user, device, unmount } = await setup();
    await user.click(screen.getByRole('button', { name: '阿明拉麵' }));
    await user.type(screen.getByLabelText('備註'), '週末帶爸媽去');
    await user.click(screen.getByRole('button', { name: '儲存備註' }));
    expect(screen.getByText('備註已儲存')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '返回' }));
    await user.click(screen.getByRole('button', { name: '阿明拉麵' }));
    expect(screen.getByLabelText('備註')).toHaveValue('週末帶爸媽去');
    unmount();
    render(<App store={await device.open()} />);
    await user.click(await screen.findByRole('button', { name: '阿明拉麵' }));
    expect(screen.getByLabelText('備註')).toHaveValue('週末帶爸媽去');
  });

  it('情境: 分享單則到 LINE', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: '阿明拉麵' }));
    await user.click(screen.getByRole('button', { name: '分享給 LINE 好友' }));
    const dlg = await dialog('分享給 LINE 好友');
    const link = within(dlg).getByRole('link', { name: '用 LINE 分享' });
    const text = decodeLine(link.getAttribute('href')!);
    expect(text).toContain('阿明拉麵');
    expect(text).toContain('地區：台北');
    expect(text).toContain('https://www.instagram.com/p/AAA/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(dlg).getByRole('link', { name: /只分享連結/ }).getAttribute('href')).toBe('https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent('https://www.instagram.com/p/AAA/'));
    await user.click(within(dlg).getByRole('button', { name: '複製內容' }));
    expect(await navigator.clipboard.readText()).toBe(text);
  });

  it('情境: 分享目前清單到 LINE', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: '分享清單' }));
    const dlg = await dialog('分享清單給 LINE 好友');
    const text = decodeLine(within(dlg).getByRole('link', { name: '用 LINE 分享' }).getAttribute('href')!);
    expect(text).toContain('想體驗');
    for (const it of [A, B]) {
      expect(text).toContain(`${it.name}（${it.city}）`);
      expect(text).toContain(it.url);
    }
    expect(text).not.toContain(C.name); // 已完成不在目前清單
  });

  it('情境: 匯出清單為文字與 CSV', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: '匯出' }));
    const dlg = await dialog('匯出清單');
    const preview = () => within(dlg).getByLabelText('匯出內容預覽').textContent!;
    expect(preview()).toContain('名稱：阿明拉麵');
    expect(preview()).toContain('地區：台北');
    expect(preview()).toContain('連結：https://www.instagram.com/p/AAA/');
    await user.click(within(dlg).getByRole('button', { name: '複製' }));
    expect(await navigator.clipboard.readText()).toContain('名稱：鹽水碗粿');

    await user.click(within(dlg).getByRole('button', { name: 'CSV' }));
    const lines = preview().trim().split(/\r?\n/);
    expect(lines[0]).toBe('清單,名稱,地區,連結');
    expect(lines).toContain('想體驗,阿明拉麵,台北,https://www.instagram.com/p/AAA/');
    expect(lines).toContain('想體驗,鹽水碗粿,台南,https://x.com/food/status/123');

    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { created.push(b as Blob); return 'blob:x'; });
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download); });
    await user.click(within(dlg).getByRole('button', { name: '下載 CSV' }));
    expect(clicks[0]).toMatch(/^george-interest-collection-\d{8}\.csv$/);
    const body = await created[0].text();
    expect(body).toContain('清單,名稱,地區,連結');
    expect(body).toContain('阿明拉麵');

    await user.click(within(dlg).getByRole('button', { name: '全部收藏' }));
    expect(preview()).toContain('已完成,收攤前香腸,其他,https://www.threads.net/@s/post/CCC');
    await user.click(within(dlg).getByRole('button', { name: '純文字' }));
    await user.click(within(dlg).getByRole('button', { name: '下載文字檔' }));
    expect(clicks[1]).toMatch(/\.txt$/);
  });
});
