import { useEffect, useState } from 'react';
import type { Item } from '../lib/types';
import { CATEGORIES, CITIES } from '../lib/constants';
import { itemName } from '../lib/share';
import { Btn, Chip, Field, SourceTag, Stars, Tag, Thumb } from './ui';

export interface DetailActions {
  back: () => void;
  patch: (p: Partial<Item>) => void;
  share: () => void;
  markDone: () => void;
  moveBack: () => void;
  askDelete: () => void;
  checkLink: () => void;
  simulateThumbExpired: () => void;
  simulateDeadLink: () => void;
  thumbBroken: () => void;
}

function openLabel(item: Item): string {
  return item.source === 'Instagram' ? '在 Instagram 開啟' : item.source === 'Threads' ? '在 Threads 開啟' : '在 X 開啟';
}

export function Detail({ item, justAdded, checking, actions }: { item: Item; justAdded: boolean; checking: boolean; actions: DetailActions }) {
  const [memo, setMemo] = useState(item.memo);
  const [review, setReview] = useState(item.review);
  const [saved, setSaved] = useState('');
  useEffect(() => { setMemo(item.memo); setReview(item.review); setSaved(''); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const memoDirty = memo !== item.memo;
  const reviewDirty = review !== item.review;

  return (
    <div className="screen">
      <header className="topbar">
        <Btn label="返回" onClick={actions.back} />
        <h1 className="topbar-title">貼文詳情</h1>
        {item.demo ? <Tag>示範資料</Tag> : <span />}
      </header>
      <main className="scroll pad">
        <div className="center-col">
          <Thumb item={item} size={160} onBroken={actions.thumbBroken} />
          <div className="detail-name" data-testid="detail-name">{itemName(item)}</div>
          <div className="muted">@{item.handle}</div>
          <div className="tags center">
            <SourceTag source={item.source} />
            <Tag>{item.city}</Tag>
            <Tag tone="accent">{item.category}</Tag>
            <Tag tone={item.status === '已完成' ? 'success' : 'warning'}>{item.status}</Tag>
            {item.manual ? <Tag tone="accent">手動補充</Tag> : null}
            {item.linkDead ? <Tag tone="danger">連結失效</Tag> : null}
          </div>
        </div>
        {item.caption ? <p className="caption" data-testid="detail-caption">{item.caption}</p> : null}
        <dl className="kv">
          <dt>連結</dt><dd><a className="link" href={item.url} target="_blank" rel="noopener noreferrer" data-testid="detail-url">{item.url}</a></dd>
        </dl>
        <div className="row"><a className="btn btn-block" href={item.url} target="_blank" rel="noopener noreferrer">{openLabel(item)}</a><Btn label="分享給 LINE 好友" onClick={actions.share} block primary /></div>

        {justAdded ? <div className="notice-info">{item.manual ? '這則是手動補充的資料。讀取公開欄位失敗時（例如私人或限制年齡貼文），由你自行填寫名稱、說明與地區，也可上傳截圖當縮圖。' : '分類與地區已依說明文字預填，若不對請直接修正。若讀不到地區，會先填「其他」。'}</div> : null}

        <div className="label">分類（可修正）</div>
        <div className="chips-wrap" role="group" aria-label="分類">{CATEGORIES.map((c) => <Chip key={c} label={c} active={item.category === c} onClick={() => actions.patch({ category: c })} />)}</div>
        <div className="label">地區（必填，可修正）</div>
        <div className="chips-wrap" role="group" aria-label="地區">{CITIES.map((c) => <Chip key={c} label={c} active={item.city === c} onClick={() => actions.patch({ city: c })} />)}</div>

        {item.status === '已完成' ? (
          <section className="card-section" aria-label="評價">
            <div className="label">評價（可修正）</div>
            <Stars value={item.rating} onChange={(rating) => actions.patch({ rating })} />
            <Field label="評價說明" value={review} onChange={setReview} multiline />
            {reviewDirty ? <div className="row"><Btn label="儲存評價" primary disabled={!review.trim()} onClick={() => { actions.patch({ review: review.trim() }); setSaved('評價已儲存'); }} block /></div> : null}
            {!review.trim() ? <div className="error">評價說明不能空白。</div> : null}
            <Btn label="移回想體驗" onClick={actions.moveBack} block />
          </section>
        ) : (
          <section className="card-section">
            {item.rating > 0 || item.review ? (
              <div className="prev-review" aria-label="先前的評價">
                <div className="label">先前的評價（已保留）</div>
                <Stars value={item.rating} />
                <p className="caption">{item.review}</p>
              </div>
            ) : null}
            <Btn label="標為已完成" onClick={actions.markDone} primary block />
            <div className="hint">標為已完成前，會請你打 1 到 5 分，並寫下評價說明。</div>
          </section>
        )}

        <Field label="備註" value={memo} onChange={(v) => { setMemo(v); setSaved(''); }} placeholder="例如：週末帶爸媽去、先問營業時間" multiline />
        <div className="row"><Btn label="儲存備註" primary={memoDirty} disabled={!memoDirty} onClick={() => { actions.patch({ memo }); setSaved('備註已儲存'); }} block /></div>
        {saved ? <div className="ok" role="status">{saved}</div> : null}

        <div className="col actions">
          <Btn label={checking ? '檢查中…' : '檢查連結與更新縮圖'} onClick={actions.checkLink} disabled={checking} block />
          <div className="demo-box">
            <div className="muted small">示範用（模擬）：重現過期與失效流程。縮圖自動更新與失效詢問的邏輯是真的。</div>
            <div className="row"><Btn label="模擬縮圖過期" onClick={actions.simulateThumbExpired} block /><Btn label="模擬連結失效" onClick={actions.simulateDeadLink} block /></div>
          </div>
          <Btn label="刪除這則收藏" onClick={actions.askDelete} danger block />
        </div>
      </main>
    </div>
  );
}
