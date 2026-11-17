# George 的 興趣收藏 — 第一版規格（2026-11-17 凍結）

這份資料夾是給實作與驗收用的 BDD 規格，對應凍結雛形「George 的 興趣收藏 雛形 v1（2026-11-17 凍結）」。

應用程式名稱：George 的 興趣收藏。介面語言：繁體中文。目標裝置：George 自己的 iPhone，單機單人使用。

## 範圍（v1）

- 從 Instagram、Threads、X 貼文網址加入收藏；也接受從 LINE 分享進來的網址。
- 先在手機上直接抓取連結的標題、說明、帳號與縮圖。若被 CORS 或網路擋下、或是私人／限制年齡貼文讀不到，改走手動補充表單，並預填連結、來源與從網址解析到的帳號。
- 每則收藏必填地區。無法判斷時預設「其他」，不用「線上」。
- 分類：吃、喝、玩、有趣、想 follow 學習。清單分「想體驗」「已完成」。標為已完成時必須打 1 到 5 分並寫評價說明。
- 可寫備註、分享到 LINE（單則與清單）、匯出清單（名稱、地區、連結；文字與 CSV）。
- 縮圖過期會自動更新；連結失效時詢問是否刪除；刪除前要確認。
- 資料只存在這台 iPhone（localStorage 或 IndexedDB），不開帳號、不同步、不依賴後端。
- 一旦加到主畫面，之後離線也要能打開、瀏覽與編輯既有收藏（應用程式殼層須快取在裝置上）。
- 選用的中繼資料代理是外掛，預設關閉，可隨時關掉。沒有它也要能完整使用（走手動補充）。

## 非目標（v1 不做）

- 原生 iOS Share Extension 或獨立 App Store 應用程式。
- 帳號、登入、雲端同步、多裝置、多人協作。
- 必須存在的後端或付費雲服務。
- 自動部署到正式環境（實作可準備靜態檔，但不部署、不新開帳號、不產生費用）。

## 架構原則（離線優先、盡量不需要後端）

1. 所有收藏資料寫在裝置上。重整、關掉、離線後資料仍在。
2. 抓取連結資訊的順序：先由瀏覽器直接請求；失敗（含 CORS）就打開手動補充表單，預填連結、來源、帳號。不要因為抓不到資訊就無法收藏。
3. 可選的 metadata proxy 只是加強自動帶入標題與縮圖，必須可關閉，關閉時行為與「沒有伺服器」相同。
4. 真正的 LINE 分享用官方分享網址（例如 `https://social-plugins.line.me/lineit/share?url=` 或 `https://line.me/R/share?text=`），不是雛形裡的模擬視窗。匯出要能複製或下載文字／CSV。

## 交付方式與 iOS Safari 限制（實作時必須誠實面對）

詳見實作報告。重點先記在這裡：

- 加到主畫面的 PWA，第一次仍必須從 **https** 網址載入（iOS 不把 `file://` 當安全來源）。Service Worker 也只能在 https（或 localhost）註冊。這是「單機也能離線用」的前提，不是偷偷做後端。
- 從「檔案」App 打開單一 HTML（`file://`）：可以看介面、操作流程；**不能**註冊 Service Worker，也通常**不能**用「加到主畫面」變成可離線的 PWA。Safari 對 `file://` 的 localStorage／IndexedDB 行為不穩定，不能當成正式資料家。
- Shortcuts 可當輔助（例如分享表把網址打開到已安裝的 App，帶入查詢參數），但不能取代 https 第一次安裝，也不能單獨當成完整 App 的家。
- Instagram、X、Threads 在 iOS Safari 幾乎都會因 CORS 擋下前端直接抓取。v1 的正式無伺服器路徑是「預填後的手動補充表單」。可選代理只是加分，預設關閉。

## 規格檔

| 檔案 | 內容 |
| --- | --- |
| `features/add-from-link.feature` | 貼上網址、來源辨識、前端抓取與 CORS 回退、地區預設 |
| `features/manual-fill.feature` | 私人／讀不到時的手動補充 |
| `features/list-filter-region.feature` | 清單、篩選、地區必填 |
| `features/status-review.feature` | 想體驗／已完成、評分與評價 |
| `features/share-export-memo.feature` | 備註、LINE 分享、匯出 |
| `features/delete-dead-link-thumb.feature` | 刪除、失效連結、縮圖過期自動更新 |
| `features/offline-storage.feature` | 單機儲存、離線、可選代理預設關閉 |

情境可用繁體中文。驗收時應以行為為準，不要綁死實作細節。
