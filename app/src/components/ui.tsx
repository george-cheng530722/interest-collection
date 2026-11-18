import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Category, Item, Source } from '../lib/types';
import { thumbLabel } from '../lib/thumbs';
import { CITIES, isKnownCity } from '../lib/constants';

export type ChipTone = 'ig' | 'threads' | 'x' | 'line' | 'eat' | 'drink' | 'play' | 'fun' | 'learn' | 'collab' | 'idea' | 'life' | 'region';

export function Chip({ label, count, active, onClick, disabled, tone }: { label: string; count?: number; active: boolean; onClick: () => void; disabled?: boolean; tone?: ChipTone }) {
  return (
    <button type="button" className={'chip' + (active ? ' chip-on' : '') + (tone ? ' chip-tone-' + tone : '')} aria-pressed={active} onClick={onClick} disabled={disabled}>
      {label}{count != null ? <span className="chip-count"> {count}</span> : null}
    </button>
  );
}

export function Icon({ name }: { name: 'back' | 'settings' | 'share' | 'plus' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'back') return <svg {...common}><path d="M15 6 9 12l6 6" /></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3V20.5M4.9 6.6l1.6 1.6M17.5 15.8l1.6 1.6M3.5 12h2.2M18.3 12H20.5M4.9 17.4l1.6-1.6M17.5 8.2l1.6-1.6" /></svg>;
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  return <svg {...common}><circle cx="18" cy="5" r="2.2" /><circle cx="6" cy="12" r="2.2" /><circle cx="18" cy="19" r="2.2" /><path d="m8 11 8-5M8 13l8 5" /></svg>;
}

export function Btn({ label, onClick, primary, danger, disabled, block, type = 'button', icon }: { label: string; onClick?: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; block?: boolean; type?: 'button' | 'submit'; icon?: 'back' | 'settings' | 'share' | 'plus' }) {
  return (
    <button type={type} className={['btn', primary ? 'btn-primary' : '', danger ? 'btn-danger' : '', block ? 'btn-block' : '', icon ? 'btn-icon' : ''].join(' ').trim()} onClick={onClick} disabled={disabled}>
      {icon ? <Icon name={icon} /> : null}<span>{label}</span>
    </button>
  );
}

/** 書籤標記。圖示與主畫面字標共用，不含文字，方便縮成 PWA 圖示。 */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="currentColor" />
      <path d="M16.5 11.5h15v23.2l-7.5-4.7-7.5 4.7V11.5z" fill="#F6F1EA" />
      <path d="M24 16.2l1.05 2.2 2.4.32-1.76 1.66.44 2.38L24 21.6l-2.13 1.16.44-2.38-1.76-1.66 2.4-.32L24 16.2z" fill="#C4A574" />
    </svg>
  );
}

export function EmptyMark() {
  return (
    <svg className="empty-mark" viewBox="0 0 160 120" aria-hidden="true">
      <rect x="46" y="18" width="68" height="86" rx="16" fill="currentColor" opacity="0.08" />
      <path d="M62 28h36v62l-18-11-18 11V28z" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M80 40.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L80 48.8l-3.2 1.6.6-3.6-2.6-2.5 3.6-.5 1.6-3.3z" fill="currentColor" opacity="0.55" />
    </svg>
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
  const tone = source === 'Instagram' ? 'ig' : source === 'Threads' ? 'threads' : 'x';
  return <Tag tone={tone}><span className={'badge-dot dot-' + tone} aria-hidden="true" />{source}</Tag>;
}

export function categoryTone(c: Category | ''): ChipTone {
  if (c === '吃') return 'eat';
  if (c === '喝') return 'drink';
  if (c === '玩') return 'play';
  if (c === '想 follow 學習') return 'learn';
  if (c === '合作機會') return 'collab';
  if (c === '好構想') return 'idea';
  if (c === '生活技巧') return 'life';
  return 'fun';
}

function catClass(c: Category | ''): string {
  return categoryTone(c);
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
