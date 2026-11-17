import { defineConfig } from '@playwright/test';

// e2e 跑在正式 build（dist/ 與 dist-single/）上：`npm run test:e2e` 會先 build。
// 使用本機安裝的 Google Chrome（channel: 'chrome'），不另外下載瀏覽器。
// PW_BASE_URL 可指向線上網址（例如 GitHub Pages），此時不啟動本機 preview。
const live = process.env.PW_BASE_URL;
const baseURL = live || 'http://localhost:4173/interest-collection/';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: 'zh-TW',
    serviceWorkers: 'allow',
  },
  webServer: live ? undefined : {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/interest-collection/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
