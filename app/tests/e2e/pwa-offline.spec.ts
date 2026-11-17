import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

async function manualAdd(page: Page, url: string, name: string) {
  await page.getByLabel('貼上社群來源的連結').fill(url);
  await page.getByRole('button', { name: '加入', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: '讀取失敗，請手動補充' });
  await expect(dlg).toBeVisible({ timeout: 20_000 });
  await dlg.getByLabel(/^名稱/).fill(name);
  await dlg.getByRole('button', { name: '儲存並標記手動補充' }).click();
  await expect(page.getByTestId('detail-name')).toHaveText(name);
  await page.getByRole('button', { name: '返回' }).click();
}

test('PWA：manifest、Service Worker 註冊並快取殼層', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'George 的 興趣收藏' })).toBeVisible();
  const manifest = await (await page.request.get('./manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'George 的 興趣收藏', display: 'standalone', start_url: './' });
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const c = await caches.open(keys.find((k) => k.startsWith('gic-shell-'))!);
    const base = new URL('./', location.href).pathname; // 例如 /interest-collection/
    return (await c.keys()).map((r) => '/' + new URL(r.url).pathname.slice(base.length));
  });
  expect(cached).toContain('/index.html');
  expect(cached.some((p) => p.startsWith('/assets/') && p.endsWith('.js'))).toBe(true);
});

test('情境: 加到主畫面後離線仍能開啟與編輯（真的 Service Worker + IndexedDB，關閉網路後重開）', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // 讓頁面由 Service Worker 控制
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await manualAdd(page, 'https://www.instagram.com/private.shop/p/PrivateE2E/', '測試店');
  await manualAdd(page, 'https://www.instagram.com/private.shop/p/ToDeleteE2E/', '要刪的');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'George 的 興趣收藏' })).toBeVisible();
  await expect(page.getByText('離線中')).toBeVisible();
  await expect(page.getByRole('button', { name: '測試店' })).toBeVisible();

  // 離線改備註
  await page.getByRole('button', { name: '測試店' }).click();
  await page.getByLabel('備註').fill('離線時寫的');
  await page.getByRole('button', { name: '儲存備註' }).click();
  // 離線改狀態
  await page.getByRole('button', { name: '標為已完成' }).click();
  const review = page.getByRole('dialog', { name: '完成並留下評價' });
  await review.getByRole('radio', { name: '4 分' }).click();
  await review.getByLabel('評價說明').fill('不錯');
  await review.getByRole('button', { name: '完成並送出評價' }).click();
  await page.getByRole('button', { name: '返回' }).click();
  // 離線刪除
  await page.getByRole('button', { name: /^想體驗/ }).click();
  await page.getByRole('button', { name: '要刪的' }).click();
  await page.getByRole('button', { name: '刪除這則收藏' }).click();
  await page.getByRole('dialog', { name: '刪除這則收藏？' }).getByRole('button', { name: '確定刪除' }).click();
  await expect(page.getByRole('button', { name: '要刪的' })).toHaveCount(0);
  // 離線手動新增（公開網址也因離線改走手動補充）
  await page.getByLabel('貼上社群來源的連結').fill('https://x.com/jack/status/20');
  await page.getByRole('button', { name: '加入', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: '讀取失敗，請手動補充' });
  await expect(dlg.getByText(/目前離線/)).toBeVisible();
  await expect(dlg.getByLabel(/^帳號/)).toHaveValue('jack');
  await dlg.getByLabel(/^名稱/).fill('離線新增');
  await dlg.getByRole('button', { name: '儲存並標記手動補充' }).click();
  await page.getByRole('button', { name: '返回' }).click();

  // 仍離線，再重開一次
  await page.reload();
  await expect(page.getByRole('button', { name: '離線新增' })).toBeVisible();
  await expect(page.getByRole('button', { name: '要刪的' })).toHaveCount(0);
  await page.getByRole('button', { name: /^已完成/ }).click();
  await page.getByRole('button', { name: '測試店' }).click();
  await expect(page.getByLabel('備註')).toHaveValue('離線時寫的');
  await expect(page.getByRole('region', { name: '評價' }).getByText('4 分')).toBeVisible();
  await context.setOffline(false);
});

test('初次開啟是空的；刪除後重整也不會寫回資料', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('empty-state')).toContainText('貼上 Instagram、X 或 Threads 的連結');
  await manualAdd(page, 'https://www.instagram.com/private.shop/p/TempE2E/', '暫時收藏');
  await page.getByRole('button', { name: '暫時收藏' }).click();
  await page.getByRole('button', { name: '刪除這則收藏' }).click();
  await page.getByRole('dialog', { name: '刪除這則收藏？' }).getByRole('button', { name: '確定刪除' }).click();
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('empty-state')).toBeVisible();
});

test('真實網路：X 公開 oEmbed 可從瀏覽器讀到 → 確認畫面；Instagram 被 CORS 擋 → 手動補充', async ({ page }) => {
  test.skip(process.env.E2E_NETWORK === '0', '設定 E2E_NETWORK=0 跳過需要網路的測試');
  await page.goto('./');
  await page.getByLabel('貼上社群來源的連結').fill('https://x.com/jack/status/20');
  await page.getByRole('button', { name: '加入', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '確認地區後加入' });
  await expect(confirm).toBeVisible({ timeout: 25_000 });
  await expect(confirm.getByText('just setting up my twttr')).toBeVisible();
  await expect(confirm.getByRole('group', { name: '地區' }).getByRole('button', { name: '其他' })).toHaveAttribute('aria-pressed', 'true');
  await confirm.getByRole('button', { name: '取消' }).click();

  await page.getByLabel('貼上社群來源的連結').fill('https://www.instagram.com/natgeo/p/DHrUZ11yOh0/');
  await page.getByRole('button', { name: '加入', exact: true }).click();
  const manual = page.getByRole('dialog', { name: '讀取失敗，請手動補充' });
  await expect(manual).toBeVisible({ timeout: 25_000 });
  await expect(manual.getByLabel(/^帳號/)).toHaveValue('natgeo');
});

test('單檔 HTML（file://）：可開啟、可操作、使用本機儲存，不註冊 Service Worker', async ({ page }) => {
  const file = pathToFileURL(resolve('dist-single/george-interest-collection.html')).href;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(file);
  await expect(page.getByRole('heading', { name: 'George 的 興趣收藏' })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker?.controller ?? null)).toBeNull();
  await manualAdd(page, 'https://www.instagram.com/private.single/p/PrivateSingle/', '單檔測試');
  await page.reload();
  await expect(page.getByRole('button', { name: '單檔測試' })).toBeVisible();
  await page.getByRole('button', { name: '設定' }).click();
  const kind = await page.getByTestId('store-kind').textContent();
  console.log('單檔版（Chrome file://）儲存：', kind);
  expect(kind).toMatch(/IndexedDB|localStorage/);
  expect(errors).toEqual([]);
});
