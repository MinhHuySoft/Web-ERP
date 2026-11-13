// Chạy các bộ test của mẫu in (không cần thư viện): node tools/print-tests/run.mjs [lọc]
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2] || '';
let pass = 0, fail = 0;
const t = {
  eq(actual, expected, name = '') {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; return; }
    fail++;
    if (fail <= 40) console.log(`  ✗ ${name}\n      được: ${a}\n      cần:  ${e}`);
  },
  ok(cond, name = '') { t.eq(!!cond, true, name); },
  throws(fn, name = '') { try { fn(); t.eq('không lỗi', 'lỗi', name); } catch { pass++; } },
};
for (const f of readdirSync(dir).filter((f) => f.endsWith('.test.mjs') && f.includes(only)).sort()) {
  const before = fail;
  const mod = await import(pathToFileURL(join(dir, f)).href);
  await mod.default(t);
  console.log(`${fail === before ? '✓' : '✗'} ${f}`);
}
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
