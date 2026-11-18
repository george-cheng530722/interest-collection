import { describe, expect, it } from 'vitest';
import { CITIES } from '../../src/lib/constants';
import { makeDevice, makeItem, preload, renderApp, screen, within } from '../helpers';
import type { Item } from '../../src/lib/types';

const FIXTURE: Item[] = [
  makeItem({ id: 'a', name: '師大雞排', source: 'Instagram', url: 'https://www.instagram.com/eats/p/AAA111/', handle: 'eats', category: '吃', city: '台北', memo: '下次路過' }),
  makeItem({ id: 'b', name: '河岸咖啡', source: 'Instagram', url: 'https://www.instagram.com/coffee/p/BBB222/', handle: 'coffee', category: '喝', city: '台北' }),
  makeItem({ id: 'c', name: '北部週末', source: 'Threads', url: 'https://www.threads.net/@weekend.north/post/WalkReal/', handle: 'weekend.north', category: '玩', city: '新北', memo: '等天氣好再排' }),
  makeItem({ id: 'd', name: '街角貓', source: 'X', url: 'https://x.com/streetcats/status/1001', handle: 'streetcats', category: '有趣', city: '台北' }),
  makeItem({ id: 'e', name: '空間筆記', source: 'Threads', url: 'https://www.threads.net/@studio.table/post/FlowReal/', handle: 'studio.table', category: '想 follow 學習', city: '其他', memo: '想看案例' }),
  makeItem({ id: 'f', name: '南部食記', source: 'Instagram', url: 'https://www.instagram.com/south/p/CCC333/', handle: 'south', category: '吃', city: '台南', status: '已完成', rating: 5, review: '好吃' }),
  makeItem({ id: 'g', name: '逢甲香腸', source: 'X', url: 'https://x.com/foodnotes/status/1002', handle: 'foodnotes', category: '吃', city: '台中' }),
];

async function setup() {
  const store = await makeDevice().open();
  await preload(store, FIXTURE);
  return renderApp({ store });
}
const cards = () => screen.queryAllByTestId('item-card');
const namesOf = (pred: (i: Item) => boolean) => FIXTURE.filter(pred).map((i) => i.name).sort();
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
    await user.click(within(screen.getByRole('group', { name: '地區篩選' })).getByRole('button', { name: /^台北/ }));
    expect(cards().length).toBeGreaterThan(0);
    screen.getAllByTestId('item-city').forEach((e) => expect(e).toHaveTextContent('台北'));
    expect(visibleNames()).toEqual(namesOf((i) => i.city === '台北' && i.status === '想體驗'));
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

  it('情境: 篩選列未選時只顯示「來源」「分類」「地區」', async () => {
    const { user } = await setup();
    const src = within(screen.getByRole('group', { name: '來源篩選' }));
    const cat = within(screen.getByRole('group', { name: '分類篩選' }));
    const city = within(screen.getByRole('group', { name: '地區篩選' }));
    expect(src.getByRole('button', { name: '來源' })).toHaveAttribute('aria-pressed', 'true');
    expect(cat.getByRole('button', { name: /^分類/ })).toHaveAttribute('aria-pressed', 'true');
    expect(city.getByRole('button', { name: '地區' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/全部來源|全部分類|全部地區/)).toBeNull();
    // 想體驗／已完成分頁不變
    expect(screen.getByRole('button', { name: /^想體驗/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^已完成/ })).toBeInTheDocument();
    const all = namesOf((i) => i.status === '想體驗');
    expect(visibleNames()).toEqual(all);

    await user.click(src.getByRole('button', { name: /^Instagram/ }));
    expect(src.getByRole('button', { name: /^Instagram/ })).toHaveAttribute('aria-pressed', 'true');
    expect(src.getByRole('button', { name: '來源' })).toHaveAttribute('aria-pressed', 'false');
    expect(visibleNames()).toEqual(namesOf((i) => i.source === 'Instagram' && i.status === '想體驗'));

    await user.click(src.getByRole('button', { name: '來源' }));
    expect(src.getByRole('button', { name: '來源' })).toHaveAttribute('aria-pressed', 'true');
    expect(visibleNames()).toEqual(all);

    await user.click(city.getByRole('button', { name: /^台北/ }));
    expect(city.getByRole('button', { name: '地區' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(city.getByRole('button', { name: '地區' }));
    expect(visibleNames()).toEqual(all);
  });

  it('情境: 舊資料或自訂地區仍會顯示且可選', async () => {
    const store = await makeDevice().open();
    await preload(store, [
      ...FIXTURE,
      makeItem({ id: 'h', name: '花蓮民宿', city: '花蓮', category: '玩' }),
      makeItem({ id: 'i', name: '舊的高雄收藏', city: '高雄市' }),
    ]);
    const { user } = await renderApp({ store });
    // 舊版正式名稱「高雄市」載入時轉成「高雄」並寫回；不認得的「花蓮」原樣保留
    expect((await store.getItems()).find((i) => i.id === 'i')?.city).toBe('高雄');
    expect((await store.getItems()).find((i) => i.id === 'h')?.city).toBe('花蓮');
    const city = within(screen.getByRole('group', { name: '地區篩選' }));
    expect(city.getByRole('button', { name: /^高雄/ })).toBeInTheDocument();
    await user.click(city.getByRole('button', { name: /^花蓮/ }));
    expect(visibleNames()).toEqual(['花蓮民宿']);
    await user.click(city.getByRole('button', { name: '地區' }));

    await user.click(screen.getByRole('button', { name: '花蓮民宿' }));
    const sel = screen.getByRole('combobox', { name: '地區' });
    expect(sel).toHaveValue('花蓮');
    expect(within(sel).getAllByRole('option').map((o) => o.textContent)).toEqual([...CITIES, '花蓮']);
    await user.selectOptions(sel, '台北');
    expect(sel).toHaveValue('台北');
    await user.selectOptions(sel, '花蓮'); // 仍可選回原本的值
    expect(sel).toHaveValue('花蓮');
    expect((await store.getItems()).find((i) => i.id === 'h')?.city).toBe('花蓮');
  });

  it('情境: 地區下拉與篩選把林口排在最前面', async () => {
    const store = await makeDevice().open();
    await preload(store, [...FIXTURE, makeItem({ id: 'lk', name: '林口咖啡', city: '林口', category: '喝' })]);
    const { user } = await renderApp({ store });
    const city = within(screen.getByRole('group', { name: '地區篩選' }));
    const labels = city.getAllByRole('button').map((b) => (b.textContent || '').replace(/\s+\d+$/, ''));
    expect(labels[0]).toBe('地區');
    expect(labels.indexOf('林口')).toBeGreaterThan(0);
    expect(labels.indexOf('林口')).toBeLessThan(labels.indexOf('台北'));
    expect(labels.indexOf('台北')).toBeLessThan(labels.indexOf('新北'));
    await user.click(screen.getByRole('button', { name: '北部週末' }));
    const sel = screen.getByRole('combobox', { name: '地區' });
    expect(within(sel).getAllByRole('option').map((o) => o.textContent)).toEqual(['林口', '台北', '新北', '桃竹', '台中', '台南', '高雄', '宜蘭', '其他']);
  });

  it('情境: 已存的地區維持原樣不會改成林口', async () => {
    const store = await makeDevice().open();
    await preload(store, [makeItem({ id: 'keep', name: '板橋早餐', city: '新北', caption: '朋友說林口也有分店' })]);
    await renderApp({ store });
    expect((await store.getItems()).find((i) => i.id === 'keep')?.city).toBe('新北');
    expect(within(screen.getByRole('button', { name: '板橋早餐' })).getByTestId('item-city')).toHaveTextContent('新北');
  });

  it('情境: 分類可以選合作機會、好構想、生活技巧', async () => {
    const { user } = await setup();
    const filter = within(screen.getByRole('group', { name: '分類篩選' }));
    for (const name of ['吃', '喝', '玩', '有趣', '想 follow 學習', '合作機會', '好構想', '生活技巧']) {
      expect(filter.getByRole('button', { name: new RegExp('^' + name) })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: '師大雞排' }));
    const group = within(screen.getByRole('group', { name: '分類' }));
    await user.click(group.getByRole('button', { name: '合作機會' }));
    expect(group.getByRole('button', { name: '合作機會' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '返回' }));
    await user.click(within(screen.getByRole('group', { name: '分類篩選' })).getByRole('button', { name: /^合作機會/ }));
    expect(visibleNames()).toEqual(['師大雞排']);
  });

  it('情境: 分類數量與點下去看到的筆數相同', async () => {
    const store = await makeDevice().open();
    const eats = [
      ...[1, 2].map((n) => makeItem({ id: 'ig' + n, name: 'IG吃' + n, category: '吃', source: 'Instagram', url: `https://www.instagram.com/p/EATIG${n}/` })),
      ...[1, 2, 3, 4, 5, 6].map((n) => makeItem({ id: 'x' + n, name: 'X吃' + n, category: '吃', source: 'X', url: `https://x.com/food/status/${n}` })),
    ];
    await preload(store, eats);
    const { user } = await renderApp({ store });
    const cat = () => within(screen.getByRole('group', { name: '分類篩選' }));
    expect(cat().getByRole('button', { name: /^吃\s*8$/ })).toBeInTheDocument();
    await user.click(cat().getByRole('button', { name: /^吃/ }));
    expect(screen.getAllByTestId('item-card')).toHaveLength(8);
    await user.click(within(screen.getByRole('group', { name: '來源篩選' })).getByRole('button', { name: 'Instagram' }));
    expect(cat().getByRole('button', { name: /^吃\s*2$/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('item-card')).toHaveLength(2);
    expect(within(screen.getByRole('group', { name: '來源篩選' })).getByRole('button', { name: 'Instagram' }).textContent).toBe('Instagram');
    expect(screen.getByRole('button', { name: '想體驗' }).textContent).toBe('想體驗');
    expect(within(screen.getByRole('group', { name: '地區篩選' })).getByRole('button', { name: '台北' }).textContent).toBe('台北');
  });

  it('情境: 點一則收藏進入詳情', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: '北部週末' }));
    expect(screen.getByTestId('detail-name')).toHaveTextContent('北部週末');
    expect(screen.getByText('Threads')).toBeInTheDocument();
    expect(screen.getByText('@weekend.north')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '地區' })).toHaveValue('新北');
    expect(within(screen.getByRole('group', { name: '分類' })).getByRole('button', { name: '玩' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('detail-url')).toHaveAttribute('href', 'https://www.threads.net/@weekend.north/post/WalkReal/');
    expect(screen.getByLabelText('備註')).toHaveValue('等天氣好再排');
  });
});
