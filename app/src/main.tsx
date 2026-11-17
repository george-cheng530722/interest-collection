import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { openBestStore, requestPersistence } from './lib/storage';
import { registerServiceWorker } from './sw-register';
import './styles.css';

/** 捷徑或分享以 ?url=…／?text=… 打開時，取出要加入的文字 */
function sharedFromLocation(): string | undefined {
  try {
    const q = new URLSearchParams(location.search);
    const v = [q.get('url'), q.get('text'), q.get('title')].filter(Boolean).join(' ').trim();
    if (v) history.replaceState(null, '', location.pathname + location.hash);
    return v || undefined;
  } catch { return undefined; }
}

(async () => {
  const store = await openBestStore();
  void requestPersistence();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App store={store} initialShared={sharedFromLocation()} />
    </StrictMode>,
  );
  registerServiceWorker();
})();
