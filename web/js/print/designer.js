// @ts-check
/**
 * Trình thiết kế mẫu in (GĐ2, docs/kien-truc/06-mau-in.md §9), vai trò `section[data-erp=print-designer]` (chuẩn 15.2).
 * Sửa mẫu erp-print-template/1 như trình thiết kế ActiveReports của ERP: canvas khổ mm, lưới + bắt dính, chọn nhiều / khung
 * chọn, kéo, co giãn, căn / phân bố / cùng cỡ, thứ tự lớp, sao chép / dán, hoàn tác, band và nhóm, thuộc tính, cây cấu trúc,
 * kéo trường vào band, xem trước bằng đúng bộ dựng in, lưu về BE (form POST trong section, có token chống giả mạo).
 */
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { fetchHtml, pick, isAllowedUrl } from '../core/http.js';
import { toast, messageBox } from '../core/ui.js';
import { applyTextStyle, renderPages, domMeasure } from './render.js';
import { buildDocument } from './engine.js';
import { loadTemplate, readGrid, readParams } from './viewer.js';
import { convertRpx, TEMPLATE_SCHEMA } from './rpx.js';
import { check } from './expr.js';
import { fakeData, referencedFields } from './fake.js';

/** @typedef {Record<string, any>} Obj */

const PX_PER_MM = 96 / 25.4;
const PAPERS = /** @type {Record<string, [number, number]>} */ ({ A4: [210, 297], A5: [148, 210], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6] });
const FONTS = ['Arial', 'Times New Roman', 'Tahoma', 'Arial Narrow', 'Microsoft Sans Serif', 'Calibri', 'Arial Unicode MS'];
const FORMATS = ['#,##0', '#,##0.##', '#,###', '#,###.##', '#,##0.00', '#,##0.####', 'dd/MM/yyyy', 'dd/MM/yyyy HH:mm', 'HH:mm', 'MM/yyyy', 'N0', 'N2', '#,##0.00 %'];
const BAND_LABEL = /** @type {Record<string,string>} */ ({ reportHeader: 'Đầu báo cáo', pageHeader: 'Đầu trang', groupHeader: 'Đầu nhóm', detail: 'Chi tiết',
  groupFooter: 'Cuối nhóm', pageFooter: 'Cuối trang', reportFooter: 'Cuối báo cáo' });
const VALUE_KINDS = /** @type {Array<[string,string]>} */ ([['text', 'Chữ cố định'], ['field', 'Cột dữ liệu'], ['expr', 'Biểu thức'], ['template', 'Chữ có {Cột}'],
  ['dateText', 'Ngày dạng chữ'], ['sys', 'Tham số hệ thống'], ['pageInfo', 'Trang N/M'], ['printDate', 'Ngày giờ in'], ['userInput', 'Người ký (UInput)']]);
const BORDER_STYLES = [['solid', 'Liền'], ['dash', 'Gạch'], ['dot', 'Chấm'], ['double', 'Đôi'], ['thickSolid', 'Liền đậm']];
const r2 = (/** @type {number} */ v) => Math.round(v * 100) / 100;
const clone = (/** @type {any} */ o) => JSON.parse(JSON.stringify(o));

/** append() của DOM ghi chữ "null" cho null: bỏ phần tử rỗng trước. @param {HTMLElement} el @param {...(Node|null|undefined|false)} xs */
const appendAll = (el, ...xs) => el.append(.../** @type {Node[]} */ (xs.filter(Boolean)));

/** Hộp bao (mm) của control trong band. @param {Obj} c */
function boxOf(c) {
  if (c.type === 'line') return { x: Math.min(c.x1, c.x2), y: Math.min(c.y1, c.y2), w: Math.abs(c.x2 - c.x1), h: Math.abs(c.y2 - c.y1) };
  if (c.type === 'crossLine') return { x: c.x, y: c.y1, w: 0, h: Math.max(0, c.y2 - c.y1) };
  return { x: c.x || 0, y: c.y || 0, w: c.w || 0, h: c.h || 0 };
}

/** Đặt hộp bao mới (đường thẳng: co giãn hai đầu theo hộp cũ). @param {Obj} c @param {{x:number,y:number,w:number,h:number}} b */
function setBox(c, b) {
  const o = boxOf(c);
  if (c.type === 'line') {
    const fx = (/** @type {number} */ v) => r2(o.w ? b.x + ((v - o.x) * b.w) / o.w : b.x + (v === c.x2 ? b.w : 0));
    const fy = (/** @type {number} */ v) => r2(o.h ? b.y + ((v - o.y) * b.h) / o.h : b.y + (v === c.y2 ? b.h : 0));
    const [x1, x2, y1, y2] = [fx(c.x1), fx(c.x2), fy(c.y1), fy(c.y2)];
    Object.assign(c, { x1, x2, y1, y2 });
    return;
  }
  if (c.type === 'crossLine') { Object.assign(c, { x: r2(b.x), y1: r2(b.y), y2: r2(b.y + b.h) }); return; }
  Object.assign(c, { x: r2(b.x), y: r2(b.y), w: r2(Math.max(0.5, b.w)), h: r2(Math.max(0.5, b.h)) });
}

/** Chữ hiển thị trên canvas. @param {Obj} c */
export function designText(c) {
  const v = c.value || {};
  const sum = c.summary ? `Σ${c.summary.func === 'sum' ? '' : `${c.summary.func} `}` : '';
  if (c.type === 'checkbox') return c.caption || '';
  if ('text' in v) return String(v.text ?? '');
  if ('field' in v && !('dateText' in v)) return `${sum}[${v.field}]`;
  if ('expr' in v) return `${sum}=${v.expr}`;
  if ('exprRaw' in v) return `⚠ ${v.exprRaw}`;
  if ('template' in v) return String(v.template);
  if ('dateText' in v) return String(v.dateText || '');
  if ('sys' in v) return v.fallback ? String(v.fallback) : `{Sys.${v.sys}}`;
  if ('lang' in v) return String(v.fallback || `{Lang.${v.lang}}`);
  if ('pageInfo' in v) return v.pageInfo === 'EN' ? 'Page N/M' : 'Trang N/M';
  if ('printDate' in v) return 'dd/MM/yyyy HH:mm';
  if ('userInput' in v) return v.fallback || `{${v.userInput}}`;
  if ('subtitle' in v) return v.fallback || '{Tiêu đề phụ}';
  if ('paramCaption' in v) return v.fallback || `{Caption.${v.paramCaption}}`;
  return '';
}

/**
 * @param {HTMLElement} section @param {import('../shell/tabs.js').TabContext} ctx
 */
export function enhancePrintDesigner(section, ctx) {
  const d = new Designer(section, ctx);
  d.start();
  return d;
}

class Designer {
  /** @param {HTMLElement} section @param {import('../shell/tabs.js').TabContext} ctx */
  constructor(section, ctx) {
    this.section = section;
    this.ctx = ctx;
    /** @type {Obj} */ this.tpl = { $schema: TEMPLATE_SCHEMA, bands: [], groups: [], page: { width: 210, height: 297, margin: { top: 10, right: 10, bottom: 10, left: 10 }, bodyWidth: 190 }, styles: {}, assets: {} };
    /** @type {string[]} */ this.sel = [];
    /** @type {string|null} */ this.band = null;
    this.zoom = 1;
    this.grid = true;
    this.step = 1;
    /** @type {string[]} */ this.undoStack = [];
    /** @type {string[]} */ this.redoStack = [];
    this.dirty = false;
    this.previewOn = false;
    /** @type {Obj[]|null} */ this.clipboard = null;
    /** @type {import('./engine.js').PrintData|null} */ this.data = null;
    /** @type {{name:string, type:string}[]} */ this.fields = [];
    this.form = /** @type {HTMLFormElement|null} */ (section.querySelector('form[method="post" i]'));
    this.readOnly = !this.form;
    this.name = section.getAttribute('data-template-name') || '';
    this.seq = 1;
  }

  start() {
    const s = this.section;
    s.classList.add('erp-pd');
    if (this.form) this.form.hidden = true;
    this.canvas = h('div', { class: 'erp-pd__canvas', tabindex: '0', 'aria-label': 'Vùng thiết kế mẫu in' });
    this.preview = h('div', { class: 'erp-pd__preview', hidden: '' });
    this.left = h('div', { class: 'erp-pd__side' });
    this.right = h('div', { class: 'erp-pd__side' });
    this.status = h('span', { class: 'erp-pd__status', 'aria-live': 'polite' }, 'Đang nạp mẫu…');
    this.bar = this.toolbar();
    s.append(this.bar, this.left, this.canvas, this.preview, this.right);
    this.bindCanvas();
    this.ctx.registerKey?.('Ctrl+S', (ev) => { ev.preventDefault?.(); if (s.isConnected) this.save(); });
    this.load().catch((e) => { this.status.textContent = `Không nạp được mẫu: ${e.message || e}`; });
  }

  async load() {
    const src = this.section.getAttribute('data-template-src');
    if (src) {
      const { template } = await loadTemplate(src, this.section.getAttribute('data-template-format') || '');
      this.tpl = clone(template);
    }
    const prev = this.section.getAttribute('data-preview-src');
    if (prev && isAllowedUrl(prev)) {
      try {
        const res = await fetchHtml(prev, { tabId: this.ctx.tab?.id });
        const pd = pick(res.doc, 'print-document');
        if (pd) {
          const grids = /** @type {HTMLTableElement[]} */ (Array.from(pd.querySelectorAll('table[data-erp="grid"]')));
          const p = readParams(/** @type {HTMLElement|null} */ (pd.querySelector('dl[data-erp="print-params"]')));
          this.data = { main: grids[0] ? readGrid(grids[0]) : { columns: [], rows: [] }, sets: grids.slice(1).map(readGrid), params: p.params, sys: p.sys,
            lang: p.lang, paramCaptions: p.captions, images: p.images };
        }
      } catch { /* xem trước dùng dữ liệu giả */ }
    }
    this.refreshFields();
    this.seq = 1 + this.allControls().length;
    this.render();
    this.status.textContent = this.readOnly ? 'Chỉ xem (không có quyền lưu mẫu)' : 'Sẵn sàng';
  }

  /* ---------------- dữ liệu mẫu ---------------- */

  /** @returns {{ band: Obj, c: Obj }[]} */
  allControls() { return (this.tpl.bands || []).flatMap((/** @type {Obj} */ b) => (b.controls || []).map((/** @type {Obj} */ c) => ({ band: b, c }))); }
  /** @param {string} id */
  find(id) { return this.allControls().find((x) => x.c.id === id) || null; }
  /** @param {string} id */
  bandById(id) { return (this.tpl.bands || []).find((/** @type {Obj} */ b) => b.id === id) || null; }
  selected() { return this.sel.map((id) => this.find(id)).filter(Boolean).map((x) => /** @type {{band:Obj,c:Obj}} */ (x)); }

  refreshFields() {
    const cols = this.data?.main.columns?.length ? this.data.main.columns : referencedFields(this.tpl).map((n) => ({ name: n, type: '' }));
    this.fields = cols.map((c) => ({ name: c.name, type: c.type }));
  }

  newId(prefix = 'ctl') {
    let id;
    do { id = `${prefix}${this.seq++}`; } while (this.find(id) || this.bandById(id));
    return id;
  }

  /** Ghi một thay đổi (có hoàn tác). @param {() => void} fn */
  edit(fn) {
    if (this.readOnly) { toast('Bạn chỉ được xem mẫu này.', 'warning'); return; }
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    fn();
    this.setDirty(true);
    this.render();
  }
  snapshot() { const { assets, ...rest } = this.tpl; return JSON.stringify(rest); }
  restore(/** @type {string} */ snap) { const assets = this.tpl.assets; this.tpl = { ...JSON.parse(snap), assets }; }
  undo() { const s = this.undoStack.pop(); if (!s) return; this.redoStack.push(this.snapshot()); this.restore(s); this.sel = this.sel.filter((id) => this.find(id)); this.setDirty(true); this.render(); }
  redo() { const s = this.redoStack.pop(); if (!s) return; this.undoStack.push(this.snapshot()); this.restore(s); this.sel = this.sel.filter((id) => this.find(id)); this.setDirty(true); this.render(); }
  setDirty(/** @type {boolean} */ on) { this.dirty = on; this.ctx.setDirty?.(on); this.updateBar(); }

  /* ---------------- thanh công cụ ---------------- */

  toolbar() {
    /** @param {string} ic @param {string} label @param {() => void} fn @param {Obj} [o] */
    const b = (ic, label, fn, o = {}) => h('button', { type: 'button', class: `erp-pd__tool ${o.cls || ''}`, title: o.title || label, 'data-cmd': o.cmd || '', onclick: fn },
      icon(ic), o.text === false ? null : h('span', {}, label));
    const sep = () => h('span', { class: 'erp-pd__sep', 'aria-hidden': 'true' });
    const zoom = /** @type {HTMLSelectElement} */ (h('select', { class: 'erp-pd__tool', 'aria-label': 'Thu phóng' },
      ...[0.5, 0.75, 1, 1.25, 1.5, 2].map((z) => h('option', { value: String(z), selected: z === 1 }, `${z * 100}%`))));
    zoom.addEventListener('change', () => { this.zoom = Number(zoom.value); this.renderCanvas(); });
    const file = /** @type {HTMLInputElement} */ (h('input', { type: 'file', accept: '.rpx,.json', hidden: '' }));
    file.addEventListener('change', () => { const f = file.files?.[0]; if (f) this.importFile(f); file.value = ''; });
    this.btnSave = b('save', 'Lưu mẫu', () => this.save(), { cls: 'erp-pd__tool--primary', title: 'Lưu mẫu (Ctrl+S)' });
    this.btnPreview = b('search', 'Xem trước', () => this.togglePreview(), { title: 'Xem trước bằng dữ liệu' });
    const add = (/** @type {string} */ kind, /** @type {string} */ label, /** @type {string} */ ic) => b(ic, label, () => this.addControl(kind), { title: `Thêm ${label.toLowerCase()}`, cmd: 'add' });
    return h('div', { class: 'erp-pd__bar', role: 'toolbar', 'aria-label': 'Thiết kế mẫu in' },
      this.btnSave, this.btnPreview,
      b('undo', 'Hoàn tác', () => this.undo(), { text: false, title: 'Hoàn tác (Ctrl+Z)' }), b('redo', 'Làm lại', () => this.redo(), { text: false, title: 'Làm lại (Ctrl+Y)' }),
      sep(),
      add('text', 'Chữ', 'edit'), add('field', 'Trường', 'list'), add('line', 'Đường', 'minus'), add('rect', 'Khung', 'square'),
      add('image', 'Ảnh', 'image'), add('checkbox', 'Ô chọn', 'check'), add('barcode', 'Mã vạch', 'qr'), add('pageInfo', 'Số trang', 'file'),
      sep(),
      b('align-left', 'Căn trái', () => this.align('left'), { text: false }), b('align-center', 'Căn giữa ngang', () => this.align('hcenter'), { text: false }),
      b('align-right', 'Căn phải', () => this.align('right'), { text: false }), b('align-top', 'Căn trên', () => this.align('top'), { text: false }),
      b('align-middle', 'Căn giữa dọc', () => this.align('vcenter'), { text: false }), b('align-bottom', 'Căn dưới', () => this.align('bottom'), { text: false }),
      b('width', 'Cùng rộng', () => this.align('width'), { text: false }), b('height', 'Cùng cao', () => this.align('height'), { text: false }),
      b('dist-h', 'Phân bố ngang', () => this.align('distH'), { text: false }), b('dist-v', 'Phân bố dọc', () => this.align('distV'), { text: false }),
      b('front', 'Lên trên cùng', () => this.order(1), { text: false }), b('back', 'Xuống dưới cùng', () => this.order(-1), { text: false }),
      sep(),
      b('group', 'Thêm nhóm', () => this.addGroup(), { title: 'Thêm đầu/cuối nhóm theo một cột' }),
      zoom,
      b('grid', 'Lưới', () => { this.grid = !this.grid; this.renderCanvas(); this.updateBar(); }, { text: false, title: 'Lưới và bắt dính 1 mm', cmd: 'grid' }),
      sep(),
      b('import', 'Nhập', () => file.click(), { title: 'Nhập mẫu .rpx (WinForms) hoặc .json' }), b('export', 'Xuất', () => this.exportJson(), { title: 'Xuất mẫu JSON' }),
      file, this.status);
  }

  updateBar() {
    if (!this.bar) return;
    const n = this.sel.length;
    for (const el of Array.from(this.bar.querySelectorAll('button'))) {
      const t = el.getAttribute('title') || '';
      if (/^Căn|Cùng/.test(t)) /** @type {HTMLButtonElement} */ (el).disabled = n < 2;
      else if (/^Phân bố/.test(t)) /** @type {HTMLButtonElement} */ (el).disabled = n < 3;
      else if (/^(Lên|Xuống)/.test(t)) /** @type {HTMLButtonElement} */ (el).disabled = n < 1;
      else if (/^Hoàn tác/.test(t)) /** @type {HTMLButtonElement} */ (el).disabled = !this.undoStack.length;
      else if (/^Làm lại/.test(t)) /** @type {HTMLButtonElement} */ (el).disabled = !this.redoStack.length;
      if (el.getAttribute('data-cmd') === 'add' || el.getAttribute('title') === 'Thêm đầu/cuối nhóm theo một cột') /** @type {HTMLButtonElement} */ (el).disabled = this.readOnly || this.previewOn;
      if (el.getAttribute('data-cmd') === 'grid') el.setAttribute('aria-pressed', String(this.grid));
    }
    if (this.btnSave) /** @type {HTMLButtonElement} */ (this.btnSave).disabled = this.readOnly || !this.dirty;
    this.btnPreview?.setAttribute('aria-pressed', String(this.previewOn));
  }

  /* ---------------- vẽ ---------------- */

  render() { this.renderCanvas(); this.renderTree(); this.renderProps(); this.updateBar(); if (this.previewOn) this.renderPreview(); }

  renderCanvas() {
    const tpl = this.tpl;
    const W = tpl.page.bodyWidth || (tpl.page.width - tpl.page.margin.left - tpl.page.margin.right);
    const paper = h('div', { class: 'erp-pd__paper' });
    /** @type {any} */ (paper.style).zoom = String(this.zoom);
    const ruler = h('div', { class: 'erp-pd__ruler', style: `width:${W}mm`, 'aria-hidden': 'true' });
    for (let cm = 0; cm * 10 < W; cm++) ruler.append(h('span', { style: `left:${cm * 10}mm` }, String(cm)));
    paper.append(ruler);
    for (const b of tpl.bands || []) {
      const g = b.group ? (tpl.groups || []).find((/** @type {Obj} */ x) => x.id === b.group) : null;
      const label = `${BAND_LABEL[b.type] || b.type}${g ? ` · ${g.by || 'một nhóm'}` : ''} — ${b.id}`;
      const head = h('div', { class: `erp-pd__bandhead${b.visible === false ? ' is-hidden' : ''}`, 'aria-selected': String(this.band === b.id && !this.sel.length),
        'data-band': b.id, style: `width:${W}mm`, title: 'Chọn band' }, label);
      const body = h('div', { class: `erp-pd__bandbody${this.grid ? ' has-grid' : ''}`, 'data-band': b.id, style: `width:${W}mm;height:${Math.max(0, b.height)}mm` });
      if (this.grid) body.style.backgroundSize = `${5 * PX_PER_MM}px ${5 * PX_PER_MM}px`;
      for (const c of b.controls || []) body.append(this.renderControl(c));
      const one = this.sel.length === 1 ? this.find(this.sel[0]) : null;
      if (one && one.band === b && !this.readOnly) this.handles(body, one.c);
      const grip = h('div', { class: 'erp-pd__grip', 'data-grip': b.id, style: `width:${W}mm`, title: 'Kéo để đổi chiều cao band' });
      paper.append(h('div', { class: 'erp-pd__band' }, head, body, grip));
    }
    const keep = { x: this.canvas.scrollLeft, y: this.canvas.scrollTop };
    this.canvas.replaceChildren(paper);
    this.canvas.scrollLeft = keep.x; this.canvas.scrollTop = keep.y;
  }

  /** @param {Obj} c */
  renderControl(c) {
    const b = boxOf(c);
    const el = h('div', { class: 'erp-pd__ctl', 'data-id': c.id, 'aria-selected': String(this.sel.includes(c.id)), title: `${c.id} (${c.type})` });
    Object.assign(el.style, { left: `${b.x}mm`, top: `${b.y}mm`, width: `${Math.max(b.w, c.type === 'line' ? 1 : 0.5)}mm`, height: `${Math.max(b.h, c.type === 'line' ? 1 : 0.5)}mm` });
    if (c.visible === false) el.classList.add('is-hidden');
    const st = { ...(this.tpl.styles?.Normal || {}), ...(c.style || {}) };
    if (c.type === 'line' || c.type === 'crossLine') {
      el.style.outline = 'none';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'erp-pd__line');
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const x1 = c.type === 'line' ? c.x1 - b.x : 0, x2 = c.type === 'line' ? c.x2 - b.x : 0, y1 = c.type === 'line' ? c.y1 - b.y : 0, y2 = c.type === 'line' ? c.y2 - b.y : b.h;
      ln.setAttribute('x1', `${x1}mm`); ln.setAttribute('x2', `${x2}mm`); ln.setAttribute('y1', `${y1}mm`); ln.setAttribute('y2', `${y2}mm`);
      ln.setAttribute('stroke', '#000'); ln.setAttribute('stroke-width', '1');
      svg.append(ln);
      el.append(svg);
      if (b.h < 1) el.style.top = `${b.y - 0.5}mm`;
      if (b.w < 1) el.style.left = `${b.x - 0.5}mm`;
      return el;
    }
    const bd = c.border || {};
    for (const side of ['top', 'right', 'bottom', 'left']) if (bd[side]) el.style.setProperty(`border-${side}`, `1px ${bd[side].style === 'dot' ? 'dotted' : bd[side].style === 'dash' ? 'dashed' : bd[side].style === 'double' ? 'double' : 'solid'} ${bd[side].color || '#000'}`);
    if (c.type === 'rect') { if (c.radius) el.style.borderRadius = '2mm'; if (c.fill) el.style.background = c.fill; return el; }
    if (c.type === 'image') {
      const a = c.src?.asset ? this.tpl.assets?.[c.src.asset] : null;
      if (a?.data && /^image\/(png|jpeg|gif|bmp)$/.test(a.mime)) el.append(h('img', { alt: '', src: `data:${a.mime};base64,${a.data}` }));
      else el.append(h('div', { class: 'pp-text__in', style: 'font:8pt Arial;color:#888' }, c.src?.field ? `[${c.src.field}]` : c.src?.system ? `{${c.src.system}}` : 'Ảnh'));
      return el;
    }
    if (st.background && c.type === 'text') el.style.background = st.background;
    el.style.justifyContent = st.valign === 'middle' ? 'center' : st.valign === 'bottom' ? 'flex-end' : 'flex-start';
    const inner = h('div', { class: 'pp-text__in' });
    applyTextStyle(inner, st, c.padding || {});
    inner.textContent = c.type === 'barcode' ? `▮▯▮▮▯ ${designText(c)}` : c.type === 'checkbox' ? `☐ ${designText(c)}` : designText(c);
    el.append(inner);
    const v = c.value || {};
    if ('field' in v || c.summary) el.classList.add('is-bound');
    if ('expr' in v || 'exprRaw' in v) el.classList.add('is-expr');
    return el;
  }

  /** Tay nắm co giãn. @param {HTMLElement} body @param {Obj} c */
  handles(body, c) {
    const b = boxOf(c);
    const pos = /** @type {Record<string,[number,number]>} */ ({ nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] });
    for (const [dir, [fx, fy]] of Object.entries(pos)) {
      const el = h('div', { class: 'erp-pd__h', 'data-handle': dir, style: `left:calc(${b.x + b.w * fx}mm - 4px);top:calc(${b.y + b.h * fy}mm - 4px);cursor:${dir}-resize` });
      body.append(el);
    }
  }

  renderTree() {
    const ul = h('ul', { class: 'erp-pd__tree', role: 'tree' });
    for (const b of this.tpl.bands || []) {
      ul.append(h('li', { class: 'is-band', role: 'treeitem', 'aria-selected': String(this.band === b.id && !this.sel.length), onclick: () => this.selectBand(b.id) },
        `${BAND_LABEL[b.type] || b.type} — ${b.id}`));
      for (const c of b.controls || []) {
        const t = designText(c).replace(/\s+/g, ' ').slice(0, 40);
        ul.append(h('li', { class: 'is-ctl', role: 'treeitem', 'aria-selected': String(this.sel.includes(c.id)),
          onclick: (/** @type {MouseEvent} */ e) => this.select(c.id, e.shiftKey || e.ctrlKey) }, `${c.id}${t ? ` · ${t}` : ''}`));
      }
    }
    const fields = h('ul', { class: 'erp-pd__fields' });
    for (const f of this.fields) {
      const li = h('li', { draggable: 'true', title: 'Kéo vào band để thêm ô dữ liệu' }, f.name, f.type ? h('small', {}, f.type) : null);
      li.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/x-erp-field', f.name); e.dataTransfer?.setData('text/plain', f.name); });
      fields.append(li);
    }
    this.left.replaceChildren(h('h3', {}, 'Cấu trúc'), ul, h('h3', {}, `Trường dữ liệu${this.data ? '' : ' (từ mẫu)'}`), fields);
  }

  /* ---------------- thuộc tính ---------------- */

  renderProps() {
    const sel = this.selected();
    const box = h('div', { class: 'erp-pd__props' });
    if (sel.length) this.controlProps(box, sel);
    else if (this.band && this.bandById(this.band)) this.bandProps(box, /** @type {Obj} */ (this.bandById(this.band)));
    else this.pageProps(box);
    this.right.replaceChildren(h('h3', {}, sel.length ? (sel.length > 1 ? `${sel.length} control` : `Control ${sel[0].c.id}`) : this.band ? `Band ${this.band}` : 'Trang và mẫu'), box);
    if (this.readOnly) for (const el of Array.from(box.querySelectorAll('input, select, textarea, button'))) /** @type {HTMLInputElement} */ (el).disabled = true;
  }

  /**
   * Ô nhập gắn với một thuộc tính.
   * @param {string} label @param {any} value @param {(v: any) => void} set
   * @param {{ type?: string, options?: Array<[string,string]>|string[], list?: string[], step?: number, check?: (v: string) => string|null, rows?: number }} [o]
   */
  input(label, value, set, o = {}) {
    let el;
    const commit = (/** @type {any} */ v) => this.edit(() => set(v));
    if (o.type === 'checkbox') {
      el = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: !!value }));
      el.addEventListener('change', () => commit(/** @type {HTMLInputElement} */ (el).checked));
      return h('label', { class: 'erp-pd__check' }, el, label);
    }
    if (o.options) {
      el = /** @type {HTMLSelectElement} */ (h('select', {}, ...o.options.map((x) => { const [v, t] = Array.isArray(x) ? x : [x, x]; return h('option', { value: v, selected: String(value ?? '') === v }, t); })));
      el.addEventListener('change', () => commit(/** @type {HTMLSelectElement} */ (el).value));
    } else if (o.type === 'textarea') {
      el = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: String(o.rows || 2), spellcheck: 'false' }));
      /** @type {HTMLTextAreaElement} */ (el).value = value ?? '';
      el.addEventListener('change', () => commit(/** @type {HTMLTextAreaElement} */ (el).value));
    } else {
      const listId = o.list ? `pd-l-${Math.random().toString(36).slice(2, 8)}` : null;
      el = /** @type {HTMLInputElement} */ (h('input', { type: o.type || 'text', step: o.step ? String(o.step) : undefined, list: listId || undefined }));
      /** @type {HTMLInputElement} */ (el).value = value ?? '';
      el.addEventListener('change', () => {
        const raw = /** @type {HTMLInputElement} */ (el).value;
        commit(o.type === 'number' ? (raw === '' ? null : Number(raw)) : raw);
      });
      if (listId && o.list) return h('label', {}, label, el, h('datalist', { id: listId }, ...o.list.map((x) => h('option', { value: x }))));
    }
    const wrap = h('label', {}, label, el);
    if (o.check) { const err = o.check(String(value ?? '')); if (err) wrap.append(h('span', { class: 'erp-pd__err' }, err)); }
    return wrap;
  }

  pageProps(/** @type {HTMLElement} */ box) {
    const p = this.tpl.page;
    appendAll(box,
      this.input('Tên mẫu', this.tpl.title || this.tpl.id || '', (v) => { this.tpl.title = v; }),
      h('div', { class: 'erp-pd__row2' },
        this.input('Khổ giấy', p.paper || 'custom', (v) => { p.paper = v; if (PAPERS[v]) { const [w, hh] = PAPERS[v]; [p.width, p.height] = p.orientation === 'landscape' ? [hh, w] : [w, hh]; p.bodyWidth = r2(p.width - p.margin.left - p.margin.right); } },
          { options: [...Object.keys(PAPERS), 'custom'].map((x) => [x, x === 'custom' ? 'Tùy chỉnh' : x]) }),
        this.input('Hướng', p.orientation || 'portrait', (v) => { if (v !== p.orientation) { p.orientation = v; [p.width, p.height] = [p.height, p.width]; p.bodyWidth = r2(p.width - p.margin.left - p.margin.right); } },
          { options: [['portrait', 'Dọc'], ['landscape', 'Ngang']] })),
      h('div', { class: 'erp-pd__row2' },
        this.input('Rộng (mm)', p.width, (v) => { p.width = v; p.paper = 'custom'; }, { type: 'number', step: 0.1 }),
        this.input('Cao (mm)', p.height, (v) => { p.height = v; p.paper = 'custom'; }, { type: 'number', step: 0.1 })),
      h('fieldset', {}, h('legend', {}, 'Lề (mm)'), h('div', { class: 'erp-pd__row' },
        ...['top', 'right', 'bottom', 'left'].map((k) => this.input({ top: 'Trên', right: 'Phải', bottom: 'Dưới', left: 'Trái' }[k] || k, p.margin[k], (v) => { p.margin[k] = v; }, { type: 'number', step: 0.1 })))),
      this.input('Độ rộng vùng in (mm)', p.bodyWidth, (v) => { p.bodyWidth = v; }, { type: 'number', step: 0.1 }),
      p.bodyWidth > p.width - p.margin.left - p.margin.right + 0.5 ? h('span', { class: 'erp-pd__err' }, 'Vùng in rộng hơn khổ giấy trừ lề.') : null,
      this.input('Tự sắp theo cột nhóm', this.tpl.data?.sort?.auto !== false, (v) => { (this.tpl.data ||= {}).sort = { ...(this.tpl.data.sort || {}), auto: v }; }, { type: 'checkbox' }),
      h('p', { class: 'erp-pd__hint' }, 'Chọn một band (thanh tiêu đề) hoặc control để sửa thuộc tính. Phím: mũi tên dời 1 mm (Shift 5 mm), Ctrl+mũi tên đổi cỡ, Delete xóa, Ctrl+C/V/D, Ctrl+Z/Y.'),
    );
  }

  bandProps(/** @type {HTMLElement} */ box, /** @type {Obj} */ b) {
    appendAll(box,
      h('div', { class: 'erp-pd__row2' },
        this.input('Chiều cao (mm)', b.height, (v) => { b.height = Math.max(0, v || 0); }, { type: 'number', step: 0.1 }),
        this.input('Nền', b.background || '', (v) => { if (v) b.background = v; else delete b.background; }, { list: ['#E0E0E0', 'LightSalmon', 'BurlyWood', 'White'] })),
      this.input('Hiện', b.visible !== false, (v) => { if (v) delete b.visible; else b.visible = false; }, { type: 'checkbox' }),
      this.input('Hiện khi (biểu thức)', b.visibleWhen || '', (v) => { if (v) b.visibleWhen = v; else delete b.visibleWhen; }, { type: 'textarea', check: (v) => (v ? check(v) : null) }),
      this.input('Tự cao theo nội dung (CanGrow)', b.canGrow !== false, (v) => { b.canGrow = v; }, { type: 'checkbox' }),
      this.input('Co lại khi trống (CanShrink)', !!b.canShrink, (v) => { b.canShrink = v; }, { type: 'checkbox' }),
      this.input('Giữ liền một trang', !!b.keepTogether, (v) => { b.keepTogether = v; }, { type: 'checkbox' }),
      this.input('Kéo ô tới đáy band', !!b.stretchControls, (v) => { b.stretchControls = v; }, { type: 'checkbox' }),
      ['groupFooter', 'reportFooter'].includes(b.type) ? this.input('In ở đáy trang', !!b.printAtBottom, (v) => { b.printAtBottom = v; }, { type: 'checkbox' }) : null,
    );
    const g = b.group ? (this.tpl.groups || []).find((/** @type {Obj} */ x) => x.id === b.group) : null;
    if (g) {
      box.append(h('fieldset', {}, h('legend', {}, `Nhóm ${g.id}`),
        this.input('Nhóm theo cột', g.by || '', (v) => { g.by = v || null; }, { list: this.fields.map((f) => f.name) }),
        this.input('Sang trang', g.newPage || 'none', (v) => { g.newPage = v; }, { options: [['none', 'Không'], ['before', 'Trước nhóm'], ['after', 'Sau nhóm']] }),
        this.input('Giữ liền', g.keepTogether || 'none', (v) => { g.keepTogether = v; }, { options: [['none', 'Không'], ['firstDetail', 'Với dòng đầu'], ['all', 'Cả nhóm']] }),
        this.input('Lặp tiêu đề nhóm ở trang mới', g.repeatHeader === 'onPage', (v) => { g.repeatHeader = v ? 'onPage' : 'none'; }, { type: 'checkbox' }),
        h('button', { type: 'button', class: 'erp-btn', onclick: () => this.removeGroup(g.id) }, 'Xóa nhóm (đầu + cuối)')));
    }
  }

  /** @param {HTMLElement} box @param {{band: Obj, c: Obj}[]} sel */
  controlProps(box, sel) {
    const first = sel[0].c;
    const all = (/** @type {(c: Obj) => void} */ f) => (/** @type {any} */ v) => { for (const s of sel) f.call(null, s.c, v); };
    const each = (/** @type {(c: Obj, v: any) => void} */ f) => (/** @type {any} */ v) => { for (const s of sel) f(s.c, v); };
    void all;
    const bx = boxOf(first);
    if (sel.length === 1) {
      box.append(h('div', { class: 'erp-pd__row' },
        ...(/** @type {Array<['x'|'y'|'w'|'h', string]>} */ ([['x', 'X'], ['y', 'Y'], ['w', 'Rộng'], ['h', 'Cao']])).map(([k, t]) =>
          this.input(t, bx[k], (v) => { const nb = { ...boxOf(first) }; nb[k] = v ?? 0; setBox(first, nb); }, { type: 'number', step: 0.1 }))));
      box.append(this.input('Mã control', first.id, (v) => { if (v && /^[A-Za-z_][\w]*$/.test(v) && !this.find(v)) { this.sel = [v]; first.id = v; } else toast('Mã không hợp lệ hoặc đã có.', 'warning'); }));
    }
    const texts = sel.filter((s) => ['text', 'barcode', 'checkbox'].includes(s.c.type));
    if (sel.length === 1 && ['text', 'barcode', 'checkbox'].includes(first.type)) this.valueProps(box, first);
    if (texts.length) {
      const st = { ...(this.tpl.styles?.Normal || {}), ...(texts[0].c.style || {}) };
      const setStyle = (/** @type {string} */ k) => each((c, v) => { c.style ||= {}; if (v === '' || v === null) delete c.style[k]; else c.style[k] = v; });
      box.append(h('fieldset', {}, h('legend', {}, 'Chữ'),
        h('div', { class: 'erp-pd__row2' },
          this.input('Font', st.font || 'Arial', setStyle('font'), { list: FONTS }),
          this.input('Cỡ (pt)', st.size || 10, setStyle('size'), { type: 'number', step: 0.25 })),
        h('div', { class: 'erp-pd__row' },
          this.input('Đậm', !!st.bold, setStyle('bold'), { type: 'checkbox' }), this.input('Nghiêng', !!st.italic, setStyle('italic'), { type: 'checkbox' }),
          this.input('Gạch chân', !!st.underline, setStyle('underline'), { type: 'checkbox' }), this.input('Xuống dòng', st.wrap !== false, setStyle('wrap'), { type: 'checkbox' })),
        h('div', { class: 'erp-pd__row2' },
          this.input('Căn ngang', st.align || 'left', setStyle('align'), { options: [['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải'], ['justify', 'Đều']] }),
          this.input('Căn dọc', st.valign || 'top', setStyle('valign'), { options: [['top', 'Trên'], ['middle', 'Giữa'], ['bottom', 'Dưới']] })),
        h('div', { class: 'erp-pd__row2' },
          this.input('Màu chữ', st.color || '', setStyle('color'), { list: ['Black', 'Blue', 'Red', 'Maroon', 'Navy', '#C00000'] }),
          this.input('Màu nền', st.background || '', setStyle('background'), { list: ['#E0E0E0', 'LightSalmon', 'BurlyWood', 'White', 'Silver'] })),
        h('div', { class: 'erp-pd__row2' },
          this.input('Lề trái (pt)', texts[0].c.padding?.l ?? '', each((c, v) => { c.padding ||= {}; if (v === null) delete c.padding.l; else c.padding.l = v; }), { type: 'number', step: 0.75 }),
          this.input('Lề phải (pt)', texts[0].c.padding?.r ?? '', each((c, v) => { c.padding ||= {}; if (v === null) delete c.padding.r; else c.padding.r = v; }), { type: 'number', step: 0.75 }))));
    }
    if (sel.some((s) => s.c.type !== 'line' && s.c.type !== 'crossLine')) {
      const bd = first.border || {};
      const sides = /** @type {Array<[string,string]>} */ ([['top', 'Trên'], ['right', 'Phải'], ['bottom', 'Dưới'], ['left', 'Trái']]);
      const style = Object.values(bd)[0]?.style || 'solid';
      box.append(h('fieldset', {}, h('legend', {}, 'Viền'),
        h('div', { class: 'erp-pd__row' }, ...sides.map(([k, t]) => this.input(t, !!bd[k], each((c, v) => { c.border ||= {}; if (v) c.border[k] = { style }; else delete c.border[k]; if (!Object.keys(c.border).length) delete c.border; }), { type: 'checkbox' }))),
        this.input('Kiểu viền', style, each((c, v) => { for (const k of Object.keys(c.border || {})) c.border[k].style = v; }), { options: BORDER_STYLES })));
    }
    box.append(this.input('Hiện', first.visible !== false, each((c, v) => { if (v) delete c.visible; else c.visible = false; }), { type: 'checkbox' }));
    box.append(this.input('Hiện khi (biểu thức)', first.visibleWhen || '', each((c, v) => { if (v) c.visibleWhen = v; else delete c.visibleWhen; }), { type: 'textarea', check: (v) => (v ? check(v) : null) }));
    box.append(h('button', { type: 'button', class: 'erp-btn', onclick: () => this.removeSelected() }, icon('delete'), h('span', {}, sel.length > 1 ? `Xóa ${sel.length} control` : 'Xóa control')));
  }

  /** Nội dung + định dạng + tổng của một ô chữ. @param {HTMLElement} box @param {Obj} c */
  valueProps(box, c) {
    const v = c.value || {};
    const kind = VALUE_KINDS.find(([k]) => k in v)?.[0] || (Object.keys(v)[0] || 'text');
    const fs = h('fieldset', {}, h('legend', {}, 'Nội dung'));
    if (c.type === 'checkbox') fs.append(this.input('Chữ cạnh ô', c.caption || '', (x) => { c.caption = x; }));
    fs.append(this.input('Loại', kind, (k) => {
      const keep = 'field' in v ? v.field : '';
      c.value = k === 'text' ? { text: designText(c) } : k === 'field' ? { field: keep || this.fields[0]?.name || '' } : k === 'expr' ? { expr: keep ? `[${keep}]` : '""' }
        : k === 'dateText' ? { dateText: 'Ngày {D} tháng {M} năm {Y}', field: keep || undefined } : k === 'sys' ? { sys: 'SysCom1' } : k === 'pageInfo' ? { pageInfo: 'VN' }
          : k === 'printDate' ? { printDate: true } : k === 'userInput' ? { userInput: 'UInput1' } : k === 'template' ? { template: '{DocumentID}' } : { text: '' };
    }, { options: VALUE_KINDS.some(([k]) => k === kind) ? VALUE_KINDS : [...VALUE_KINDS, [kind, `Khác (${kind})`]] }));
    if (kind === 'text') fs.append(this.input('Chữ', v.text ?? '', (x) => { c.value = { text: x }; }, { type: 'textarea' }));
    if (kind === 'field' || kind === 'dateText') fs.append(this.input('Cột', v.field || '', (x) => { c.value = { ...v, field: x || undefined }; }, { list: this.fields.map((f) => f.name) }));
    if (kind === 'expr') fs.append(this.input('Biểu thức', v.expr ?? '', (x) => { c.value = { expr: x }; }, { type: 'textarea', rows: 3, check: (x) => check(x) }),
      h('span', { class: 'erp-pd__hint' }, 'Ví dụ: Quantity * Price · IIf(IsBold = 1, "x", "") · Format(DocumentDate, "dd/MM/yyyy") · NumberToWords(Amount)'));
    if (kind === 'template') fs.append(this.input('Chữ có {Cột}', v.template ?? '', (x) => { c.value = { template: x }; }, { type: 'textarea' }));
    if (kind === 'dateText') fs.append(this.input('Mẫu ngày ({D} {M} {Y} {YY})', v.dateText ?? '', (x) => { c.value = { ...v, dateText: x }; }));
    if (kind === 'sys') fs.append(this.input('Tên tham số', v.sys || '', (x) => { c.value = { ...v, sys: x }; }, { list: ['SysCom1', 'SysCom2', 'SysCom3', 'SysCom4', 'ReportLocation', 'UserFullName'] }));
    if (kind === 'userInput') fs.append(this.input('Ô người ký', v.userInput || 'UInput1', (x) => { c.value = { ...v, userInput: x }; }, { options: ['UInput1', 'UInput2', 'UInput3', 'UInput4', 'UInput5', 'UInput6'] }));
    if (kind === 'pageInfo') fs.append(this.input('Ngôn ngữ', v.pageInfo || 'VN', (x) => { c.value = { ...v, pageInfo: x }; }, { options: [['VN', 'Trang N/M'], ['EN', 'Page N/M']] }));
    box.append(fs);
    if (c.type !== 'text') return;
    const fmt = c.format;
    const words = fmt && typeof fmt === 'object' && fmt.kind === 'words';
    const f2 = h('fieldset', {}, h('legend', {}, 'Định dạng'),
      this.input('Chuỗi định dạng .NET', typeof fmt === 'string' ? fmt : '', (x) => { if (x) c.format = x; else delete c.format; }, { list: FORMATS }),
      this.input('Đọc số thành chữ', !!words, (x) => { if (x) c.format = { kind: 'words', currency: 'VND', lang: 'VN' }; else delete c.format; }, { type: 'checkbox' }));
    if (words) f2.append(h('div', { class: 'erp-pd__row2' },
      this.input('Tiền', fmt.currency || 'VND', (x) => { c.format = { ...fmt, currency: x }; }, { list: ['VND', 'USD', 'EUR', 'AUD', 'CAD'] }),
      this.input('Ngôn ngữ', fmt.lang || 'VN', (x) => { c.format = { ...fmt, lang: x }; }, { options: [['VN', 'Tiếng Việt'], ['EN', 'Tiếng Anh']] })));
    f2.append(h('div', { class: 'erp-pd__row2' },
      this.input('Ô tự cao (CanGrow)', c.canGrow !== false, (x) => { c.canGrow = x; }, { type: 'checkbox' }),
      this.input('Ẩn khi rỗng', !!c.hideIfEmpty, (x) => { c.hideIfEmpty = x; }, { type: 'checkbox' })),
      h('div', { class: 'erp-pd__row2' },
        this.input('Không in số 0', !!c.suppressZero, (x) => { c.suppressZero = x; }, { type: 'checkbox' }),
        this.input('Bỏ dấu âm', !!c.abs, (x) => { c.abs = x; }, { type: 'checkbox' })),
      this.input('Ẩn giá trị trùng dòng trên', c.hideDuplicates || '', (x) => { if (x) c.hideDuplicates = x; else delete c.hideDuplicates; },
        { options: [['', 'Không'], ['value', 'Ẩn chữ'], ['control', 'Ẩn cả ô']] }));
    box.append(f2);
    const s = c.summary;
    const groups = (this.tpl.groups || []).map((/** @type {Obj} */ g) => [`group:${g.id}`, `Nhóm ${g.id}${g.by ? ` (${g.by})` : ''}`]);
    const f3 = h('fieldset', {}, h('legend', {}, 'Tổng'),
      this.input('Hàm', s?.func || '', (x) => {
        if (!x) { delete c.summary; return; }
        const band = this.find(c.id)?.band;
        const scope = s?.scope || (band?.group ? `group:${band.group}` : 'report');
        c.summary = { func: x, scope, running: s?.running || 'none', ...(band && ['groupHeader', 'reportHeader', 'pageHeader'].includes(band.type) ? { lookAhead: true } : {}) };
      }, { options: [['', 'Không'], ['sum', 'Tổng'], ['count', 'Đếm (STT)'], ['avg', 'Trung bình'], ['min', 'Nhỏ nhất'], ['max', 'Lớn nhất'], ['countdistinct', 'Đếm khác nhau'], ['concat', 'Nối chuỗi']] }));
    if (s) f3.append(
      this.input('Phạm vi', s.scope, (x) => { c.summary = { ...s, scope: x }; }, { options: [['report', 'Cả báo cáo'], ['page', 'Trang'], ...groups] }),
      this.input('Lũy kế', s.running || 'none', (x) => { c.summary = { ...s, running: x }; }, { options: [['none', 'Không'], ['group', 'Trong nhóm'], ['all', 'Toàn báo cáo']] }));
    box.append(f3);
  }

  /* ---------------- thao tác ---------------- */

  /** @param {string} id @param {boolean} [add] */
  select(id, add = false) {
    if (add) this.sel = this.sel.includes(id) ? this.sel.filter((x) => x !== id) : [...this.sel, id];
    else this.sel = [id];
    const f = this.find(id);
    if (f) this.band = f.band.id;
    this.renderCanvas(); this.renderTree(); this.renderProps(); this.updateBar();
  }

  /** @param {string} id */
  selectBand(id) { this.sel = []; this.band = id; this.renderCanvas(); this.renderTree(); this.renderProps(); this.updateBar(); }

  targetBand() {
    const bands = this.tpl.bands || [];
    return this.bandById(this.band || '') || bands.find((/** @type {Obj} */ b) => b.type === 'detail') || bands[0];
  }

  /** @param {string} kind @param {{x:number,y:number}} [at] @param {string} [field] @param {Obj} [band] */
  addControl(kind, at, field, band) {
    const b = band || this.targetBand();
    if (!b) return;
    const pos = at || { x: 2, y: Math.min(Math.max(0, b.height - 6), 1) };
    /** @type {Obj} */ let c;
    const id = this.newId(kind === 'field' ? 'txt' : kind === 'line' ? 'line' : kind === 'rect' ? 'box' : 'lbl');
    const base = { id, x: r2(pos.x), y: r2(pos.y) };
    if (kind === 'line') c = { id, type: 'line', x1: base.x, y1: base.y, x2: r2(base.x + 40), y2: base.y };
    else if (kind === 'rect') c = { ...base, type: 'rect', w: 30, h: 15, border: { top: { style: 'solid' }, right: { style: 'solid' }, bottom: { style: 'solid' }, left: { style: 'solid' } } };
    else if (kind === 'image') c = { ...base, type: 'image', w: 20, h: 20, fit: 'zoom', src: { system: 'logo' } };
    else if (kind === 'checkbox') c = { ...base, type: 'checkbox', w: 25, h: 5, caption: 'Ô chọn', value: { field: field || this.fields[0]?.name || '' } };
    else if (kind === 'barcode') c = { ...base, type: 'barcode', w: 40, h: 12, symbology: 'code128', caption: true, value: { field: field || this.fields[0]?.name || '' } };
    else if (kind === 'pageInfo') c = { ...base, type: 'text', w: 30, h: 5, value: { pageInfo: 'VN' }, style: { align: 'right' } };
    else if (kind === 'field') c = { ...base, type: 'text', w: 30, h: 5, canGrow: true, value: { field: field || this.fields[0]?.name || '' } };
    else c = { ...base, type: 'text', w: 30, h: 5, canGrow: false, value: { text: 'Chữ' } };
    this.edit(() => {
      b.controls ||= [];
      b.controls.push(c);
      const bottom = boxOf(c).y + boxOf(c).h;
      if (bottom > b.height) b.height = r2(bottom + 1);
      this.sel = [c.id];
      this.band = b.id;
    });
    this.canvas.focus();
  }

  removeSelected() {
    if (!this.sel.length) return;
    const ids = new Set(this.sel);
    this.edit(() => { for (const b of this.tpl.bands || []) b.controls = (b.controls || []).filter((/** @type {Obj} */ c) => !ids.has(c.id)); this.sel = []; });
  }

  /** @param {string} how */
  align(how) {
    const sel = this.selected();
    if (sel.length < 2) return;
    this.edit(() => {
      const ref = boxOf(sel[0].c);
      const boxes = sel.map((s) => ({ s, b: boxOf(s.c) }));
      if (how === 'distH' || how === 'distV') {
        const k = how === 'distH' ? 'x' : 'y', z = how === 'distH' ? 'w' : 'h';
        boxes.sort((a, b) => a.b[k] - b.b[k]);
        const first = boxes[0].b, last = boxes[boxes.length - 1].b;
        const total = boxes.reduce((s, x) => s + x.b[z], 0);
        const gap = (last[k] + last[z] - first[k] - total) / (boxes.length - 1);
        let pos = first[k];
        for (const x of boxes) { setBox(x.s.c, { ...x.b, [k]: r2(pos) }); pos += x.b[z] + gap; }
        return;
      }
      for (const { s, b } of boxes.slice(1)) {
        const nb = { ...b };
        if (how === 'left') nb.x = ref.x;
        if (how === 'right') nb.x = ref.x + ref.w - b.w;
        if (how === 'hcenter') nb.x = ref.x + (ref.w - b.w) / 2;
        if (how === 'top') nb.y = ref.y;
        if (how === 'bottom') nb.y = ref.y + ref.h - b.h;
        if (how === 'vcenter') nb.y = ref.y + (ref.h - b.h) / 2;
        if (how === 'width') nb.w = ref.w;
        if (how === 'height') nb.h = ref.h;
        setBox(s.c, nb);
      }
    });
  }

  /** @param {1|-1} dir */
  order(dir) {
    const ids = new Set(this.sel);
    this.edit(() => {
      for (const b of this.tpl.bands || []) {
        const picked = (b.controls || []).filter((/** @type {Obj} */ c) => ids.has(c.id));
        if (!picked.length) continue;
        const rest = b.controls.filter((/** @type {Obj} */ c) => !ids.has(c.id));
        b.controls = dir > 0 ? [...rest, ...picked] : [...picked, ...rest];
      }
    });
  }

  addGroup() {
    const by = window.prompt(`Nhóm theo cột (${this.fields.slice(0, 8).map((f) => f.name).join(', ')}${this.fields.length > 8 ? '…' : ''}):`, this.fields[0]?.name || 'DocumentID');
    if (by === null) return;
    this.edit(() => {
      const id = this.newId('GroupHeader');
      const fid = id.replace('GroupHeader', 'GroupFooter');
      (this.tpl.groups ||= []).push({ id, by: by.trim() || null, newPage: 'none', keepTogether: 'none', repeatHeader: 'none' });
      const bands = this.tpl.bands;
      const det = bands.findIndex((/** @type {Obj} */ b) => b.type === 'detail');
      const at = det < 0 ? bands.length : det;
      bands.splice(at, 0, { id, type: 'groupHeader', group: id, height: 8, canGrow: true, controls: [{ id: this.newId('txt'), type: 'text', x: 0, y: 1, w: 60, h: 5, value: { field: by.trim() }, style: { bold: true } }] });
      const det2 = bands.findIndex((/** @type {Obj} */ b) => b.type === 'detail');
      bands.splice(det2 < 0 ? bands.length : det2 + 1, 0, { id: fid, type: 'groupFooter', group: id, height: 6, canGrow: true, controls: [] });
      this.band = id;
      this.sel = [];
    });
  }

  /** @param {string} gid */
  removeGroup(gid) {
    if (!window.confirm(`Xóa nhóm ${gid} cùng đầu và cuối nhóm (kể cả control bên trong)?`)) return;
    this.edit(() => {
      this.tpl.groups = (this.tpl.groups || []).filter((/** @type {Obj} */ g) => g.id !== gid);
      this.tpl.bands = this.tpl.bands.filter((/** @type {Obj} */ b) => b.group !== gid);
      this.band = null;
      this.sel = [];
    });
  }

  copy(cut = false) {
    const sel = this.selected();
    if (!sel.length) return;
    this.clipboard = sel.map((s) => clone(s.c));
    if (cut) this.removeSelected();
  }

  paste() {
    if (!this.clipboard?.length) return;
    const b = this.targetBand();
    if (!b) return;
    const items = this.clipboard.map((c) => clone(c));
    this.edit(() => {
      /** @type {string[]} */ const ids = [];
      for (const c of items) {
        c.id = this.newId(c.id.replace(/\d+$/, '') || 'ctl');
        const bb = boxOf(c);
        setBox(c, { ...bb, x: bb.x + 2, y: Math.min(bb.y + 2, Math.max(0, b.height - bb.h)) });
        (b.controls ||= []).push(c);
        ids.push(c.id);
      }
      this.sel = ids;
      this.band = b.id;
    });
  }

  /* ---------------- chuột / bàn phím ---------------- */

  bindCanvas() {
    const cv = this.canvas;
    const mmPerPx = () => 1 / (PX_PER_MM * this.zoom);
    const snap = (/** @type {number} */ v, /** @type {boolean} */ free) => (this.grid && !free ? Math.round(v / this.step) * this.step : r2(v));
    cv.addEventListener('pointerdown', (e) => {
      if (this.previewOn || e.button !== 0) return;
      const t = /** @type {HTMLElement} */ (e.target);
      const head = t.closest('.erp-pd__bandhead');
      if (head) { this.selectBand(head.getAttribute('data-band') || ''); return; }
      const grip = t.closest('[data-grip]');
      const handle = t.closest('[data-handle]');
      const ctl = t.closest('.erp-pd__ctl');
      const body = /** @type {HTMLElement|null} */ (t.closest('.erp-pd__bandbody'));
      cv.focus({ preventScroll: true });
      if (this.readOnly && !ctl) return;
      const x0 = e.clientX, y0 = e.clientY;
      if (grip) {
        const b = this.bandById(grip.getAttribute('data-grip') || '');
        if (!b || this.readOnly) return;
        const h0 = b.height;
        this.drag(e, (dx, dy, free) => { b.height = Math.max(0, snap(h0 + dy * mmPerPx(), free)); this.renderCanvas(); }, () => this.edit(() => {}), () => { b.height = h0; });
        return;
      }
      if (handle) {
        const one = this.selected()[0];
        if (!one || this.readOnly) return;
        const dir = handle.getAttribute('data-handle') || '';
        const b0 = boxOf(one.c);
        const snapshot = this.snapshot();
        this.drag(e, (dx, dy, free) => {
          const m = { x: dx * mmPerPx(), y: dy * mmPerPx() };
          const nb = { ...b0 };
          if (dir.includes('e')) nb.w = snap(b0.x + b0.w + m.x, free) - b0.x;
          if (dir.includes('s')) nb.h = snap(b0.y + b0.h + m.y, free) - b0.y;
          if (dir.includes('w')) { const nx = snap(b0.x + m.x, free); nb.w = b0.x + b0.w - nx; nb.x = nx; }
          if (dir.includes('n')) { const ny = snap(b0.y + m.y, free); nb.h = b0.y + b0.h - ny; nb.y = ny; }
          if (one.c.type !== 'line') { nb.w = Math.max(0.5, nb.w); nb.h = Math.max(0.5, nb.h); }
          setBox(one.c, nb);
          this.renderCanvas();
        }, () => this.commitDrag(snapshot), () => { this.restore(snapshot); this.render(); });
        return;
      }
      if (ctl) {
        const id = ctl.getAttribute('data-id') || '';
        if (e.shiftKey || e.ctrlKey) { this.select(id, true); return; }
        if (!this.sel.includes(id)) this.select(id);
        if (this.readOnly) return;
        const items = this.selected().map((s) => ({ s, b: boxOf(s.c) }));
        const snapshot = this.snapshot();
        const lead = items.find((x) => x.s.c.id === id) || items[0];
        let moved = false;
        this.drag(e, (dx, dy, free) => {
          if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
          moved = true;
          const nx = snap(lead.b.x + dx * mmPerPx(), free) - lead.b.x;
          const ny = snap(lead.b.y + dy * mmPerPx(), free) - lead.b.y;
          for (const it of items) setBox(it.s.c, { ...it.b, x: Math.max(0, it.b.x + nx), y: Math.max(0, it.b.y + ny) });
          this.renderCanvas();
        }, (ev) => {
          if (!moved) return;
          // Thả sang band khác: chuyển các control đã chọn sang band dưới con trỏ.
          const over = /** @type {HTMLElement|null} */ (document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.erp-pd__bandbody') || null);
          const target = over ? this.bandById(over.getAttribute('data-band') || '') : null;
          if (target && items.every((it) => it.s.band !== target)) {
            const rect = over.getBoundingClientRect();
            const yIn = (ev.clientY - rect.top) * mmPerPx();
            for (const it of items) {
              it.s.band.controls = it.s.band.controls.filter((/** @type {Obj} */ c) => c !== it.s.c);
              const bb = boxOf(it.s.c);
              setBox(it.s.c, { ...bb, y: Math.max(0, snap(yIn - (lead.b.h / 2), false) + (it.b.y - lead.b.y)) });
              (target.controls ||= []).push(it.s.c);
            }
            this.band = target.id;
          }
          this.commitDrag(snapshot);
        }, () => { this.restore(snapshot); this.render(); });
        return;
      }
      if (body) {
        const bandId = body.getAttribute('data-band') || '';
        if (!e.shiftKey) { this.sel = []; this.band = bandId; }
        const rect = body.getBoundingClientRect();
        const mq = h('div', { class: 'erp-pd__marquee' });
        body.append(mq);
        const sx = (x0 - rect.left) * mmPerPx(), sy = (y0 - rect.top) * mmPerPx();
        /** @type {string[]} */ let hit = [];
        this.drag(e, (dx, dy) => {
          const ex = sx + dx * mmPerPx(), ey = sy + dy * mmPerPx();
          const r = { x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(ex - sx), h: Math.abs(ey - sy) };
          Object.assign(mq.style, { left: `${r.x}mm`, top: `${r.y}mm`, width: `${r.w}mm`, height: `${r.h}mm` });
          const b = this.bandById(bandId);
          hit = (b?.controls || []).filter((/** @type {Obj} */ c) => { const q = boxOf(c); return q.x < r.x + r.w && q.x + Math.max(q.w, 0.5) > r.x && q.y < r.y + r.h && q.y + Math.max(q.h, 0.5) > r.y; }).map((/** @type {Obj} */ c) => c.id);
        }, () => {
          mq.remove();
          this.sel = e.shiftKey ? [...new Set([...this.sel, ...hit])] : hit;
          this.renderCanvas(); this.renderTree(); this.renderProps(); this.updateBar();
        }, () => mq.remove());
      }
    });
    cv.addEventListener('dblclick', (e) => {
      const ctl = /** @type {HTMLElement} */ (e.target).closest('.erp-pd__ctl');
      if (!ctl) return;
      const area = /** @type {HTMLElement|null} */ (this.right.querySelector('textarea, input[list]'));
      area?.focus();
    });
    cv.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('text/x-erp-field') && !this.readOnly) e.preventDefault(); });
    cv.addEventListener('drop', (e) => {
      const name = e.dataTransfer?.getData('text/x-erp-field');
      const body = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('.erp-pd__bandbody'));
      if (!name || !body) return;
      e.preventDefault();
      const rect = body.getBoundingClientRect();
      const k = 1 / (PX_PER_MM * this.zoom);
      const b = this.bandById(body.getAttribute('data-band') || '');
      if (b) this.addControl('field', { x: Math.round((e.clientX - rect.left) * k), y: Math.round((e.clientY - rect.top) * k) }, name, b);
    });
    cv.addEventListener('keydown', (e) => this.onKey(e));
  }

  /**
   * Kéo chuột chung: Esc hủy, Alt tắt bắt dính.
   * @param {PointerEvent} e @param {(dx: number, dy: number, free: boolean) => void} move @param {(ev: PointerEvent) => void} done @param {() => void} cancel
   */
  drag(e, move, done, cancel) {
    const x0 = e.clientX, y0 = e.clientY;
    e.preventDefault();
    const onMove = (/** @type {PointerEvent} */ ev) => move(ev.clientX - x0, ev.clientY - y0, ev.altKey);
    const end = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onEsc, true); };
    const onUp = (/** @type {PointerEvent} */ ev) => { end(); done(ev); };
    const onEsc = (/** @type {KeyboardEvent} */ ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); end(); cancel(); } };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onEsc, true);
  }

  /** @param {string} before */
  commitDrag(before) {
    if (before === this.snapshot()) { this.render(); return; }
    this.undoStack.push(before);
    this.redoStack = [];
    this.setDirty(true);
    this.render();
  }

  /** @param {KeyboardEvent} e */
  onKey(e) {
    if (this.previewOn) return;
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (k === 'z' || k === 'Z') && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
    if (ctrl && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey))) { e.preventDefault(); this.redo(); return; }
    if (ctrl && (k === 'c' || k === 'C')) { e.preventDefault(); this.copy(); return; }
    if (ctrl && (k === 'x' || k === 'X')) { e.preventDefault(); this.copy(true); return; }
    if (ctrl && (k === 'v' || k === 'V')) { e.preventDefault(); this.paste(); return; }
    if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); this.copy(); this.paste(); return; }
    if (ctrl && (k === 'a' || k === 'A')) { e.preventDefault(); const b = this.targetBand(); this.sel = (b?.controls || []).map((/** @type {Obj} */ c) => c.id); this.render(); return; }
    if (k === 'Escape') { if (this.sel.length) { e.stopPropagation(); this.sel = []; this.render(); } return; }
    if ((k === 'Delete' || k === 'Backspace') && this.sel.length) { e.preventDefault(); this.removeSelected(); return; }
    const arrows = /** @type {Record<string,[number,number]>} */ ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });
    if (arrows[k] && this.sel.length) {
      e.preventDefault();
      const [dx, dy] = arrows[k];
      const step = e.shiftKey ? 5 : e.altKey ? 0.1 : this.step;
      this.edit(() => {
        for (const s of this.selected()) {
          const b = boxOf(s.c);
          if (ctrl) setBox(s.c, { ...b, w: Math.max(0.5, b.w + dx * step), h: Math.max(0.5, b.h + dy * step) });
          else setBox(s.c, { ...b, x: Math.max(0, b.x + dx * step), y: Math.max(0, b.y + dy * step) });
        }
      });
    }
  }

  /* ---------------- xem trước, nhập / xuất, lưu ---------------- */

  togglePreview() {
    this.previewOn = !this.previewOn;
    this.canvas.hidden = this.previewOn;
    this.preview.hidden = !this.previewOn;
    if (this.previewOn) this.renderPreview();
    this.updateBar();
  }

  renderPreview() {
    try {
      const data = this.data || { main: fakeData(this.tpl, { rows: 12, groups: 2 }), sys: null };
      const doc = buildDocument(this.tpl, data, { measure: domMeasure(document) });
      const el = renderPages(doc.pages);
      this.preview.replaceChildren(
        h('p', { class: 'erp-pd__hint' }, `${doc.pages.length} trang · ${this.data ? 'dữ liệu thật của chứng từ' : 'dữ liệu giả (chưa có chứng từ để xem)'}${doc.warnings.length ? ` · ${doc.warnings.length} cảnh báo: ${doc.warnings.slice(0, 3).join('; ')}` : ''}`),
        el);
    } catch (e) {
      this.preview.replaceChildren(h('p', { class: 'erp-pd__err' }, `Không dựng được: ${/** @type {Error} */ (e).message}`));
    }
  }

  /** @param {File} f */
  async importFile(f) {
    try {
      const text = await f.text();
      const t = /\.json$/i.test(f.name) ? JSON.parse(text) : convertRpx(text, { file: f.name }).template;
      if (t.$schema !== TEMPLATE_SCHEMA) throw new Error('Không phải mẫu erp-print-template/1');
      this.edit(() => { const { assets, ...rest } = clone(t); this.tpl = { ...rest, assets: assets || {} }; this.sel = []; this.band = null; });
      this.refreshFields();
      this.render();
      toast(`Đã nhập ${f.name}`, 'success');
    } catch (e) { toast(`Không nhập được: ${/** @type {Error} */ (e).message}`, 'error'); }
  }

  exportJson() {
    const a = h('a', { download: `${this.name || this.tpl.id || 'mau-in'}.json`, href: URL.createObjectURL(new Blob([JSON.stringify(this.tpl, null, 1)], { type: 'application/json' })) });
    a.click();
    setTimeout(() => URL.revokeObjectURL(/** @type {HTMLAnchorElement} */ (a).href), 5000);
  }

  async save() {
    if (this.readOnly || !this.form) return;
    const errors = this.validateTemplate();
    if (errors.length) { await messageBox(errors.map((t) => ({ type: 'error', text: t })), 'Mẫu còn lỗi'); return; }
    const comment = window.prompt('Ghi chú cho lần lưu này (tùy chọn):', '') ?? null;
    if (comment === null) return;
    const fd = new FormData(this.form);
    fd.set('Json', JSON.stringify(this.tpl));
    fd.set('Comment', comment);
    this.status.textContent = 'Đang lưu…';
    try {
      const res = await fetchHtml(this.form.action, { method: 'POST', body: fd, tabId: this.ctx.tab?.id });
      const msgs = Array.from(res.doc.querySelectorAll('[data-erp="message"]')).map((p) => ({ type: p.getAttribute('data-msg-type') || 'info', text: p.textContent?.trim() || '' }));
      if (!res.ok || msgs.some((m) => m.type === 'error')) {
        this.status.textContent = 'Chưa lưu';
        await messageBox(msgs.length ? msgs : [{ type: 'error', text: `Máy chủ trả lỗi ${res.status}.` }], 'Không lưu được');
        return;
      }
      this.setDirty(false);
      this.status.textContent = `Đã lưu ${new Date().toLocaleTimeString('vi-VN')}`;
      toast(msgs.find((m) => m.type === 'success')?.text || 'Đã lưu mẫu in.', 'success');
    } catch (e) {
      this.status.textContent = 'Chưa lưu';
      toast(`Không lưu được: ${/** @type {Error} */ (e).message}`, 'error');
    }
  }

  /** Kiểm trước khi lưu: biểu thức đọc được, id không trùng, control nằm trong vùng in. */
  validateTemplate() {
    /** @type {string[]} */ const out = [];
    const ids = new Set();
    const W = this.tpl.page.bodyWidth;
    for (const { band, c } of this.allControls()) {
      if (ids.has(c.id)) out.push(`Mã control ${c.id} bị trùng.`);
      ids.add(c.id);
      for (const e of [c.value?.expr, c.visibleWhen, ...(c.rules || []).map((/** @type {Obj} */ r) => r.when)].filter(Boolean)) {
        const err = check(e);
        if (err) out.push(`${c.id} (${band.id}): biểu thức "${String(e).slice(0, 40)}" lỗi — ${err}`);
      }
      const b = boxOf(c);
      if (b.x + b.w > W + 0.5) out.push(`${c.id} (${band.id}) vượt quá độ rộng vùng in ${W} mm.`);
    }
    for (const b of this.tpl.bands || []) if (b.visibleWhen && check(b.visibleWhen)) out.push(`Band ${b.id}: điều kiện hiện lỗi — ${check(b.visibleWhen)}`);
    return out.slice(0, 20);
  }
}
