// @vitest-environment node
// 確保 spec/features/*.feature 的每個「情境」都有同名的自動化測試
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SPEC = join(__dirname, '../../../spec/features');
const TESTS = [join(__dirname, '../features'), join(__dirname, '../e2e')];
const testSource = TESTS.flatMap((d) => readdirSync(d).map((f) => readFileSync(join(d, f), 'utf8'))).join('\n');

describe('BDD 規格覆蓋', () => {
  for (const file of readdirSync(SPEC).filter((f) => f.endsWith('.feature'))) {
    const scenarios = readFileSync(join(SPEC, file), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('情境:')).map((l) => l.replace(/^情境:\s*/, ''));
    it(`${file}：${scenarios.length} 個情境都有對應測試`, () => {
      expect(scenarios.length).toBeGreaterThan(0);
      const missing = scenarios.filter((s) => !testSource.includes(`情境: ${s}`));
      expect(missing).toEqual([]);
    });
  }
});
