import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Item, Settings } from './lib/types';
import { DEFAULT_SETTINGS } from './lib/types';
import { DEFAULT_CITY, defaultEmoji } from './lib/constants';
import { classify, extractPostUrl, inferCity, isLikelyUnreadable, parseUrlMeta, sameUrl, thumbExpiryFromUrl } from './lib/parse';
import { extractPlaceName, shortSummary } from './lib/place';
import { failMessage, fetchPostMeta, type FailReason } from './lib/fetchMeta';
import { isThumbExpired, refreshThumb } from './lib/thumbs';
import { loadSettings, migrateLegacyCities, migratePlaceAndSummary, removeStoredDemoItems, saveSettings, storageEstimate, StorageFullError, type Store } from './lib/storage';
import { shareItemText, shareListText } from './lib/share';
import { applyFilters, ListView, type Filters } from './components/ListView';
import { Detail } from './components/Detail';
import { ConfirmAddSheet, DeadLinkSheet, DeleteSheet, DuplicateSheet, ExportSheet, ManualSheet, ReviewSheet, SettingsSheet, ShareSheet } from './components/sheets';
import { BrandMark } from './components/ui';

export interface AppProps {
  store: Store;
  /** 測試時可注入；正式環境使用瀏覽器的 fetch */
  fetchImpl?: typeof fetch;
  /** 從 ?url= 或 ?text=（捷徑、分享）帶進來的文字 */
  initialShared?: string;
}

const RETRY_FAILED_THUMB_MS = 6 * 3600 * 1000;

function newId(): string {
  return 'i-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function blankItem(url: string, p: Partial<Item>): Item {
  const now = Date.now();
  const { source, handle } = parseUrlMeta(url);
  return {
    id: newId(), source: source ?? 'Instagram', url, handle, name: '', placeName: '', caption: '', summary: '', category: '', city: DEFAULT_CITY,
    status: '想體驗', memo: '', rating: 0, review: '', manual: false, linkDead: false, thumbState: 'ok',
    emoji: '✨', createdAt: now, updatedAt: now, fetchedVia: 'manual', ...p,
  };
}

export default function App({ store, fetchImpl, initialShared }: AppProps) {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const [storageWarning, setStorageWarning] = useState('');
  const [usage, setUsage] = useState('');

  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({ tab: '想體驗', source: '全部', category: '全部', city: '全部' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Item | null>(null);
  const [manual, setManual] = useState<{ draft: Item; reason: FailReason } | null>(null);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [deadFor, setDeadFor] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [share, setShare] = useState<{ title: string; text: string; url?: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState('');
  const [dupPrompt, setDupPrompt] = useState<{ item: Item; onOpen: () => void; onCancel: () => void; onSaveAnyway: () => void } | null>(null);
  const attempted = useRef(new Set<string>());
  const sharedHandled = useRef(false);
  const dupBypass = useRef<string | null>(null);
  const addRef = useRef<(raw?: string) => Promise<void>>(async () => undefined);

  const fetchDeps = useCallback(() => ({ fetchImpl, settings: settingsRef.current, online: navigator.onLine !== false }), [fetchImpl]);

  const reportStorageError = useCallback((e: unknown) => {
    setStorageWarning(e instanceof StorageFullError ? '裝置儲存空間不足，這次變更可能沒有存好。請刪除一些含截圖的收藏後再試。' : '寫入本機儲存失敗，這次變更可能沒有存好。');
  }, []);

  // ---- 載入 ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await removeStoredDemoItems(store);
        await migrateLegacyCities(store);
        await migratePlaceAndSummary(store);
        const [all, s] = await Promise.all([store.getItems(), loadSettings(store)]);
        const now = Date.now();
        // 上次中斷的更新、或很久以前失敗的縮圖，這次開啟時再自動試一次
        const fixed = all.map((it) => it.thumbState === 'refreshing' || (it.thumbState === 'failed' && (it.thumbCheckedAt ?? 0) < now - RETRY_FAILED_THUMB_MS) ? { ...it, thumbState: 'expired' as const } : it.thumbState === 'fresh' ? { ...it, thumbState: 'ok' as const } : it);
        if (!alive) return;
        setItems(fixed);
        setSettings(s);
      } catch (e) {
        reportStorageError(e);
      }
      if (store.kind === 'memory') setStorageWarning('此環境無法使用本機儲存（常見於從「檔案」打開的單檔 HTML），關閉或重整後資料會消失。');
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [store, reportStorageError]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [openId]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);

  // ---- 寫入 ----
  const persist = useCallback(async (item: Item) => {
    try { await store.putItem(item); } catch (e) { reportStorageError(e); }
  }, [store, reportStorageError]);

  const patchItem = useCallback((id: string, patch: Partial<Item>) => {
    const cur = itemsRef.current.find((x) => x.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    itemsRef.current = itemsRef.current.map((x) => (x.id === id ? next : x));
    setItems(itemsRef.current);
    void persist(next);
  }, [persist]);

  const insertItem = useCallback((created: Item) => {
    itemsRef.current = [created, ...itemsRef.current];
    setItems(itemsRef.current);
    void persist(created);
    setJustAddedId(created.id);
    setOpenId(created.id);
    setFilters({ tab: '想體驗', source: '全部', category: '全部', city: '全部' });
    dupBypass.current = null;
    setToast('已加入收藏');
  }, [persist]);

  const askDuplicate = useCallback((url: string, resume: () => void) => {
    if (dupBypass.current && sameUrl(dupBypass.current, url)) return false;
    const existing = itemsRef.current.find((x) => sameUrl(x.url, url));
    if (!existing) return false;
    setToast('');
    setDupPrompt({
      item: existing,
      onOpen: () => {
        dupBypass.current = null;
        setDupPrompt(null);
        setPending(null);
        setManual(null);
        setInput('');
        setOpenId(existing.id);
      },
      onCancel: () => setDupPrompt(null),
      onSaveAnyway: () => {
        dupBypass.current = url;
        setDupPrompt(null);
        resume();
      },
    });
    return true;
  }, []);

  const removeItem = useCallback(async (id: string) => {
    itemsRef.current = itemsRef.current.filter((x) => x.id !== id);
    setItems(itemsRef.current);
    if (openId === id) setOpenId(null);
    try { await store.deleteItem(id); } catch (e) { reportStorageError(e); }
  }, [store, openId, reportStorageError]);

  // ---- 縮圖過期：自動更新（真的重新抓取） ----
  const runRefresh = useCallback(async (id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (!it) return;
    patchItem(id, { thumbState: 'refreshing' });
    const out = await refreshThumb(it, fetchDeps());
    if (!itemsRef.current.some((x) => x.id === id)) return;
    patchItem(id, out.patch);
    if (out.kind === 'dead') setDeadFor((cur) => cur ?? id);
  }, [fetchDeps, patchItem]);

  useEffect(() => {
    if (!loaded) return;
    const now = Date.now();
    for (const it of items) {
      if (isThumbExpired(it, now) && !attempted.current.has(it.id)) {
        attempted.current.add(it.id);
        void runRefresh(it.id);
      }
    }
  }, [items, loaded, runRefresh]);

  const onThumbBroken = useCallback((id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (it && it.thumbState === 'ok' && !attempted.current.has(id)) patchItem(id, { thumbState: 'expired' });
  }, [patchItem]);

  // ---- 加入流程 ----
  const openManual = useCallback((url: string, reason: FailReason) => {
    const category = classify(url);
    setManual({ reason, draft: blankItem(url, { manual: true, fetchedVia: 'manual', category, emoji: defaultEmoji(category), city: DEFAULT_CITY }) });
  }, []);

  const add = useCallback(async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text) { setNotice('請先貼上 Instagram、X 或 Threads 的連結。'); return; }
    const url = extractPostUrl(text);
    if (!url) { setNotice('目前支援 Instagram、X 與 Threads 的貼文連結。'); return; }
    if (askDuplicate(url, () => { void addRef.current(text); })) return;
    setNotice('');
    setInput(url);
    if (isLikelyUnreadable(url)) { setInput(''); openManual(url, 'private'); return; }
    setLoading(true);
    let res;
    try { res = await fetchPostMeta(url, fetchDeps()); } finally { setLoading(false); }
    setInput('');
    if (res.ok) {
      const m = res.meta;
      const caption = m.caption;
      const basis = `${m.name} ${caption}`;
      const category = classify(basis);
      setPending(blankItem(url, {
        name: m.name, placeName: extractPlaceName(m.name, caption), caption, summary: shortSummary(caption),
        handle: m.handle || parseUrlMeta(url).handle, category, city: inferCity(basis),
        emoji: defaultEmoji(category), thumbUrl: m.image, thumbExpiresAt: thumbExpiryFromUrl(m.image), fetchedVia: res.via,
      }));
    } else {
      openManual(url, res.reason);
    }
  }, [input, fetchDeps, openManual, askDuplicate]);

  addRef.current = add;

  // 從捷徑／分享帶 ?url= 進來時，自動走同一套加入流程
  useEffect(() => {
    if (!loaded || sharedHandled.current || !initialShared) return;
    sharedHandled.current = true;
    setInput(initialShared);
    void add(initialShared);
  }, [loaded, initialShared, add]);

  // ---- 衍生資料 ----
  const visible = useMemo(() => applyFilters(items, filters), [items, filters]);
  const openItem = items.find((x) => x.id === openId) ?? null;
  const byId = (id: string | null) => (id ? items.find((x) => x.id === id) ?? null : null);
  const deleteItem = byId(deleteFor);
  const deadItem = byId(deadFor);
  const reviewItem = byId(reviewFor);
  const listName = [filters.tab, filters.source !== '全部' ? filters.source : '', filters.category !== '全部' ? filters.category : '', filters.city !== '全部' ? filters.city : ''].filter(Boolean).join('・');

  const checkLink = async (it: Item) => {
    setChecking(true);
    try {
      const res = await fetchPostMeta(it.url, fetchDeps());
      if (res.ok) {
        const patch: Partial<Item> = { linkDead: false };
        if (res.meta.image && res.meta.image !== it.thumbUrl) Object.assign(patch, { thumbUrl: res.meta.image, thumbExpiresAt: thumbExpiryFromUrl(res.meta.image), thumbState: 'fresh', thumbCheckedAt: Date.now() });
        patchItem(it.id, patch);
        setToast(patch.thumbUrl ? '連結正常，縮圖已更新。' : '連結正常。');
      } else if (res.reason === 'dead') {
        patchItem(it.id, { linkDead: true });
        setDeadFor(it.id);
      } else {
        setToast('無法確認連結狀態：' + failMessage(res.reason));
      }
    } finally { setChecking(false); }
  };

  const openSettings = async () => {
    setSettingsOpen(true);
    const e = await storageEstimate();
    setUsage(e && e.quota ? `已用約 ${(e.usage / 1024 / 1024).toFixed(1)} MB／可用約 ${(e.quota / 1024 / 1024).toFixed(0)} MB` : '');
  };

  if (!loaded) return <div className="screen center-col loading-screen"><BrandMark /><p className="muted">載入中…</p></div>;

  return (
    <div className="app">
      {openItem ? (
        <Detail
          key={openItem.id}
          item={openItem}
          justAdded={justAddedId === openItem.id}
          checking={checking}
          actions={{
            back: () => { setFilters((f) => ({ ...f, tab: openItem.status })); setOpenId(null); },
            patch: (p) => patchItem(openItem.id, p),
            share: () => setShare({ title: '分享給 LINE 好友', text: shareItemText(openItem), url: openItem.url }),
            markDone: () => setReviewFor(openItem.id),
            moveBack: () => patchItem(openItem.id, { status: '想體驗' }),
            askDelete: () => setDeleteFor(openItem.id),
            checkLink: () => void checkLink(openItem),
            thumbBroken: () => onThumbBroken(openItem.id),
          }}
        />
      ) : (
        <ListView
          items={items} visible={visible} filters={filters} setFilters={setFilters}
          input={input} setInput={setInput} loading={loading} notice={notice} online={online} storageWarning={storageWarning}
          onAdd={() => void add()}
          onShareList={() => setShare({ title: '分享清單給 LINE 好友', text: shareListText(listName, visible) })}
          onExport={() => setExportOpen(true)} onSettings={() => void openSettings()}
          onOpen={(id) => setOpenId(id)} onShareItem={(it) => setShare({ title: '分享給 LINE 好友', text: shareItemText(it), url: it.url })}
          onThumbBroken={onThumbBroken}
        />
      )}

      {pending ? <ConfirmAddSheet draft={pending} onChange={(p) => setPending((d) => (d ? { ...d, ...p } : d))} onCancel={() => { dupBypass.current = null; setPending(null); }} onConfirm={() => {
        if (!pending.city || !pending.category) return;
        const save = () => {
          insertItem({ ...pending, placeName: pending.placeName.trim(), summary: pending.summary || shortSummary(pending.caption), createdAt: Date.now(), updatedAt: Date.now() });
          setPending(null);
        };
        if (askDuplicate(pending.url, save)) return;
        save();
      }} /> : null}

      {manual ? <ManualSheet draft={manual.draft} reason={manual.reason} onChange={(p) => setManual((m) => (m ? { ...m, draft: { ...m.draft, ...p } } : m))} onCancel={() => { dupBypass.current = null; setManual(null); }} onSave={() => {
        const d = manual.draft;
        if (!d.name.trim() || !d.handle.trim() || !d.category || !d.city) return;
        const save = () => {
          const caption = d.caption.trim();
          insertItem({ ...d, name: d.name.trim(), placeName: d.placeName.trim(), caption, summary: shortSummary(caption), handle: d.handle.replace(/^@/, '').trim(), manual: true, fetchedVia: 'manual', linkDead: manual.reason === 'dead', createdAt: Date.now(), updatedAt: Date.now() });
          setManual(null);
        };
        if (askDuplicate(d.url, save)) return;
        save();
      }} /> : null}

      {reviewItem ? <ReviewSheet item={reviewItem} onCancel={() => setReviewFor(null)} onConfirm={(rating, review) => {
        patchItem(reviewItem.id, { status: '已完成', rating, review });
        setReviewFor(null);
        setFilters((f) => ({ ...f, tab: '已完成' }));
      }} /> : null}

      {deadItem && !deleteFor ? <DeadLinkSheet item={deadItem} onKeep={() => { patchItem(deadItem.id, { linkDead: true }); setDeadFor(null); }} onDelete={() => { setDeleteFor(deadItem.id); setDeadFor(null); }} /> : null}
      {deleteItem ? <DeleteSheet item={deleteItem} onCancel={() => setDeleteFor(null)} onConfirm={() => { const id = deleteItem.id; setDeleteFor(null); setDeadFor(null); void removeItem(id); setToast('已刪除'); }} /> : null}

      {share ? <ShareSheet title={share.title} text={share.text} singleUrl={share.url} onClose={() => setShare(null)} /> : null}
      {exportOpen ? <ExportSheet visibleRows={visible} allRows={[...items].sort((a, b) => b.createdAt - a.createdAt)} listName={listName} onClose={() => setExportOpen(false)} /> : null}
      {settingsOpen ? <SettingsSheet settings={settings} storeKind={store.kind} usage={usage} onClose={() => setSettingsOpen(false)} onChange={(s) => { setSettings(s); settingsRef.current = s; void saveSettings(store, s).catch(reportStorageError); }} /> : null}

      {dupPrompt ? <DuplicateSheet item={dupPrompt.item} onOpen={dupPrompt.onOpen} onCancel={dupPrompt.onCancel} onSaveAnyway={dupPrompt.onSaveAnyway} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
