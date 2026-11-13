// @ts-check
/** Trang web/tools/rpx.html: chuyển và dựng thử hàng loạt mẫu .rpx ngay trong trình duyệt (không gửi dữ liệu đi đâu). */
import { convertRpx } from '../print/rpx.js';
import { buildDocument } from '../print/engine.js';
import { renderPages, domMeasure } from '../print/render.js';
import { fakeData } from '../print/fake.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const RANK = ['ok', 'info', 'auto', 'layout', 'later', 'manual'];
/** @typedef {{ name: string, level: string, pages: number, template: any, warnings: { level: string, msg: string }[], buildWarnings: string[], error?: string }} Result */
/** @type {Result[]} */ let results = [];
const measure = domMeasure(document);

/** @param {File[]} files */
async function run(files) {
  const rpx = files.filter((f) => /\.rpx$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
  results = [];
  $('out').hidden = false;
  $('rows').replaceChildren();
  let k = 0;
  for (const f of rpx) {
    k++;
    $('progress').textContent = `Đang kiểm ${k}/${rpx.length}: ${f.name}`;
    /** @type {Result} */ let r;
    try {
      const { template, warnings } = convertRpx(await f.text(), { file: f.name, fileDate: new Date(f.lastModified).toISOString() });
      const worst = warnings.reduce((m, w) => (RANK.indexOf(w.level) > RANK.indexOf(m) ? w.level : m), 'ok');
      const doc = buildDocument(template, { main: fakeData(template, { rows: 20, groups: 2 }), sys: null }, { measure });
      r = { name: f.name, level: ['info', 'auto'].includes(worst) ? 'ok' : worst, pages: doc.pages.length, template, warnings, buildWarnings: doc.warnings };
    } catch (e) {
      r = { name: f.name, level: 'manual', pages: 0, template: null, warnings: [], buildWarnings: [], error: String(/** @type {Error} */ (e).message || e) };
    }
    results.push(r);
    addRow(r, results.length - 1);
    if (k % 20 === 0) await new Promise((res) => setTimeout(res, 0));
  }
  $('progress').textContent = `Đã kiểm ${rpx.length} mẫu.`;
  /** @type {Record<string, number>} */ const by = {};
  for (const r of results) by[r.level] = (by[r.level] || 0) + 1;
  $('sum').replaceChildren(...['ok', 'layout', 'later', 'manual'].map((lv) => { const s = document.createElement('span'); s.textContent = `${lv}: ${by[lv] || 0}`; return s; }));
}

/** @param {Result} r @param {number} i */
function addRow(r, i) {
  const tr = document.createElement('tr');
  tr.tabIndex = 0;
  for (const [t, cls] of [[r.name, ''], [r.level, 'r-lv'], [String(r.pages), '']]) {
    const td = document.createElement('td');
    td.textContent = t;
    if (cls) { td.className = cls; td.dataset.lv = r.level; }
    tr.append(td);
  }
  const open = () => {
    for (const x of Array.from($('rows').children)) x.setAttribute('aria-selected', String(x === tr));
    show(results[i]);
  };
  tr.addEventListener('click', open);
  tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  $('rows').append(tr);
}

/** @param {Result} r */
function show(r) {
  const d = $('detail');
  d.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = r.name;
  d.append(h);
  const ul = document.createElement('ul');
  const lines = r.error ? [`Lỗi: ${r.error}`] : [...r.warnings.filter((w) => w.level !== 'info').map((w) => `${w.level}: ${w.msg}`), ...r.buildWarnings.map((w) => `dựng: ${w}`)];
  for (const l of lines.length ? lines : ['Không có cảnh báo.']) { const li = document.createElement('li'); li.textContent = l; ul.append(li); }
  d.append(ul);
  if (!r.template) return;
  const view = document.createElement('div');
  view.className = 'erp-print__view';
  const doc = buildDocument(r.template, { main: fakeData(r.template, { rows: 20, groups: 2 }), sys: null }, { measure });
  const el = renderPages(doc.pages);
  /** @type {any} */ (el.style).zoom = '0.6';
  view.append(el);
  d.append(view);
  const a = document.createElement('a');
  a.className = 'erp-btn';
  a.textContent = 'Tải JSON đã chuyển';
  a.download = r.name.replace(/\.rpx$/i, '.json');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(r.template, null, 1)], { type: 'application/json' }));
  d.append(a);
}

for (const id of ['dir', 'files']) $(id).addEventListener('change', (e) => run(Array.from(/** @type {HTMLInputElement} */ (e.target).files || [])));
