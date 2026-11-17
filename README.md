# George 的 興趣收藏（PWA）

離線優先、單機的手機網頁 App。資料只存在使用者自己的裝置（IndexedDB），沒有帳號、沒有伺服器。

- 線上版：https://george-cheng530722.github.io/interest-collection/
- 程式：`app/`（Vite + React）；驗收規格：`spec/features/`（BDD）
- 部署：push 到 `main` 由 GitHub Actions 建置 `app/dist` 發佈到 GitHub Pages。可選的中繼資料代理 `app/proxy/` 不會部署，預設關閉。
