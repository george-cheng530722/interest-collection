import type { Category, City, Item, ItemStatus, Source } from '../lib/types';
import { CATEGORIES, CITIES, SOURCES, APP_NAME } from '../lib/constants';
import { itemName } from '../lib/share';
import { shortUrl } from '../lib/parse';
import { Btn, Chip, SourceTag, Stars, Tag, Thumb } from './ui';

export interface Filters { tab: ItemStatus; source: Source | '全部'; category: Category | '全部'; city: City | '全部' }

export function applyFilters(items: Item[], f: Filters): Item[] {
  return items
    .filter((it) => it.status === f.tab && (f.source === '全部' || it.source === f.source) && (f.category === '全部' || it.category === f.category) && (f.city === '全部' || it.city === f.city))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function dateLabel(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function ListView(props: {
  items: Item[]; visible: Item[]; filters: Filters; setFilters: (f: Filters) => void;
  input: string; setInput: (s: string) => void; loading: boolean; notice: string; online: boolean; storageWarning: string;
  onAdd: () => void; onShareList: () => void; onExport: () => void; onSettings: () => void;
  onOpen: (id: string) => void; onShareItem: (it: Item) => void; onThumbBroken: (id: string) => void;
}) {
  const { items, visible, filters: f, setFilters } = props;
  const inTab = items.filter((it) => it.status === f.tab);
  const usedCities = CITIES.filter((c) => inTab.some((it) => it.city === c));
  const set = (p: Partial<Filters>) => setFilters({ ...f, ...p });
  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="app-title">{APP_NAME}</h1>
        {!props.online ? <Tag tone="warning">離線中</Tag> : null}
        <Btn label="設定" onClick={props.onSettings} />
      </header>
      {props.storageWarning ? <div className="notice-warn pad-x" role="alert">{props.storageWarning}</div> : null}
      <form className="add-box" onSubmit={(e) => { e.preventDefault(); props.onAdd(); }}>
        <div className="field">
          <label htmlFor="add-input" className="field-label">貼上社群來源的連結</label>
          <textarea id="add-input" rows={2} value={props.input} onChange={(e) => props.setInput(e.target.value)} placeholder="貼上 Instagram、X 跟 Threads 的連結，或 LINE 分享的文字" autoCapitalize="off" autoCorrect="off" />
        </div>
        <div className="row"><Btn type="submit" label={props.loading ? '讀取中…' : '加入'} primary disabled={props.loading} block /></div>
        <div className="row"><Btn label="分享清單" onClick={props.onShareList} disabled={visible.length === 0} block /><Btn label="匯出" onClick={props.onExport} disabled={visible.length === 0} block /></div>
        {props.notice ? <div className="notice-text" role="status">{props.notice}</div> : null}
      </form>
      <nav className="chip-row" aria-label="清單">
        <Chip label="想體驗" count={items.filter((i) => i.status === '想體驗').length} active={f.tab === '想體驗'} onClick={() => set({ tab: '想體驗' })} />
        <Chip label="已完成" count={items.filter((i) => i.status === '已完成').length} active={f.tab === '已完成'} onClick={() => set({ tab: '已完成' })} />
      </nav>
      <div className="chip-row" role="group" aria-label="來源篩選">
        <Chip label="全部來源" active={f.source === '全部'} onClick={() => set({ source: '全部' })} />
        {SOURCES.map((s) => <Chip key={s} label={s} count={inTab.filter((i) => i.source === s).length} active={f.source === s} onClick={() => set({ source: s })} />)}
      </div>
      <div className="chip-row" role="group" aria-label="分類篩選">
        <Chip label="全部分類" count={inTab.length} active={f.category === '全部'} onClick={() => set({ category: '全部' })} />
        {CATEGORIES.map((c) => <Chip key={c} label={c} count={inTab.filter((i) => i.category === c).length} active={f.category === c} onClick={() => set({ category: c })} />)}
      </div>
      <div className="chip-row" role="group" aria-label="地區篩選">
        <Chip label="全部地區" active={f.city === '全部'} onClick={() => set({ city: '全部' })} />
        {usedCities.map((c) => <Chip key={c} label={c} count={inTab.filter((i) => i.city === c).length} active={f.city === c} onClick={() => set({ city: c })} />)}
      </div>
      <main className="scroll pad-x" aria-label="收藏清單">
        {props.loading ? <div className="card muted" role="status">正在讀取貼文資訊…</div> : null}
        {visible.length === 0 && !props.loading ? (
          items.length === 0
            ? <div className="empty" data-testid="empty-state"><p className="empty-title">還沒有收藏</p><p>貼上 Instagram、X 或 Threads 的連結，就能開始收集。</p></div>
            : <div className="empty">{inTab.length === 0 ? '這個區塊還沒有項目' : '這個篩選沒有項目'}</div>
        ) : null}
        <ul className="list">
          {visible.map((it) => (
            <li key={it.id}>
              <div className="card" role="button" tabIndex={0} data-testid="item-card" aria-label={itemName(it)} onClick={() => props.onOpen(it.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onOpen(it.id); } }}>
                <Thumb item={it} size={72} onBroken={() => props.onThumbBroken(it.id)} />
                <div className="card-body">
                  <div className="card-top"><span className="strong" data-testid="item-name">{itemName(it)}</span><span className="muted tiny">{dateLabel(it.createdAt)}</span></div>
                  <div className="muted small">@{it.handle}</div>
                  {it.caption ? <div className="clamp2">{it.caption}</div> : null}
                  <div className="tags">
                    <SourceTag source={it.source} />
                    <Tag tone="accent">{it.category}</Tag>
                    <Tag><span data-testid="item-city">{it.city}</span></Tag>
                    <Tag tone={it.status === '已完成' ? 'success' : 'warning'}>{it.status}</Tag>
                    {it.manual ? <Tag tone="accent">手動補充</Tag> : null}
                    {it.linkDead ? <Tag tone="danger">連結失效</Tag> : null}
                  </div>
                  {it.status === '已完成' && it.rating > 0 ? <Stars value={it.rating} /> : null}
                  {it.memo ? <div className="muted tiny ellipsis">備註：{it.memo}</div> : null}
                  <div className="card-foot">
                    <a className="link small ellipsis" href={it.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{shortUrl(it.url)}</a>
                    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><Btn label="分享" onClick={() => props.onShareItem(it)} /></span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
