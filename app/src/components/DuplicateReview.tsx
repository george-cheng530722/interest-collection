import { useState } from 'react';
import type { Item } from '../lib/types';
import { itemDateLabel, itemName } from '../lib/share';
import { Btn, Sheet, Thumb } from './ui';

export function DuplicateReview({ groups, onBack, onDelete }: { groups: Item[][]; onBack: () => void; onDelete: (ids: string[]) => void }) {
  const [keep, setKeep] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<string[] | null>(null);
  return (
    <div className="screen">
      <header className="topbar">
        <Btn label="返回" icon="back" onClick={onBack} />
        <h1 className="topbar-title">重複收藏</h1>
      </header>
      <main className="scroll pad">
        <p className="muted small">每一組留下一則，其餘刪除前會再確認一次。資料只在這台裝置。</p>
        {groups.length === 0 ? <p className="empty-title">沒有重複收藏了。</p> : null}
        {groups.map((group, index) => {
          const chosen = keep[index] || [...group].sort((a, b) => b.createdAt - a.createdAt)[0].id;
          const drop = group.filter((it) => it.id !== chosen);
          return (
            <section key={group.map((it) => it.id).join('-')} className="card-section" aria-label="重複組">
              <div className="label">第 {index + 1} 組，共 {group.length} 則</div>
              {group.map((it) => (
                <label key={it.id} className={'dup-row' + (it.id === chosen ? ' dup-keep' : '')}>
                  <input type="radio" name={'keep-' + index} checked={it.id === chosen} onChange={() => setKeep((k) => ({ ...k, [index]: it.id }))} />
                  <Thumb item={it} size={48} />
                  <span className="grow">
                    <span className="strong">{itemName(it)}</span>
                    <span className="muted tiny">{itemDateLabel(it.createdAt)} · {it.city}</span>
                  </span>
                  {it.id === chosen ? <span className="tiny">留下</span> : null}
                </label>
              ))}
              <Btn label={`刪除其餘 ${drop.length} 則`} danger disabled={drop.length === 0} onClick={() => setPending(drop.map((it) => it.id))} block />
            </section>
          );
        })}
      </main>
      {pending ? (
        <Sheet title="刪除重複收藏？" onClose={() => setPending(null)}>
          <p>確定刪除這 {pending.length} 則？留下的那一則不會動，刪除後無法復原。</p>
          <div className="row">
            <Btn label="取消" onClick={() => setPending(null)} block />
            <Btn label="確定刪除" danger onClick={() => { const ids = pending; setPending(null); onDelete(ids); }} block />
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
