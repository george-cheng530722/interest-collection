import { describe, expect, it } from 'vitest';
import { classify, detectSource, extractPostUrl, inferCity, isLikelyUnreadable, normalizeUrl, parseUrlMeta, sameUrl, thumbExpiryFromUrl } from '../../src/lib/parse';
import { CITIES } from '../../src/lib/constants';

describe('來源辨識與帳號解析', () => {
  it.each([
    ['https://www.instagram.com/natgeo/p/DHrUZ11yOh0/', 'Instagram', 'natgeo'],
    ['https://www.instagram.com/p/DHrUZ11yOh0/', 'Instagram', ''],
    ['https://instagram.com/reel/ABC/', 'Instagram', ''],
    ['https://x.com/jack/status/20', 'X', 'jack'],
    ['https://twitter.com/jack/status/20', 'X', 'jack'],
    ['https://mobile.twitter.com/jack/status/20', 'X', 'jack'],
    ['https://x.com/i/status/20', 'X', ''],
    ['https://www.threads.net/@natgeo/post/C7XSa54NOw1', 'Threads', 'natgeo'],
    ['https://www.threads.com/@natgeo/post/C7XSa54NOw1', 'Threads', 'natgeo'],
  ])('%s → %s @%s', (url, source, handle) => {
    expect(parseUrlMeta(url)).toEqual({ source, handle });
  });
  it('不支援的網址回傳 null', () => {
    expect(detectSource('https://www.facebook.com/x')).toBeNull();
    expect(detectSource('https://notx.com/a/status/1')).toBeNull();
    expect(detectSource('hello')).toBeNull();
  });
});

describe('從 LINE 分享文字找出貼文網址', () => {
  it('取出第一個支援的網址並去掉追蹤參數', () => {
    expect(extractPostUrl('George 分享：https://www.instagram.com/p/ABC/?igsh=xyz123 快看！')).toBe('https://www.instagram.com/p/ABC/');
    expect(extractPostUrl('先看 https://example.com/a 再看 https://twitter.com/jack/status/20?s=20&t=abc')).toBe('https://x.com/jack/status/20');
    expect(extractPostUrl('「https://www.threads.net/@natgeo/post/C7XSa54NOw1」')).toBe('https://www.threads.net/@natgeo/post/C7XSa54NOw1');
    expect(extractPostUrl('沒有網址')).toBeNull();
  });
  it('sameUrl 忽略 www、尾斜線、threads.com／net 差異', () => {
    expect(sameUrl('https://www.threads.net/@a/post/B', 'https://threads.com/@a/post/B/')).toBe(true);
    expect(sameUrl('https://www.instagram.com/p/A/?igsh=1', 'https://instagram.com/p/A')).toBe(true);
    expect(normalizeUrl('https://x.com/a/status/1#frag')).toBe('https://x.com/a/status/1');
  });
  it('X iOS 分享網址：去掉查詢參數，並整理主機與 /i/web/status/', () => {
    expect(normalizeUrl('https://x.com/jack/status/20?s=46&t=AbCd')).toBe('https://x.com/jack/status/20');
    expect(normalizeUrl('https://twitter.com/jack/status/20')).toBe('https://x.com/jack/status/20');
    expect(normalizeUrl('https://mobile.twitter.com/jack/status/20?s=21')).toBe('https://x.com/jack/status/20');
    expect(normalizeUrl('https://www.x.com/jack/status/20/')).toBe('https://x.com/jack/status/20');
    expect(normalizeUrl('https://m.twitter.com/jack/status/20?s=46')).toBe('https://x.com/jack/status/20');
    expect(normalizeUrl('https://x.com/i/web/status/20?s=46&t=zzz')).toBe('https://x.com/i/status/20');
    expect(normalizeUrl('https://twitter.com/i/web/status/20')).toBe('https://x.com/i/status/20');
    expect(extractPostUrl('從 X 分享 https://x.com/jack/status/20?s=46&t=zzzz')).toBe('https://x.com/jack/status/20');
  });
});

describe('分類、地區、私人判斷、縮圖到期', () => {
  it('地區無法判斷時預設「其他」', () => {
    expect(inferCity('just setting up my twttr')).toBe('其他');
    expect(inferCity('')).toBe('其他');
    expect(inferCity('大稻埕河岸手沖')).toBe('台北');
    expect(inferCity('鹽水碗粿')).toBe('台南');
    expect(inferCity('逢甲烤香腸')).toBe('台中');
  });
  it('地區用新名稱（台北、桃竹、宜蘭…），不再回傳「台北市」這類舊名稱', () => {
    expect(inferCity('台北車站')).toBe('台北');
    expect(inferCity('九份老街')).toBe('新北');
    expect(inferCity('桃園機場')).toBe('桃竹');
    expect(inferCity('中壢夜市')).toBe('桃竹');
    expect(inferCity('大溪老街')).toBe('桃竹');
    expect(inferCity('宜蘭三星蔥')).toBe('宜蘭');
    expect(inferCity('羅東夜市')).toBe('宜蘭');
    expect(inferCity('礁溪溫泉')).toBe('宜蘭');
    expect(inferCity('駁二藝術特區')).toBe('高雄');
    for (const t of ['台北車站', '桃園機場', '羅東夜市', '旗津', '安平']) expect(CITIES).toContain(inferCity(t));
  });
  it('分類', () => {
    expect(classify('叉燒拉麵')).toBe('吃');
    expect(classify('白桃烏龍茶')).toBe('喝');
    expect(classify('九份路線')).toBe('玩');
    expect(classify('店面動線筆記')).toBe('想 follow 學習');
    expect(classify('橘貓店長')).toBe('有趣');
  });
  it('私人／限制年齡標記', () => {
    expect(isLikelyUnreadable('https://www.instagram.com/a/p/PrivateX/')).toBe(true);
    expect(isLikelyUnreadable('https://www.instagram.com/p/age-gate/')).toBe(true);
    expect(isLikelyUnreadable('https://www.instagram.com/natgeo/p/DHrUZ11yOh0/')).toBe(false);
  });
  it('Instagram CDN oe= 推得到期時間', () => {
    expect(thumbExpiryFromUrl('https://scontent.cdninstagram.com/v/a.jpg?stp=1&oe=6745A1B2')).toBe(0x6745a1b2 * 1000);
    expect(thumbExpiryFromUrl('https://pbs.twimg.com/a.jpg')).toBeUndefined();
  });
});
