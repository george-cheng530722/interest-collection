import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Category, Item, Source } from '../lib/types';
import { thumbLabel } from '../lib/thumbs';
import { CITIES, isKnownCity } from '../lib/constants';

export function Chip({ label, count, active, onClick, disabled }: { label: string; count?: number; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={'chip' + (active ? ' chip-on' : '')} aria-pressed={active} onClick={onClick} disabled={disabled}>
      {label}{count != null ? <span className="chip-count"> {count}</span> : null}
    </button>
  );
}

export function Btn({ label, onClick, primary, danger, disabled, block, type = 'button' }: { label: string; onClick?: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; block?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} className={['btn', primary ? 'btn-primary' : '', danger ? 'btn-danger' : '', block ? 'btn-block' : ''].join(' ').trim()} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

export function Field({ label, value, onChange, placeholder, multiline, required, inputMode, name }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; required?: boolean; inputMode?: 'url' | 'text'; name?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}{required ? <span className="req">（必填）</span> : null}</label>
      {multiline
        ? <textarea id={id} name={name} value={value} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} name={name} type="text" inputMode={inputMode} autoCapitalize="off" autoCorrect="off" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

/**
 * 地區下拉選單（原生 <select>，名稱「地區」）。
 * 目前的值（或 keep 傳入的原本值）若不在 CITIES（舊資料或自訂地區），會多列在最後，照樣顯示、照樣可選。
 */
export function CitySelect({ value, onChange, allowEmpty = true, keep }: { value: string; onChange: (c: string) => void; allowEmpty?: boolean; keep?: string }) {
  const extras = [...new Set([keep ?? '', value])].filter((c) => c && !isKnownCity(c));
  return (
    <select className="select" aria-label="地區" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty || !value ? <option value="" disabled={!allowEmpty}>請選擇</option> : null}
      {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
      {extras.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

export function Stars({ value, onChange, label = '評分' }: { value: number; onChange?: (n: number) => void; label?: string }) {
  return (
    <div className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? label : `${value} 分`}>
      {[1, 2, 3, 4, 5].map((n) => onChange
        ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} 分`} className={'star' + (n <= value ? ' star-on' : '')} onClick={(e) => { e.stopPropagation(); onChange(n); }}>{n <= value ? '★' : '☆'}</button>
        : <span key={n} className={'star' + (n <= value ? ' star-on' : '')} aria-hidden="true">{n <= value ? '★' : '☆'}</span>)}
      {value > 0 ? <span className="stars-text">{value} 分</span> : null}
    </div>
  );
}

export function Tag({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'ig' | 'threads' | 'x'; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function SourceTag({ source }: { source: Source }) {
  return <Tag tone={source === 'Instagram' ? 'ig' : source === 'Threads' ? 'threads' : 'x'}>{source}</Tag>;
}

function catClass(c: Category | ''): string {
  return c === '吃' ? 'eat' : c === '喝' ? 'drink' : c === '玩' ? 'play' : c === '想 follow 學習' ? 'learn' : 'fun';
}

/** 縮圖：本機截圖 → 遠端縮圖（載不到就換後備圖示）→ 分類 emoji */
export function Thumb({ item, size, onBroken }: { item: Item; size: number; onBroken?: () => void }) {
  const [broken, setBroken] = useState(false);
  const src = item.screenshot || (!broken ? item.thumbUrl : undefined);
  const reported = useRef(false);
  useEffect(() => { setBroken(false); reported.current = false; }, [item.thumbUrl, item.screenshot]);
  const label = item.thumbState === 'failed' && !src ? '更新失敗，使用預設圖示' : thumbLabel(item);
  return (
    <div className={`thumb thumb-${catClass(item.category)}`} style={{ width: size, height: size, fontSize: size * 0.4 }} data-testid="thumb" data-thumb-state={item.thumbState}>
      {src
        ? <img src={src} alt={item.screenshot ? '截圖縮圖' : '貼文縮圖'} loading="lazy" referrerPolicy="no-referrer" onError={() => { setBroken(true); if (!item.screenshot && !reported.current) { reported.current = true; onBroken?.(); } }} />
        : <span aria-hidden="true">{item.emoji}</span>}
      {label ? <div className={'thumb-label' + (size < 90 ? ' thumb-label-sm' : '')}>{label}</div> : null}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop">
      <button type="button" className="sheet-dismiss" aria-label="關閉視窗" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head"><h2>{title}</h2><Btn label="關閉" onClick={onClose} /></div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Preview({ text, label }: { text: string; label?: string }) {
  return <pre className="preview" aria-label={label}>{text}</pre>;
}
