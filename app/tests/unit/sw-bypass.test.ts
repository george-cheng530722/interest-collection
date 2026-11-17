// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
const fetchBlock = src.slice(src.indexOf("self.addEventListener('fetch'"));

describe('Service Worker', () => {
  it('跨網域請求在 respondWith 之前就 return，不快取', () => {
    const originCheck = fetchBlock.indexOf('url.origin !== self.location.origin');
    const respond = fetchBlock.indexOf('event.respondWith');
    expect(originCheck).toBeGreaterThan(-1);
    expect(respond).toBeGreaterThan(originCheck);
    expect(fetchBlock.slice(originCheck, originCheck + 80)).toContain('return');
    expect(fetchBlock.slice(originCheck, respond)).not.toContain('caches.');
  });

  it('快取代次已提高，已安裝的 PWA 會換掉舊殼層', () => {
    expect(src).toMatch(/SW_CACHE_GENERATION = 2/);
    expect(src).toContain("k.startsWith('gic-shell-')");
  });
});
