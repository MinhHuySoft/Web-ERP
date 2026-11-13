// Chuyển hàng loạt thư mục .rpx bằng web/js/print/rpx.js và thống kê cảnh báo (công cụ dev, chỉ đọc thư mục nguồn).
//   node tools/print-tests/rpx-batch.mjs <thư mục Reports> [thư mục ra JSON] [--build]
// --build: dựng thử từng mẫu với dữ liệu giả (fake.js) để bắt lỗi bộ dựng; in số trang / cảnh báo bộ dựng.
// Thư mục ra chứa chữ của mẫu khách hàng: để ngoài repo.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { convertRpx } from '../../web/js/print/rpx.js';
import { buildDocument } from '../../web/js/print/engine.js';
import { fakeData } from '../../web/js/print/fake.js';

const args = process.argv.slice(2);
const build = args.includes('--build');
const [src, out] = args.filter((a) => !a.startsWith('--'));
if (!src) { console.log('Cách dùng: node tools/print-tests/rpx-batch.mjs <thư mục Reports> [thư mục ra]'); process.exit(2); }
if (out) mkdirSync(out, { recursive: true });
const files = readdirSync(src).filter((f) => /\.rpx$/i.test(f)).sort();
const worst = {}, msgs = new Map(), errors = [];
const built = { ok: 0, pages: 0, ms: 0 };
let sizes = [];
const rank = ['ok', 'info', 'auto', 'layout', 'later', 'manual'];
for (const f of files) {
  try {
    const xml = new TextDecoder('utf-8').decode(readFileSync(join(src, f)));
    const { template, warnings } = convertRpx(xml, { file: f });
    const w = warnings.reduce((m, x) => (rank.indexOf(x.level) > rank.indexOf(m) ? x.level : m), 'ok');
    const lvl = ['info', 'auto'].includes(w) ? 'ok' : w;
    worst[lvl] = (worst[lvl] || 0) + 1;
    for (const x of warnings) {
      const key = `${x.level}\t${x.level === 'info' ? x.msg.replace(/ .*$|:.*$/, '') : x.msg.replace(/ của \S+| ở \S+| \S+ (có|định)/, ' …$1')}`;
      const e = msgs.get(key) || { n: 0, files: new Set() };
      e.n++; e.files.add(f); msgs.set(key, e);
    }
    if (build) {
      try {
        const t0 = Date.now();
        const doc = buildDocument(template, { main: fakeData(template, { rows: 30, groups: 3 }), sys: new Map(), params: new Map() });
        built.pages += doc.pages.length; built.ok++; built.ms += Date.now() - t0;
        for (const w of doc.warnings) { const k = `build\t${w.replace(/"[^"]*"/, '"…"').slice(0, 90)}`; const e = msgs.get(k) || { n: 0, files: new Set() }; e.n++; e.files.add(f); msgs.set(k, e); }
      } catch (e) { errors.push(`${f}: dựng lỗi ${e.stack?.split('\n').slice(0, 3).join(' | ')}`); }
    }
    const js = JSON.stringify(template);
    sizes.push(js.length);
    if (out) writeFileSync(join(out, f.replace(/\.rpx$/i, '.json')), js);
  } catch (e) { errors.push(`${f}: ${e.message}`); }
}
sizes.sort((a, b) => a - b);
console.log(`${files.length} tệp; mức nặng nhất mỗi tệp: ${JSON.stringify(worst)}; lỗi đọc: ${errors.length}`);
if (build) console.log(`dựng thử: ${built.ok} mẫu, ${built.pages} trang, ${built.ms} ms`);
console.log(`JSON trung vị ${sizes[sizes.length >> 1]} B, lớn nhất ${sizes[sizes.length - 1]} B`);
for (const [k, v] of [...msgs].sort((a, b) => a[0].localeCompare(b[0]) || b[1].n - a[1].n)) console.log(`${k.split('\t')[0].padEnd(7)} ${String(v.n).padStart(6)} lần ${String(v.files.size).padStart(4)} tệp  ${k.split('\t')[1]}`);
for (const e of errors.slice(0, 20)) console.log('LỖI', e);
