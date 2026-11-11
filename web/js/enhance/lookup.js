// @ts-check
import { h, fold, debounce } from '../core/dom.js';
import { fetchHtml, pick } from '../core/http.js';
import { icon } from '../core/icons.js';

/** @typedef {{ field:string, label:string, hidden:boolean }} LkCol */
/** @typedef {{ value:string, text:string, cells:Record<string,string> }} LkRow */
/** @typedef {{ cols: LkCol[], rows: LkRow[], total:number }} LkResult */

/** @type {Map<string, Promise<LkResult>>} */
const cache = new Map();

/** Gọi data-lookup-src và đọc table[data-erp=lookup-result] (chuẩn ERP-HTML mục 10). @param {string} src @param {string} q */
export function fetchLookup(src, q) {
  const url = src.includes('{q}') ? src.replace('{q}', encodeURIComponent(q)) : src;
  let p = cache.get(url);
  if (!p) {
    p = fetchHtml(url).then((res) => {
      const t = pick(res.doc, 'lookup-result');
      if (!t) return { cols: [], rows: [], total: 0 };
      const cols = Array.from(t.querySelectorAll('thead th')).map((th) => ({ field: th.getAttribute('data-field') || '', label: th.textContent?.trim() || '', hidden: th.hasAttribute('data-hidden') }));
      const rows = Array.from(t.querySelectorAll('tbody tr')).map((tr) => {
        /** @type {Record<string,string>} */ const cells = {};
        Array.from(tr.children).forEach((td, i) => { if (cols[i]) cells[cols[i].field] = td.getAttribute('data-value') ?? td.textContent?.trim() ?? ''; });
        return { value: tr.getAttribute('data-value') || '', text: tr.getAttribute('data-text') || '', cells };
      });
      return { cols, rows, total: Number(t.getAttribute('data-total')) || rows.length };
    });
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

/** @type {{ close:()=>void }|null} */
let openPop = null;

/**
 * Mở bảng tra cứu dưới ô nhập.
 * @param {HTMLInputElement} input @param {string} src @param {string} q @param {(row:LkRow)=>void} onPick
 */
export async function openLookup(input, src, q, onPick) {
  openPop?.close();
  const pop = h('div', { class: 'erp-lookup-pop erp-surface', role: 'listbox', 'aria-label': 'Kết quả tra cứu' }, h('div', { class: 'erp-lookup-pop__loading' }, 'Đang tra cứu…'));
  document.body.append(pop);
  const place = () => {
    const r = input.getBoundingClientRect();
    const w = Math.max(r.width, Math.min(560, innerWidth - 16));
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
    const below = innerHeight - r.bottom;
    if (below < 260 && r.top > below) { pop.style.top = ''; pop.style.bottom = `${innerHeight - r.top + 4}px`; }
    else { pop.style.bottom = ''; pop.style.top = `${r.bottom + 4}px`; }
  };
  place();
  let sel = 0;
  /** @type {LkRow[]} */ let rows = [];
  const close = () => {
    pop.remove(); openPop = null;
    document.removeEventListener('pointerdown', outside, true);
    input.removeEventListener('keydown', keys, true);
    window.removeEventListener('resize', place);
    input.setAttribute('aria-expanded', 'false');
  };
  const outside = (/** @type {Event} */ e) => { if (!pop.contains(/** @type {Node} */ (e.target)) && e.target !== input && !input.parentElement?.contains(/** @type {Node} */ (e.target))) close(); };
  const mark = (/** @type {number} */ i) => {
    sel = Math.max(0, Math.min(i, rows.length - 1));
    pop.querySelectorAll('tbody tr').forEach((tr, j) => tr.setAttribute('aria-selected', String(j === sel)));
    pop.querySelector('tbody tr[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const choose = (/** @type {number} */ i) => { const r = rows[i]; if (r) { close(); onPick(r); } };
  const keys = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); mark(sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); mark(sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); choose(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close();
  };
  openPop = { close };
  input.setAttribute('aria-expanded', 'true');
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  input.addEventListener('keydown', keys, true);
  window.addEventListener('resize', place);
  try {
    const res = await fetchLookup(src, q);
    if (!pop.isConnected) return;
    const f = fold(q.trim());
    rows = f ? res.rows.filter((r) => Object.values(r.cells).some((v) => fold(v).includes(f)) || fold(r.text).includes(f)) : res.rows;
    const cols = res.cols.filter((c) => !c.hidden);
    if (!rows.length) { pop.replaceChildren(h('div', { class: 'erp-lookup-pop__empty' }, 'Không có kết quả phù hợp.')); return; }
    const table = h('table', {},
      h('thead', {}, h('tr', {}, ...cols.map((c) => h('th', {}, c.label)))),
      h('tbody', {}, ...rows.map((r, i) => h('tr', { role: 'option', 'aria-selected': String(i === 0), onclick: () => choose(i), onmousemove: () => mark(i) },
        ...cols.map((c) => h('td', {}, r.cells[c.field] ?? ''))))));
    pop.replaceChildren(table, res.total > res.rows.length ? h('div', { class: 'erp-lookup-pop__more' }, `Hiển thị ${res.rows.length}/${res.total} — gõ thêm để lọc`) : '');
    mark(0);
  } catch (err) {
    pop.replaceChildren(h('div', { class: 'erp-lookup-pop__empty' }, `Lỗi tra cứu: ${String(/** @type {any} */ (err)?.message || err)}`));
  }
}

/**
 * Gắn tra cứu F4 cho ô nhập trong form (data-control=lookup).
 * @param {HTMLInputElement} input @param {(name:string, value:string)=>void} fill
 */
export function attachLookup(input, fill) {
  const src = input.getAttribute('data-lookup-src') || '';
  if (!src) return;
  const fillFields = (input.getAttribute('data-lookup-fill') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const min = Number(input.getAttribute('data-lookup-min') || 0);
  const field = input.closest('[data-erp="field"]');
  const out = /** @type {HTMLOutputElement|null} */ (field?.querySelector('[data-erp="lookup-text"]') || null);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  const pickRow = (/** @type {LkRow} */ r) => {
    input.value = r.value;
    if (out) out.textContent = r.text;
    for (const f of fillFields) if (f in r.cells) fill(f, r.cells[f]);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  };
  const open = (/** @type {string} */ q) => { if (!input.readOnly && !input.disabled) openLookup(input, src, q, pickRow); };
  const btn = h('button', { type: 'button', class: 'erp-lookup__btn', tabindex: '-1', 'aria-label': 'Tra cứu (F4)', title: 'Tra cứu (F4)', disabled: input.readOnly || input.disabled, onclick: () => open('') }, icon('search'));
  const wrap = h('span', { class: 'erp-lookup' });
  input.replaceWith(wrap);
  wrap.append(input, btn);
  const typed = debounce(() => { if (input.value.length >= min && document.activeElement === input) open(input.value); }, 250);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) { e.preventDefault(); open(''); }
  });
  input.addEventListener('input', (e) => { if (e.isTrusted) { if (out) out.textContent = ''; typed(); } });
}
