import { useEffect, useState } from 'react';
import type { Item } from '../lib/types';
import { CATEGORIES } from '../lib/constants';
import { itemName } from '../lib/share';
import { cardBlurb } from '../lib/place';
import type { Settings } from '../lib/types';
import { Btn, categoryTone, Chip, CitySelect, Field, PlaceNav, SourceTag, Stars, Tag, Thumb } from './ui';

export interface DetailActions {
  back: () => void;
  patch: (p: Partial<Item>) => void;
  share: () => void;
  markDone: () => void;
  moveBack: () => void;
  askDelete: () => void;
  checkLink: () => void;
  thumbBroken: () => void;
}

function openLabel(item: Item): string {
  return item.source === 'Instagram' ? '在 Instagram 開啟' : item.source === 'Threads' ? '在 Threads 開啟' : '在 X 開啟';
}

export function Detail({ item, justAdded, checking, actions, duplicate, home }: { item: Item; justAdded: boolean; checking: boolean; actions: DetailActions; duplicate?: boolean; home?: Pick<Settings, 'homeAddress' | 'homeLat' | 'homeLng'> }) {
  const [memo, setMemo] = useState(item.memo);
  const [review, setReview] = useState(item.review);
  const [place, setPlace] = useState(item.placeName || '');
  const [address, setAddress] = useState(item.address || '');
  const [captionOpen, setCaptionOpen] = useState(false);
  const [saved, setSaved] = useState('');
  // 打開時的地區：若是舊資料或自訂值，改選別的地區後仍可在下拉選單選回來
  const [originalCity, setOriginalCity] = useState(item.city);
  useEffect(() => { setMemo(item.memo); setReview(item.review); setPlace(item.placeName || ''); setAddress(item.address || ''); setCaptionOpen(false); setSaved(''); setOriginalCity(item.city); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const memoDirty = memo !== item.memo;
  const reviewDirty = review !== item.review;
  const placeDirty = place.trim() !== (item.placeName || '');
  const addressDirty = address.trim() !== (item.address || '');
  const full = item.caption || '';
  const brief = cardBlurb(item);
  const canExpand = full.trim().length > brief.trim().length;

  return (
    <div className="screen">
      <header className="topbar">
        <Btn label="返回" icon="back" onClick={actions.back} />
        <h1 className="topbar-title">貼文詳情</h1>
      </header>
      <main className="scroll pad">
        <div className="center-col">
          <Thumb item={item} size={160} onBroken={actions.thumbBroken} />
          <div className="detail-name" data-testid="detail-name">{itemName(item)}</div>
          {item.placeName?.trim() && item.placeName.trim() !== itemName(item) ? <div className="place-name" data-testid="detail-place">{item.placeName.trim()}</div> : null}
          <div className="muted">@{item.handle}</div>
          <div className="tags center">
            <SourceTag source={item.source} />
            <Tag>{item.city}</Tag>
            <Tag tone="accent">{item.category}</Tag>
            <Tag tone={item.status === '已完成' ? 'success' : 'warning'}>{item.status}</Tag>
            {item.manual ? <Tag tone="accent">手動補充</Tag> : null}
            {item.linkDead ? <Tag tone="danger">連結失效</Tag> : null}
            {duplicate ? <Tag tone="danger">重複</Tag> : null}
          </div>
        </div>
        {full.trim() ? (
          <div className="caption-block">
            <p className={'caption detail-caption' + (captionOpen ? ' is-open' : '')} data-testid="detail-caption">{captionOpen || !canExpand ? full : brief}</p>
            {canExpand ? <button type="button" className="text-btn" onClick={() => setCaptionOpen((v) => !v)}>{captionOpen ? '收合簡介' : '展開全文'}</button> : null}
          </div>
        ) : null}
        <PlaceNav item={item} home={home} />
        <dl className="kv">
          <dt>連結</dt><dd><a className="link" href={item.url} target="_blank" rel="noopener noreferrer" data-testid="detail-url">{item.url}</a></dd>
        </dl>
        <div className="row"><a className="btn btn-block" href={item.url} target="_blank" rel="noopener noreferrer">{openLabel(item)}</a><Btn label="分享給 LINE 好友" onClick={actions.share} block primary /></div>

        {justAdded ? <div className="notice-info">{item.manual ? '這則是手動補充的資料。讀取公開欄位失敗時（例如私人或限制年齡貼文），由你自行填寫名稱、說明與地區，也可上傳截圖當縮圖。' : '分類與地區已依說明文字預填，若不對請直接修正。若讀不到地區，會先填「其他」。'}</div> : null}

        <div className="label">分類（可修正）</div>
        <div className="chips-wrap" role="group" aria-label="分類">{CATEGORIES.map((c) => <Chip key={c} tone={categoryTone(c)} label={c} active={item.category === c} onClick={() => actions.patch({ category: c })} />)}</div>
        <div className="label">地區（必填，可修正）</div>
        <CitySelect value={item.city} keep={originalCity} allowEmpty={false} onChange={(city) => { if (city) actions.patch({ city }); }} />

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

        <Field label="店家名稱" value={place} onChange={(v) => { setPlace(v); setSaved(''); }} placeholder="沒有可靠店名就留白" />
        {placeDirty ? <div className="row"><Btn label="儲存店家名稱" primary onClick={() => { actions.patch({ placeName: place.trim(), lat: undefined, lng: undefined, geoState: undefined }); setPlace(place.trim()); setSaved('店家名稱已儲存'); }} block /></div> : null}
        <Field label="地址" value={address} onChange={(v) => { setAddress(v); setSaved(''); }} placeholder="沒有寫地址就留白" />
        {addressDirty ? <div className="row"><Btn label="儲存地址" primary onClick={() => { actions.patch({ address: address.trim(), lat: undefined, lng: undefined, geoState: undefined }); setAddress(address.trim()); setSaved('地址已儲存'); }} block /></div> : null}
        <Field label="備註" value={memo} onChange={(v) => { setMemo(v); setSaved(''); }} placeholder="例如：週末帶爸媽去、先問營業時間" multiline />
        <div className="row"><Btn label="儲存備註" primary={memoDirty} disabled={!memoDirty} onClick={() => { actions.patch({ memo }); setSaved('備註已儲存'); }} block /></div>
        {saved ? <div className="ok" role="status">{saved}</div> : null}

        <div className="col actions">
          <Btn label={checking ? '檢查中…' : '檢查連結與更新縮圖'} onClick={actions.checkLink} disabled={checking} block />
          <Btn label="刪除這則收藏" onClick={actions.askDelete} danger block />
        </div>
      </main>
    </div>
  );
}
