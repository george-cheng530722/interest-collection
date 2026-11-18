import { describe, expect, it } from 'vitest';
import { cardBlurb, extractPlaceName, shortSummary, SUMMARY_MAX } from '../../src/lib/place';

describe('店家名稱抽取', () => {
  it('從 IG／Threads 常見寫法抽出短店名，抽不到就留白', () => {
    const samples: Array<[string, string, string]> = [
      ['吃貨日記', '週五中午只想吃麵。\n📍 阿明拉麵\n叉燒厚、湯頭濃。', '阿明拉麵'],
      ['', '店名：山海咖啡\n地址：宜蘭縣羅東鎮公正路\n手沖喝完還想再點一杯。', '山海咖啡'],
      ['', '「店名」老乾杯\n信義區的燒肉，生日才來。', '老乾杯'],
      ['', '【玖仰咖啡】\n松山文創園區的手沖，座位不多。', '玖仰咖啡'],
      ['', '「永康牛肉麵」\n紅燒湯頭，中午一定要排隊。', '永康牛肉麵'],
      ['', '回宜蘭一定要來。\n🏠 阿嬤的灶腳', '阿嬤的灶腳'],
      ['', '新開的點心。\n📍 @dimsum.lab\n蝦餃皮很薄。', 'dimsum.lab'],
      ['', '📍 @dimsum.lab 點心實驗室', '點心實驗室'],
      ['', '位置：@riverside.cafe\n河岸的下午茶。', 'riverside.cafe'],
      ['', '📍 阿明拉麵（台北市大同區迪化街）', '阿明拉麵'],
      ['【小王清湯】', '牛肉麵加湯。', '小王清湯'],
      ['', '店名：本店\n📍 分店', '本店'],
      ['', '地址：春水堂 台中市西區公益路68號\n珍珠奶茶。', '春水堂'],
      ['', '地址：阿明拉麵，台北市大同區迪化街一段10號', '阿明拉麵'],
      ['', '今天雲很多，去大安森林公園走路。\n沒有進店，只是散散步。\nPhoto by @friend', ''],
      ['', '地址：台北市大安區復興南路一段100號\n湯很好喝。', ''],
      ['', '【食記】\n麵很好吃，但這篇沒寫店名。', ''],
      ['', '📍 這家真的太好吃了以後每週都要來', ''],
      ['National Geographic', 'Photo by @carltonward | Today is Manatee Awareness Day.', ''],
    ];
    for (const [title, caption, want] of samples) {
      expect(extractPlaceName(title, caption), caption.slice(0, 24)).toBe(want);
    }
  });
});

describe('短簡介', () => {
  it('短文原樣保留，長文在句號或換行處截斷且不超過 120 字', () => {
    expect(shortSummary('今天只是散散步。')).toBe('今天只是散散步。');
    const sentence = '這家店的手沖很穩定，座位靠窗。';
    const long = sentence.repeat(8) + '尾巴不該留下。';
    const summary = shortSummary(long);
    expect([...summary].length).toBeLessThanOrEqual(SUMMARY_MAX);
    expect(summary.endsWith('。')).toBe(true);
    expect(summary).not.toContain('尾巴');
    expect(long.startsWith(summary)).toBe(true);

    const broken = '哇！' + '沒有句號的說明'.repeat(20);
    const hard = shortSummary(broken);
    expect([...hard].length).toBe(SUMMARY_MAX);
    expect(hard.startsWith('哇！')).toBe(true);

    const first = '這一行故意寫得比較長，超過二十四個字之後才換行。';
    const lined = first + '\n' + '沒有句號的第二行'.repeat(30);
    expect(shortSummary(lined)).toBe(first);
  });

  it('已存的短簡介優先於全文', () => {
    expect(cardBlurb({ caption: '很長'.repeat(40), summary: '只看這句。' })).toBe('只看這句。');
    expect(cardBlurb({ caption: '還沒遷移的全文。' })).toBe('還沒遷移的全文。');
  });
});
