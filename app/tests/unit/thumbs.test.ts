import { describe, expect, it, vi } from 'vitest';
import { isThumbExpired, refreshThumb } from '../../src/lib/thumbs';
import { DEFAULT_SETTINGS } from '../../src/lib/types';
import { makeItem } from '../helpers';

describe('縮圖過期判斷與更新', () => {
  it('依 oe= 到期時間或狀態判斷；截圖不會過期', () => {
    const now = 2_000_000_000_000;
    expect(isThumbExpired(makeItem({ id: 'a', name: 'a', thumbUrl: 'u', thumbExpiresAt: now - 1 }), now)).toBe(true);
    expect(isThumbExpired(makeItem({ id: 'a', name: 'a', thumbUrl: 'u', thumbExpiresAt: now + 1 }), now)).toBe(false);
    expect(isThumbExpired(makeItem({ id: 'a', name: 'a', thumbState: 'expired' }), now)).toBe(true);
    expect(isThumbExpired(makeItem({ id: 'a', name: 'a', thumbState: 'expired', screenshot: 'data:' }), now)).toBe(false);
  });
  it('更新失敗時保留既有縮圖網址', async () => {
    const it0 = makeItem({ id: 'a', name: 'a', thumbUrl: 'https://old', thumbState: 'expired' });
    const out = await refreshThumb(it0, { fetchImpl: vi.fn(async () => { throw new TypeError('x'); }) as unknown as typeof fetch, settings: DEFAULT_SETTINGS, online: true });
    expect(out.kind).toBe('failed');
    expect(out.patch).not.toHaveProperty('thumbUrl');
    expect(out.patch.thumbState).toBe('failed');
  });
});
