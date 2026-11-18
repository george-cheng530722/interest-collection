import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Category, Item, Settings, Source } from '../lib/types';
import { thumbLabel } from '../lib/thumbs';
import { CITIES, isKnownCity } from '../lib/constants';
import { distanceKm, formatDistance, mapsNavigateUrl, mapsSearchUrl } from '../lib/geo';
import { telHref } from '../lib/phone';

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

/** 金色皇冠。主畫面用大一點的漸層，PWA 圖示是同一造型。 */
export function BrandMark({ size = 48 }: { size?: number }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFF6D4" />
          <stop offset="0.38" stopColor="#F0D078" />
          <stop offset="0.72" stopColor="#C6A04A" />
          <stop offset="1" stopColor="#8C6418" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gid})`} d="M10 44 16 20l12 14L32 8l4 26 12-14 6 24z" />
      <rect x="8" y="44" width="48" height="9" rx="2.5" fill={`url(#${gid})`} />
      <circle cx="16" cy="18" r="3.2" fill="#FFF8E6" />
      <circle cx="32" cy="10" r="3.4" fill="#FFF8E6" />
      <circle cx="48" cy="18" r="3.2" fill="#FFF8E6" />
    </svg>
  );
}

/** 有店名或地址才出現導航。有電話就顯示撥打；沒有電話但有店名或地址時，給一個查電話的地圖搜尋。 */
export function PlaceNav({ item, home }: { item: Item; home?: Pick<Settings, 'homeAddress' | 'homeLat' | 'homeLng'> }) {
  const address = item.address?.trim() || '';
  const place = item.placeName?.trim() || '';
  const phone = item.phone?.trim() || '';
  const dest = address || place;
  const call = phone ? telHref(phone) : '';
  const lookup = !call && (place || address) ? mapsSearchUrl([place, address].filter(Boolean).join(' ')) : '';
  if (!dest && !call && !lookup) return null;
  const origin = home?.homeAddress?.trim() || '';
  const located = item.geoState === 'ok' && item.lat != null && item.lng != null;
  const km = located && home?.homeLat != null && home.homeLng != null ? distanceKm({ lat: home.homeLat, lng: home.homeLng }, { lat: item.lat!, lng: item.lng! }) : null;
  const href = dest ? (located && origin ? mapsNavigateUrl(origin, dest) : mapsSearchUrl(dest)) : '';
  return (
    <div className="place-nav">
      {address ? <div className="small" data-testid="item-address">{address}</div> : null}
      <div className="place-nav-row">
        {km != null ? <span className="distance" data-testid="item-distance">{formatDistance(km)}</span> : null}
        {href ? <a className="map-link" href={href} target="_blank" rel="noopener noreferrer" data-testid="item-nav" onClick={(e) => e.stopPropagation()}>{located ? '導航' : '在地圖上搜尋'}</a> : null}
        {call ? <span className="phone-text" data-testid="item-phone">{phone}</span> : null}
        {call ? <a className="call-link" href={call} data-testid="item-call" onClick={(e) => e.stopPropagation()}>撥打</a> : null}
        {lookup ? <a className="lookup-link" href={lookup} target="_blank" rel="noopener noreferrer" data-testid="item-lookup" onClick={(e) => e.stopPropagation()}>查電話</a> : null}
      </div>
    </div>
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

export function Field({ label, value, onChange, placeholder, multiline, required, inputMode, name }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; required?: boolean; inputMode?: 'url' | 'text' | 'tel'; name?: string }) {
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
