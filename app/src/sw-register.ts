/**
 * 只在正式 build、且由 https（或 localhost）載入時註冊 Service Worker。
 * 單檔 HTML（file://）不能註冊 Service Worker，會直接略過。
 */
export function registerServiceWorker(): void {
  if (import.meta.env.MODE === 'single' || !import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('Service Worker 註冊失敗', e));
  });
  if (document.readyState === 'complete') navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined);
}
