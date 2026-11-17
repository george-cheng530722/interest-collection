/** 把相簿選的截圖縮小成 JPEG data URL（最長邊 640px），避免塞爆本機儲存 */
export async function fileToThumbDataUrl(file: File, maxSide = 640, quality = 0.78): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      const t = setTimeout(() => rej(new Error('圖片解碼逾時')), 2500);
      i.onload = () => { clearTimeout(t); res(i); };
      i.onerror = () => { clearTimeout(t); rej(new Error('無法讀取圖片')); };
      i.src = raw;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/jpeg', quality);
    return out.startsWith('data:image/') && out.length < raw.length ? out : raw;
  } catch {
    return raw; // 測試環境（jsdom）或格式不支援時，直接存原圖
  }
}
