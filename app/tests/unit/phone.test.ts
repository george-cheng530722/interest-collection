import { describe, expect, it } from 'vitest';
import { commitPhone, extractPhone, formatPhone, telHref } from '../../src/lib/phone';

describe('台灣電話抽取', () => {
  it('市話、手機、國碼與括號都認得出來', () => {
    expect(extractPhone('店名：阿明拉麵\n02-2345-6789')).toBe('02-2345-6789');
    expect(extractPhone('(02)2345-6789')).toBe('02-2345-6789');
    expect(extractPhone('03-1234567')).toBe('03-123-4567');
    expect(extractPhone('04-23456789')).toBe('04-2345-6789');
    expect(extractPhone('07-1234567')).toBe('07-123-4567');
    expect(extractPhone('+886-2-2345-6789')).toBe('02-2345-6789');
    expect(extractPhone('+886 02 2345 6789')).toBe('02-2345-6789');
    expect(extractPhone('0912-345-678')).toBe('0912-345-678');
    expect(extractPhone('0912345678')).toBe('0912-345-678');
    expect(extractPhone('+886-912-345-678')).toBe('0912-345-678');
    expect(extractPhone('０２－２３４５－６７８９')).toBe('02-2345-6789');
  });

  it('有標籤時優先訂位、預約、電話，而不是先出現的其他號碼', () => {
    const text = '營業 0912-000-111\n訂位：02-2345-6789\n外送 0988-111-222';
    expect(extractPhone(text)).toBe('02-2345-6789');
    expect(extractPhone('預約專線 03-1234567\n手機 0912000111')).toBe('03-123-4567');
    expect(extractPhone('📞 07-7654321\n0911222333')).toBe('07-765-4321');
    expect(extractPhone('Tel. 04-23456789')).toBe('04-2345-6789');
    expect(extractPhone('電話：0912-345-678\n02-1111-2222')).toBe('0912-345-678');
  });

  it('日期、價格、統編、發票、郵遞區號不是電話', () => {
    expect(extractPhone('2024-11-18 開幕')).toBe('');
    expect(extractPhone('日期 2026/11/18')).toBe('');
    expect(extractPhone('2024-02-23')).toBe('');
    expect(extractPhone('售價 NT$1,280')).toBe('');
    expect(extractPhone('特價 350 元')).toBe('');
    expect(extractPhone('統編 12345678')).toBe('');
    expect(extractPhone('發票號碼 AB12345678')).toBe('');
    expect(extractPhone('郵遞區號 244')).toBe('');
    expect(extractPhone('郵遞區號 24448')).toBe('');
    expect(extractPhone('訂單 2024111800123')).toBe('');
    expect(extractPhone('今天人很多，沒有留電話。')).toBe('');
    expect(extractPhone('分機 1234')).toBe('');
  });

  it('撥打連結把 0 換成 +886', () => {
    expect(telHref('02-2345-6789')).toBe('tel:+886223456789');
    expect(telHref('0912-345-678')).toBe('tel:+886912345678');
    expect(telHref('不是電話')).toBe('');
    expect(formatPhone('0223456789')).toBe('02-2345-6789');
    expect(commitPhone('', '訂位 02-2700-1234')).toBe('02-2700-1234');
    expect(commitPhone('0912345678', '02-1111-2222')).toBe('0912-345-678');
  });
});
