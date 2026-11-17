// 驗證三個真實網址：(1) Node 伺服器端（等同 curl）可讀性；(2) 真實瀏覽器（Playwright + 本機 Chrome）
// 從 http://127.0.0.1 頁面直接 fetch 是否被 CORS 擋下。結果寫到 /tmp/interest-app-link-fetch.txt
// 用法：node scripts/link-fetch-check.mjs [輸出路徑]
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const OUT = process.argv[2] || '/tmp/interest-app-link-fetch.txt';
const TARGETS = [
  'https://www.instagram.com/natgeo/p/DHrUZ11yOh0/',
  'https://x.com/jack/status/20',
  'https://www.threads.net/@natgeo/post/C7XSa54NOw1',
];
// App 也會嘗試的公開 oEmbed 端點（不需金鑰者）
const OEMBED = [
  'https://publish.x.com/oembed?omit_script=1&url=' + encodeURIComponent('https://x.com/jack/status/20'),
  'https://publish.twitter.com/oembed?omit_script=1&url=' + encodeURIComponent('https://x.com/jack/status/20'),
  'https://graph.threads.net/v1.0/oembed?url=' + encodeURIComponent('https://www.threads.net/@natgeo/post/C7XSa54NOw1'),
  'https://api.instagram.com/oembed/?url=' + encodeURIComponent('https://www.instagram.com/natgeo/p/DHrUZ11yOh0/'),
];
const UA_BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const UA_BOT = 'facebookexternalhit/1.1';

function og(html) {
  const pick = (p) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*>`, 'i');
    const m = html.match(re);
    if (!m) return '';
    const c = m[0].match(/content=["']([^"']*)["']/i);
    return c ? c[1].slice(0, 120) : '';
  };
  return { title: pick('og:title'), description: pick('og:description'), image: pick('og:image') ? '(有)' : '', site: pick('og:site_name') };
}

async function nodeFetch(url, ua) {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': ua, 'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8' }, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    return { status: r.status, finalUrl: r.url, acao: r.headers.get('access-control-allow-origin'), bytes: text.length, og: og(text), json: text.trim().startsWith('{') ? text.slice(0, 160) : '' };
  } catch (e) { return { error: String(e.cause?.code || e.message) }; }
}

function curl(url) {
  try {
    return execFileSync('curl', ['-s', '-o', '/dev/null', '-L', '-m', '20', '-A', UA_BROWSER, '-w', '%{http_code} %{url_effective}', url], { encoding: 'utf8' });
  } catch (e) { return 'curl 失敗：' + e.message; }
}

const lines = [];
const log = (s = '') => { lines.push(s); console.log(s); };
log('George 的 興趣收藏 — 真實連結抓取驗證');
log('執行時間：' + new Date().toISOString());
log('指令：cd app && npm run check:links   （= node scripts/link-fetch-check.mjs）');
log('');
log('== A. 伺服器端（Node fetch / curl，不受 CORS 限制）==');
for (const url of TARGETS) {
  log('URL: ' + url);
  log('  curl -L（iPhone Safari UA）：' + curl(url));
  for (const [name, ua] of [['iPhone Safari UA', UA_BROWSER], ['facebookexternalhit UA', UA_BOT]]) {
    const r = await nodeFetch(url, ua);
    if (r.error) { log(`  Node fetch（${name}）：錯誤 ${r.error}`); continue; }
    log(`  Node fetch（${name}）：HTTP ${r.status}，最終 URL ${r.finalUrl}，${r.bytes} bytes，Access-Control-Allow-Origin=${r.acao ?? '(無)'}`);
    log(`    og:title=${JSON.stringify(r.og.title)} og:description=${JSON.stringify(r.og.description)} og:image=${r.og.image || '(無)'}`);
  }
}
log('');
log('-- oEmbed 端點（伺服器端）--');
for (const url of OEMBED) {
  const r = await nodeFetch(url, UA_BROWSER);
  log(url);
  log(r.error ? `  錯誤 ${r.error}` : `  HTTP ${r.status}，ACAO=${r.acao ?? '(無)'}，內容開頭：${(r.json || '(非 JSON)').replace(/\s+/g, ' ')}`);
}

log('');
log('== B. 瀏覽器環境（Playwright + 本機 Google Chrome，頁面來源 http://127.0.0.1，直接 fetch）==');
const server = http.createServer((_q, s) => { s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end('<!doctype html><title>probe</title>'); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(origin);
  for (const url of [...TARGETS, ...OEMBED]) {
    consoleErrors.length = 0;
    const res = await page.evaluate(async (u) => {
      const out = {};
      try { const r = await fetch(u, { mode: 'cors' }); out.cors = `可讀 HTTP ${r.status}，${(await r.text()).length} bytes`; }
      catch (e) { out.cors = `被擋：${e.name}: ${e.message}`; }
      try { const r = await fetch(u, { mode: 'no-cors' }); out.noCors = `opaque 回應 type=${r.type} status=${r.status}（內容不可讀）`; }
      catch (e) { out.noCors = `失敗：${e.name}: ${e.message}`; }
      return out;
    }, url);
    log(url);
    log('  mode:cors    → ' + res.cors);
    log('  mode:no-cors → ' + res.noCors);
    const corsMsg = consoleErrors.find((m) => /CORS|Access-Control/i.test(m));
    if (corsMsg) log('  Chrome 主控台：' + corsMsg.slice(0, 220));
  }
} catch (e) {
  log('無法啟動瀏覽器：' + e.message);
} finally {
  await browser?.close();
  server.close();
}
log('');
log('== 結論 ==');
log('見 app/README.md「iOS Safari 實際行為」與 /tmp/interest-app-report.txt。上方 B 段若顯示「被擋：TypeError: Failed to fetch」即為 CORS 擋下（Chrome 主控台會印出 No \'Access-Control-Allow-Origin\'）。');
writeFileSync(OUT, lines.join('\n') + '\n');
console.log('\n已寫入 ' + OUT);
