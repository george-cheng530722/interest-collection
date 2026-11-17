/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { createHash } from 'node:crypto';
import { readdirSync, renameSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

function listPublic(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else out.push(relative(dir, p).split('\\').join('/')); });
  walk(dir);
  return out;
}

/**
 * 產生 Service Worker：把這次 build 的應用程式殼層（index.html、JS、CSS、manifest、圖示）全部預先快取。
 * 快取名稱帶內容雜湊，新版上線時舊快取會被清掉。只快取同源 GET；對 Instagram／X／Threads／代理的請求一律不碰。
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'gic-service-worker',
    enforce: 'post',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = [...Object.keys(bundle), ...listPublic('public')].filter((f) => !f.endsWith('.map') && f !== 'sw.js').sort();
      const hash = createHash('sha256');
      for (const f of Object.keys(bundle).sort()) {
        const b = bundle[f];
        hash.update(f);
        hash.update(b.type === 'chunk' ? b.code : typeof b.source === 'string' ? b.source : Buffer.from(b.source));
      }
      // 代次要手動加。內容雜湊會跟著檔案變，但已安裝的 PWA 需換掉快取名稱才會拿到新殼層。
      const SW_CACHE_GENERATION = 2;
      const version = SW_CACHE_GENERATION + '-' + hash.digest('hex').slice(0, 12);
      const precache = ['./', ...files.map((f) => './' + f)];
      const source = `/* George 的 興趣收藏 — Service Worker（build 時自動產生，請勿手改） */
const CACHE = 'gic-shell-${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gic-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try { url = new URL(req.url); } catch { return; }
  // 跨網域（oEmbed、Instagram、X、Threads、代理）一律不攔截、不快取。
  // 不要在 Service Worker 裡重送這些請求：iOS Safari 會把跨網域 301 的 CORS 讀取弄失敗。
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    // 殼層優先：有快取就立即開啟（離線可用），同時在背景更新 index.html
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('./index.html') || await cache.match('./');
      const network = fetch(req).then((res) => { if (res.ok) cache.put('./index.html', res.clone()); return res; }).catch(() => undefined);
      if (cached) { event.waitUntil(network); return cached; }
      return (await network) || new Response('離線中，且尚未快取應用程式。請先在有網路時開啟一次。', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: url.search === '' ? false : true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('', { status: 504 });
    }
  })());
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/** 單檔版：拿掉 manifest／圖示連結（file:// 讀不到外部檔），並把輸出改名 */
function singleFileHtml(): Plugin {
  const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23c2410c'/%3E%3Cpath d='M20 14h24v38l-12-9-12 9z' fill='%23faf7f2'/%3E%3C/svg%3E";
  return {
    name: 'gic-single-html',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/<!--pwa-head-->[\s\S]*?<!--\/pwa-head-->/, `<link rel="icon" href="${favicon}" />`);
    },
    closeBundle() {
      const from = join('dist-single', 'index.html');
      if (existsSync(from)) renameSync(from, join('dist-single', 'george-interest-collection.html'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    // GitHub Pages 專案網址：https://george-cheng530722.github.io/interest-collection/ ；單檔版維持相對路徑
    base: single ? './' : '/interest-collection/',
    plugins: [react(), ...(single ? [singleFileHtml(), viteSingleFile({ removeViteModuleLoader: true })] : [serviceWorkerPlugin()])],
    publicDir: single ? false : 'public',
    build: single
      ? { outDir: 'dist-single', emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false }
      : { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
    server: { port: 5173 },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.test.ts', 'tests/features/**/*.test.tsx', 'tests/unit/**/*.test.tsx'],
      testTimeout: 15000,
    },
  };
});
