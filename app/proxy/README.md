# 可選的中繼資料代理（外掛）

- **非正式必要**：App 不需要它就能完整使用（讀不到時走手動補充）。
- **App 預設開啟代理，指向已部署的 Cloudflare Worker** `https://interest-collection-proxy.george-cheng.workers.dev`（介面與這個本機版相同：`/meta?url=`）。只有裝置直接讀不到貼文時才會請求；使用者可在「設定 → 中繼資料代理（外掛）」關掉，關掉後不會送出任何請求。私人貼文代理也讀不到，仍走手動補充。
- 這個資料夾的 `server.mjs` 是**本機開發版**，方便在電腦上比較自動帶入的效果；舊設定若還指向 `localhost`／`127.0.0.1`，App 會自動改成 Worker 網址。
- 零相依（只用 Node 內建模組）。啟動：`npm run proxy` 或 `node proxy/server.mjs`（`PORT`、`HOST`、`ALLOW_ORIGIN` 可調）。
- 端點：`GET /meta?url=<Instagram/Threads/X 貼文網址>` → `{ status, finalUrl, title, description, image, siteName }`；`GET /geo?q=<地址或店名>` → `{ lat, lng }`（Nominatim，帶 User-Agent，快取一天；找不到就 404，不捏造）；`GET /health`。
- 已上線的 Worker 目前只有 `/meta`。距離要在手機上出現，需要把同樣的 `/geo` 部署到 `interest-collection-proxy`（本環境沒有 Cloudflare 登入，所以沒有重新部署）。
- 只允許 Instagram／Threads／X 網域，避免變成開放代理。這個 Node 版不必部署；正式用的是 Worker。
- iPhone 上的 PWA 是 https，不能呼叫 `http://localhost`（那是手機自己），也會被混合內容擋下，所以手機上用的是 https 的 Worker。
