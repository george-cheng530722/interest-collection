import { useRef, useState } from 'react';
import type { Category, Item, Settings } from '../lib/types';
import { CATEGORIES, defaultEmoji } from '../lib/constants';
import { DEFAULT_PROXY_URL } from '../lib/types';
import { shortUrl } from '../lib/parse';
import { failMessage, type FailReason } from '../lib/fetchMeta';
import { copyText, downloadText, exportCsv, exportFileName, exportText, itemDateLabel, itemName, lineItShareUrl, lineShareUrl } from '../lib/share';
import { fileToThumbDataUrl } from '../lib/image';
import type { StoreKind } from '../lib/storage';
import { Btn, categoryTone, Chip, CitySelect, Field, Preview, Sheet, SourceTag, Stars, Tag, Thumb } from './ui';

function CategoryPicker({ value, onChange }: { value: Category | ''; onChange: (c: Category | '') => void }) {
  return (
    <div role="group" aria-label="分類" className="chips-wrap">
      {CATEGORIES.map((c) => <Chip key={c} tone={categoryTone(c)} label={c} active={value === c} onClick={() => onChange(value === c ? '' : c)} />)}
    </div>
  );
}

export function ConfirmAddSheet({ draft, onChange, onCancel, onConfirm }: { draft: Item; onChange: (p: Partial<Item>) => void; onCancel: () => void; onConfirm: () => void }) {
  const ready = !!draft.city && !!draft.category;
  return (
    <Sheet title="確認地區後加入" onClose={onCancel}>
      <div className="confirm-head">
        <Thumb item={draft} size={64} />
        <div className="grow">
          <div className="strong">{itemName(draft)}</div>
          <div className="muted">@{draft.handle || '（帳號未知）'}</div>
          <div className="tags"><SourceTag source={draft.source} /><Tag>{draft.fetchedVia === 'oembed' ? '已由公開 oEmbed 讀取' : draft.fetchedVia === 'proxy' ? '已由代理讀取' : '已直接讀取'}</Tag></div>
        </div>
      </div>
      {draft.caption ? <p className="caption">{draft.caption}</p> : null}
      <Field label="名稱" value={draft.name} onChange={(name) => onChange({ name })} />
      <Field label="店家名稱" value={draft.placeName} onChange={(placeName) => onChange({ placeName })} placeholder="讀不到店名就留白" />
      <div className="label">分類</div>
      <CategoryPicker value={draft.category} onChange={(category) => onChange({ category, emoji: defaultEmoji(category) })} />
      <div className="label">地區（必填，已預填，請確認）</div>
      <CitySelect value={draft.city} onChange={(city) => onChange({ city })} />
      <div className="hint">若讀不到地區，會先填「其他」，你可以直接改。</div>
      {!draft.city ? <div className="error" role="alert">請選擇地區，才能加入收藏。</div> : null}
      {!draft.category ? <div className="error" role="alert">請選擇分類。</div> : null}
      <div className="row"><Btn label="取消" onClick={onCancel} block /><Btn label="加入收藏" onClick={onConfirm} primary disabled={!ready} block /></div>
    </Sheet>
  );
}

export function ManualSheet({ draft, reason, onChange, onCancel, onSave }: { draft: Item; reason: FailReason; onChange: (p: Partial<Item>) => void; onCancel: () => void; onSave: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgErr, setImgErr] = useState('');
  const missing: string[] = [];
  if (!draft.name.trim()) missing.push('名稱');
  if (!draft.handle.trim()) missing.push('帳號');
  if (!draft.category) missing.push('分類');
  if (!draft.city) missing.push('地區');
  const ready = missing.length === 0;
  return (
    <Sheet title="讀取失敗，請手動補充" onClose={onCancel}>
      <div className="notice-warn">{failMessage(reason)}已依網址預填來源 {draft.source}{draft.handle ? ` 與帳號 @${draft.handle}` : ''}。儲存後會標記為「手動補充」。</div>
      <div className="field">
        <label className="field-label" htmlFor="manual-url">連結</label>
        <input id="manual-url" type="text" value={draft.url} readOnly className="readonly" />
      </div>
      <div className="tags"><span className="muted">來源</span><SourceTag source={draft.source} /><span className="muted small">{shortUrl(draft.url)}</span></div>
      <Field label="名稱" required value={draft.name} onChange={(name) => onChange({ name })} placeholder="例如：大稻埕拉麵" />
      <Field label="店家名稱" value={draft.placeName} onChange={(placeName) => onChange({ placeName })} placeholder="沒有可靠店名就留白" />
      <Field label="說明" value={draft.caption} onChange={(caption) => onChange({ caption })} placeholder="這則貼文在說什麼？" multiline />
      <Field label="帳號" required value={draft.handle} onChange={(handle) => onChange({ handle: handle.replace(/^@/, '').trim() })} placeholder="例如：aming.ramen" />
      <div className="label">分類（必填）</div>
      <CategoryPicker value={draft.category} onChange={(category) => onChange({ category, emoji: defaultEmoji(category) })} />
      <div className="label">地區（必填；不明時先填「其他」）</div>
      <CitySelect value={draft.city} onChange={(city) => onChange({ city })} />
      <div className="field">
        <span className="field-label">截圖當縮圖（選填）</span>
        <input ref={fileRef} type="file" accept="image/*" aria-label="選擇截圖" className="visually-hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { setImgErr(''); onChange({ screenshot: await fileToThumbDataUrl(f) }); } catch { setImgErr('讀不到這張圖片，請換一張。'); }
        }} />
        <div className="row">
          <Btn label={draft.screenshot ? '換一張截圖' : '從相簿選截圖'} onClick={() => fileRef.current?.click()} block />
          {draft.screenshot ? <Btn label="移除截圖" onClick={() => { onChange({ screenshot: undefined }); if (fileRef.current) fileRef.current.value = ''; }} block /> : null}
        </div>
        {draft.screenshot ? <div className="row center"><Thumb item={draft} size={72} /><span className="muted small">截圖只存在這台裝置。</span></div> : null}
        {imgErr ? <div className="error">{imgErr}</div> : null}
      </div>
      <Field label="備註" value={draft.memo} onChange={(memo) => onChange({ memo })} placeholder="例如：朋友私訊分享、店休日不固定" multiline />
      {!ready ? <div className="error" role="alert">請填寫：{missing.join('、')}。</div> : null}
      <div className="row"><Btn label="取消" onClick={onCancel} block /><Btn label="儲存並標記手動補充" onClick={onSave} primary disabled={!ready} block /></div>
    </Sheet>
  );
}

export function DeleteSheet({ item, onCancel, onConfirm }: { item: Item; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Sheet title="刪除這則收藏？" onClose={onCancel}>
      <p>確定要刪除「{itemName(item)}」嗎？資料只存在這台裝置，刪除後無法復原。</p>
      <div className="row"><Btn label="取消" onClick={onCancel} block /><Btn label="確定刪除" onClick={onConfirm} danger block /></div>
    </Sheet>
  );
}

export function DeadLinkSheet({ item, onKeep, onDelete }: { item: Item; onKeep: () => void; onDelete: () => void }) {
  return (
    <Sheet title="連結似乎已失效" onClose={onKeep}>
      <p>「{itemName(item)}」的連結似乎已失效，可能是貼文已刪除。要刪除這則收藏嗎？</p>
      <p className="muted small">選「先保留」會留下「連結失效」標記，備註與評價都不會動。</p>
      <div className="row"><Btn label="先保留" onClick={onKeep} block /><Btn label="刪除" onClick={onDelete} danger block /></div>
    </Sheet>
  );
}

export function ReviewSheet({ item, onCancel, onConfirm }: { item: Item; onCancel: () => void; onConfirm: (rating: number, review: string) => void }) {
  const [rating, setRating] = useState(item.rating || 0);
  const [review, setReview] = useState(item.review || '');
  const ready = rating >= 1 && rating <= 5 && review.trim().length > 0;
  return (
    <Sheet title="完成並留下評價" onClose={onCancel}>
      <div className="strong">{itemName(item)}</div>
      <div className="muted">{item.city}</div>
      <div className="label">評分（1 到 5 分）</div>
      <Stars value={rating} onChange={setRating} />
      <Field label="評價說明" value={review} onChange={setReview} placeholder="這次體驗怎麼樣？例如：值得再去、要早到" multiline />
      {!ready ? <div className="error" role="alert">請先打分數，並寫下評價說明。</div> : null}
      <div className="row"><Btn label="先不要" onClick={onCancel} block /><Btn label="完成並送出評價" onClick={() => ready && onConfirm(rating, review.trim())} primary disabled={!ready} block /></div>
    </Sheet>
  );
}

export function ShareSheet({ title, text, singleUrl, onClose }: { title: string; text: string; singleUrl?: string; onClose: () => void }) {
  const [copied, setCopied] = useState('');
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="label">要傳給 LINE 好友的內容</div>
      <Preview text={text} label="分享內容預覽" />
      <div className="col">
        <a className="btn btn-primary btn-block btn-line" href={lineShareUrl(text)} target="_blank" rel="noopener noreferrer" data-testid="line-share-link"><span className="badge-dot dot-line" aria-hidden="true" />用 LINE 分享</a>
        <div className="row">
          <Btn label={copied || '複製內容'} onClick={async () => setCopied((await copyText(text)) ? '已複製' : '無法自動複製，請長按上方文字')} block />
          {canNativeShare ? <Btn label="系統分享…" onClick={() => { navigator.share({ text }).catch(() => undefined); }} block /> : null}
        </div>
        {singleUrl ? <a className="link small" href={lineItShareUrl(singleUrl)} target="_blank" rel="noopener noreferrer">只分享連結（LINE 社群外掛）</a> : null}
      </div>
      <div className="hint">會打開 LINE 官方分享頁（line.me），由你選擇好友後送出。</div>
    </Sheet>
  );
}

export function ExportSheet({ visibleRows, allRows, listName, onClose }: { visibleRows: Item[]; allRows: Item[]; listName: string; onClose: () => void }) {
  const [fmt, setFmt] = useState<'text' | 'csv'>('text');
  const [scope, setScope] = useState<'visible' | 'all'>('visible');
  const [msg, setMsg] = useState('');
  const rows = scope === 'visible' ? visibleRows : allRows;
  const name = scope === 'visible' ? listName : '全部收藏';
  const text = fmt === 'csv' ? exportCsv(rows) : exportText(rows, name);
  return (
    <Sheet title="匯出清單" onClose={onClose}>
      <div className="muted small">欄位：清單、名稱、地區、連結。共 {rows.length} 則。</div>
      <div className="chips-wrap" role="group" aria-label="範圍">
        <Chip label={`目前畫面（${listName}）`} active={scope === 'visible'} onClick={() => setScope('visible')} />
        <Chip label="全部收藏" active={scope === 'all'} onClick={() => setScope('all')} />
      </div>
      <div className="chips-wrap" role="group" aria-label="格式">
        <Chip label="純文字" active={fmt === 'text'} onClick={() => setFmt('text')} />
        <Chip label="CSV" active={fmt === 'csv'} onClick={() => setFmt('csv')} />
      </div>
      <Preview text={text} label="匯出內容預覽" />
      <div className="row">
        <Btn label="複製" onClick={async () => setMsg((await copyText(text)) ? '已複製' : '無法自動複製，請長按上方文字')} block />
        <Btn label={fmt === 'csv' ? '下載 CSV' : '下載文字檔'} primary onClick={() => setMsg(downloadText(exportFileName(fmt === 'csv' ? 'csv' : 'txt'), text, fmt === 'csv' ? 'text/csv' : 'text/plain') ? '已下載（iPhone 會存到「檔案」或顯示預覽）' : '下載失敗，請改用複製')} block />
      </div>
      {msg ? <div className="ok" role="status">{msg}</div> : null}
    </Sheet>
  );
}

export function DuplicateSheet({ item, onOpen, onCancel, onSaveAnyway }: { item: Item; onOpen: () => void; onCancel: () => void; onSaveAnyway: () => void }) {
  return (
    <Sheet title="這則已經收藏過了" onClose={onCancel}>
      <p>這則連結已經在收藏裡。要打開原本那一則，還是仍要再存一筆？</p>
      <div className="dup-card">
        <div className="strong">{itemName(item)}</div>
        {item.placeName?.trim() && item.placeName.trim() !== itemName(item) ? <div className="place-name">{item.placeName.trim()}</div> : null}
        <div className="muted small">{itemDateLabel(item.createdAt)} · {item.city || '其他'}</div>
      </div>
      <div className="row"><Btn label="取消" onClick={onCancel} block /><Btn label="打開這則" onClick={onOpen} primary block /></div>
      <Btn label="仍要儲存" onClick={onSaveAnyway} block />
    </Sheet>
  );
}

export function SettingsSheet({ settings, storeKind, usage, onChange, onClose }: { settings: Settings; storeKind: StoreKind; usage: string; onChange: (s: Settings) => void; onClose: () => void }) {
  return (
    <Sheet title="設定" onClose={onClose}>
      <div className="setting">
        <label className="switch-row">
          <input type="checkbox" role="switch" aria-label="中繼資料代理（外掛）" checked={settings.proxyEnabled} onChange={(e) => onChange({ ...settings, proxyEnabled: e.target.checked })} />
          <span><span className="strong">中繼資料代理（外掛）</span><br /><span className="muted small">預設開啟。只有在裝置直接讀不到貼文時，才會把貼文網址送到下方代理以取得標題與縮圖。可以隨時關掉；關掉後完全不會向代理送出請求，讀不到時改走手動補充。私人貼文代理也讀不到，一樣請手動補充。</span></span>
        </label>
        <Field label="代理網址" value={settings.proxyUrl} onChange={(proxyUrl) => onChange({ ...settings, proxyUrl })} placeholder={DEFAULT_PROXY_URL} inputMode="url" />
      </div>
      <div className="setting">
        <div className="strong">資料存放位置</div>
        <div className="muted small" data-testid="store-kind">
          {storeKind === 'indexeddb' ? '這台裝置的 IndexedDB' : storeKind === 'localstorage' ? '這台裝置的 localStorage（IndexedDB 無法使用時的降級）' : '暫存記憶體（此環境無法使用本機儲存，重整後會消失）'}
          {usage ? `；${usage}` : ''}
        </div>
        <div className="muted small">不需帳號、不會同步，也不會上傳到任何伺服器。</div>
      </div>
    </Sheet>
  );
}
