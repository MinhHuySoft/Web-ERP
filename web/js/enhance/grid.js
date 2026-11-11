// @ts-check
import { h, fold, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatByType, comparator, parseNumber, toInvariant, formatNumber, parseDate } from '../core/format.js';
import { getGridLayout, saveGridLayout, clearGridLayout } from '../core/settings.js';
import { openDialog, toast } from '../core/ui.js';
import { popupMenu } from '../shell/shell.js';
import { openLookup } from './lookup.js';

/**
 * @typedef {{ i:number, field:string, label:string, type:string, decimals:number|null, width:number, align:string,
 *   frozen:boolean, hidden:boolean, sum:string, wrap:boolean, sortable:boolean, filterable:boolean, editor:string,
 *   required:boolean, readonly:boolean, lookupSrc:string, lookupFill:string[], group:string, options:[string,string][] }} Col
 * @typedef {{ raw:string, html:string, text:string }} Cell
 * @typedef {{ id:number, key:string, tone:string, strong:boolean, state:'unchanged'|'new'|'modified'|'deleted', cells:Cell[], invalid:Set<number> }} Row
 * @typedef {{ type:'row', row:Row } | { type:'group', label:string, count:number, sums:Record<number,number>, gkey:string, depth:number }} Item
 */

const NUM = new Set(['number', 'money', 'quantity', 'percent']);
const VIRTUAL_MIN = 160;        // từ số dòng này trở lên thì ảo hóa phần thân lưới
const CARD_WIDTH = 620;         // lưới hẹp hơn ⇒ tự chuyển dạng thẻ
/** Ô kiểu có/không: icon SVG cùng bộ biểu tượng (không dùng ký tự ✓), có nhãn cho trình đọc màn hình. */
const CHECK_HTML = '<svg class="erp-icon erp-grid__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"'
  + ' stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Có" focusable="false"><path d="m5 12 5 5L20 7"/></svg>';
/** @param {string} raw */
const boolHtml = (raw) => (raw === 'true' ? CHECK_HTML : '');

/** @type {Map<string, Set<Grid>>} */
const byForm = new Map();

/** @param {string} formId @returns {Grid[]} */
export const gridsOfForm = (formId) => Array.from(byForm.get(formId) || []).filter((g) => g.el.isConnected);

/** @param {HTMLElement} root @returns {Grid[]} */
export const gridsIn = (root) => Array.from(root.querySelectorAll('.erp-grid')).map((el) => /** @type {any} */ (el).__grid).filter(Boolean);

/**
 * Giải phóng mọi lưới trong `root` TRƯỚC khi root bị xóa / thay (đóng tab, thay màn, đóng hộp thoại, tab ngủ).
 * Không gọi thì `byForm` và ResizeObserver giữ lưới cũ — cả màn hình cũ không được trình duyệt dọn (rò bộ nhớ).
 * @param {ParentNode|null|undefined} root
 */
export function disposeGrids(root) {
  root?.querySelectorAll('.erp-grid').forEach((el) => /** @type {any} */ (el).__grid?.dispose());
}

/** @param {HTMLTableElement} table @param {import('../shell/tabs.js').TabContext|null} ctx */
export function enhanceGrid(table, ctx) { return new Grid(table, ctx); }

const esc = (/** @type {string} */ s) => String(s ?? '').replace(/[&<>"']/g, (c) => /** @type {any} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class Grid {
  /** @param {HTMLTableElement} table @param {import('../shell/tabs.js').TabContext|null} ctx */
  constructor(table, ctx) {
    this.ctx = ctx;
    this.src = table;
    const d = table.dataset;
    this.gridId = d.gridId || 'T0';
    this.keyField = d.keyField || '';
    this.selectable = d.selectable || 'single';
    this.editable = table.hasAttribute('data-editable');
    this.formId = d.form || '';
    this.sendAll = table.hasAttribute('data-send-all');
    this.totalRows = Number(d.totalRows || 0);
    const screen = table.closest('[data-erp="screen"]');
    this.layoutKey = d.layoutKey || `${screen?.getAttribute('data-screen-id') || 'screen'}.${this.gridId}`;
    this.caption = table.querySelector('caption')?.textContent?.trim() || '';
    /** @type {Col[]} */ this.cols = this.readCols(table);
    /** @type {Row[]} */ this.rows = [];
    this.seq = 0;
    for (const tr of Array.from(table.tBodies[0]?.rows || [])) this.rows.push(this.readRow(tr));
    /** @type {Record<string,{raw:string, html:string}>} */ this.serverTotals = {};
    for (const td of Array.from(table.tFoot?.querySelectorAll('td[data-field]') || [])) {
      this.serverTotals[td.getAttribute('data-field') || ''] = { raw: td.getAttribute('data-value') || '', html: td.innerHTML };
    }
    const tpl = /** @type {HTMLTemplateElement|null} */ (table.parentElement?.querySelector(`template[data-erp="row-template"][data-grid-id="${CSS.escape(this.gridId)}"]`) || null);
    this.template = tpl?.content.querySelector('tr') || null;
    tpl?.remove();
    for (const t of Array.from(table.parentElement?.querySelectorAll('template[data-erp="options"]') || [])) {
      const col = this.cols.find((c) => c.field === t.getAttribute('data-field'));
      if (col) col.options = Array.from(/** @type {HTMLTemplateElement} */ (t).content.querySelectorAll('option')).map((o) => [o.value, o.textContent || '']);
    }
    /** @type {{i:number, dir:1|-1}[]} */ this.sort = [];
    /** @type {Map<number,string>} */ this.filters = new Map();
    this.q = '';
    /** @type {number[]} */ this.groupBy = [];
    /** @type {Set<string>} */ this.collapsed = new Set();
    /** @type {Set<Row>} */ this.selected = new Set();
    /** @type {Row|null} */ this.activeRow = null;
    this.activeCol = -1;
    this.showFilterRow = false;
    /** @type {'auto'|'table'|'cards'} */ this.view = 'auto';
    this.cardLimit = 60;
    this.applyDefaults(d);
    this.loadLayout();
    this.build();
    if (this.formId) { if (!byForm.has(this.formId)) byForm.set(this.formId, new Set()); byForm.get(this.formId)?.add(this); }
  }

  /* ------------------------------------------------------------------ đọc HTML --------------------------------- */
  /** @param {HTMLTableElement} table @returns {Col[]} */
  readCols(table) {
    const ths = Array.from(table.tHead?.rows[table.tHead.rows.length - 1]?.cells || []);
    return ths.map((th, i) => {
      const d = th.dataset;
      const type = d.type || 'text';
      return {
        i, field: d.field || `c${i}`, label: th.textContent?.trim() || d.field || '', type,
        decimals: d.decimals !== undefined ? Number(d.decimals) : (type === 'money' ? 0 : null),
        width: Number(d.width) || (NUM.has(type) ? 110 : type === 'date' ? 100 : 150),
        align: d.align || (NUM.has(type) ? 'right' : type === 'bool' || type === 'date' ? 'center' : 'left'),
        frozen: th.hasAttribute('data-frozen'), hidden: th.hasAttribute('data-hidden'), sum: d.sum || '', wrap: th.hasAttribute('data-wrap'),
        sortable: d.sortable !== 'false', filterable: d.filterable !== 'false', editor: d.editor || '',
        required: th.hasAttribute('data-required'), readonly: th.hasAttribute('data-readonly'), lookupSrc: d.lookupSrc || '',
        lookupFill: (d.lookupFill || '').split(',').map((s) => s.trim()).filter(Boolean), group: d.group || '', options: [],
      };
    });
  }

  /** @param {HTMLTableRowElement} tr @returns {Row} */
  readRow(tr) {
    const cells = this.cols.map((c, i) => {
      const td = tr.cells[i];
      if (!td) return { raw: '', html: '', text: '' };
      const text = td.textContent?.trim() || '';
      const raw = td.getAttribute('data-value') ?? text;
      if (c.type === 'bool') return { raw, html: boolHtml(raw), text: formatByType(raw, 'bool') };
      return { raw, html: NUM.has(c.type) || c.type === 'date' || c.type === 'datetime' ? esc(formatByType(raw, c.type, c.decimals)) : td.innerHTML.trim(), text: NUM.has(c.type) ? formatByType(raw, c.type, c.decimals) : text };
    });
    return { id: ++this.seq, key: tr.getAttribute('data-key') || '', tone: tr.getAttribute('data-tone') || '', strong: tr.hasAttribute('data-strong'), state: 'unchanged', cells, invalid: new Set() };
  }

  /** @param {DOMStringMap} d */
  applyDefaults(d) {
    for (const part of (d.sort || '').split(',').filter(Boolean)) {
      const [f, dir] = part.split(':');
      const c = this.cols.find((x) => x.field === f);
      if (c) this.sort.push({ i: c.i, dir: dir === 'desc' ? -1 : 1 });
    }
    for (const f of (d.groupBy || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const c = this.cols.find((x) => x.field === f);
      if (c) this.groupBy.push(c.i);
    }
    /** @type {number[]} */ this.order = this.cols.map((c) => c.i);
  }

  /* ------------------------------------------------------------------ bố cục người dùng ------------------------ */
  loadLayout() {
    const L = getGridLayout(this.layoutKey);
    if (!L) return;
    const idx = (/** @type {string} */ f) => this.cols.find((c) => c.field === f)?.i;
    if (Array.isArray(L.order)) {
      const known = L.order.map(idx).filter((/** @type {any} */ x) => x !== undefined);
      this.order = [...known, ...this.order.filter((i) => !known.includes(i))];
    }
    if (L.widths) for (const c of this.cols) if (L.widths[c.field]) c.width = L.widths[c.field];
    if (Array.isArray(L.hidden)) for (const c of this.cols) c.hidden = L.hidden.includes(c.field);
    if (Array.isArray(L.frozen)) for (const c of this.cols) c.frozen = L.frozen.includes(c.field);
    if (Array.isArray(L.groupBy)) this.groupBy = L.groupBy.map(idx).filter((/** @type {any} */ x) => x !== undefined);
    if (Array.isArray(L.sort)) this.sort = L.sort.map((/** @type {any} */ s) => ({ i: idx(s.field), dir: s.dir })).filter((/** @type {any} */ s) => s.i !== undefined);
    if (L.view) this.view = L.view;
  }

  saveLayout = debounce(() => {
    saveGridLayout(this.layoutKey, {
      order: this.order.map((i) => this.cols[i].field), widths: Object.fromEntries(this.cols.map((c) => [c.field, c.width])),
      hidden: this.cols.filter((c) => c.hidden).map((c) => c.field), frozen: this.cols.filter((c) => c.frozen).map((c) => c.field),
      groupBy: this.groupBy.map((i) => this.cols[i].field), sort: this.sort.map((s) => ({ field: this.cols[s.i].field, dir: s.dir })), view: this.view,
    });
  }, 400);

  resetLayout() {
    clearGridLayout(this.layoutKey);
    const fresh = this.readCols(this.src);
    this.cols.forEach((c, i) => Object.assign(c, { width: fresh[i].width, hidden: fresh[i].hidden, frozen: fresh[i].frozen }));
    this.order = this.cols.map((c) => c.i);
    this.sort = []; this.groupBy = []; this.view = 'auto';
    this.applyDefaults(this.src.dataset);
    this.renderAll();
    toast('Đã khôi phục bố cục mặc định của lưới', 'success', 2000);
  }

  /* ------------------------------------------------------------------ dựng DOM ---------------------------------- */
  build() {
    const multi = this.selectable === 'multi';
    this.search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'erp-input erp-grid__search', placeholder: 'Tìm trong lưới…', 'aria-label': 'Tìm trong lưới',
      oninput: debounce(() => { this.q = fold(this.search.value.trim()); this.renderBody(); }, 150) }));
    this.countEl = h('span', { class: 'erp-grid__count' });
    const tb = (/** @type {string} */ ic, /** @type {string} */ label, /** @type {(e:MouseEvent)=>void} */ fn, /** @type {any} */ extra = {}) =>
      h('button', { type: 'button', class: 'erp-gbtn', title: label, 'aria-label': label, onclick: fn, ...extra }, icon(ic), h('span', {}, label));
    const bar = h('div', { class: 'erp-grid__bar' },
      this.caption ? h('strong', { class: 'erp-grid__caption' }, this.caption) : null,
      this.search, this.countEl, h('span', { class: 'erp-grid__spacer' }),
      this.editable ? tb('row-add', 'Thêm dòng', () => this.addRow()) : null,
      this.editable ? tb('row-delete', 'Xóa dòng', () => this.deleteSelected()) : null,
      tb('filter', 'Lọc theo cột', () => { this.showFilterRow = !this.showFilterRow; this.renderHead(); }, { 'aria-pressed': 'false' }),
      tb('group', 'Nhóm', (e) => this.groupMenu(/** @type {HTMLElement} */ (e.currentTarget))),
      tb('columns', 'Cột', () => this.columnsDialog()),
      tb('cards', 'Dạng thẻ', () => { this.view = this.isCards() ? 'table' : 'cards'; this.saveLayout(); this.renderAll(); }),
      tb('export', 'Xuất CSV', () => this.exportCsv()));
    this.table = /** @type {HTMLTableElement} */ (h('table', { class: 'erp-grid__table', role: 'grid', 'aria-multiselectable': multi ? 'true' : false, 'aria-label': this.caption || 'Lưới dữ liệu' }));
    this.scroll = h('div', { class: 'erp-grid__scroll', tabindex: '0' }, this.table);
    this.cardsEl = h('div', { class: 'erp-grid__cards', hidden: true });
    this.status = h('div', { class: 'erp-grid__status' });
    this.el = h('div', { class: `erp-grid${this.editable ? ' is-editable' : ''}`, dataset: { gridId: this.gridId } }, bar, this.scroll, this.cardsEl, this.status);
    /** @type {any} */ (this.el).__grid = this;
    this.src.replaceWith(this.el);
    this.scroll.addEventListener('scroll', () => { if (this.virtual) this.queueBody(); }, { passive: true });
    this.scroll.addEventListener('keydown', (e) => this.onKey(e));
    this.table.addEventListener('click', (e) => this.onClick(e));
    this.table.addEventListener('dblclick', (e) => this.onDblClick(e));
    this.cardsEl.addEventListener('click', (e) => this.onCardClick(e));
    this.ro = new ResizeObserver(() => { if (this.view === 'auto') { const c = this.isCards(); if (c !== this.lastCards) this.renderAll(); } });
    this.ro.observe(this.el);
    this.renderAll();
  }

  /** Gỡ khỏi sổ đăng ký toàn cục và ngắt theo dõi kích thước để trình duyệt dọn được lưới (xem disposeGrids). */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.ro?.disconnect();
    if (this.formId) {
      const set = byForm.get(this.formId);
      set?.delete(this);
      if (set && !set.size) byForm.delete(this.formId);
    }
    /** @type {any} */ (this.el).__grid = null;
    this.rows = [];
  }

  isCards() { return this.view === 'cards' || (this.view === 'auto' && this.el.clientWidth > 0 && this.el.clientWidth < CARD_WIDTH); }

  visibleCols() { return this.order.map((i) => this.cols[i]).filter((c) => !c.hidden); }

  renderAll() {
    this.rh = 0;    // đo lại chiều cao dòng (mật độ hiển thị có thể đã đổi)
    this.lastCards = this.isCards();
    this.scroll.hidden = this.lastCards;
    this.cardsEl.hidden = !this.lastCards;
    this.el.classList.toggle('is-cards', this.lastCards);
    if (!this.lastCards) this.renderHead();
    this.renderBody();
  }

  renderHead() {
    const cols = this.visibleCols();
    const multi = this.selectable === 'multi';
    const colgroup = h('colgroup', {}, multi ? h('col', { style: 'width:36px' }) : null, ...cols.map((c) => h('col', { style: `width:${c.width}px` })));
    const tw = cols.reduce((s, c) => s + c.width, multi ? 36 : 0);
    this.table.style.width = `${tw}px`;
    const offsets = this.frozenOffsets(cols, multi ? 36 : 0);
    const sortOf = (/** @type {Col} */ c) => this.sort.find((s) => s.i === c.i);
    /** @type {HTMLElement[]} */
    const headRows = [];
    if (cols.some((c) => c.group)) {
      const gr = h('tr', { class: 'erp-grid__grouprow' }, multi ? h('th', { class: 'erp-grid__sel is-frozen', style: 'left:0' }) : null);
      let last = null; /** @type {HTMLElement|null} */ let cell = null;
      for (const c of cols) {
        if (c.group && c.group === last && cell) { cell.colSpan += 1; continue; }
        last = c.group || null;
        cell = h('th', { scope: 'colgroup', class: c.frozen ? 'is-frozen' : '', style: c.frozen ? `left:${offsets.get(c.i)}px` : '' }, c.group || '');
        /** @type {HTMLTableCellElement} */ (cell).colSpan = 1;
        gr.append(cell);
      }
      headRows.push(gr);
    }
    const allSel = multi && this.rows.length > 0 && this.rows.every((r) => this.selected.has(r));
    headRows.push(h('tr', {},
      multi ? h('th', { class: 'erp-grid__sel is-frozen', style: 'left:0', scope: 'col' },
        h('input', { type: 'checkbox', 'aria-label': 'Chọn tất cả', checked: allSel, onchange: (/** @type {Event} */ e) => this.selectAll(/** @type {HTMLInputElement} */ (e.target).checked) })) : null,
      ...cols.map((c) => {
        const s = sortOf(c);
        const th = h('th', { scope: 'col', class: `${c.frozen ? 'is-frozen ' : ''}is-${c.align}`, style: c.frozen ? `left:${offsets.get(c.i)}px` : '',
          'aria-sort': s ? (s.dir === 1 ? 'ascending' : 'descending') : 'none', dataset: { col: String(c.i) } },
        h('button', { type: 'button', class: 'erp-grid__hbtn', title: c.sortable ? 'Bấm để sắp xếp (Shift: nhiều cột)' : c.label,
          onclick: (/** @type {MouseEvent} */ e) => c.sortable && this.toggleSort(c, e.shiftKey) },
        h('span', { class: 'erp-grid__hlabel' }, c.label, c.required && this.editable ? h('b', { class: 'erp-req', 'aria-hidden': 'true' }, '*') : null),
        s ? icon(s.dir === 1 ? 'chevron-up' : 'chevron-down', 'erp-grid__sorticon') : null,
        s && this.sort.length > 1 ? h('small', {}, String(this.sort.indexOf(s) + 1)) : null),
        h('button', { type: 'button', class: 'erp-grid__hmenu', 'aria-label': `Tùy chọn cột ${c.label}`, onclick: (/** @type {MouseEvent} */ e) => this.colMenu(c, /** @type {HTMLElement} */ (e.currentTarget)) }, icon('chevron-down')),
        h('span', { class: 'erp-grid__resizer', 'aria-hidden': 'true', onpointerdown: (/** @type {PointerEvent} */ e) => this.startResize(e, c) }));
        th.addEventListener('contextmenu', (e) => { e.preventDefault(); this.colMenu(c, th); });
        return th;
      })));
    if (this.showFilterRow) {
      headRows.push(h('tr', { class: 'erp-grid__filterrow' }, multi ? h('th', { class: 'erp-grid__sel is-frozen', style: 'left:0' }) : null,
        ...cols.map((c) => h('th', { class: c.frozen ? 'is-frozen' : '', style: c.frozen ? `left:${offsets.get(c.i)}px` : '' },
          c.filterable ? h('input', { type: 'search', class: 'erp-input', value: this.filters.get(c.i) || '', 'aria-label': `Lọc ${c.label}`,
            placeholder: NUM.has(c.type) ? '>100, 10..20' : 'chứa…',
            oninput: debounce((/** @type {Event} */ e) => { const v = /** @type {HTMLInputElement} */ (e.target).value.trim(); if (v) this.filters.set(c.i, v); else this.filters.delete(c.i); this.renderBody(); }, 200) }) : null))));
    }
    const thead = h('thead', {}, ...headRows);
    this.tbody = h('tbody', {});
    this.tfoot = h('tfoot', {});
    this.table.replaceChildren(colgroup, thead, this.tbody, this.tfoot);
    this.offsets = offsets;
    this.el.querySelector('.erp-gbtn[aria-pressed]')?.setAttribute('aria-pressed', String(this.showFilterRow));
  }

  /** @param {Col[]} cols @param {number} start */
  frozenOffsets(cols, start) {
    /** @type {Map<number,number>} */ const m = new Map();
    let x = start;
    for (const c of cols) { if (!c.frozen) break; m.set(c.i, x); x += c.width; }
    // cột cố định phải liền nhau từ trái; cột "cố định" nằm sau cột thường thì bỏ cố định
    for (const c of cols) if (c.frozen && !m.has(c.i)) c.frozen = false;
    return m;
  }

  /* ------------------------------------------------------------------ dữ liệu hiển thị --------------------------- */
  /** @returns {Row[]} */
  filtered() {
    const cols = this.visibleCols();
    /** @type {[number, (r:Row)=>boolean][]} */
    const tests = Array.from(this.filters.entries()).map(([i, v]) => [i, makeTest(this.cols[i], v)]);
    let rows = this.rows.filter((r) => {
      for (const [, t] of tests) if (!t(r)) return false;
      if (this.q && !cols.some((c) => fold(r.cells[c.i].text || r.cells[c.i].raw).includes(this.q))) return false;
      return true;
    });
    if (this.sort.length) {
      const cmps = this.sort.map((s) => ({ s, cmp: comparator(this.cols[s.i].type) }));
      rows = rows.slice().sort((a, b) => {
        for (const { s, cmp } of cmps) { const r = cmp(a.cells[s.i].raw, b.cells[s.i].raw) * s.dir; if (r) return r; }
        return a.id - b.id;
      });
    }
    return rows;
  }

  /** @param {Row[]} rows @returns {Item[]} */
  itemsOf(rows) {
    if (!this.groupBy.length) return rows.map((row) => ({ type: 'row', row }));
    /** @type {Item[]} */ const out = [];
    const sumCols = this.cols.filter((c) => c.sum === 'sum');
    const walk = (/** @type {Row[]} */ list, /** @type {number} */ depth, /** @type {string} */ prefix) => {
      const gi = this.groupBy[depth];
      if (gi === undefined) { list.forEach((row) => out.push({ type: 'row', row })); return; }
      const cmp = comparator(this.cols[gi].type);
      /** @type {Map<string, Row[]>} */ const m = new Map();
      for (const r of list) { const k = r.cells[gi].raw; if (!m.has(k)) m.set(k, []); m.get(k)?.push(r); }
      for (const k of Array.from(m.keys()).sort(cmp)) {
        const rs = /** @type {Row[]} */ (m.get(k));
        const gkey = `${prefix}|${k}`;
        /** @type {Record<number,number>} */ const sums = {};
        for (const c of sumCols) sums[c.i] = rs.reduce((s, r) => s + (r.state === 'deleted' ? 0 : Number(r.cells[c.i].raw) || 0), 0);
        const label = rs[0].cells[gi].text || rs[0].cells[gi].raw || '(trống)';
        out.push({ type: 'group', label: `${this.cols[gi].label}: ${label}`, count: rs.length, sums, gkey, depth });
        if (!this.collapsed.has(gkey)) walk(rs, depth + 1, gkey);
      }
    };
    walk(rows, 0, '');
    return out;
  }

  queueBody() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.paintWindow(); });
  }

  renderBody() {
    this.view_rows = this.filtered();
    this.items = this.itemsOf(this.view_rows);
    this.updateStatus();
    if (this.isCards()) { this.renderCards(); return; }
    this.virtual = this.items.length >= VIRTUAL_MIN;
    if (!this.virtual) { this.tbody.innerHTML = this.items.map((it) => this.itemHtml(it)).join(''); }
    else { this.lastWin = ''; this.paintWindow(); }
    this.renderFoot();
  }

  paintWindow() {
    if (!this.items) return;
    const rh = this.rowHeight();
    const vh = this.scroll.clientHeight || 600;
    const head = /** @type {HTMLElement|null} */ (this.table.tHead)?.offsetHeight || 0;
    const start = Math.max(0, Math.floor((this.scroll.scrollTop - head) / rh) - 15);
    const end = Math.min(this.items.length, start + Math.ceil(vh / rh) + 35);
    const win = `${start}:${end}:${this.items.length}`;
    if (win === this.lastWin) return;
    this.lastWin = win;
    const cs = this.visibleCols().length + (this.selectable === 'multi' ? 1 : 0);
    const top = start * rh, bottom = (this.items.length - end) * rh;
    this.tbody.innerHTML = (top ? `<tr class="erp-grid__spacer" aria-hidden="true"><td colspan="${cs}" style="height:${top}px"></td></tr>` : '')
      + this.items.slice(start, end).map((it) => this.itemHtml(it)).join('')
      + (bottom ? `<tr class="erp-grid__spacer" aria-hidden="true"><td colspan="${cs}" style="height:${bottom}px"></td></tr>` : '');
  }

  rowHeight() {
    if (!this.rh) {
      const v = parseFloat(getComputedStyle(this.el).getPropertyValue('--erp-row-h')) || 32;
      this.rh = v;
    }
    return this.rh;
  }

  /** @param {Item} it */
  itemHtml(it) {
    const cols = this.visibleCols();
    const multi = this.selectable === 'multi';
    if (it.type === 'group') {
      const cs = cols.length + (multi ? 1 : 0);
      const sums = cols.filter((c) => it.sums[c.i] !== undefined).map((c) => `<span>${esc(c.label)}: <b>${esc(formatNumber(it.sums[c.i], c.decimals))}</b></span>`).join('');
      const open = !this.collapsed.has(it.gkey);
      return `<tr class="erp-grid__group" data-gkey="${esc(it.gkey)}" style="--depth:${it.depth}"><td colspan="${cs}"><button type="button" class="erp-grid__gtoggle" aria-expanded="${open}">`
        + `<span class="erp-grid__caret">${open ? '▾' : '▸'}</span> ${esc(it.label)} <small>(${it.count})</small></button>${sums ? `<span class="erp-grid__gsums">${sums}</span>` : ''}</td></tr>`;
    }
    const r = it.row;
    const sel = this.selected.has(r);
    const cls = [r.state !== 'unchanged' ? `is-${r.state}` : '', sel ? 'is-selected' : '', r === this.activeRow ? 'is-active' : '', r.strong ? 'is-strong' : ''].filter(Boolean).join(' ');
    const tds = cols.map((c) => {
      const cell = r.cells[c.i];
      const fz = c.frozen ? ` is-frozen" style="left:${this.offsets?.get(c.i) || 0}px` : '';
      const inv = r.invalid.has(c.i) ? ' aria-invalid="true"' : '';
      const act = r === this.activeRow && this.activeCol === c.i ? ' is-cell-active' : '';
      return `<td class="is-${c.align}${c.wrap ? ' is-wrap' : ''}${act}${fz}" data-col="${c.i}"${inv}>${cell.html}</td>`;
    }).join('');
    const selTd = multi ? `<td class="erp-grid__sel is-frozen" style="left:0"><input type="checkbox" aria-label="Chọn dòng"${sel ? ' checked' : ''}></td>` : '';
    return `<tr data-rid="${r.id}"${r.tone ? ` data-tone="${esc(r.tone)}"` : ''} class="${cls}" aria-selected="${sel}">${selTd}${tds}</tr>`;
  }

  renderFoot() {
    const cols = this.visibleCols();
    const sumCols = cols.filter((c) => c.sum);
    if (!sumCols.length || !this.tfoot) { if (this.tfoot) this.tfoot.innerHTML = ''; return; }
    const local = this.filters.size > 0 || !!this.q || this.rows.some((r) => r.state !== 'unchanged');
    const live = this.view_rows.filter((r) => r.state !== 'deleted');
    const useServer = !local && Object.keys(this.serverTotals).length > 0;
    let labelDone = false;
    const multi = this.selectable === 'multi';
    const tds = cols.map((c) => {
      const fz = c.frozen ? ` is-frozen" style="left:${this.offsets?.get(c.i) || 0}px` : '';
      if (c.sum) {
        let v;
        if (useServer && this.serverTotals[c.field]) v = esc(formatNumber(this.serverTotals[c.field].raw, c.decimals));
        else v = esc(formatNumber(aggregate(c.sum, live.map((r) => Number(r.cells[c.i].raw) || 0)), c.sum === 'count' ? 0 : c.decimals));
        return `<td class="is-right${fz}">${v}</td>`;
      }
      if (!labelDone) { labelDone = true; return `<td class="${fz}"><b>${useServer ? 'Tổng cộng' : local ? 'Tổng (đang lọc)' : 'Tổng cộng'}</b></td>`; }
      return `<td class="${fz}"></td>`;
    }).join('');
    this.tfoot.innerHTML = `<tr>${multi ? '<td class="erp-grid__sel is-frozen" style="left:0"></td>' : ''}${tds}</tr>`;
  }

  updateStatus() {
    const shown = this.view_rows.length, total = this.rows.length;
    this.countEl.textContent = shown === total ? `${total} dòng` : `${shown}/${total} dòng`;
    const parts = [];
    if (this.totalRows > total) parts.push(`Máy chủ có ${this.totalRows.toLocaleString('vi-VN')} dòng — đang hiển thị ${total.toLocaleString('vi-VN')}`);
    if (this.selected.size) parts.push(`Đã chọn ${this.selected.size}`);
    const changed = this.rows.filter((r) => r.state !== 'unchanged').length;
    if (changed) parts.push(`${changed} dòng thay đổi chưa lưu`);
    if (this.groupBy.length) parts.push(`Nhóm theo: ${this.groupBy.map((i) => this.cols[i].label).join(' › ')}`);
    this.status.textContent = parts.join(' · ');
    this.status.hidden = !parts.length;
  }

  /* ------------------------------------------------------------------ dạng thẻ (di động) ------------------------- */
  renderCards() {
    const cols = this.visibleCols();
    const titleCol = cols.find((c) => c.type === 'link') || cols[0];
    const statusCol = cols.find((c) => c.type === 'status');
    const rest = cols.filter((c) => c !== titleCol && c !== statusCol).slice(0, 6);
    const rows = this.view_rows.slice(0, this.cardLimit);
    this.cardsEl.innerHTML = rows.map((r) => {
      const fields = rest.map((c) => `<div><dt>${esc(c.label)}</dt><dd class="is-${c.align}">${r.cells[c.i].html || '—'}</dd></div>`).join('');
      return `<article class="erp-card${this.selected.has(r) ? ' is-selected' : ''}${r.state !== 'unchanged' ? ` is-${r.state}` : ''}" data-rid="${r.id}"${r.tone ? ` data-tone="${esc(r.tone)}"` : ''} tabindex="0">`
        + `<header><span class="erp-card__title">${titleCol ? r.cells[titleCol.i].html : ''}</span>${statusCol ? r.cells[statusCol.i].html : ''}</header><dl>${fields}</dl></article>`;
    }).join('') + (this.view_rows.length > rows.length ? `<button type="button" class="erp-btn erp-grid__more">Xem thêm (${this.view_rows.length - rows.length} dòng)</button>` : '')
      + (this.view_rows.length ? '' : '<p class="erp-empty">Không có dữ liệu.</p>');
  }

  /** @param {MouseEvent} e */
  onCardClick(e) {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t.closest('.erp-grid__more')) { this.cardLimit += 60; this.renderCards(); return; }
    const card = /** @type {HTMLElement|null} */ (t.closest('.erp-card'));
    if (!card || t.closest('a')) return;
    const row = this.rowById(Number(card.dataset.rid));
    if (!row) return;
    const link = /** @type {HTMLAnchorElement|null} */ (card.querySelector('a[href]'));
    if (link && !this.editable) { link.click(); return; }
    this.toggleSelect(row, this.selectable === 'multi');
    this.renderCards();
  }

  /* ------------------------------------------------------------------ tương tác ----------------------------------- */
  /** @param {number} id */
  rowById(id) { return this.rows.find((r) => r.id === id) || null; }

  /** @param {MouseEvent} e */
  onClick(e) {
    const t = /** @type {HTMLElement} */ (e.target);
    const g = /** @type {HTMLElement|null} */ (t.closest('tr.erp-grid__group'));
    if (g) { const k = g.dataset.gkey || ''; if (this.collapsed.has(k)) this.collapsed.delete(k); else this.collapsed.add(k); this.renderBody(); return; }
    const tr = /** @type {HTMLElement|null} */ (t.closest('tr[data-rid]'));
    if (!tr) return;
    const row = this.rowById(Number(tr.dataset.rid));
    if (!row) return;
    const td = /** @type {HTMLElement|null} */ (t.closest('td[data-col]'));
    if (t.matches('input[type=checkbox]') && t.closest('.erp-grid__sel')) {
      this.toggleSelect(row, true, e.shiftKey);
    } else if (!t.closest('a')) {
      if (this.selectable === 'multi' && (e.ctrlKey || e.metaKey)) this.toggleSelect(row, true);
      else if (this.selectable === 'multi' && e.shiftKey) this.toggleSelect(row, true, true);
      else if (this.selectable !== 'none') { this.selected.clear(); this.selected.add(row); }
      if (this.editable && td) {
        const c = this.cols[Number(td.dataset.col)];
        if (c.editor === 'checkbox' && !c.readonly && row.state !== 'deleted') { this.setCell(row, c, row.cells[c.i].raw === 'true' ? 'false' : 'true'); }
      }
    }
    this.activeRow = row;
    if (td) this.activeCol = Number(td.dataset.col);
    // bấm vào link: để sự kiện click đi hết (điều hướng) rồi mới vẽ lại dòng
    if (t.closest('a')) requestAnimationFrame(() => this.renderBodyKeepScroll());
    else this.renderBodyKeepScroll();
  }

  /** @param {MouseEvent} e */
  onDblClick(e) {
    const t = /** @type {HTMLElement} */ (e.target);
    const tr = /** @type {HTMLElement|null} */ (t.closest('tr[data-rid]'));
    if (!tr) return;
    const row = this.rowById(Number(tr.dataset.rid));
    const td = /** @type {HTMLElement|null} */ (t.closest('td[data-col]'));
    if (!row) return;
    if (this.editable && td) { this.editCell(row, this.cols[Number(td.dataset.col)]); return; }
    /** @type {HTMLAnchorElement|null} */ (tr.querySelector('a[href]'))?.click();
  }

  renderBodyKeepScroll() {
    const st = this.scroll.scrollTop;
    if (this.virtual) { this.lastWin = ''; this.paintWindow(); } else this.tbody.innerHTML = this.items.map((it) => this.itemHtml(it)).join('');
    this.scroll.scrollTop = st;
    this.updateStatus();
    const head = this.table.tHead?.querySelector('.erp-grid__sel input');
    if (head) /** @type {HTMLInputElement} */ (head).checked = this.rows.length > 0 && this.rows.every((r) => this.selected.has(r));
  }

  /** @param {Row} row @param {boolean} multi @param {boolean} [range] */
  toggleSelect(row, multi, range = false) {
    if (!multi) { this.selected.clear(); this.selected.add(row); return; }
    if (range && this.activeRow) {
      const list = this.view_rows;
      const a = list.indexOf(this.activeRow), b = list.indexOf(row);
      if (a >= 0 && b >= 0) { for (let i = Math.min(a, b); i <= Math.max(a, b); i++) this.selected.add(list[i]); return; }
    }
    if (this.selected.has(row)) this.selected.delete(row); else this.selected.add(row);
  }

  /** @param {boolean} on */
  selectAll(on) { this.selected = new Set(on ? this.view_rows : []); this.renderBodyKeepScroll(); }

  selectedKeys() { return Array.from(this.selected).map((r) => r.key).filter(Boolean); }

  /** @param {KeyboardEvent} e */
  onKey(e) {
    if (/** @type {HTMLElement} */ (e.target).closest('.erp-grid__editor, thead')) return;
    const rows = this.view_rows || [];
    if (!rows.length) return;
    const cols = this.visibleCols();
    let i = this.activeRow ? rows.indexOf(this.activeRow) : -1;
    let ci = cols.findIndex((c) => c.i === this.activeCol);
    const move = (/** @type {number} */ ni, /** @type {number} */ nci) => {
      i = Math.max(0, Math.min(rows.length - 1, ni));
      ci = Math.max(0, Math.min(cols.length - 1, nci));
      this.activeRow = rows[i]; this.activeCol = cols[ci].i;
      if (this.selectable === 'single') { this.selected.clear(); this.selected.add(this.activeRow); }
      this.ensureVisible(this.activeRow);
      this.renderBodyKeepScroll();
    };
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(i + 1, Math.max(ci, 0)); break;
      case 'ArrowUp': e.preventDefault(); move(i - 1, Math.max(ci, 0)); break;
      case 'ArrowRight': e.preventDefault(); move(Math.max(i, 0), ci + 1); break;
      case 'ArrowLeft': e.preventDefault(); move(Math.max(i, 0), ci - 1); break;
      case 'PageDown': e.preventDefault(); move(i + 15, Math.max(ci, 0)); break;
      case 'PageUp': e.preventDefault(); move(i - 15, Math.max(ci, 0)); break;
      case 'Home': if (e.ctrlKey) { e.preventDefault(); move(0, Math.max(ci, 0)); } break;
      case 'End': if (e.ctrlKey) { e.preventDefault(); move(rows.length - 1, Math.max(ci, 0)); } break;
      case ' ': if (this.activeRow && this.selectable === 'multi') { e.preventDefault(); this.toggleSelect(this.activeRow, true); this.renderBodyKeepScroll(); } break;
      case 'Enter': case 'F2':
        if (!this.activeRow) return;
        e.preventDefault();
        if (this.editable && this.activeCol >= 0) this.editCell(this.activeRow, this.cols[this.activeCol]);
        else /** @type {HTMLAnchorElement|null} */ (this.tbody.querySelector(`tr[data-rid="${this.activeRow.id}"] a[href]`))?.click();
        break;
      case 'Insert': if (this.editable) { e.preventDefault(); this.addRow(); } break;
      case 'Delete': if (this.editable && e.ctrlKey) { e.preventDefault(); this.deleteSelected(); } break;
      case 'a': case 'A': if (e.ctrlKey && this.selectable === 'multi') { e.preventDefault(); this.selectAll(true); } break;
      default:
        if (this.editable && this.activeRow && this.activeCol >= 0 && e.key.length === 1 && !e.ctrlKey && !e.altKey) {
          e.preventDefault(); this.editCell(this.activeRow, this.cols[this.activeCol], e.key);
        }
    }
  }

  /** @param {Row} row */
  ensureVisible(row) {
    const idx = this.items.findIndex((it) => it.type === 'row' && it.row === row);
    if (idx < 0) return;
    const rh = this.rowHeight();
    const head = this.table.tHead?.offsetHeight || 0;
    const foot = this.table.tFoot?.offsetHeight || 0;
    const top = idx * rh;
    const view = this.scroll.clientHeight - head - foot;
    if (top < this.scroll.scrollTop) this.scroll.scrollTop = top;
    else if (top + rh > this.scroll.scrollTop + view) this.scroll.scrollTop = top + rh - view;
  }

  /* ------------------------------------------------------------------ sắp xếp / nhóm / cột ------------------------ */
  /** @param {Col} c @param {boolean} multi */
  toggleSort(c, multi) {
    const s = this.sort.find((x) => x.i === c.i);
    if (!multi) this.sort = s ? (s.dir === 1 ? [{ i: c.i, dir: -1 }] : []) : [{ i: c.i, dir: 1 }];
    else if (!s) this.sort.push({ i: c.i, dir: 1 });
    else if (s.dir === 1) s.dir = -1;
    else this.sort = this.sort.filter((x) => x !== s);
    this.saveLayout();
    this.renderHead();
    this.renderBody();
  }

  /** @param {Col} c @param {HTMLElement} anchor */
  colMenu(c, anchor) {
    const grouped = this.groupBy.includes(c.i);
    popupMenu(anchor, [
      { icon: 'chevron-up', label: 'Sắp xếp tăng dần', onClick: () => { this.sort = [{ i: c.i, dir: 1 }]; this.saveLayout(); this.renderHead(); this.renderBody(); } },
      { icon: 'chevron-down', label: 'Sắp xếp giảm dần', onClick: () => { this.sort = [{ i: c.i, dir: -1 }]; this.saveLayout(); this.renderHead(); this.renderBody(); } },
      { icon: 'close', label: 'Bỏ sắp xếp', onClick: () => { this.sort = []; this.saveLayout(); this.renderHead(); this.renderBody(); }, disabled: !this.sort.length },
      { icon: 'group', label: grouped ? 'Bỏ nhóm theo cột này' : 'Nhóm theo cột này', onClick: () => { this.groupBy = grouped ? this.groupBy.filter((x) => x !== c.i) : [...this.groupBy, c.i]; this.collapsed.clear(); this.saveLayout(); this.renderBody(); } },
      { icon: 'pin', label: c.frozen ? 'Bỏ cố định cột' : 'Cố định đến cột này', onClick: () => this.freezeTo(c) },
      { icon: 'expand', label: 'Tự co độ rộng', onClick: () => this.autoWidth(c) },
      { icon: 'columns', label: 'Ẩn cột', onClick: () => { c.hidden = true; this.saveLayout(); this.renderAll(); }, disabled: this.visibleCols().length <= 1 },
      { icon: 'reload', label: 'Khôi phục bố cục mặc định', onClick: () => this.resetLayout() },
    ]);
  }

  /** @param {Col} c */
  freezeTo(c) {
    const cols = this.visibleCols();
    if (c.frozen) { cols.forEach((x) => { x.frozen = false; }); }
    else { let on = true; for (const x of cols) { x.frozen = on; if (x === c) on = false; } }
    this.saveLayout(); this.renderAll();
  }

  /** @param {Col} c */
  autoWidth(c) {
    const ctx2d = document.createElement('canvas').getContext('2d');
    if (!ctx2d) return;
    ctx2d.font = getComputedStyle(this.table).font;
    let w = ctx2d.measureText(c.label).width + 40;
    for (const r of this.rows.slice(0, 300)) w = Math.max(w, ctx2d.measureText(r.cells[c.i].text || r.cells[c.i].raw).width + 24);
    c.width = Math.min(Math.ceil(w), 520);
    this.saveLayout(); this.renderAll();
  }

  /** @param {HTMLElement} anchor */
  groupMenu(anchor) {
    const cols = this.visibleCols().filter((c) => !NUM.has(c.type));
    popupMenu(anchor, [
      { icon: 'close', label: 'Không nhóm', checked: !this.groupBy.length, onClick: () => { this.groupBy = []; this.saveLayout(); this.renderBody(); } },
      ...cols.map((c) => ({ icon: 'group', label: c.label, checked: this.groupBy[0] === c.i, onClick: () => { this.groupBy = [c.i]; this.collapsed.clear(); this.saveLayout(); this.renderBody(); } })),
    ]);
  }

  columnsDialog() {
    const list = h('ol', { class: 'erp-colpick' });
    const draw = () => {
      list.replaceChildren(...this.order.map((i, pos) => {
        const c = this.cols[i];
        const id = `cp-${this.gridId}-${i}`;
        return h('li', {},
          h('input', { type: 'checkbox', id, checked: !c.hidden, onchange: (/** @type {Event} */ e) => { c.hidden = !/** @type {HTMLInputElement} */ (e.target).checked; this.saveLayout(); this.renderAll(); } }),
          h('label', { for: id }, c.label), h('small', {}, c.field),
          h('button', { type: 'button', class: 'erp-iconbtn', 'aria-label': `Đưa ${c.label} lên`, disabled: pos === 0, onclick: () => { this.move(pos, -1); draw(); } }, icon('chevron-up')),
          h('button', { type: 'button', class: 'erp-iconbtn', 'aria-label': `Đưa ${c.label} xuống`, disabled: pos === this.order.length - 1, onclick: () => { this.move(pos, 1); draw(); } }, icon('chevron-down')));
      }));
    };
    draw();
    openDialog({ title: 'Chọn và sắp xếp cột', body: list, size: 'sm', footer: [h('button', { type: 'button', class: 'erp-btn', onclick: () => { this.resetLayout(); draw(); } }, icon('reload'), 'Mặc định')] });
  }

  /** @param {number} pos @param {number} dir */
  move(pos, dir) {
    const j = pos + dir;
    if (j < 0 || j >= this.order.length) return;
    [this.order[pos], this.order[j]] = [this.order[j], this.order[pos]];
    this.saveLayout(); this.renderAll();
  }

  /** @param {PointerEvent} e @param {Col} c */
  startResize(e, c) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startW = c.width;
    const th = /** @type {HTMLElement} */ (e.target).closest('th');
    const colEl = /** @type {HTMLElement|null} */ (this.table.querySelector(`colgroup col:nth-child(${this.visibleCols().indexOf(c) + 1 + (this.selectable === 'multi' ? 1 : 0)})`));
    const mv = (/** @type {PointerEvent} */ ev) => {
      c.width = Math.max(48, Math.min(800, startW + ev.clientX - startX));
      if (colEl) colEl.style.width = `${c.width}px`;
      this.table.style.width = `${this.visibleCols().reduce((s, x) => s + x.width, this.selectable === 'multi' ? 36 : 0)}px`;
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); th?.classList.remove('is-resizing'); this.saveLayout(); this.renderAll(); };
    th?.classList.add('is-resizing');
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
  }

  /* ------------------------------------------------------------------ sửa trực tiếp -------------------------------- */
  /** @param {Row} row @param {Col} col @param {string} [initial] */
  editCell(row, col, initial) {
    if (!this.editable || col.readonly || col.editor === 'none' || row.state === 'deleted') return;
    this.activeRow = row; this.activeCol = col.i;
    this.ensureVisible(row);
    this.renderBodyKeepScroll();
    const td = /** @type {HTMLElement|null} */ (this.tbody.querySelector(`tr[data-rid="${row.id}"] td[data-col="${col.i}"]`));
    if (!td) return;
    const cell = row.cells[col.i];
    const kind = col.editor || (NUM.has(col.type) ? 'number' : col.type === 'date' ? 'date' : col.type === 'bool' ? 'checkbox' : 'text');
    if (kind === 'checkbox') { this.setCell(row, col, cell.raw === 'true' ? 'false' : 'true'); return; }
    /** @type {HTMLInputElement|HTMLSelectElement} */
    let ed;
    if (kind === 'select') {
      ed = /** @type {HTMLSelectElement} */ (h('select', { class: 'erp-grid__editor erp-input' }, h('option', { value: '' }, ''), ...col.options.map(([v, t]) => h('option', { value: v, selected: v === cell.raw }, t))));
    } else {
      ed = /** @type {HTMLInputElement} */ (h('input', { class: 'erp-grid__editor erp-input', type: kind === 'date' ? 'date' : 'text', inputmode: kind === 'number' || kind === 'money' ? 'decimal' : false, autocomplete: 'off' }));
      ed.value = initial ?? (kind === 'number' || kind === 'money' ? (cell.raw === '' ? '' : formatNumber(cell.raw, col.decimals)) : kind === 'date' ? (cell.raw || '').slice(0, 10) : cell.raw);
    }
    td.classList.add('is-editing');
    td.replaceChildren(ed);
    ed.focus();
    if (initial === undefined && ed instanceof HTMLInputElement && ed.type === 'text') ed.select();
    let done = false;
    const finish = (/** @type {boolean} */ commit, /** @type {number} */ moveRow = 0, /** @type {number} */ moveCol = 0) => {
      if (done) return; done = true;
      if (commit) {
        let v = ed.value;
        if (kind === 'number' || kind === 'money') { const n = parseNumber(v); v = v.trim() === '' ? '' : Number.isFinite(n) ? toInvariant(n) : cell.raw; }
        if (kind === 'date' && v && !/^\d{4}-/.test(v)) v = parseDate(v);
        if (v !== cell.raw) this.setCell(row, col, v, ed instanceof HTMLSelectElement ? ed.selectedOptions[0]?.textContent || v : undefined);
      }
      this.renderBodyKeepScroll();
      if (moveRow || moveCol) this.moveEdit(row, col, moveRow, moveCol);
      else this.scroll.focus({ preventScroll: true });
    };
    ed.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(true, 1, 0); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); finish(true, 0, e.shiftKey ? -1 : 1); }
      else if (e.key === 'F4' && kind === 'lookup' && ed instanceof HTMLInputElement) { e.preventDefault(); this.openCellLookup(ed, row, col, ''); }
    });
    ed.addEventListener('blur', () => setTimeout(() => { if (!document.querySelector('.erp-lookup-pop')) finish(true); }, 120));
    if (kind === 'lookup' && ed instanceof HTMLInputElement) {
      const inp = ed;
      inp.addEventListener('input', debounce(() => this.openCellLookup(inp, row, col, inp.value), 250));
      if (initial) this.openCellLookup(inp, row, col, initial);
    }
  }

  /** @param {HTMLInputElement} input @param {Row} row @param {Col} col @param {string} q */
  openCellLookup(input, row, col, q) {
    if (!col.lookupSrc) return;
    openLookup(input, col.lookupSrc, q, (r) => {
      input.value = r.value;
      this.setCell(row, col, r.value);
      for (const f of col.lookupFill) {
        const target = this.cols.find((c) => c.field === f);
        if (target && f in r.cells) this.setCell(row, target, r.cells[f]);
      }
      input.blur();
    });
  }

  /** @param {Row} row @param {Col} col @param {number} dr @param {number} dc */
  moveEdit(row, col, dr, dc) {
    const cols = this.visibleCols().filter((c) => !c.readonly && c.editor !== 'none');
    let ci = cols.indexOf(col);
    let ri = this.view_rows.indexOf(row);
    if (dc) { ci += dc; if (ci >= cols.length) { ci = 0; ri += 1; } else if (ci < 0) { ci = cols.length - 1; ri -= 1; } }
    if (dr) ri += dr;
    if (ri >= this.view_rows.length) { if (dr) { this.scroll.focus(); return; } this.addRow(); return; }
    if (ri < 0 || !cols[ci]) return;
    this.editCell(this.view_rows[ri], cols[ci]);
  }

  /** @param {Row} row @param {Col} col @param {string} raw @param {string} [text] */
  setCell(row, col, raw, text) {
    const t = text ?? (NUM.has(col.type) || col.type === 'date' || col.type === 'datetime' || col.type === 'bool' ? formatByType(raw, col.type, col.decimals) : raw);
    row.cells[col.i] = { raw, text: t, html: col.type === 'bool' ? boolHtml(raw) : esc(t) };
    if (row.state === 'unchanged') row.state = 'modified';
    row.invalid.delete(col.i);
    this.markDirty();
    this.renderFoot();
    this.updateStatus();
  }

  /** Chỉ đánh dấu "có thay đổi" khi lưới còn trên trang (lưới cũ có thể còn sự kiện trễ sau khi màn hình đã thay). */
  markDirty() { if (this.el.isConnected) this.ctx?.setDirty(true); }

  addRow() {
    /** @type {Row} */
    let row;
    if (this.template) {
      row = this.readRow(/** @type {HTMLTableRowElement} */ (this.template.cloneNode(true)));
      row.key = '';
    } else row = { id: ++this.seq, key: '', tone: '', strong: false, state: 'new', cells: this.cols.map(() => ({ raw: '', html: '', text: '' })), invalid: new Set() };
    row.state = 'new';
    this.rows.push(row);
    this.filters.clear(); this.q = ''; if (this.search) this.search.value = '';
    this.renderBody();
    this.markDirty();
    const first = this.visibleCols().find((c) => !c.readonly && c.editor !== 'none');
    this.scroll.scrollTop = this.scroll.scrollHeight;
    if (first) setTimeout(() => this.editCell(row, first), 30);
  }

  deleteSelected() {
    const rows = this.selected.size ? Array.from(this.selected) : this.activeRow ? [this.activeRow] : [];
    if (!rows.length) { toast('Chọn dòng cần xóa trước', 'info', 2000); return; }
    for (const r of rows) {
      if (r.state === 'new') this.rows.splice(this.rows.indexOf(r), 1);
      else r.state = r.state === 'deleted' ? 'modified' : 'deleted';
    }
    this.selected.clear();
    this.markDirty();
    this.renderBody();
  }

  /** Kiểm tra cột bắt buộc trước khi gửi. @returns {boolean} */
  validate() {
    let ok = true;
    for (const r of this.rows) {
      r.invalid.clear();
      if (r.state === 'deleted' || r.state === 'unchanged') continue;
      for (const c of this.cols) if (c.required && !String(r.cells[c.i].raw).trim()) { r.invalid.add(c.i); ok = false; }
    }
    if (!ok) { this.renderBodyKeepScroll(); toast(`Lưới "${this.caption || this.gridId}": còn ô bắt buộc chưa nhập`, 'error'); }
    return ok;
  }

  /** Dữ liệu gửi kèm form (chuẩn ERP-HTML 11.6). @returns {[string,string][]} */
  serialize() {
    /** @type {[string,string][]} */ const out = [];
    let i = 0;
    const ordered = this.sort.length ? this.filteredAll() : this.rows;
    for (const r of ordered) {
      if (r.state === 'unchanged' && !this.sendAll) continue;
      if (r.state === 'new' && r.cells.every((c) => !String(c.raw).trim())) continue;
      const p = `${this.gridId}[${i}]`;
      out.push([`${p}.__key`, r.key], [`${p}.__state`, r.state]);
      if (r.state !== 'deleted') this.cols.forEach((c) => out.push([`${p}.${c.field}`, r.cells[c.i].raw]));
      i++;
    }
    return out;
  }

  /** Mọi dòng theo thứ tự sắp xếp hiện tại, bỏ qua bộ lọc. */
  filteredAll() {
    const cmps = this.sort.map((s) => ({ s, cmp: comparator(this.cols[s.i].type) }));
    return this.rows.slice().sort((a, b) => { for (const { s, cmp } of cmps) { const r = cmp(a.cells[s.i].raw, b.cells[s.i].raw) * s.dir; if (r) return r; } return a.id - b.id; });
  }

  /* ------------------------------------------------------------------ xuất ------------------------------------------ */
  exportCsv() {
    const cols = this.visibleCols();
    const q = (/** @type {string} */ s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => q(c.label)).join(';'), ...this.view_rows.filter((r) => r.state !== 'deleted').map((r) => cols.map((c) => q(NUM.has(c.type) ? r.cells[c.i].raw : r.cells[c.i].text || r.cells[c.i].raw)).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${this.layoutKey}.csv` });
    document.body.append(a); a.click(); a.remove();
    toast('Đã xuất nhanh CSV các dòng đang hiển thị. Dùng nút "Xuất Excel" của màn hình để lấy file đầy đủ từ máy chủ.', 'info', 5000);
  }
}

/** @param {string} kind @param {number[]} vals */
function aggregate(kind, vals) {
  if (!vals.length) return 0;
  switch (kind) {
    case 'count': return vals.length;
    case 'avg': return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'min': return Math.min(...vals);
    case 'max': return Math.max(...vals);
    default: return vals.reduce((a, b) => a + b, 0);
  }
}

/** Bộ lọc theo cột: số hỗ trợ >, >=, <, <=, =, a..b; còn lại "chứa" không dấu. @param {Col} c @param {string} v @returns {(r:Row)=>boolean} */
function makeTest(c, v) {
  if (NUM.has(c.type)) {
    const range = /^(-?[\d.,]+)\s*\.\.\s*(-?[\d.,]+)$/.exec(v);
    if (range) { const a = parseNumber(range[1]), b = parseNumber(range[2]); return (r) => { const n = Number(r.cells[c.i].raw); return n >= a && n <= b; }; }
    const op = /^(>=|<=|>|<|=)\s*(-?[\d.,]+)$/.exec(v);
    if (op) {
      const n = parseNumber(op[2]);
      const f = { '>': (/** @type {number} */ x) => x > n, '>=': (/** @type {number} */ x) => x >= n, '<': (/** @type {number} */ x) => x < n, '<=': (/** @type {number} */ x) => x <= n, '=': (/** @type {number} */ x) => x === n }[op[1]];
      return (r) => f(Number(r.cells[c.i].raw));
    }
  }
  const f = fold(v);
  return (r) => fold(r.cells[c.i].text || r.cells[c.i].raw).includes(f);
}
