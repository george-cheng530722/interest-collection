import { describe, expect, it } from 'vitest';
import { CITIES, seedItems } from '../../src/lib/constants';
import { makeDevice, renderApp, screen, within } from '../helpers';

// 背景：清單中已有多則不同來源、分類與地區的收藏（首次開啟寫入的示範資料）
async function setup() {
  const store = await makeDevice().open();
  return renderApp({ store });
}
const cards = () => screen.queryAllByTestId('item-card');
const seed = seedItems();
const namesOf = (pred: (i: (typeof seed)[number]) => boolean) => seed.filter(pred).map((i) => i.name).sort();
const visibleNames = () => screen.queryAllByTestId('item-name').map((e) => e.textContent!).sort();

describe('功能: 清單、篩選與地區', () => {
  it('情境: 以想體驗與已完成分頁檢視', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: /^想體驗/ }));
    expect(visibleNames()).toEqual(namesOf((i) => i.status === '想體驗'));
    cards().forEach((c) => expect(within(c).getByText('想體驗')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^已完成/ }));
    expect(visibleNames()).toEqual(namesOf((i) => i.status === '已完成'));
    cards().forEach((c) => expect(within(c).getByText('已完成')).toBeInTheDocument());
  });

  it('情境: 依來源篩選', async () => {
    const { user } = await setup();
    await user.click(within(screen.getByRole('group', { name: '來源篩選' })).getByRole('button', { name: /^Instagram/ }));
    expect(cards().length).toBeGreaterThan(0);
    expect(visibleNames()).toEqual(namesOf((i) => i.source === 'Instagram' && i.status === '想體驗'));
    cards().forEach((c) => expect(within(c).getByText('Instagram')).toBeInTheDocument());
  });

  it('情境: 依分類篩選', async () => {
    const { user } = await setup();
    await user.click(within(screen.getByRole('group', { name: '分類篩選' })).getByRole('button', { name: /^吃/ }));
    expect(cards().length).toBeGreaterThan(0);
    expect(visibleNames()).toEqual(namesOf((i) => i.category === '吃' && i.status === '想體驗'));
  });

  it('情境: 依地區篩選', async () => {
    const { user } = await setup();
    await user.click(within(screen.getByRole('group', { name: '地區篩選' })).getByRole('button', { name: /^台北市/ }));
    expect(cards().length).toBeGreaterThan(0);
    screen.getAllByTestId('item-city').forEach((e) => expect(e).toHaveTextContent('台北市'));
    expect(visibleNames()).toEqual(namesOf((i) => i.city === '台北市' && i.status === '想體驗'));
  });

  it('情境: 每則收藏都有地區', async () => {
    const { user } = await setup();
    for (const tab of [/^想體驗/, /^已完成/]) {
      await user.click(screen.getByRole('button', { name: tab }));
      for (const c of cards()) {
        const city = within(c).getByTestId('item-city').textContent!;
        expect(CITIES).toContain(city);
      }
    }
    expect(screen.queryByText('線上')).toBeNull();
  });

  it('情境: 點一則收藏進入詳情', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: '北部週末' }));
    expect(screen.getByTestId('detail-name')).toHaveTextContent('北部週末');
    expect(screen.getByText('Threads')).toBeInTheDocument();
    expect(screen.getByText('@weekend.north')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: '地區' })).getByRole('button', { name: '新北市' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('group', { name: '分類' })).getByRole('button', { name: '玩' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('detail-url')).toHaveAttribute('href', 'https://www.threads.net/@weekend.north/post/DemoJiufenWalk/');
    expect(screen.getByLabelText('備註')).toHaveValue('等天氣好再排');
  });
});
