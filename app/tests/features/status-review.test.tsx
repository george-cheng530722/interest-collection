import { describe, expect, it } from 'vitest';
import { dialog, makeDevice, makeItem, preload, renderApp, screen, within } from '../helpers';
import App from '../../src/App';
import { render } from '@testing-library/react';

describe('功能: 想體驗、已完成與評價', () => {
  it('情境: 標為已完成必須打 1 到 5 分並寫評價', async () => {
    const store = await makeDevice().open();
    await preload(store, [makeItem({ id: 'a', name: '阿明拉麵' })]);
    const { user } = await renderApp({ store });
    await user.click(screen.getByRole('button', { name: '阿明拉麵' }));
    await user.click(screen.getByRole('button', { name: '標為已完成' }));
    const dlg = await dialog('完成並留下評價');
    const submit = within(dlg).getByRole('button', { name: '完成並送出評價' });
    expect(submit).toBeDisabled();
    expect(within(dlg).getAllByRole('radio')).toHaveLength(5);
    await user.click(within(dlg).getByRole('radio', { name: '4 分' }));
    expect(submit).toBeDisabled(); // 評價空白
    await user.type(within(dlg).getByLabelText('評價說明'), '   ');
    expect(submit).toBeDisabled();
    await user.type(within(dlg).getByLabelText('評價說明'), '湯頭濃，叉燒厚');
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect((await store.getItems())[0]).toMatchObject({ status: '已完成', rating: 4, review: '湯頭濃，叉燒厚' });
  });

  it('情境: 已完成的收藏在詳情顯示評分與評價', async () => {
    const store = await makeDevice().open();
    await preload(store, [makeItem({ id: 'b', name: '南部食記', status: '已完成', rating: 5, review: '碗粿很嫩，蒜泥醬油夠味。' })]);
    const { user } = await renderApp({ store });
    await user.click(screen.getByRole('button', { name: /^已完成/ }));
    await user.click(screen.getByRole('button', { name: '南部食記' }));
    const section = screen.getByRole('region', { name: '評價' });
    expect(within(section).getByText('5 分')).toBeInTheDocument();
    expect(within(section).getByRole('radio', { name: '5 分' })).toHaveAttribute('aria-checked', 'true');
    expect(within(section).getByLabelText('評價說明')).toHaveValue('碗粿很嫩，蒜泥醬油夠味。');
    // 可修改
    await user.click(within(section).getByRole('radio', { name: '3 分' }));
    expect((await store.getItems())[0].rating).toBe(3);
  });

  it('情境: 可從已完成改回想體驗', async () => {
    const device = makeDevice();
    const store = await device.open();
    await preload(store, [makeItem({ id: 'c', name: '南部食記', status: '已完成', rating: 5, review: '會再去' })]);
    const { user, unmount } = await renderApp({ store });
    await user.click(screen.getByRole('button', { name: /^已完成/ }));
    await user.click(screen.getByRole('button', { name: '南部食記' }));
    await user.click(screen.getByRole('button', { name: '移回想體驗' }));
    const prev = screen.getByLabelText('先前的評價');
    expect(within(prev).getByText('5 分')).toBeInTheDocument();
    expect(within(prev).getByText('會再去')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByRole('button', { name: /^想體驗/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '南部食記' })).toBeInTheDocument();
    // 重整後仍保留
    unmount();
    render(<App store={await device.open()} />);
    expect(await screen.findByRole('button', { name: '南部食記' })).toBeInTheDocument();
    expect((await store.getItems())[0]).toMatchObject({ status: '想體驗', rating: 5, review: '會再去' });
  });
});
