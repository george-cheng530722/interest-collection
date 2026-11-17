import { describe, expect, it } from 'vitest';
import { classify, detectSource, extractPostUrl, inferCity, isLikelyUnreadable, normalizeUrl, parseUrlMeta, sameUrl, thumbExpiryFromUrl } from '../../src/lib/parse';

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
});

describe('分類、地區、私人判斷、縮圖到期', () => {
  it('地區無法判斷時預設「其他」', () => {
    expect(inferCity('just setting up my twttr')).toBe('其他');
    expect(inferCity('')).toBe('其他');
    expect(inferCity('大稻埕河岸手沖')).toBe('台北市');
    expect(inferCity('鹽水碗粿')).toBe('台南市');
    expect(inferCity('逢甲烤香腸')).toBe('台中市');
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
