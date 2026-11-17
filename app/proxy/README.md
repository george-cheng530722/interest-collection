# 可選的中繼資料代理（外掛）

- **非正式必要**：App 不需要它就能完整使用（讀不到時走手動補充）。
- **預設關閉**：App 只有在「設定 → 中繼資料代理（外掛）」打開時才會請求它；關閉時不會送出任何請求。
- 零相依（只用 Node 內建模組）。啟動：`npm run proxy` 或 `node proxy/server.mjs`（`PORT`、`HOST`、`ALLOW_ORIGIN` 可調）。
- 端點：`GET /meta?url=<Instagram/Threads/X 貼文網址>` → `{ status, finalUrl, title, description, image, siteName }`；`GET /health`。
- 只允許 Instagram／Threads／X 網域，避免變成開放代理。**不要部署**；本專案也沒有部署它。
- iPhone 上的 PWA 是 https，不能呼叫 `http://localhost`（那是手機自己），也會被混合內容擋下。要在手機上用，必須自己用 https 架設，這已超出 v1 範圍。主要用途是在電腦上開發、比較自動帶入的效果。
