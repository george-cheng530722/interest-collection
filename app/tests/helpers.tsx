import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { vi } from 'vitest';
import App from '../src/App';
import { idbStore, openIdb, type Store } from '../src/lib/storage';
import type { Item } from '../src/lib/types';

export const IG_URL = 'https://www.instagram.com/natgeo/p/DHrUZ11yOh0/';
export const X_URL = 'https://x.com/jack/status/20';
export const THREADS_URL = 'https://www.threads.net/@natgeo/post/C7XSa54NOw1';

/** 一台「裝置」：同一個 IndexedDB，可以重複開啟（模擬重整） */
export function makeDevice() {
  const factory = new IDBFactory();
  return { factory, open: async (): Promise<Store> => idbStore(await openIdb(factory)) };
}

/** 模擬瀏覽器被 CORS 擋下：fetch 直接丟 TypeError（與 Chrome／Safari 的實際行為相同） */
export function corsBlockedFetch() {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => { throw new TypeError('Failed to fetch'); });
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
export function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

export function makeItem(p: Partial<Item> & Pick<Item, 'id' | 'name'>): Item {
  return {
    source: 'Instagram', url: `https://www.instagram.com/p/${p.id}/`, handle: 'tester', placeName: '', caption: '', summary: '', address: '', category: '吃', city: '台北',
    status: '想體驗', memo: '', rating: 0, review: '', manual: false, linkDead: false, thumbState: 'ok', emoji: '🍜',
    createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, fetchedVia: 'manual', ...p,
  };
}

/** 預先放入指定收藏 */
export async function preload(store: Store, items: Item[]) {
  for (const it of items) await store.putItem(it);
}

export async function renderApp(opts: { store: Store; fetchImpl?: typeof fetch; initialShared?: string }) {
  const user = userEvent.setup();
  const fetchImpl = opts.fetchImpl ?? corsBlockedFetch();
  const utils = render(<App store={opts.store} fetchImpl={fetchImpl as typeof fetch} initialShared={opts.initialShared} />);
  await screen.findByRole('heading', { name: "George's Picks" });
  return { user, fetchImpl, ...utils };
}

export const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });
export const cardNames = () => screen.queryAllByTestId('item-name').map((e) => e.textContent);
export { screen, waitFor, within };

export async function pasteAndAdd(user: ReturnType<typeof userEvent.setup>, text: string) {
  const box = screen.getByLabelText('貼上社群來源的連結');
  await user.clear(box);
  await user.click(box);
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: '加入' }));
}

export function calledUrls(fn: { mock: { calls: unknown[][] } }): string[] {
  return fn.mock.calls.map((c) => String(c[0]));
}
