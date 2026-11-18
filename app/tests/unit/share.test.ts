import { describe, expect, it } from 'vitest';
import { exportCsv, exportText, lineItShareUrl, lineShareUrl, shareItemText, shareListText } from '../../src/lib/share';
import { makeItem } from '../helpers';

const a = makeItem({ id: 'a', name: '阿明, "拉麵"', city: '台北', url: 'https://www.instagram.com/p/A/', memo: '要早到' });
const b = makeItem({ id: 'b', name: '碗粿', city: '台南', url: 'https://x.com/a/status/1', status: '已完成' });

describe('分享與匯出文字', () => {
  it('單則分享含名稱、地區、連結（與備註）', () => {
    const t = shareItemText(a);
    expect(t).toContain('阿明, "拉麵"');
    expect(t).toContain('地區：台北');
    expect(t).toContain('https://www.instagram.com/p/A/');
    expect(t).toContain('備註：要早到');
  });
  it('清單分享', () => {
    const t = shareListText('想體驗', [a, b]);
    expect(t.split('\n')[0]).toBe("George's Picks｜想體驗");
    expect(t).toContain('1. 阿明, "拉麵"（台北）');
    expect(t).toContain('2. 碗粿（台南）');
  });
  it('LINE 官方分享網址', () => {
    expect(lineShareUrl('名稱\n地區：台北')).toBe('https://line.me/R/share?text=' + encodeURIComponent('名稱\n地區：台北'));
    expect(lineItShareUrl('https://x.com/a')).toBe('https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fx.com%2Fa');
  });
  it('CSV 欄位與跳脫', () => {
    const lines = exportCsv([a, b]).trim().split('\r\n');
    expect(lines[0]).toBe('清單,名稱,地區,連結');
    expect(lines[1]).toBe('想體驗,"阿明, ""拉麵""",台北,https://www.instagram.com/p/A/');
    expect(lines[2]).toBe('已完成,碗粿,台南,https://x.com/a/status/1');
  });
  it('純文字匯出', () => {
    const t = exportText([b], '已完成');
    expect(t).toContain('欄位：清單、名稱、地區、連結');
    expect(t).toContain('名稱：碗粿');
    expect(t).toContain('地區：台南');
    expect(t).toContain('連結：https://x.com/a/status/1');
  });
});
