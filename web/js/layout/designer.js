// @ts-check
/**
 * Trình vẽ layout form (vai trò `section[data-erp=layout-designer]`, chuẩn ERP-HTML mục 15.3; docs/kien-truc/07-ve-layout-form.md).
 * Sửa bố cục LYT của form như LayoutSettingFrm (Ctrl+F12) của WinForms: lưới 40 cột, kéo đổi chỗ / sang tab khác / vào nhóm,
 * kéo cạnh phải đổi độ rộng, thuộc tính theo chuỗi 21 vị trí, thêm ô từ cột của bảng, bỏ ô, nhóm, nhãn; xem trước bằng đúng bộ
 * nâng cấp ô của FE; hoàn tác / làm lại; phiên bản đã lưu và khôi phục. BE ghi SY_FrmCfg như WinForms và giữ bản sao lưu.
 * FE không chạy gì trong cấu hình (SQL mặc định chỉ hiện để xem).
 */
import { h, fold } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { fetchHtml, isAllowedUrl } from '../core/http.js';
import { toast, messageBox, confirmBox } from '../core/ui.js';
import { enhanceFields } from '../enhance/fields.js';

/** @typedef {Record<string, any>} Obj */
/**
 * Một ô / control của bố cục: một dòng LYT. `cfg` = 21 vị trí (giữ nguyên các vị trí trình vẽ không sửa).
 * `group` = đường dẫn nhóm cha (tên các nhóm nối nhau như KeyID của WinForms: LYT1GrpBox1GrpBox2 ⇒ "GrpBox1GrpBox2"); "" = ngoài nhóm.
 * `text` = chữ trên nút do BE tính (LYS BT / LT, chữ mặc định của control), chỉ để hiện; không gửi lại.
 * `props` = thuộc tính riêng LYS (mã → giá trị); `from` = tên cũ khi đổi tên trong lần sửa này (BE giữ dòng và thuộc tính của ô).
 * `loaded` = ô đọc từ cấu hình (đổi tên thì gửi `from`); ô thêm mới / chép thì không.
 * @typedef {{ uid:string, tab:string, group:string, name:string, cfg:string[], text?:string, props:Record<string,string>, from?:string, loaded?:boolean }} Item
 */

export const LAYOUT_SCHEMA = 'erp-form-layout/1';
const COLS = 40;
const CT = /** @type {Array<[number,string]>} */ ([[1, 'Ô chữ'], [2, 'Ô chọn'], [3, 'Chọn nhiều'], [4, 'Ngày'], [5, 'Số'], [6, 'Đánh dấu'], [7, 'Màu'],
  [20, 'Nút chọn (radio)'], [22, 'User control'], [23, 'Nhóm'], [24, 'Nút menu'], [26, 'Nút'], [28, 'Nhãn'], [30, 'HTML']]);
const PERM = /** @type {Array<[number,string]>} */ ([[0, 'Mọi người'], [2, 'Khóa khi có giá trị mặc định'], [3, 'Khóa khi có mặc định SQL'],
  [4, 'Ẩn khi có giá trị mặc định'], [5, 'Ẩn khi có mặc định SQL'], [7, 'Quản lý'], [9, 'Quản trị']]);
const ENABLE = /** @type {Array<[number,string]>} */ ([[0, 'Không dùng'], [1, 'Bình thường'], [2, 'Sửa hoặc thêm'], [3, 'Chỉ khi thêm'], [4, 'Chỉ khi sửa'],
  [7, 'Quản lý'], [9, 'Quản trị']]);
const CHECK = /** @type {Array<[number,string]>} */ ([[0, 'Không'], [1, 'Cảnh báo khi trống'], [2, 'Không được trùng']]);
/**
 * Thuộc tính riêng LYS (PropertyX của WinForms): nhãn và kiểu ô nhập. Mã nào sửa được do BE quyết (`editableProps` theo loại control);
 * mã khác (có SQL / lệnh, vd LBS, VLQ, C4) chỉ hiện để xem. Bật/tắt ghi "1" / rỗng; màu là số ARGB có dấu như .NET.
 * @type {Record<string, [string, 'int'|'bool'|'color'|'text'|'font'|'align']>}
 */
const PROPS = {
  FH: ['Cao cố định (px)', 'int'], FW: ['Rộng cố định (px)', 'int'], PT: ['Dịch xuống (px)', 'int'], PL: ['Dịch sang phải (px)', 'int'],
  PV1: ['Màu chữ của ô', 'color'], PV3: ['Chữ của ô đậm', 'bool'], PV4: ['Màu chữ nhãn', 'color'], PV5: ['Nền nhãn', 'color'], PV6: ['Nhãn đậm', 'bool'],
  LBEX: ['Khóa ô khi (biểu thức trên dòng, vd StatusID<>2)', 'text'], LBSP: ['Cột tham số của SQL khóa', 'text'],
  PC: ['Ký tự che (mật khẩu)', 'text'],
  MVR: ['Có giá trị nhỏ nhất', 'bool'], MV: ['Giá trị nhỏ nhất', 'text'], MXR: ['Có giá trị lớn nhất', 'bool'], MX: ['Giá trị lớn nhất', 'text'],
  SCB: ['Nút xóa', 'bool'], SUD: ['Nút tăng / giảm', 'bool'], SUV1: ['Bước tăng 1', 'text'], SUV2: ['Bước tăng 2', 'text'],
  SFB: ['Có khung', 'bool'], SFT: ['Tiêu đề khung', 'text'], VLS: ['Danh sách giá trị (;)', 'text'], VLC: ['Danh sách chữ (;)', 'text'], VCW: ['Độ rộng từng nút (;)', 'text'],
  BI: ['Biểu tượng', 'text'], BC: ['Màu nền', 'color'],
  B0: ['Kiểu viền', 'text'], B1: ['Màu viền', 'color'], B2: ['Cỡ viền', 'int'], FS: ['Cỡ chữ', 'int'], FB: ['Kiểu chữ', 'font'], FN: ['Font', 'text'],
  FC: ['Màu chữ', 'color'], F1: ['Viền chữ', 'text'], B4: ['Màu viền chữ', 'color'], TA: ['Canh chữ', 'align'],
  BT: ['Chữ trên nút', 'text'], LT: ['Chữ liên kết', 'text'],
};
const FONT_STYLES = /** @type {Array<[string,string]>} */ ([['', 'Thường'], ['1', 'Đậm'], ['2', 'Nghiêng'], ['3', 'Đậm nghiêng'], ['4', 'Gạch chân'], ['5', 'Đậm, gạch chân']]);
const ALIGNS = /** @type {Array<[string,string]>} */ ([['', 'Mặc định'], ['1', 'Trên trái'], ['2', 'Trên giữa'], ['4', 'Trên phải'], ['16', 'Giữa trái'],
  ['32', 'Chính giữa'], ['64', 'Giữa phải'], ['256', 'Dưới trái'], ['512', 'Dưới giữa'], ['1024', 'Dưới phải']]);
/** Số ARGB có dấu (.NET Color.ToArgb) → #rrggbb. @param {string} v */
export function argbToHex(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, '0')}` : '#000000'; }
/** #rrggbb → số ARGB có dấu, alpha 255. @param {string} hex */
export function hexToArgb(hex) { return String((0xff000000 | parseInt(hex.slice(1), 16)) | 0); }

/* ---------------- chuỗi LYT 21 vị trí (docs/legacy-analysis/10-engine-form-dong.md §4.7) ---------------- */

/** @param {string} s @returns {string[]} */
export function parseCfg(s) {
  const p = String(s ?? '').split(';');
  while (p.length < 21) p.push('');
  return p;
}
/** Chuỗi ghi lại: giữ đủ số vị trí gốc (tối thiểu 21). @param {string[]} p */
export const joinCfg = (p) => p.join(';');
/** Chữ người dùng → vị trí 7 / 10 (";" của ERP mã hóa thành ":"). @param {string} v */
export const encText = (v) => String(v ?? '').replace(/;/g, ':');
/** @param {string} v */
export const decText = (v) => String(v ?? '').replace(/:/g, ';');
const num = (/** @type {string} */ v, /** @type {number} */ d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
/** Độ rộng trên lưới 40 cột (99 = hết dòng, 0 = tự động ⇒ hết dòng như web đang hiện). @param {Item} it */
export function spanOf(it) { const x = num(it.cfg[1], 3); return x === 99 || x === 0 || x > COLS ? COLS : Math.max(1, x); }
/** @param {Item} it */
const typeOf = (it) => num(it.cfg[0], 1);
/** @param {Item} it */
const rowsOf = (it) => { const y = num(it.cfg[2], 1); return y === 99 ? 4 : Math.min(Math.max(y, 1), 16); };

/**
 * @param {HTMLElement} section @param {import('../shell/tabs.js').TabContext} ctx
 */
export function enhanceLayoutDesigner(section, ctx) {
  const d = new LayoutDesigner(section, ctx);
  d.start();
  return d;
}

class LayoutDesigner {
  /** @param {HTMLElement} section @param {import('../shell/tabs.js').TabContext} ctx */
  constructor(section, ctx) {
    this.section = section;
    this.ctx = ctx;
    this.form = /** @type {HTMLFormElement|null} */ (section.querySelector('form[method="post" i]'));
    this.readOnly = !this.form;
    /** @type {Obj} */ this.data = { tabs: [], items: [], fields: [], versions: [] };
    /** @type {Item[]} */ this.items = [];
    /** @type {Record<string,string>} */ this.captions = {};
    this.tab = '1';
    /** @type {string|null} */ this.sel = null;
    /** @type {string[]} */ this.undoStack = [];
    /** @type {string[]} */ this.redoStack = [];
    this.dirty = false;
    this.previewOn = false;
    this.seq = 0;
    this.filter = '';
  }

  start() {
    const s = this.section;
    s.classList.add('erp-pd', 'erp-ld');
    if (this.form) this.form.hidden = true;
    this.status = h('span', { class: 'erp-pd__status', 'aria-live': 'polite' }, 'Đang nạp bố cục…');
    this.tabsBar = h('div', { class: 'erp-subtabs erp-ld__tabs', role: 'tablist', 'aria-label': 'Tab của form' });
    this.canvas = h('div', { class: 'erp-ld__canvas', tabindex: '0', 'aria-label': 'Vùng vẽ bố cục' });
    this.center = h('div', { class: 'erp-ld__center' }, this.tabsBar, this.canvas);
    this.left = h('div', { class: 'erp-pd__side' });
    this.right = h('div', { class: 'erp-pd__side' });
    s.append(this.toolbar(), this.left, this.center, this.right);
    this.ctx.registerKey?.('Ctrl+S', (ev) => { ev.preventDefault?.(); if (s.isConnected) this.save(); });
    this.ctx.registerKey?.('Ctrl+Z', (ev) => { if (!isTyping()) { ev.preventDefault?.(); this.undo(); } });
    this.ctx.registerKey?.('Ctrl+Y', (ev) => { if (!isTyping()) { ev.preventDefault?.(); this.redo(); } });
    this.canvas.addEventListener('keydown', (e) => this.onKey(e));
    // Bấm chỗ trống của khung vẽ: bỏ chọn ô, hiện thuộc tính / công cụ của tab.
    this.canvas.addEventListener('click', (e) => {
      if (this.previewOn || /** @type {HTMLElement} */ (e.target).closest('.erp-ld__item') || !this.sel) return;
      this.sel = null; this.renderCanvas(); this.renderRight();
    });
    this.load().catch((e) => { this.status.textContent = `Không nạp được bố cục: ${e.message || e}`; });
  }

  async load() {
    const src = this.section.getAttribute('data-layout-src') || '';
    if (!src || !isAllowedUrl(src)) throw new Error('Thiếu hoặc sai data-layout-src');
    const res = await fetch(src, { credentials: 'include', headers: { Accept: 'application/json', 'X-ERP-Request': 'layout' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.$schema !== LAYOUT_SCHEMA) throw new Error('Dữ liệu không đúng định dạng erp-form-layout/1');
    this.data = data;
    this.items = (data.items || []).map((/** @type {Obj} */ x) => Object.assign(this.mk(String(x.tab), String(x.group || ''), String(x.name), parseCfg(x.cfg)),
      x.text ? { text: String(x.text) } : {}, { props: { ...(x.props || {}) }, loaded: true }));
    /** @type {Record<string, string[]>} */ this.editable = data.editableProps || {};
    /** Tiêu đề / quyền xem trang chi tiết (chỉ trang sửa được). @type {Record<string, {caption?:string, visible?:string}>} */
    this.pages = {};
    for (const t of data.tabs || []) {
      if (t.kind !== 'detail') continue;
      const p = {};
      if (t.dcpEditable) /** @type {Obj} */ (p).caption = t.dcp || '';
      if (t.visibleEditable) /** @type {Obj} */ (p).visible = t.visible || '0';
      if (Object.keys(p).length) this.pages[String(t.page)] = p;
    }
    this.sourceList = null;
    this.captions = Object.fromEntries((data.tabs || []).filter((/** @type {Obj} */ t) => t.captionKey).map((/** @type {Obj} */ t) => [t.captionKey, t.caption || '']));
    this.base = this.snapshot();
    this.tab = (data.tabs || []).find((/** @type {Obj} */ t) => this.items.some((i) => i.tab === t.id))?.id || data.tabs?.[0]?.id || '1';
    this.render();
    this.status.textContent = this.readOnly ? 'Chỉ xem (không có quyền lưu bố cục)' : 'Sẵn sàng';
  }

  /** @param {string} tab @param {string} group @param {string} name @param {string[]} cfg @returns {Item} */
  mk(tab, group, name, cfg) { return { uid: `i${++this.seq}`, tab, group, name, cfg, props: {} }; }

  /** Mã LYS sửa được với loại control `ct` (BE gửi: "0" = mọi loại). @param {number} ct @param {string} code */
  canEditProp(ct, code) { return [...(this.editable['0'] || []), ...(this.editable[String(ct)] || [])].some((c) => c.toUpperCase() === code.toUpperCase()); }

  /* ---------------- thanh công cụ ---------------- */

  toolbar() {
    /** @param {string} ic @param {string} label @param {() => void} fn @param {Obj} [o] */
    const b = (ic, label, fn, o = {}) => h('button', { type: 'button', class: `erp-pd__tool ${o.cls || ''}`, title: o.title || label, onclick: fn },
      icon(ic), o.text === false ? null : h('span', {}, label));
    const sep = () => h('span', { class: 'erp-pd__sep', 'aria-hidden': 'true' });
    this.btnSave = b('save', 'Lưu bố cục', () => this.save(), { cls: 'erp-pd__tool--primary', title: 'Lưu bố cục (Ctrl+S)' });
    this.btnPreview = b('search', 'Xem trước', () => this.togglePreview(), { title: 'Xem như màn chứng từ trên web' });
    this.btnPreview.setAttribute('aria-pressed', 'false');
    const bar = h('div', { class: 'erp-pd__bar', role: 'toolbar', 'aria-label': 'Vẽ layout form' },
      this.btnSave, this.btnPreview,
      b('undo', 'Hoàn tác', () => this.undo(), { text: false, title: 'Hoàn tác (Ctrl+Z)' }), b('redo', 'Làm lại', () => this.redo(), { text: false, title: 'Làm lại (Ctrl+Y)' }),
      sep(),
      b('group', 'Thêm nhóm', () => this.addControl(23), { title: 'Thêm khung nhóm (GroupBox)' }),
      b('edit', 'Thêm nhãn', () => this.addControl(28), { title: 'Thêm nhãn chữ (LabelCaption)' }),
      b('delete', 'Bỏ khỏi bố cục', () => this.remove(), { title: 'Bỏ ô đang chọn (Delete)' }),
      sep(),
      b('prev', 'Lên trước', () => this.nudge(-1), { text: false, title: 'Đổi chỗ với ô trước (Alt+←)' }),
      b('next', 'Xuống sau', () => this.nudge(1), { text: false, title: 'Đổi chỗ với ô sau (Alt+→)' }),
      b('reload', 'Phiên bản', () => this.showVersions(), { title: 'Các lần lưu và khôi phục' }),
      this.status);
    if (this.readOnly) bar.querySelectorAll('button').forEach((x) => { if (x !== this.btnPreview) /** @type {HTMLButtonElement} */ (x).disabled = true; });
    return bar;
  }

  /* ---------------- trạng thái / hoàn tác ---------------- */

  snapshot() { return JSON.stringify({ items: this.items, captions: this.captions, pages: this.pages }); }
  /** Ghi lại trạng thái trước khi đổi. */
  push() { this.undoStack.push(this.snapshot()); if (this.undoStack.length > 100) this.undoStack.shift(); this.redoStack = []; }
  /** Chưa lưu = khác trạng thái lúc mở (hoàn tác về đúng ban đầu thì hết "chưa lưu"). */
  updateDirty() { if (this.base !== undefined) this.setDirty(this.snapshot() !== this.base); }
  /** @param {string} s */
  restore(s) { const o = JSON.parse(s); this.items = o.items; this.captions = o.captions; this.pages = o.pages || {}; this.render(); }
  undo() { const s = this.undoStack.pop(); if (!s) return; this.redoStack.push(this.snapshot()); this.restore(s); }
  redo() { const s = this.redoStack.pop(); if (!s) return; this.undoStack.push(this.snapshot()); this.restore(s); }
  /** @param {boolean} d */
  setDirty(d) { this.dirty = d; this.ctx.setDirty?.(d); }

  /** @param {string|null} uid */
  item(uid) { return this.items.find((i) => i.uid === uid) || null; }
  /** Ô của một vùng (tab + nhóm) theo thứ tự. @param {string} tab @param {string} group */
  zone(tab, group) { return this.items.filter((i) => i.tab === tab && i.group === group); }
  /** Đường dẫn vùng của các nhóm trong tab. @param {string} tab */
  groupsOf(tab) { return this.items.filter((i) => i.tab === tab && typeOf(i) === 23).map((i) => i.group + i.name); }
  /** Các vùng (đường dẫn) nằm trong nhóm `path` (gồm chính nó). @param {string} tab @param {string} path @returns {Set<string>} */
  subtree(tab, path) {
    const out = new Set([path]);
    const walk = (/** @type {string} */ p) => { for (const g of this.items) if (g.tab === tab && g.group === p && typeOf(g) === 23) { out.add(g.group + g.name); walk(g.group + g.name); } };
    walk(path);
    return out;
  }
  /** Đổi tab / nhóm cha của một nhóm: mọi ô bên trong đi theo (đổi tiền tố đường dẫn). @param {Item} g @param {string} tab @param {string} parent */
  moveGroup(g, tab, parent) {
    const oldPath = g.group + g.name, newPath = parent + g.name;
    const zones = this.subtree(g.tab, oldPath);
    for (const c of this.items) if (c !== g && c.tab === g.tab && zones.has(c.group)) { c.tab = tab; c.group = newPath + c.group.slice(oldPath.length); }
  }

  /* ---------------- vẽ ---------------- */

  render() {
    this.renderTabs();
    this.renderCanvas();
    this.renderLeft();
    this.renderRight();
  }

  renderTabs() {
    this.updateDirty();
    const tabs = /** @type {Obj[]} */ (this.data.tabs || []);
    this.tabsBar.replaceChildren(...tabs.map((t) => {
      const n = this.items.filter((i) => i.tab === t.id).length;
      const btn = h('button', { type: 'button', role: 'tab', class: 'erp-subtab', 'aria-selected': String(t.id === this.tab), title: t.hint || '',
        onclick: () => { this.tab = t.id; this.sel = null; this.render(); } },
      this.tabTitle(t), n ? h('span', { class: 'erp-count' }, String(n)) : null);
      // Thả ô lên tab: chuyển ô sang cuối tab đó.
      btn.addEventListener('dragover', (e) => { if (this.dragUid && !this.readOnly) { e.preventDefault(); btn.classList.add('is-drop'); } });
      btn.addEventListener('dragleave', () => btn.classList.remove('is-drop'));
      btn.addEventListener('drop', (e) => { e.preventDefault(); btn.classList.remove('is-drop'); this.dropTo(t.id, '', null, false); });
      return btn;
    }));
  }

  /** @param {Obj} t */
  tabTitle(t) {
    const cap = t.captionKey ? (this.captions[t.captionKey] || '') : (this.pages?.[String(t.page)]?.caption || t.caption || '');
    return cap || t.defaultCaption || `Tab ${t.id}`;
  }

  renderCanvas() {
    this.updateDirty();
    if (this.previewOn) return this.renderPreview();
    const root = this.zoneEl(this.tab, '', COLS);
    this.canvas.replaceChildren(root);
    if (!this.zone(this.tab, '').length) {
      root.append(h('div', { class: 'erp-ld__empty' }, this.readOnly ? 'Tab này chưa có ô.' : 'Tab này chưa có ô. Kéo cột từ danh sách bên trái vào đây.'));
    }
  }

  /** Lưới 40 cột (hoặc số cột của nhóm) chứa các ô của một vùng. @param {string} tab @param {string} group @param {number} cols */
  zoneEl(tab, group, cols) {
    const grid = h('div', { class: 'erp-ld__grid', 'data-zone': `${tab}|${group}` });
    grid.style.setProperty('--ld-cols', String(cols));
    for (const it of this.zone(tab, group)) grid.append(this.itemEl(it, cols));
    grid.addEventListener('dragover', (e) => { if ((this.dragUid || this.dragField) && !this.readOnly && e.target === grid) { e.preventDefault(); grid.classList.add('is-drop'); } });
    grid.addEventListener('dragleave', (e) => { if (e.target === grid) grid.classList.remove('is-drop'); });
    grid.addEventListener('drop', (e) => {
      if (e.target !== grid) return;
      e.preventDefault(); grid.classList.remove('is-drop');
      this.dropTo(tab, group, null, false);
    });
    return grid;
  }

  /** @param {Item} it @param {number} cols */
  itemEl(it, cols) {
    const t = typeOf(it);
    const span = Math.min(spanOf(it), cols);
    const field = (/** @type {Obj[]} */ (this.data.fields || [])).find((f) => f.name.toLowerCase() === it.name.toLowerCase());
    const hidden = it.cfg[18] === '1';
    const cls = ['erp-ld__item', `is-ct${t}`, it.uid === this.sel ? 'is-selected' : '', hidden ? 'is-hidden' : '', it.cfg[3] === '1' ? 'is-row-start' : '',
      !field && t <= 20 ? 'is-missing' : ''].filter(Boolean).join(' ');
    const cap = decText(it.cfg[7]) || (t === 22 ? it.props?.BT || it.props?.LT : '') || it.text || (field?.caption) || it.name;
    const el = h('div', { class: cls, draggable: this.readOnly ? false : 'true', tabindex: '-1', 'data-uid': it.uid,
      title: `${cap}${cap !== it.name ? ` (${it.name})` : ''}${field ? '' : t <= 20 ? ' — không có cột này trong bảng' : ''}${hidden ? ' — đang ẩn' : ''}` });
    el.style.setProperty('--ld-span', String(span));
    el.style.setProperty('--ld-rows', String(t === 23 ? 1 : rowsOf(it)));
    if (t === 23) {
      el.append(h('div', { class: 'erp-ld__ghead' }, icon('group'), h('span', {}, cap)), this.zoneEl(it.tab, it.group + it.name, span));
    } else if (t === 22 || t === 24 || t === 26) {
      el.append(h('span', { class: 'erp-ld__btn' }, cap));
    } else {
      el.append(h('span', { class: 'erp-ld__cap' }, cap, it.cfg[17] === '1' ? h('b', { class: 'erp-ld__req', 'aria-hidden': 'true' }, ' *') : null),
        h('span', { class: 'erp-ld__ctl' }, h('small', {}, it.name), h('small', { class: 'erp-ld__type' }, CT.find(([v]) => v === t)?.[1] || String(t))));
    }
    if (!this.readOnly) el.append(h('span', { class: 'erp-ld__grip', title: 'Kéo để đổi độ rộng', 'aria-hidden': 'true' }));
    el.addEventListener('click', (e) => { e.stopPropagation(); this.select(it.uid); });
    el.addEventListener('dragstart', (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest('.erp-ld__item') !== el) return;
      e.stopPropagation();
      this.dragUid = it.uid;
      e.dataTransfer?.setData('text/plain', it.name);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      el.classList.add('is-dragging');
    });
    el.addEventListener('dragend', () => { this.dragUid = null; el.classList.remove('is-dragging'); this.clearDrop(); });
    el.addEventListener('dragover', (e) => {
      if ((!this.dragUid && !this.dragField) || this.readOnly) return;
      if (/** @type {HTMLElement} */ (e.target).closest('.erp-ld__item') !== el) return;
      if (this.dragUid === it.uid) return;
      e.preventDefault(); e.stopPropagation();
      const r = el.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      this.clearDrop();
      el.classList.add(after ? 'is-drop-after' : 'is-drop-before');
    });
    el.addEventListener('drop', (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest('.erp-ld__item') !== el || this.readOnly) return;
      e.preventDefault(); e.stopPropagation();
      const after = el.classList.contains('is-drop-after');
      this.clearDrop();
      this.dropTo(it.tab, it.group, it.uid, after);
    });
    const grip = el.querySelector('.erp-ld__grip');
    grip?.addEventListener('pointerdown', (e) => this.resizeStart(/** @type {PointerEvent} */ (e), it, el, cols));
    return el;
  }

  clearDrop() { this.section.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop').forEach((x) => x.classList.remove('is-drop-before', 'is-drop-after', 'is-drop')); }

  /**
   * Thả ô đang kéo (hoặc cột từ danh sách) vào vùng tab|nhóm, trước / sau ô `ref` (null = cuối vùng).
   * @param {string} tab @param {string} group @param {string|null} ref @param {boolean} after
   */
  dropTo(tab, group, ref, after) {
    const moving = this.item(this.dragUid || null);
    const fieldName = this.dragField;
    this.dragUid = null; this.dragField = null;
    if (!moving && !fieldName) return;
    if (moving && typeOf(moving) === 23 && moving.tab === tab && this.subtree(tab, moving.group + moving.name).has(group)) {
      toast('Không đặt nhóm vào trong chính nó.', 'warning'); return;
    }
    if (moving && moving.uid === ref) return;
    this.push();
    let it = moving;
    if (moving) this.items.splice(this.items.indexOf(moving), 1);
    else {
      if (this.items.some((i) => i.name.toLowerCase() === String(fieldName).toLowerCase())) { toast(`Cột ${fieldName} đã có trong bố cục.`, 'warning'); this.undoStack.pop(); return; }
      it = this.newItem(String(fieldName), tab, group);
    }
    const item = /** @type {Item} */ (it);
    // Đổi chỗ một nhóm: các ô trong nhóm (kể cả nhóm lồng) đi theo.
    if (moving && typeOf(item) === 23 && (item.tab !== tab || item.group !== group)) this.moveGroup(item, tab, group);
    item.tab = tab; item.group = group;
    let at = this.items.length;
    if (ref) { const r = this.items.findIndex((i) => i.uid === ref); if (r >= 0) at = r + (after ? 1 : 0); }
    else {
      const last = this.items.map((i, k) => (i.tab === tab && i.group === group ? k : -1)).filter((k) => k >= 0).pop();
      if (last !== undefined) at = last + 1;
    }
    this.items.splice(at, 0, item);
    this.tab = tab;
    this.sel = item.uid;
    this.render();
  }

  /** Ô mới từ một cột của bảng, như bấm đúp ở LayoutSettingFrm: có/không 6, ngày 4, số 5, còn lại 1; rộng 4. @param {string} name @param {string} tab @param {string} group */
  newItem(name, tab, group) {
    const f = (/** @type {Obj[]} */ (this.data.fields || [])).find((x) => x.name === name);
    const ct = f?.type === 'bool' ? 6 : f?.type === 'date' || f?.type === 'datetime' ? 4 : ['number', 'money', 'quantity', 'percent'].includes(f?.type) ? 5 : 1;
    return this.mk(tab, group, name, parseCfg(`${ct};4;1`));
  }

  /** @param {number} ct */
  addControl(ct) {
    if (this.readOnly) return;
    // Tên và cấu hình mặc định như LayoutSettingFrm: "GrpBox{n}" = 23;6;3, "UserControl{n}" (nhãn) = 28;6;1.
    const base = ct === 23 ? 'GrpBox' : 'UserControl';
    let n = 1;
    while (this.items.some((i) => i.name.toLowerCase() === `${base}${n}`.toLowerCase())) n++;
    const cur = this.item(this.sel);
    const group = cur ? (typeOf(cur) === 23 ? cur.group + cur.name : cur.group) : '';
    this.push();
    const it = this.mk(this.tab, cur ? cur.tab === this.tab ? group : '' : '', `${base}${n}`, parseCfg(ct === 23 ? '23;6;3;;;;;Nhóm mới' : '28;6;1;;;;;Nhãn mới'));
    this.items.push(it);
    this.sel = it.uid;
    this.render();
  }

  remove() {
    const it = this.item(this.sel);
    if (!it || this.readOnly) return;
    this.push();
    // Bỏ nhóm: các ô trong nhóm (và nhóm lồng) lên một cấp, không mất ô nào (WinForms để lại ô mồ côi).
    if (typeOf(it) === 23) {
      const path = it.group + it.name;
      const zones = this.subtree(it.tab, path);
      for (const c of this.items) if (c.tab === it.tab && zones.has(c.group)) c.group = it.group + c.group.slice(path.length);
    }
    this.items.splice(this.items.indexOf(it), 1);
    this.sel = null;
    this.render();
  }

  /** Đổi chỗ với ô kề trong cùng vùng. @param {number} dir */
  nudge(dir) {
    const it = this.item(this.sel);
    if (!it || this.readOnly) return;
    const z = this.zone(it.tab, it.group);
    const k = z.indexOf(it);
    const other = z[k + dir];
    if (!other) return;
    this.push();
    const a = this.items.indexOf(it), b = this.items.indexOf(other);
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    this.render();
    this.focusSel();
  }

  /** Kéo cạnh phải: độ rộng theo cột của lưới. @param {PointerEvent} e @param {Item} it @param {HTMLElement} el @param {number} cols */
  resizeStart(e, it, el, cols) {
    e.preventDefault(); e.stopPropagation();
    const grid = /** @type {HTMLElement} */ (el.parentElement);
    const colW = grid.getBoundingClientRect().width / cols;
    const startW = el.getBoundingClientRect().width;
    const before = this.snapshot();
    const orig = it.cfg[1];
    const move = (/** @type {PointerEvent} */ ev) => {
      const span = Math.max(1, Math.min(cols, Math.round((startW + ev.clientX - e.clientX) / colW)));
      it.cfg[1] = span >= COLS ? '99' : String(span);
      el.style.setProperty('--ld-span', String(span));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (it.cfg[1] !== orig) { this.undoStack.push(before); this.redoStack = []; this.setDirty(true); }
      this.sel = it.uid;
      this.render();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** @param {string} uid */
  select(uid) {
    this.sel = uid;
    this.canvas.querySelectorAll('.erp-ld__item.is-selected').forEach((x) => x.classList.remove('is-selected'));
    this.canvas.querySelector(`[data-uid="${uid}"]`)?.classList.add('is-selected');
    this.renderRight();
    this.focusSel();
  }

  focusSel() { /** @type {HTMLElement|null} */ (this.canvas.querySelector(`[data-uid="${this.sel}"]`))?.focus({ preventScroll: true }); }

  /** @param {KeyboardEvent} e */
  onKey(e) {
    if (this.readOnly || isTyping()) return;
    if (e.key === 'Delete') { e.preventDefault(); this.remove(); }
    else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); this.nudge(e.key === 'ArrowLeft' ? -1 : 1); }
  }

  /* ---------------- bên trái: cột của bảng ---------------- */

  renderLeft() {
    const used = new Set(this.items.map((i) => i.name.toLowerCase()));
    const fields = (/** @type {Obj[]} */ (this.data.fields || [])).filter((f) => !used.has(String(f.name).toLowerCase()));
    const q = fold(this.filter);
    const shown = fields.filter((f) => !q || fold(`${f.name} ${f.caption || ''}`).includes(q));
    const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'erp-input erp-ld__search', placeholder: 'Tìm cột…', value: this.filter, 'aria-label': 'Tìm cột' }));
    search.addEventListener('input', () => { this.filter = search.value; this.renderLeft(); const s = /** @type {HTMLInputElement|null} */ (this.left.querySelector('input')); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); });
    const list = h('ul', { class: 'erp-pd__fields' }, ...shown.map((f) => {
      const li = h('li', { draggable: this.readOnly ? false : 'true', title: `${f.name} (${f.type})${this.readOnly ? '' : ' — kéo vào bố cục hoặc bấm đúp để thêm vào cuối tab'}` },
        f.caption || f.name, h('small', {}, f.caption ? f.name : f.type));
      li.addEventListener('dragstart', (e) => { this.dragField = f.name; e.dataTransfer?.setData('text/plain', f.name); });
      li.addEventListener('dragend', () => { this.dragField = null; this.clearDrop(); });
      li.addEventListener('dblclick', () => { if (!this.readOnly) { this.dragField = f.name; this.dropTo(this.tab, '', null, false); } });
      return li;
    }));
    this.left.replaceChildren(h('h3', {}, `Cột chưa dùng (${fields.length})`), h('div', { class: 'erp-ld__searchbox' }, search),
      shown.length ? list : h('p', { class: 'erp-ld__note' }, fields.length ? 'Không có cột phù hợp.' : 'Mọi cột của bảng đã có trong bố cục.'));
  }

  /* ---------------- bên phải: thuộc tính ---------------- */

  renderRight() {
    const it = this.item(this.sel);
    const t = (/** @type {Obj[]} */ (this.data.tabs || [])).find((x) => x.id === this.tab);
    const ro = this.readOnly;
    /** @param {string} label @param {HTMLElement} ctl */
    const row = (label, ctl) => h('label', {}, label, ctl);
    /** @param {Item} x @param {number} pos @param {Obj} [o] */
    const text = (x, pos, o = {}) => {
      const v = o.enc ? decText(x.cfg[pos]) : x.cfg[pos];
      const inp = /** @type {HTMLInputElement} */ (h(o.area ? 'textarea' : 'input', { type: o.type || 'text', value: v, readonly: ro || o.readonly || false, min: o.min, max: o.max, placeholder: o.placeholder || '' }));
      if (o.area) inp.value = v;
      inp.addEventListener('change', () => { this.push(); x.cfg[pos] = o.enc ? encText(inp.value) : inp.value.trim(); this.renderCanvas(); this.renderTabs(); });
      return inp;
    };
    /** @param {Item} x @param {number} pos @param {Array<[number,string]>} opts @param {string} [dflt] */
    const pick = (x, pos, opts, dflt = '0') => {
      const sel = /** @type {HTMLSelectElement} */ (h('select', { disabled: ro }, ...opts.map(([v, l]) => h('option', { value: String(v) }, l))));
      sel.value = String(num(x.cfg[pos], Number(dflt)));
      if (!opts.some(([v]) => String(v) === sel.value)) sel.append(h('option', { value: x.cfg[pos], selected: true }, x.cfg[pos] || '—'));
      sel.addEventListener('change', () => { this.push(); x.cfg[pos] = sel.value === dflt && pos !== 0 ? '' : sel.value; this.render(); });
      return sel;
    };
    /** @param {Item} x @param {number} pos @param {string} label */
    const flag = (x, pos, label) => {
      const cb = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: x.cfg[pos] === '1', disabled: ro }));
      cb.addEventListener('change', () => { this.push(); x.cfg[pos] = cb.checked ? '1' : ''; this.renderCanvas(); });
      return h('label', { class: 'erp-pd__check' }, cb, label);
    };
    if (!it) {
      const parts = [h('h3', {}, 'Tab')];
      if (t) {
        const box = h('div', { class: 'erp-pd__props' });
        if (t.captionKey) {
          const inp = /** @type {HTMLInputElement} */ (h('input', { type: 'text', value: this.captions[t.captionKey] || '', readonly: ro, placeholder: t.defaultCaption || '' }));
          inp.addEventListener('change', () => { this.push(); this.captions[t.captionKey] = inp.value.trim(); this.renderTabs(); });
          box.append(row(`Tiêu đề tab (${t.captionKey})`, inp));
        } else {
          box.append(h('p', { class: 'erp-ld__note' }, t.hint || ''));
          const pg = this.pages[String(t.page)];
          if (pg && 'caption' in pg) {
            const inp = /** @type {HTMLInputElement} */ (h('input', { type: 'text', value: pg.caption || '', readonly: ro, placeholder: t.defaultCaption || '' }));
            inp.addEventListener('change', () => { this.push(); pg.caption = inp.value.trim(); this.renderTabs(); });
            box.append(row(`Tiêu đề trang (T${t.page} / DCP)`, inp));
          } else if (!t.grid) box.append(h('p', { class: 'erp-ld__note' }, `Form không có lưới T${t.page}: ô đặt ở đây hiện thành trang chỉ có ô.`));
          if (pg && 'visible' in pg) {
            const sel = /** @type {HTMLSelectElement} */ (h('select', { disabled: ro }, ...[['0', 'Mọi người'], ['1', 'Quản lý'], ['4', 'Admin']].map(([v, l]) => h('option', { value: v }, l))));
            sel.value = pg.visible || '0';
            sel.addEventListener('change', () => { this.push(); pg.visible = sel.value; this.updateDirty(); });
            box.append(row(`Ai thấy trang này (TPV${t.page})`, sel));
          }
        }
        box.append(h('p', { class: 'erp-ld__note' }, 'Chọn một ô trên lưới để sửa thuộc tính. Kéo ô để đổi chỗ (thả lên tên tab để chuyển tab), kéo cạnh phải để đổi độ rộng.'));
        if (!ro) box.append(this.tabTools(t));
        for (const n of [this.data.note, ...(this.data.notes || [])].filter(Boolean)) box.append(h('p', { class: 'erp-ld__note' }, icon('info'), ' ', String(n)));
        parts.push(box);
      }
      this.right.replaceChildren(...parts);
      return;
    }
    const ct = typeOf(it);
    const f = (/** @type {Obj[]} */ (this.data.fields || [])).find((x) => x.name.toLowerCase() === it.name.toLowerCase());
    const own = ct === 23 ? this.subtree(it.tab, it.group + it.name) : new Set();
    const groups = this.groupsOf(it.tab).filter((g) => !own.has(g));
    const grp = /** @type {HTMLSelectElement} */ (h('select', { disabled: ro || ct === 23, title: ct === 23 ? 'Kéo nhóm để đổi chỗ' : '' },
      h('option', { value: '' }, '(Không thuộc nhóm)'), ...groups.map((g) => h('option', { value: g }, g))));
    grp.value = it.group;
    grp.addEventListener('change', () => { this.push(); it.group = grp.value; this.items.splice(this.items.indexOf(it), 1); this.items.push(it); this.render(); });
    const nameInp = /** @type {HTMLInputElement} */ (h('input', { type: 'text', value: it.name, readonly: ro, list: `ld-cols-${this.seq}`, spellcheck: 'false',
      title: 'Tên ô (SubID): tên cột của bảng, hoặc tên control' }));
    const cols = h('datalist', { id: `ld-cols-${this.seq}` }, ...(/** @type {Obj[]} */ (this.data.fields || [])).map((x) => h('option', { value: x.name }, x.caption || '')));
    nameInp.addEventListener('change', () => this.rename(it, nameInp.value.trim()) || (nameInp.value = it.name));
    const box = h('div', { class: 'erp-pd__props' },
      h('div', { class: 'erp-ld__name' }, row(it.from ? `Tên (đổi từ ${it.from})` : 'Tên', nameInp), cols,
        h('small', {}, f ? `${f.type}${f.caption ? ` · ${f.caption}` : ''}` : ct <= 20 ? 'Không có cột này trong bảng' : 'Control')),
      row('Tiêu đề (để trống = theo tên cột)', text(it, 7, { enc: true, placeholder: f?.caption || '' })),
      h('div', { class: 'erp-pd__row2' }, row('Loại control', pick(it, 0, CT, '1')), row('Nhóm', grp)),
      h('div', { class: 'erp-pd__row' },
        row('Rộng (1–40, 99)', text(it, 1, { type: 'number', min: 0, max: 99 })), row('Cao', text(it, 2, { type: 'number', min: 1, max: 99 })),
        row('Chừa sau', text(it, 19, { type: 'number', min: 0, max: 6 })), row('Rộng nhãn', text(it, 5, { type: 'number', min: 0, max: 400, placeholder: '85' }))),
      h('fieldset', {}, h('legend', {}, 'Hiển thị'),
        flag(it, 3, 'Xuống dòng (đầu dòng mới)'), flag(it, 4, 'Chỉ đọc'), flag(it, 17, 'Bắt buộc nhập'), flag(it, 18, 'Ẩn (giữ trong cấu hình)')),
      h('div', { class: 'erp-pd__row2' }, row('Quyền xem', pick(it, 9, PERM)), row('Quyền sửa', pick(it, 8, PERM))),
      h('div', { class: 'erp-pd__row2' }, row('Cho sửa khi', pick(it, 14, ENABLE)), row('Kiểm dữ liệu', pick(it, 12, CHECK))),
      row('Giá trị mặc định', text(it, 10, { enc: true })),
      row('Mặc định bằng SQL (chỉ xem trên web)', text(it, 15, { area: true, readonly: true })),
      row('Rộng trên điện thoại (0 = tự động, 1–12 cột)', text(it, 20, { type: 'number', min: 0, max: 12 })));
    this.right.replaceChildren(h('h3', {}, 'Thuộc tính ô'), box, h('h3', {}, 'Thuộc tính riêng (LYS)'), this.propsBox(it));
  }

  /**
   * Đổi tên ô (SubID): cột khác của bảng, hoặc tên control. Nhóm: đường dẫn của các ô con đổi theo. Ô đọc từ cấu hình mang `from` để BE
   * giữ dòng và thuộc tính LYS (BE chặn đổi tên user control sang lớp khác).
   * @param {Item} it @param {string} name @returns {boolean}
   */
  rename(it, name) {
    if (name === it.name) return true;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,49}$/.test(name)) { toast('Tên chỉ gồm chữ không dấu, số và "_", bắt đầu bằng chữ, tối đa 50 ký tự.', 'warning'); return false; }
    if (this.items.some((i) => i !== it && i.name.toLowerCase() === name.toLowerCase())) { toast(`Đã có ô ${name} trong bố cục.`, 'warning'); return false; }
    this.push();
    if (typeOf(it) === 23) {
      const oldPath = it.group + it.name, newPath = it.group + name;
      const zones = this.subtree(it.tab, oldPath);
      for (const c of this.items) if (c !== it && c.tab === it.tab && zones.has(c.group)) c.group = newPath + c.group.slice(oldPath.length);
    }
    if (it.loaded && !it.from) it.from = it.name;
    it.name = name;
    if (it.from && it.from.toLowerCase() === name.toLowerCase()) delete it.from;
    this.render();
    return true;
  }

  /** Thuộc tính riêng LYS của ô: mã sửa được theo loại control (BE quyết), mã có SQL / lệnh chỉ xem. @param {Item} it */
  propsBox(it) {
    const ct = typeOf(it);
    const ro = this.readOnly;
    const box = h('div', { class: 'erp-pd__props' });
    const codes = Object.keys(PROPS).filter((c) => this.canEditProp(ct, c));
    /** @param {string} code @param {string} v */
    const set = (code, v) => { this.push(); if (v === '') delete it.props[code]; else it.props[code] = v; this.renderCanvas(); };
    for (const code of codes) {
      const [label, kind] = PROPS[code];
      const cur = it.props[code] ?? '';
      const cap = `${label} (${code})`;
      if (kind === 'bool') {
        const cb = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: cur === '1', disabled: ro }));
        cb.addEventListener('change', () => set(code, cb.checked ? '1' : ''));
        box.append(h('label', { class: 'erp-pd__check' }, cb, cap));
      } else if (kind === 'color') {
        const inp = /** @type {HTMLInputElement} */ (h('input', { type: 'color', value: cur ? argbToHex(cur) : '#000000', disabled: ro, 'aria-label': cap }));
        const state = h('small', {}, cur ? '' : '(mặc định)');
        inp.addEventListener('change', () => set(code, hexToArgb(inp.value)));
        const clear = h('button', { type: 'button', class: 'erp-btn erp-btn--sm', disabled: ro || !cur, onclick: () => set(code, '') }, 'Mặc định');
        box.append(h('div', { class: 'erp-ld__prop' }, h('span', {}, cap), h('span', { class: 'erp-ld__color' }, inp, state, clear)));
      } else if (kind === 'font' || kind === 'align') {
        const opts = kind === 'font' ? FONT_STYLES : ALIGNS;
        const sel = /** @type {HTMLSelectElement} */ (h('select', { disabled: ro }, ...opts.map(([v, l]) => h('option', { value: v }, l))));
        sel.value = cur;
        if (sel.value !== cur) sel.append(h('option', { value: cur, selected: true }, cur));
        sel.addEventListener('change', () => set(code, sel.value));
        box.append(h('label', {}, cap, sel));
      } else {
        const inp = /** @type {HTMLInputElement} */ (h('input', { type: kind === 'int' ? 'number' : 'text', value: cur, readonly: ro, step: kind === 'int' ? '1' : false }));
        inp.addEventListener('change', () => set(code, inp.value.trim()));
        box.append(h('label', {}, cap, inp));
      }
    }
    const fixed = Object.entries(it.props).filter(([c]) => !this.canEditProp(ct, c));
    if (fixed.length) {
      box.append(h('p', { class: 'erp-ld__note' }, icon('lock'), ' Chỉ sửa trên ERP (có SQL / lệnh, hoặc không dùng cho loại control này):'),
        h('dl', { class: 'erp-ld__fixed' }, ...fixed.flatMap(([c, v]) => [h('dt', {}, c), h('dd', { title: v }, v)])));
    }
    if (!codes.length && !fixed.length) box.append(h('p', { class: 'erp-ld__note' }, 'Loại control này không có thuộc tính riêng sửa trên web.'));
    return box;
  }

  /** Công cụ của tab: chuyển hết ô sang tab khác, chép bố cục từ form khác. @param {Obj} t */
  tabTools(t) {
    const others = (/** @type {Obj[]} */ (this.data.tabs || [])).filter((x) => x.id !== t.id);
    const to = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Tab đích' }, ...others.map((x) => h('option', { value: x.id }, this.tabTitle(x)))));
    const fs = h('fieldset', {}, h('legend', {}, 'Công cụ tab'),
      h('label', {}, 'Chuyển hết ô của tab này sang', to),
      h('button', { type: 'button', class: 'erp-btn erp-btn--sm', onclick: () => this.moveTab(t.id, to.value) }, 'Chuyển tab'));
    if (this.section.getAttribute('data-source-src')) {
      fs.append(h('button', { type: 'button', class: 'erp-btn erp-btn--sm', onclick: () => this.copyPanel(t).catch((e) => toast(`Không nạp được: ${e.message || e}`, 'error')) },
        icon('copy'), ' Chép bố cục từ form khác…'));
    }
    return fs;
  }

  /** Như "Chuyển Tab" của WinForms: mọi ô (kể cả nhóm) sang cuối tab đích; tiêu đề tab master đi theo nếu tab đích chưa có. @param {string} from @param {string} to */
  moveTab(from, to) {
    const moving = this.items.filter((i) => i.tab === from);
    if (!moving.length) { toast('Tab này chưa có ô.', 'info'); return; }
    this.push();
    for (const i of moving) i.tab = to;
    this.items = [...this.items.filter((i) => !moving.includes(i)), ...moving];
    const tabs = /** @type {Obj[]} */ (this.data.tabs || []);
    const ft = tabs.find((x) => x.id === from), tt = tabs.find((x) => x.id === to);
    if (ft?.captionKey && tt?.captionKey && !this.captions[tt.captionKey] && this.captions[ft.captionKey]) this.captions[tt.captionKey] = this.captions[ft.captionKey];
    this.tab = to; this.sel = null;
    this.render();
    toast(`Đã chuyển ${moving.length} ô sang tab "${this.tabTitle(tt || {})}".`, 'success');
  }

  /**
   * Chép bố cục một tab của form khác vào tab đang chọn (như "Copy Layout" của WinForms, nhưng chép cả nhóm và ô con).
   * Nguồn lấy qua `data-source-src` (BE ghép URL, FE chỉ thay `{fid}`). Thuộc tính có SQL / lệnh không được chép.
   * @param {Obj} t
   */
  async copyPanel(t) {
    const tmpl = this.section.getAttribute('data-source-src') || '';
    const url = (/** @type {string} */ fid) => tmpl.replace('{fid}', encodeURIComponent(fid));
    if (!isAllowedUrl(url(''))) throw new Error('URL nguồn không hợp lệ');
    const get = async (/** @type {string} */ u) => { const r = await fetch(u, { credentials: 'include', headers: { Accept: 'application/json', 'X-ERP-Request': 'layout' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
    this.sourceList ||= await get(url(''));
    const forms = /** @type {Obj[]} */ (this.sourceList.forms || []);
    const fid = /** @type {HTMLInputElement} */ (h('input', { type: 'text', list: 'ld-src-forms', placeholder: 'Mã form, vd AR_InvoiceFrm', spellcheck: 'false' }));
    const dl = h('datalist', { id: 'ld-src-forms' }, ...forms.map((f) => h('option', { value: f.fid }, `${f.caption || ''} (${f.items} ô)`)));
    const srcTab = /** @type {HTMLSelectElement} */ (h('select', { disabled: true }, h('option', { value: '' }, '— chọn form trước —')));
    const info = h('p', { class: 'erp-ld__note' }, `Thay toàn bộ ô của tab "${this.tabTitle(t)}" bằng ô của một tab ở form khác. Lưu bố cục mới ghi vào ERP.`);
    /** @type {Obj|null} */ let src = null;
    const go = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'erp-btn erp-btn--primary erp-btn--sm', disabled: true, onclick: () => src && this.applyCopy(src, srcTab.value, t) }, 'Chép vào tab này'));
    const loadSrc = async () => {
      const v = fid.value.trim();
      if (!/^[A-Za-z0-9_]{1,250}$/.test(v)) { toast('Mã form không hợp lệ.', 'warning'); return; }
      src = await get(url(v));
      const tabs = /** @type {Obj[]} */ (this.data.tabs || []);
      const counts = tabs.map((x) => [x, (/** @type {Obj[]} */ (src?.items || [])).filter((i) => i.tab === x.id).length]).filter(([, n]) => n);
      srcTab.replaceChildren(...counts.map(([x, n]) => h('option', { value: /** @type {Obj} */ (x).id }, `${/** @type {Obj} */ (x).captionKey && src?.captions?.[/** @type {Obj} */ (x).captionKey] || this.tabTitle(/** @type {Obj} */ (x))} (${n} ô)`)));
      srcTab.disabled = !counts.length; go.disabled = !counts.length;
      if (!counts.length) toast(`Form ${v} không có bố cục.`, 'info');
    };
    this.right.replaceChildren(h('h3', {}, 'Chép bố cục từ form khác'), h('div', { class: 'erp-pd__props' }, info,
      h('label', {}, 'Form nguồn', fid), dl,
      h('button', { type: 'button', class: 'erp-btn erp-btn--sm', onclick: () => loadSrc().catch((e) => toast(`Không nạp được: ${e.message || e}`, 'error')) }, 'Xem bố cục'),
      h('label', {}, 'Tab nguồn', srcTab), go,
      h('button', { type: 'button', class: 'erp-btn erp-btn--sm', onclick: () => this.renderRight() }, 'Đóng')));
    fid.focus();
  }

  /** @param {Obj} src @param {string} srcTab @param {Obj} t */
  async applyCopy(src, srcTab, t) {
    const list = (/** @type {Obj[]} */ (src.items || [])).filter((i) => i.tab === srcTab);
    if (!list.length) return;
    if (this.zone(t.id, '').length && !(await confirmBox(`Thay ${this.items.filter((i) => i.tab === t.id).length} ô đang có của tab "${this.tabTitle(t)}" bằng ${list.length} ô của ${src.form}?`, { ok: 'Thay' }))) return;
    this.push();
    this.items = this.items.filter((i) => i.tab !== t.id);
    const taken = new Set(this.items.map((i) => i.name.toLowerCase()));
    /** @type {string[]} */ const skipped = [];
    let stripped = 0;
    for (const x of list) {
      if (taken.has(String(x.name).toLowerCase())) { skipped.push(x.name); continue; }
      const it = this.mk(t.id, String(x.group || ''), String(x.name), parseCfg(x.cfg));
      for (const [c, v] of Object.entries(x.props || {})) { if (this.canEditProp(typeOf(it), c)) it.props[c] = String(v); else stripped++; }
      if (x.text) it.text = String(x.text);
      taken.add(it.name.toLowerCase());
      this.items.push(it);
    }
    // Ô con của nhóm không chép được (trùng tên) ra ngoài nhóm.
    const paths = new Set(this.items.filter((i) => i.tab === t.id && typeOf(i) === 23).map((i) => i.group + i.name));
    for (const i of this.items) if (i.tab === t.id && i.group && !paths.has(i.group)) i.group = '';
    this.tab = t.id; this.sel = null;
    this.render();
    toast(`Đã chép ${list.length - skipped.length} ô từ ${src.form}.${skipped.length ? ` Bỏ ${skipped.length} ô trùng tên ở tab khác: ${skipped.slice(0, 5).join(', ')}.` : ''}${stripped ? ` Không chép ${stripped} thuộc tính có SQL / lệnh.` : ''} Bấm Lưu để ghi.`,
      skipped.length || stripped ? 'warning' : 'success', 9000);
  }

  /* ---------------- xem trước bằng FE thật ---------------- */

  togglePreview() {
    this.previewOn = !this.previewOn;
    this.btnPreview.setAttribute('aria-pressed', String(this.previewOn));
    this.renderCanvas();
  }

  renderPreview() {
    const fields = /** @type {Obj[]} */ (this.data.fields || []);
    const fs = h('fieldset', { 'data-erp': 'tab' });
    /** @param {Item[]} list */
    const add = (list) => {
      for (const it of list) {
        const ct = typeOf(it);
        if (it.cfg[18] === '1') continue;
        if (ct === 23) { add(this.zone(it.tab, it.group + it.name)); continue; }
        const f = fields.find((x) => x.name.toLowerCase() === it.name.toLowerCase());
        const cap = decText(it.cfg[7]) || (ct === 22 ? it.props?.BT || it.props?.LT : '') || it.text || f?.caption || it.name;
        const span = String(spanOf(it));
        const box = h('div', { 'data-erp': 'field', 'data-span': span, 'data-row-start': it.cfg[3] === '1' ? '' : false });
        const id = `ldp-${it.uid}`;
        if (ct === 22 || ct === 24 || ct === 26) { box.dataset.control = 'button'; box.append(h('span', {}), h('button', { type: 'button', disabled: '' }, cap)); }
        else if (ct === 28) { box.dataset.control = 'label'; box.append(h('label', { for: id }, cap), h('output', { id }, '')); }
        else if (ct === 6) { box.dataset.control = 'checkbox'; box.append(h('label', { for: id }, cap), h('input', { id, type: 'checkbox', disabled: '' })); }
        else if (ct === 4) { box.dataset.control = 'date'; box.append(h('label', { for: id }, cap), h('input', { id, type: 'date', readonly: '' })); }
        else if (ct === 5) { box.dataset.control = 'number'; box.append(h('label', { for: id }, cap), h('input', { id, inputmode: 'decimal', readonly: '', value: '' })); }
        else if (rowsOf(it) > 1) { box.dataset.control = 'textarea'; box.dataset.rows = String(rowsOf(it)); box.append(h('label', { for: id }, cap), h('textarea', { id, readonly: '', rows: String(rowsOf(it)) })); }
        else { box.dataset.control = 'text'; box.append(h('label', { for: id }, cap), h('input', { id, readonly: '', value: '' })); }
        if (it.cfg[19] && Number(it.cfg[19]) > 0) box.dataset.gapAfter = it.cfg[19];
        if (it.cfg[17] === '1') box.querySelector('input, textarea')?.setAttribute('required', '');
        fs.append(box);
      }
    };
    add(this.zone(this.tab, ''));
    const form = h('form', { class: 'erp-record erp-ld__preview', 'data-erp': 'record', onsubmit: (/** @type {Event} */ e) => e.preventDefault() }, fs);
    fs.classList.add('erp-fieldset');
    this.canvas.replaceChildren(form);
    enhanceFields(form, null);
  }

  /* ---------------- lưu / phiên bản ---------------- */

  /** @returns {Obj} */
  toJson() {
    return {
      $schema: LAYOUT_SCHEMA, form: this.data.form, revision: this.data.revision,
      captions: this.captions, pages: this.pages,
      items: this.items.map((i) => ({ tab: i.tab, group: i.group, name: i.name, ...(i.from ? { from: i.from } : {}), cfg: joinCfg(i.cfg), props: i.props || {} })),
    };
  }

  validate() {
    /** @type {string[]} */ const out = [];
    const seen = new Set();
    for (const i of this.items) {
      const k = i.name.toLowerCase();
      if (seen.has(k)) out.push(`Ô ${i.name} có hai lần trong bố cục.`);
      seen.add(k);
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,49}$/.test(i.name)) out.push(`Tên ô "${i.name}" không hợp lệ.`);
      if (i.group && !this.items.some((g) => g.tab === i.tab && g.group + g.name === i.group && typeOf(g) === 23)) out.push(`Ô ${i.name} thuộc nhóm ${i.group} không có trong tab.`);
      const x = num(i.cfg[1], 3);
      if (!(x === 99 || (x >= 0 && x <= COLS))) out.push(`Ô ${i.name}: độ rộng ${i.cfg[1]} không hợp lệ (0–40 hoặc 99).`);
    }
    return out.slice(0, 20);
  }

  async save() {
    if (this.readOnly || !this.form) return;
    const errors = this.validate();
    if (errors.length) { await messageBox(errors.map((text) => ({ type: 'error', text })), 'Bố cục còn lỗi'); return; }
    const comment = window.prompt('Ghi chú cho lần lưu này (tùy chọn):', '') ?? null;
    if (comment === null) return;
    const fd = new FormData(this.form);
    fd.set('Json', JSON.stringify(this.toJson()));
    fd.set('Comment', comment);
    await this.post(fd, 'Đã lưu bố cục.');
  }

  /** @param {FormData} fd @param {string} okText */
  async post(fd, okText) {
    if (!this.form) return;
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
      this.undoStack = []; this.redoStack = [];
      toast(msgs.find((m) => m.type === 'success')?.text || okText, 'success');
      await this.load();
      this.status.textContent = `Đã lưu ${new Date().toLocaleTimeString('vi-VN')}`;
    } catch (e) {
      this.status.textContent = 'Chưa lưu';
      toast(`Không lưu được: ${/** @type {Error} */ (e).message}`, 'error');
    }
  }

  async showVersions() {
    const vs = /** @type {Obj[]} */ (this.data.versions || []);
    if (!vs.length) { toast('Chưa có lần lưu nào từ web cho form này.', 'info'); return; }
    const list = h('ul', { class: 'erp-ld__versions' }, ...vs.map((v) => h('li', {},
      h('div', {}, h('strong', {}, `Lần ${v.no}`), ` · ${v.at || ''} · ${v.by || ''}${v.kind === 'restore' ? ` · khôi phục về trước lần ${v.restoredFrom}` : ''}`),
      v.comment ? h('small', {}, v.comment) : null,
      this.readOnly ? null : h('button', { type: 'button', class: 'erp-btn erp-btn--sm', onclick: async () => {
        if (this.dirty && !(await confirmBox('Bố cục đang sửa chưa lưu sẽ bị bỏ. Tiếp tục?'))) return;
        if (!(await confirmBox(`Khôi phục bố cục về như TRƯỚC lần lưu ${v.no}? Thao tác này cũng được lưu thành một phiên bản mới.`, { ok: 'Khôi phục' }))) return;
        const fd = new FormData(/** @type {HTMLFormElement} */ (this.form));
        fd.set('Restore', String(v.no));
        await this.post(fd, 'Đã khôi phục bố cục.');
      } }, 'Khôi phục về trước lần này'))));
    this.right.replaceChildren(h('h3', {}, 'Phiên bản đã lưu'),
      h('p', { class: 'erp-ld__note' }, 'Mỗi lần lưu từ web giữ ảnh bố cục trước và sau. Khôi phục ghi lại ảnh "trước" vào cấu hình form.'),
      list, h('div', { class: 'erp-pd__props' }, h('button', { type: 'button', class: 'erp-btn', onclick: () => this.renderRight() }, 'Đóng')));
  }
}

const isTyping = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || /** @type {HTMLElement} */ (a).isContentEditable); };
