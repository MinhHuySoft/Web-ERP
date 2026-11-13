// @ts-check
/**
 * Vai trò `section[data-erp=print-document]` (chuẩn ERP-HTML mục 15.1): dữ liệu in là các lưới `R0` (bảng chính), `R1`…
 * (bảng phụ), tham số in `dl[data-erp=print-params]`; mẫu tải từ `data-template-src` (JSON erp-print-template/1 hoặc
 * `.rpx` của WinForms — FE tự chuyển, không chạy script trong mẫu). Dựng bằng engine.js, vẽ bằng render.js, in qua một
 * khung in riêng có `@page` đúng khổ của mẫu.
 */
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { isAllowedUrl } from '../core/http.js';
import { toast } from '../core/ui.js';
import { getNumberStyle, numberSeparators } from '../core/format.js';
import { getPrintPaper, savePrintPaper } from '../core/settings.js';
import { buildDocument } from './engine.js';
import { renderPages, domMeasure } from './render.js';
import { convertRpx, TEMPLATE_SCHEMA } from './rpx.js';
import { parseIsoDate } from './netformat.js';

/** @typedef {Record<string, any>} Obj */

/** Khổ giấy chuẩn (mm, dọc). */
export const PAPERS = /** @type {Record<string, [number, number]>} */ ({ A4: [210, 297], A5: [148, 210], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6] });
/** Lựa chọn ô "Khổ giấy" của màn xem in (như màn xem in ERP: A4, A4 ngang, A5, A5 ngang…). */
export const PAPER_CHOICES = /** @type {Array<[string,string]>} */ ([['A4', 'A4'], ['A4L', 'A4 ngang'], ['A5', 'A5'], ['A5L', 'A5 ngang'], ['A3', 'A3'], ['A3L', 'A3 ngang'],
  ['Letter', 'Letter'], ['LetterL', 'Letter ngang']]);

/**
 * Mẫu với khổ giấy khác (ô "Khổ giấy" khi xem in). Giống ActiveReports khi đổi khổ lúc xem: giữ lề và độ rộng vùng in
 * (PrintWidth) của mẫu, chỉ đổi kích thước trang — chữ không co giãn, đầu/cuối trang theo khổ mới.
 * @param {Obj} tpl @param {string} choice "" (theo mẫu) | "A4" | "A4L" (ngang) | …
 */
export function withPaper(tpl, choice) {
  const land = /L$/.test(choice || '');
  const name = land ? choice.slice(0, -1) : choice;
  const size = name ? PAPERS[name] : null;
  if (!size) return tpl;
  const [w, hh] = land ? [size[1], size[0]] : size;
  return { ...tpl, page: { ...tpl.page, paper: name, orientation: land ? 'landscape' : 'portrait', width: w, height: hh } };
}

/** Tên khổ của mẫu để hiện trong ô chọn. @param {Obj} page */
function paperLabel(page) {
  const land = page.orientation === 'landscape' || Number(page.width) > Number(page.height);
  const known = PAPERS[page.paper] && PAPER_CHOICES.find(([v]) => v === `${page.paper}${land ? 'L' : ''}`);
  return known ? known[1] : `${Math.round(page.width * 10) / 10} × ${Math.round(page.height * 10) / 10} mm`;
}

const NUMERIC = new Set(['number', 'money', 'quantity', 'percent']);
/** @type {Map<string, Promise<{ template: Obj, warnings: string[] }>>} */
const templateCache = new Map();
/** @type {((r: import('./engine.js').MeasureReq) => number)|null} */
let measurer = null;

/** Giá trị máy → kiểu JS theo data-type. @param {string|null} raw @param {string} type */
export function typed(raw, type) {
  if (raw === null || raw === undefined) return null;
  if (NUMERIC.has(type)) { if (raw.trim() === '') return null; const n = Number(raw); return Number.isFinite(n) ? n : null; }
  if (type === 'date' || type === 'datetime') return raw ? parseIsoDate(raw) : null;
  if (type === 'bool') return raw === '' ? null : raw === 'true' || raw === '1';
  return raw;
}

/** Đọc một lưới thành bảng dữ liệu. @param {HTMLTableElement} t @returns {import('./engine.js').DataSet} */
export function readGrid(t) {
  const ths = Array.from(t.querySelectorAll('thead tr:last-child th'));
  const columns = ths.map((th) => ({ name: th.getAttribute('data-field') || th.textContent?.trim() || '', type: th.getAttribute('data-type') || 'text',
    format: th.getAttribute('data-format') || '' }));
  /** @type {Obj[]} */ const rows = [];
  for (const tr of Array.from(t.querySelectorAll('tbody tr'))) {
    /** @type {Obj} */ const r = Object.create(null);
    Array.from(tr.children).forEach((td, j) => {
      const c = columns[j];
      if (!c) return;
      const raw = td.hasAttribute('data-value') ? td.getAttribute('data-value') : (NUMERIC.has(c.type) || c.type.startsWith('date') || c.type === 'bool' ? null : td.textContent);
      r[c.name] = td.hasAttribute('data-null') ? null : typed(raw, c.type);
    });
    rows.push(r);
  }
  return { columns, rows };
}

/** Đọc tham số in. @param {HTMLElement|null} dl */
export function readParams(dl) {
  const params = new Map(), sys = new Map(), lang = new Map(), captions = new Map(), images = new Map();
  for (const dd of Array.from(dl?.querySelectorAll('dd[data-name]') || [])) {
    const name = dd.getAttribute('data-name') || '';
    const type = dd.getAttribute('data-type') || 'text';
    const raw = dd.hasAttribute('data-value') ? dd.getAttribute('data-value') : dd.textContent;
    const v = typed(raw, type);
    const dot = name.indexOf('.');
    const prefix = dot > 0 ? name.slice(0, dot) : '';
    const key = name.slice(dot + 1);
    if (prefix === 'Sys') sys.set(key, v);
    else if (prefix === 'Lang') lang.set(key, String(v ?? ''));
    else if (prefix === 'Caption') captions.set(key, String(v ?? ''));
    else if (prefix === 'Image') { const img = dd.querySelector('img'); const src = img?.getAttribute('src'); if (src) images.set(key, src); }
    else params.set(name, v);
  }
  return { params, sys, lang, captions, images };
}

/**
 * Tải mẫu (có bộ đệm theo URL trong phiên).
 * @param {string} url @param {string} format "rpx" | "json" | "" (tự nhận)
 */
export function loadTemplate(url, format = '') {
  const key = `${format}|${url}`;
  let p = templateCache.get(key);
  if (!p) {
    p = (async () => {
      if (!isAllowedUrl(url)) throw new Error('URL mẫu in không được phép');
      const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json, application/xml, text/xml', 'X-ERP-Request': 'print-template' } });
      if (!res.ok) throw new Error(`Không tải được mẫu in (HTTP ${res.status})`);
      const text = await res.text();
      const ct = res.headers.get('content-type') || '';
      const isJson = format === 'json' || (!format && (/json/.test(ct) || /^\s*\{/.test(text)));
      if (isJson) {
        const t = JSON.parse(text);
        if (t?.$schema !== TEMPLATE_SCHEMA) throw new Error('Mẫu in không đúng định dạng erp-print-template/1');
        return { template: t, warnings: [] };
      }
      const file = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || '');
      const { template, warnings } = convertRpx(text, { file, fileDate: res.headers.get('last-modified') || '' });
      return { template, warnings: warnings.filter((w) => ['layout', 'later', 'manual'].includes(w.level)).map((w) => w.msg) };
    })();
    templateCache.set(key, p);
    p.catch(() => templateCache.delete(key));
  }
  return p;
}

/**
 * @param {HTMLElement} section @param {import('../shell/tabs.js').TabContext} ctx
 */
export function enhancePrintDocument(section, ctx) {
  section.classList.add('erp-print');
  const grids = /** @type {HTMLTableElement[]} */ (Array.from(section.querySelectorAll('table[data-erp="grid"]')));
  const main = grids.find((t) => t.getAttribute('data-grid-id') === 'R0') || grids[0];
  const sets = grids.filter((t) => t !== main);
  const dl = /** @type {HTMLElement|null} */ (section.querySelector('dl[data-erp="print-params"]'));
  const { params, sys, lang, captions, images } = readParams(dl);
  /** @type {import('./engine.js').PrintData} */
  const data = { main: main ? readGrid(main) : { columns: [], rows: [] }, sets: sets.map(readGrid), params, sys: dl ? sys : null, lang, paramCaptions: captions, images };
  grids.forEach((t) => t.remove());
  dl?.remove();
  // Người dùng chọn kiểu số 1,234,567.89 (Cài đặt › Định dạng số, như vùng Windows của máy chạy ERP) thì dùng kiểu đó;
  // còn lại theo cấu hình công ty BE gửi (data-number-*).
  const locale = getNumberStyle() === 'us' ? numberSeparators()
    : { group: section.getAttribute('data-number-group') || undefined, decimal: section.getAttribute('data-number-decimal') || undefined };
  const title = section.getAttribute('data-title') || section.closest('[data-erp="screen"]')?.querySelector('h1, .erp-screen__title')?.textContent?.trim() || 'Mẫu in';

  const view = h('div', { class: 'erp-print__view', tabindex: '0', 'aria-label': 'Trang in' }, h('div', { class: 'erp-print__status' }, 'Đang dựng mẫu in…'));
  const info = h('span', { class: 'erp-print__info', 'aria-live': 'polite' }, '');
  const zoom = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Thu phóng' },
    ...[['fit', 'Vừa khung'], ['0.5', '50%'], ['0.75', '75%'], ['1', '100%'], ['1.25', '125%'], ['1.5', '150%'], ['2', '200%']].map(([v, t]) => h('option', { value: v }, t))));
  zoom.value = 'fit';
  const paper = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Khổ giấy', disabled: '' }, h('option', { value: '' }, 'Theo mẫu')));
  const printBtn = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'erp-btn erp-btn--primary', disabled: '', title: 'In (Ctrl+P)' }, icon('print'), h('span', {}, 'In')));
  const warnBox = h('details', { class: 'erp-print__warn', hidden: '' });
  const bar = h('div', { class: 'erp-print__bar' }, printBtn, h('label', { class: 'erp-print__zoom' }, icon('search'), zoom),
    h('label', { class: 'erp-print__zoom', title: 'Khổ giấy khi xem và in (không đổi mẫu)' }, icon('file'), paper));
  const design = section.getAttribute('data-design-href');
  if (design && isAllowedUrl(design)) bar.append(h('a', { class: 'erp-btn', href: design, 'data-target': 'tab' }, icon('edit'), h('span', {}, 'Thiết kế mẫu')));
  bar.append(warnBox, info);
  // Một thanh duy nhất: gộp nút In / thu phóng / khổ giấy / thiết kế vào thanh "Mẫu in … Xem" của màn (form lọc), như ERP.
  // Các ô chọn ở đây không có name nên không gửi theo form lọc.
  const filter = section.closest('[data-erp="screen"]')?.querySelector('form[data-erp="filter"]');
  if (filter) { bar.classList.add('erp-print__bar--filter'); filter.append(bar); } else section.prepend(bar);
  section.append(view);

  /** @type {HTMLElement|null} */ let docEl = null;
  /** @type {Obj|null} */ let tpl = null;
  /** Mẫu đang hiện (đã áp khổ giấy người dùng chọn). @type {Obj|null} */ let shown = null;
  /** @type {string[]} */ let loadWarnings = [];
  const applyZoom = () => {
    if (!docEl || !shown) return;
    let z = Number(zoom.value);
    if (zoom.value === 'fit') {
      const avail = view.clientWidth - 32;
      const pageW = (shown.page.width / 25.4) * 96;
      z = Math.max(0.3, Math.min(1.5, avail / pageW));
    }
    /** @type {any} */ (docEl.style).zoom = String(z);
  };
  zoom.addEventListener('change', applyZoom);
  const ro = new ResizeObserver(() => { if (zoom.value === 'fit') applyZoom(); });
  ro.observe(view);

  const doPrint = () => { if (docEl && shown) printPages(docEl, shown, title).catch((e) => toast(`Không in được: ${e.message || e}`, 'error')); };
  printBtn.addEventListener('click', doPrint);
  ctx.registerKey?.('Ctrl+P', (ev) => { ev.preventDefault?.(); if (section.isConnected) doPrint(); });

  /** Dựng lại các trang theo khổ giấy đang chọn. */
  const build = () => {
    if (!tpl || !measurer) return;
    shown = withPaper(tpl, paper.value);
    const t0 = performance.now();
    const { pages, warnings } = buildDocument(shown, data, { measure: measurer, locale });
    docEl = renderPages(pages);
    view.replaceChildren(docEl);
    applyZoom();
    printBtn.disabled = false;
    // Thanh gọn: chỉ số trang; số dòng và thời gian dựng ở chú thích.
    info.textContent = `${pages.length} trang`;
    info.title = `${pages.length} trang · ${data.main.rows.length} dòng · ${Math.round(performance.now() - t0)} ms`;
    const all = [...loadWarnings, ...warnings];
    warnBox.hidden = !all.length;
    warnBox.replaceChildren(...(all.length ? [h('summary', {}, `Cảnh báo (${all.length})`), h('ul', {}, ...all.slice(0, 50).map((w) => h('li', {}, w)))] : []));
  };
  const fail = (/** @type {any} */ e) => view.replaceChildren(h('div', { class: 'erp-print__status erp-print__status--error' }, `Không dựng được mẫu in: ${e?.message || e}`));
  paper.addEventListener('change', () => {
    if (!tpl) return;
    savePrintPaper(String(tpl.id || src), paper.value);
    try { build(); } catch (e) { fail(e); }
  });

  const src = section.getAttribute('data-template-src') || '';
  (async () => {
    try {
      if (!src) throw new Error('Thiếu data-template-src');
      const loaded = await loadTemplate(src, section.getAttribute('data-template-format') || '');
      tpl = loaded.template;
      loadWarnings = loaded.warnings;
      paper.options[0].textContent = `Theo mẫu (${paperLabel(tpl.page)})`;
      paper.append(...PAPER_CHOICES.map(([v, t]) => h('option', { value: v }, t)));
      const saved = getPrintPaper(String(tpl.id || src));
      paper.value = PAPER_CHOICES.some(([v]) => v === saved) ? saved : '';
      paper.disabled = false;
      if (document.fonts?.ready) await document.fonts.ready;
      measurer ||= domMeasure(document);
      build();
    } catch (e) {
      fail(e);
    }
  })();
}

/**
 * In các trang qua một khung in riêng (không lẫn giao diện ứng dụng), khổ giấy theo mẫu (đã áp khổ người dùng chọn).
 * @param {HTMLElement} docEl @param {Obj} tpl @param {string} title
 */
export async function printPages(docEl, tpl, title) {
  const frame = /** @type {HTMLIFrameElement} */ (h('iframe', { 'aria-hidden': 'true', tabindex: '-1', title: 'In' }));
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  document.body.append(frame);
  const d = /** @type {Document} */ (frame.contentDocument);
  d.open();
  d.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title></title></head><body></body></html>');
  d.close();
  d.title = title;
  const link = d.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('css/print-doc.css', document.baseURI).href;
  const st = d.createElement('style');
  st.textContent = `@page { size: ${Number(tpl.page.width)}mm ${Number(tpl.page.height)}mm; margin: 0 } html, body { margin: 0; padding: 0; background: #fff }`;
  const loaded = new Promise((r) => { link.onload = r; link.onerror = r; });
  d.head.append(link, st);
  const copy = /** @type {HTMLElement} */ (d.importNode(docEl, true));
  /** @type {any} */ (copy.style).zoom = '';
  d.body.append(copy);
  await loaded;
  if (d.fonts?.ready) await d.fonts.ready;
  await Promise.all(Array.from(d.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  const w = /** @type {Window} */ (frame.contentWindow);
  w.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 100), { once: true });
  w.focus();
  w.print();
  setTimeout(() => frame.isConnected && frame.remove(), 60_000);
}
