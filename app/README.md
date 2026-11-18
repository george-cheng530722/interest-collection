# George 的 興趣收藏（v1）

離線優先、單機、不需後端的手機網頁 App（PWA）。收藏 Instagram、Threads、X 貼文，每則必填地區，讀不到時用手動補充，可分享到 LINE、匯出文字／CSV，完成時留下 1–5 分評價。資料只存在這台裝置（IndexedDB），不需帳號、不同步、不上傳。

- 功能依據：`../v1/prototype-v1-2026-11-17.canvas.tsx`（雛形）
- 驗收規格：`../spec/features/*.feature`（每個「情境」都有同名自動化測試，`tests/unit/spec-coverage.test.ts` 會檢查）

> 網頁版由 GitHub Actions 發佈到 GitHub Pages；中繼資料代理是另外部署的 Cloudflare Worker（`https://interest-collection-proxy.george-cheng.workers.dev`），App 預設使用、可在設定關掉。

## iOS App（Capacitor，用自己的 Mac + Xcode + 免費 Apple ID 安裝）

同一份程式也可以包成 iPhone App（`ios/` 是 Capacitor 8 產生的 Xcode 專案，使用 Swift Package Manager，**不需要 CocoaPods**）。安裝步驟寫在專案根目錄的 **[`../INSTALL-MAC.md`](../INSTALL-MAC.md)**（壓縮包解壓後就在最上層）。

- 原生版在 iPhone 上用 `CapacitorHttp` 直接讀 IG／X／Threads 貼文頁的 og 標籤（不受 CORS 限制），讀不到才走公開 oEmbed → 代理（預設開啟，可關）→ 手動補充。Web／PWA 的抓取順序**完全不變**（`src/lib/fetchMeta.ts`、`src/lib/nativeHttp.ts`）。
- 自訂網址：`interestcollection://add?url=<貼文網址>`（可給「捷徑」使用）。
- 相關指令：`npm run cap:sync`（build + `cap sync ios`）、`npm run cap:open`（用 Xcode 打開，只能在 Mac 執行）、`npm run ios:icons`（重產 App 圖示）。

---

## 快速開始

需求：Node.js 20 以上（開發時用 Node 24 測過）。

```bash
cd app
npm install
npm run dev          # 開發伺服器 http://localhost:5173（只供開發，不是正式依賴）
npm run build        # 正式 PWA 靜態檔 → dist/（含 manifest、sw.js、圖示）
npm run preview      # 在 http://localhost:4173 預覽 dist/（localhost 也能註冊 Service Worker）
npm run build:single # 單一 HTML → dist-single/george-interest-collection.html
npm test             # Vitest：單元 + BDD 情境（jsdom，無代理、無網路）
npm run test:e2e     # 先 build 兩種版本，再用 Playwright + 本機 Google Chrome 跑 e2e
npm run check:links  # 驗證三個真實網址的伺服器端／瀏覽器端可讀性 → /tmp/interest-app-link-fetch.txt
npm run proxy        # （可選）在本機啟動中繼資料代理 http://localhost:8787（開發用；App 預設用已部署的 Worker）
```

| script | 用途 |
| --- | --- |
| `dev` | Vite 開發伺服器（不註冊 Service Worker） |
| `build` | 型別檢查 + 產出 `dist/`（PWA） |
| `build:single` | 型別檢查 + 產出 `dist-single/george-interest-collection.html`（CSS/JS 全內嵌） |
| `preview` | 預覽 `dist/` |
| `test` | Vitest 單元與 BDD 情境測試 |
| `test:e2e` | Playwright e2e（真的 Service Worker 離線、IndexedDB 重整、file:// 單檔、真實網路 X oEmbed）。沒有網路時可設 `E2E_NETWORK=0` 跳過網路那一條 |
| `test:all` | 以上兩者 |

Playwright 使用 `channel: 'chrome'`（系統已安裝的 Google Chrome），不另外下載瀏覽器。若機器沒有 Chrome，可改 `npx playwright install chromium` 並把 `playwright.config.ts` 的 `channel` 拿掉。

## 技術選擇與理由

- **Vite + TypeScript + React 19**：雛形本身是 React/TSX，畫面與狀態可以幾乎一對一搬過來；Vite 打包快、輸出純靜態檔，沒有伺服器執行期。
- **手寫 Service Worker（build 時由 `vite.config.ts` 的小外掛產生 `dist/sw.js`）**：而不是 Workbox / vite-plugin-pwa。需求很單純（預先快取殼層、離線開啟），手寫約 50 行、零相依、行為一目了然。快取名稱是代次加內容雜湊（這次把代次加到 2），新版上線會清掉舊的 `gic-shell-` 快取，已安裝的 PWA 才會換到新殼層；只攔截同源 GET，跨網域的 oEmbed、Instagram、X、Threads 與代理一律不攔截、不快取。
- **IndexedDB（自己包一層，無套件）→ localStorage → 記憶體** 三段降級（`src/lib/storage.ts`）。截圖縮成最長邊 640px 的 JPEG data URL 再存，避免撐爆容量；寫入遇到 `QuotaExceededError` 會在畫面顯示「儲存空間不足」，不會丟掉既有資料。啟動時呼叫 `navigator.storage.persist()` 請求持久儲存。
- **vite-plugin-singlefile**：產出單一 HTML（CSS/JS 內嵌），方便拷到 iPhone「檔案」App。
- **Vitest + Testing Library + fake-indexeddb**：在 jsdom 跑 BDD 情境；**Playwright**：在真的 Chrome 驗證 Service Worker 離線殼層與 file:// 單檔。

### 執行期相依套件
`react`、`react-dom`。其他都是開發相依：`vite`、`@vitejs/plugin-react`、`vite-plugin-singlefile`、`typescript`、`vitest`、`jsdom`、`@testing-library/react`、`@testing-library/user-event`、`@testing-library/jest-dom`、`fake-indexeddb`、`@playwright/test`、`@types/*`。
（`package.json` 有 `overrides.csstype = 3.1.3`：安裝當天 npm registry 上 `csstype@3.2.4` 的 tarball 回 404，只是型別套件，鎖舊版不影響執行。）

## 目錄結構

```
app/
├─ index.html                 # 入口（含 manifest、apple-touch-icon；單檔版會移除這些連結）
├─ public/manifest.webmanifest, public/icons/*.png   # PWA 設定與圖示（scripts/make-icons.mjs 產生）
├─ src/
│  ├─ main.tsx                # 開啟本機儲存、讀 ?url=、註冊 Service Worker
│  ├─ App.tsx                 # 狀態與流程（加入、手動補充、評價、刪除、縮圖自動更新、失效詢問）
│  ├─ sw-register.ts          # 只在正式 build + https/localhost 註冊 SW
│  ├─ components/             # ListView、Detail、各種表單 sheet、UI 元件
│  └─ lib/
│     ├─ parse.ts             # 來源辨識、帳號解析、LINE 分享文字取網址、地區／分類推斷
│     ├─ fetchMeta.ts         # 抓取流程：直接 fetch → 公開 oEmbed → 代理（預設開啟，可關）
│     ├─ og.ts                # og 標籤解析與各平台標題整理
│     ├─ share.ts             # LINE 分享網址、分享文字、匯出文字／CSV、複製、下載
│     ├─ storage.ts           # IndexedDB / localStorage / 記憶體、清掉舊版示範資料、設定
│     ├─ thumbs.ts            # 縮圖過期判斷與真的重新抓取
│     └─ image.ts             # 截圖縮小
├─ proxy/server.mjs           # 本機版中繼資料代理（開發用，零相依；正式預設是 Cloudflare Worker）
├─ scripts/link-fetch-check.mjs  # 真實網址可讀性驗證
├─ tests/unit/*.test.ts       # 單元測試 + 規格覆蓋檢查
├─ tests/features/*.test.tsx  # 對應 7 個 .feature 的 BDD 情境
└─ tests/e2e/*.spec.ts        # Playwright：PWA 離線、持久化、單檔、真實網路
```

## 產出單一 HTML

```bash
npm run build:single
# → dist-single/george-interest-collection.html（約 280 KB，CSS/JS 全內嵌）
```

把這個檔案用 AirDrop／iCloud Drive 放進 iPhone「檔案」App，點開即可用 Safari（或檔案 App 的預覽）開啟。單檔版不註冊 Service Worker、不連 manifest。儲存會先試 IndexedDB，打不開就降級 localStorage，再不行就用記憶體並在畫面頂端顯示紅色警告「重整後資料會消失」；「設定」裡可以看到目前用的是哪一種。**請把單檔版當成試用／展示，不要當成資料的正式家**（見下方 iOS 行為）。

## 第一次把 PWA 加到 iPhone 主畫面（需要一次 https）

iOS 只在 https 網址上提供完整 PWA（Service Worker 離線快取 + 加到主畫面獨立顯示）。`dist/` 是純靜態檔，不需要任何伺服器程式，任何靜態託管都可以。最小、免費的選項（**本專案沒有替你做，只列出**）：

1. **用既有 GitHub 帳號開 GitHub Pages**：把 `dist/` 內容推到某個 repo 的 `gh-pages` 分支（或用 Pages 的 Actions），網址形如 `https://<帳號>.github.io/<repo>/`。本 App 的 `base` 是 `./`，放在子路徑也能運作。
2. **Cloudflare Pages** 或 **Netlify**：上傳 `dist/` 資料夾（拖放即可），只需靜態檔。

之後在 iPhone：

1. 用 **Safari** 打開那個 https 網址，等畫面出現（此時 Service Worker 會把殼層快取起來）。
2. 點「分享」→「加入主畫面」→「新增」。
3. 從主畫面圖示打開一次（獨立顯示）。之後**沒有網路也能打開**、看收藏、改備註／狀態、刪除、用手動補充新增。

注意：Safari 分頁裡的資料和「主畫面 App」的資料是**分開的兩份**儲存空間（iOS 的行為）。請固定從主畫面圖示使用。

### 搭配「捷徑」（輔助，非必要）
App 支援 `?url=` 或 `?text=` 參數：開啟時會自動把內容帶進加入流程（也能從 LINE 分享文字裡找出網址）。可以在「捷徑」App 建一個接收分享表（URL／文字）的捷徑，動作是「打開 URL：`https://你的網址/?url=[捷徑輸入]`」。這只是方便從分享表丟網址進來；**不能取代第一次的 https 安裝**，而且依 iOS 版本，捷徑打開的可能是 Safari 分頁而不是主畫面 App（兩者資料分開）。最穩的做法仍是：在 IG／X／Threads 複製連結 → 打開主畫面 App → 貼上。

## 可選中繼資料代理（外掛）怎麼開關

- 程式：`proxy/server.mjs`（零相依，說明見 `proxy/README.md`）。**可關、非正式必要**；不用它，App 一樣完整可用（讀不到就走手動補充）。
- 預設代理：已部署的 Cloudflare Worker `https://interest-collection-proxy.george-cheng.workers.dev`（`/meta?url=…`）。
- 本機開發版：`npm run proxy` → `http://localhost:8787/meta?url=…`。停止：Ctrl+C。
- App 端：右上「設定」→「中繼資料代理（外掛）」開關，以及代理網址。**預設開啟**，而且只在「直接抓取」與「公開 oEmbed」都拿不到資料後才問代理；**關掉後 App 不會向代理送出任何請求**（有測試驗證）。
- 舊設定遷移：如果裝置上存的代理網址是空白或 `localhost`／`127.0.0.1`（舊版預設），開啟時會改成 Worker 網址並打開代理，然後寫回；使用者自己填的其他網址與開關不會被動到。
- 限制：iPhone 上的 https PWA 不能呼叫 `http://localhost`（那是手機自己，且會被混合內容擋下），所以手機上用的是 https 的 Worker。代理只允許 IG／Threads／X 網域。私人或限制年齡的貼文代理也讀不到，仍走手動補充。

## 資料與功能說明

- 全新開啟是空的，畫面上會請你貼上 Instagram、X 或 Threads 的連結。舊版寫進這台裝置的示範資料（已知 id 或網址，例如河岸散策、隱藏台北小吃）會在開啟時刪掉；你自己加的收藏會留下，之後也不會再寫入範例。
- 地區必填，用下拉選單選：台北、新北、桃竹、台中、台南、高雄、宜蘭、其他（清單篩選也用同一組）。無法判斷時預設「其他」；確認畫面與手動補充可改回「請選擇」，此時「加入」按鈕會停用。舊資料的「台北市／新北市／桃園市／台中市／台南市／高雄市」開啟時轉成新名稱並寫回；其他自訂值（例如「花蓮」）原樣保留，在詳情的下拉選單與地區篩選裡都看得到、選得到。
- 分享到 LINE 用官方網址 `https://line.me/R/share?text=…`（文字含名稱、地區、連結；單則另附 `https://social-plugins.line.me/lineit/share?url=…` 只分享連結）。也可複製或用系統分享。
- 匯出：目前畫面或全部收藏；純文字或 CSV（欄位：清單、名稱、地區、連結；CSV 加 UTF-8 BOM）；可複製或下載。
- 縮圖過期：Instagram CDN 網址的 `oe=` 參數是到期時間，到期或圖片載入失敗時會**自動**重新抓取（直接 → oEmbed → 代理[預設開啟]），顯示「縮圖已過期 → 正在更新… → 已更新」；失敗時保留既有縮圖網址或改顯示分類圖示，標記「更新失敗」，收藏本身不受影響，6 小時後下次開啟再試。
- 連結失效：X 的公開 oEmbed 回 404、Threads oEmbed 回 400/404、或直接抓到 404/410 時判定失效，詢問「先保留（留下『連結失效』標記）／刪除（再確認一次）」。詳情頁的「檢查連結與更新縮圖」會真的去檢查。縮圖過期仍會自動重抓，不需要另外的示範按鈕。

## iOS Safari 實際行為

以下依實作與已知平台限制整理，**不是保證**；實際行為會隨 iOS 版本改變。抓取結果是 2026-11-17 在 Linux 上用 Node 與 Playwright + Google Chrome 156 實測（詳見 `/tmp/interest-app-link-fetch.txt`），**沒有在真的 iPhone 上測過**；Safari 的 CORS 規則與 Chrome 相同，預期結果一致，但仍需真機確認。

- **Instagram／Threads 貼文頁直接 fetch：被 CORS 擋下**（沒有 `Access-Control-Allow-Origin`）。**X 貼文頁**在瀏覽器裡回 403、內容是空的。所以「直接讀 og 標籤」在手機上幾乎一定失敗，**無伺服器時的正式路徑是預填後的手動補充表單**（預填連結、來源、從網址解析的帳號）。
- 據實記錄的例外：**X 的公開 oEmbed 要打 `publish.x.com/oembed`**。`publish.twitter.com/oembed` 現在 301 到 `publish.x.com`；兩個回應都帶這個網站的 `Access-Control-Allow-Origin`，但 iOS Safari 對這種跨網域 CORS 重新導向會失敗（本機 Chrome 會跟著走完，所以單元測試以前看不出來）。App 先打 `publish.x.com`，連不上才退回 `publish.twitter.com`。從 X iOS App 分享的網址（`?s=46&t=…`、`twitter.com`、`mobile.twitter.com`、`/i/web/status/`）會先整理成 `https://x.com/…/status/{id}` 或 `https://x.com/i/status/{id}` 再問 oEmbed（`/i/web/status/` 直接問會 404）。能拿到作者與推文文字，但沒有縮圖；App 會用它帶到「確認地區後加入」畫面。**Threads 的 `graph.threads.net/v1.0/oembed` 也可從瀏覽器讀到（`ACAO: *`）**，但只回傳嵌入用 HTML，沒有作者、標題、縮圖，只能用來確認貼文存在／失效，所以 Threads 仍走手動補充。Instagram 的舊 oEmbed 端點被 CORS 擋、新版需要 Meta access token，前端不能用。這些端點隨時可能改變。Service Worker 不攔截、不快取這些跨網域請求。
- 伺服器端（curl／Node）三個網址都是 HTTP 200 且有 og:title／og:description／og:image（Threads 會 301 轉到 threads.com）——這就是可選代理能補強的部分。
- **PWA「加到主畫面」第一次必須從 https 載入**；Service Worker 不能在 `file://` 註冊（只有 https 或 localhost）。
- **從「檔案」打開單檔 HTML**：通常可以操作介面；不能當成完整離線 PWA（沒有 Service Worker、通常也不能加到主畫面成為獨立 App）；Safari 對 `file://` 的 localStorage／IndexedDB 行為不穩定（可能無法使用、可能和其他檔案共用、可能被清掉）。App 會自動降級並在畫面顯示警告。
- **Shortcuts（捷徑）只能當輔助**（例如分享表把網址以 `?url=` 打開），不能取代第一次 https 安裝，也不是完整 App 的家。
- iOS 可能在長期未使用時清除網站資料（Safari 的 7 天規則對「加到主畫面」的 App 通常不適用，但仍屬平台政策）；`navigator.storage.persist()` 只是請求。重要清單請定期用「匯出」備份。
- Web Share Target（manifest 的 `share_target`）iOS 不支援，只在 Android Chrome 有作用；所以 iPhone 的分享表看不到本 App。
- LINE 分享網址會開 LINE App（有安裝時）或 LINE 網頁；在獨立顯示模式下會跳出到 Safari／LINE。下載匯出檔在 iOS 會出現預覽或存到「檔案」。

## 已知缺口（v1）

- 沒有在真的 iPhone 上驗證（CORS 結果來自 Chrome；Safari 預期相同）。
- Instagram／Threads 在代理關掉（或代理也讀不到）時拿不到標題與縮圖，只能手動補充；X 透過 oEmbed 拿得到文字但沒有縮圖。
- 沒有 JSON 備份／還原（只有文字／CSV 匯出）；換手機無法搬資料。
- 地區選項固定為台北、新北、桃竹、台中、台南、高雄、宜蘭、其他（舊資料或自訂值會保留）；分類一則只能一個。
- 代理預設開啟（Cloudflare Worker），讀不到時貼文網址會送到 Worker；不想送出可在「設定」關掉。私人貼文代理也讀不到。
