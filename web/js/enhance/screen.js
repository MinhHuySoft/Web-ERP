// @ts-check
import { h, uid } from '../core/dom.js';
import { fetchHtml, pick, adopt } from '../core/http.js';
import { icon } from '../core/icons.js';
import { toast } from '../core/ui.js';
import { toggleFavorite, isFavorite } from '../core/settings.js';
import { enhanceToolbar } from './toolbar.js';
import { enhanceFields } from './fields.js';
import { enhanceGrid } from './grid.js';
import { enhanceMessages } from './messages.js';
import { interceptNavigation } from './forms.js';
import { enhanceDashboard } from './dashboard.js';
import { enhancePrintDocument } from '../print/viewer.js';
import { enhancePrintDesigner } from '../print/designer.js';
import { enhanceLayoutDesigner } from '../layout/designer.js';

const MODE_LABEL = { view: 'Xem', new: 'Thêm mới', edit: 'Đang sửa', find: 'Danh sách' };
const TYPE_CLASS = { LIST: 'list', LISTEDIT: 'list', EDIT: 'edit', REPORT: 'report', DASHBOARD: 'dashboard', CUSTOM: 'custom' };

/**
 * Nâng cấp một section[data-erp=screen] (chuẩn ERP-HTML mục 6) thành màn hình hoàn chỉnh trong tab.
 * @param {HTMLElement} screen @param {import('../shell/tabs.js').TabContext} ctx
 */
export function enhanceScreen(screen, ctx) {
  const type = screen.getAttribute('data-form-type') || 'CUSTOM';
  const mode = screen.getAttribute('data-mode') || 'view';
  const listLike = (type === 'LIST' || type === 'LISTEDIT' || (type === 'EDIT' && mode === 'find') || type === 'REPORT');
  screen.classList.add('erp-screen', `erp-screen--${/** @type {any} */ (TYPE_CLASS)[type] || 'custom'}`, `is-mode-${mode}`);
  if (listLike) screen.classList.add('erp-screen--fill');

  // Đầu màn hình: breadcrumb (đường dẫn menu) + tiêu đề + trạng thái + yêu thích; các nút thao tác dồn sang phải cùng hàng
  const h1 = screen.querySelector(':scope > h1');
  if (h1) {
    const url = ctx.tab?.url || '';
    const fav = h('button', { type: 'button', class: 'erp-iconbtn erp-fav', 'aria-pressed': String(isFavorite(url)), title: 'Yêu thích',
      onclick: () => { const on = toggleFavorite({ url, title: h1.textContent || '' }); fav.setAttribute('aria-pressed', String(on)); toast(on ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích', 'success', 1800); ctx.shell?.sidebar?.renderFavorites(); } }, icon('star'));
    const badge = mode !== 'view' || type === 'EDIT' ? h('span', { class: `erp-badge erp-badge--mode-${mode}` }, /** @type {any} */ (MODE_LABEL)[mode] || mode) : null;
    const path = /** @type {string[]} */ (ctx.shell?.menuPath?.(screen.getAttribute('data-menu-id') || '', '') || []).slice(0, -1);
    const crumbs = path.length ? h('nav', { class: 'erp-crumbs', 'aria-label': 'Vị trí' }, ...path.flatMap((p, i) => [i ? h('span', { class: 'erp-crumbs__sep', 'aria-hidden': 'true' }, '/') : null, h('span', {}, p)])) : null;
    const actions = h('div', { class: 'erp-screen__actions' });
    const head = h('div', { class: 'erp-screen__head' },
      h('div', { class: 'erp-screen__titles' }, crumbs, h('div', { class: 'erp-screen__titleline' }, h('h1', { class: 'erp-screen__title' }, h1.textContent || ''), badge, fav)),
      actions);
    h1.replaceWith(head);
    const tb = screen.querySelector(':scope > [data-erp="toolbar"]');
    if (tb) actions.append(tb);
  }
  enhanceFragment(screen, ctx);
  if (listLike && type !== 'REPORT') compactFilter(screen);
}

/**
 * Màn danh sách: một ô tìm duy nhất và thanh lọc gọn.
 * - Ô "Tìm nhanh" của BE (data-control=search, tìm trên DB) thay ô "Tìm trong lưới" trên thanh của lưới; Enter = lọc lại.
 *   Ô vẫn thuộc form lọc (thuộc tính form), nên giá trị vẫn gửi cùng các ô lọc khác.
 * - Các ô lọc còn lại gộp vào nút "Lọc" cạnh nút Nạp lại, bấm mới mở bảng lọc; nút ghi tóm tắt điều kiện đang lọc.
 * Báo cáo không gộp (tham số là phần chính của màn).
 * @param {HTMLElement} screen
 */
function compactFilter(screen) {
  const form = /** @type {HTMLFormElement|null} */ (screen.querySelector(':scope > form[data-erp="filter"]'));
  if (!form) return;
  if (!form.id) form.id = uid('flt');
  form.querySelector(':scope > .erp-filter__toggle')?.remove();

  const searchField = form.querySelector(':scope > [data-erp="field"][data-control="search"]');
  const search = /** @type {HTMLInputElement|null} */ (searchField?.querySelector('input'));
  const bar = screen.querySelector('.erp-grid__bar');
  if (searchField && search && bar) {
    search.setAttribute('form', form.id);
    search.classList.add('erp-input', 'erp-grid__search', 'erp-grid__search--server');
    search.setAttribute('aria-label', searchField.querySelector('label')?.textContent?.trim() || 'Tìm');
    if (!search.placeholder) search.placeholder = 'Tìm mã, số chứng từ…';
    search.title = 'Nhấn Enter để tìm trên toàn bộ dữ liệu';
    const local = bar.querySelector('.erp-grid__search');
    if (local) local.replaceWith(search); else bar.prepend(search);
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); } });
    // Nút × của ô search: xóa xong thì lọc lại ngay.
    search.addEventListener('search', () => { if (!search.value) form.requestSubmit(); });
    searchField.remove();
  }

  const actions = screen.querySelector('.erp-screen__actions');
  const fields = Array.from(form.querySelectorAll(':scope > [data-erp="field"]'));
  if (!fields.length) { form.hidden = true; return; }
  if (!actions) return;
  form.classList.add('erp-filter--panel', 'is-open');
  form.hidden = true;
  const summary = h('span', { class: 'erp-filter__summary' }, filterSummary(form));
  const btn = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'erp-btn erp-filter__open', 'aria-expanded': 'false', 'aria-controls': form.id,
    title: 'Bộ lọc' }, icon('filter'), h('span', {}, 'Lọc'), summary));
  const outside = (/** @type {Event} */ e) => { if (!form.contains(/** @type {Node} */ (e.target)) && !btn.contains(/** @type {Node} */ (e.target))) close(); };
  const close = () => {
    form.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
  };
  const open = () => {
    form.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    /** @type {HTMLElement|null} */ (form.querySelector('input:not([type=hidden]), select, textarea'))?.focus();
    document.addEventListener('pointerdown', outside, true);
  };
  btn.addEventListener('click', () => (form.hidden ? open() : close()));
  form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); } });
  form.addEventListener('submit', close);
  actions.prepend(btn);
  actions.append(form);
}

/** Tóm tắt điều kiện lọc đang áp, vd "13/10 – 12/11/2026 · HN — Hà Nội". @param {HTMLFormElement} form */
function filterSummary(form) {
  const dmy = (/** @type {string} */ v) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split('-').reverse().join('/') : v);
  /** @type {string[]} */ const dates = [];
  /** @type {string[]} */ const parts = [];
  for (const f of Array.from(form.querySelectorAll(':scope > [data-erp="field"]'))) {
    const ctl = f.getAttribute('data-control');
    if (ctl === 'date' || ctl === 'datetime') {
      // Ô ngày đã nâng cấp: giá trị ISO nằm ở input ẩn mang name, ô hiển thị là text dd/mm/yyyy.
      const v = /** @type {HTMLInputElement|null} */ (f.querySelector('input[name]'))?.value;
      if (v) dates.push(dmy(v));
      continue;
    }
    const sel = f.querySelector('select');
    const cb = /** @type {HTMLInputElement|null} */ (f.querySelector('input[type=checkbox]'));
    const text = /** @type {HTMLInputElement|null} */ (f.querySelector('input:not([type=hidden]):not([type=checkbox])'));
    if (sel) { if (sel.value) parts.push(sel.selectedOptions[0]?.textContent?.trim() || sel.value); }
    else if (cb) { if (cb.checked) parts.push(f.querySelector('label')?.textContent?.trim() || cb.name); }
    else if (text?.value) parts.push(text.value);
  }
  const [a, b] = dates;
  const range = dates.length === 2 ? (a.slice(6) === b.slice(6) ? `${a.slice(0, 5)} – ${b}` : `${a} – ${b}`) : dates.join(' · ');
  return [range, ...parts].filter(Boolean).join(' · ');
}

/**
 * Nâng cấp các thành phần bên trong (dùng cho cả màn hình và hộp thoại).
 * @param {HTMLElement} root @param {import('../shell/tabs.js').TabContext} ctx
 */
export function enhanceFragment(root, ctx) {
  interceptNavigation(root, ctx);
  // FE tự kiểm tra (validateRecord) để mở đúng tab chứa ô lỗi; tắt bong bóng kiểm tra mặc định của trình duyệt
  root.querySelectorAll('form').forEach((f) => { /** @type {HTMLFormElement} */ (f).noValidate = true; });
  // Mẫu in trước lưới: các lưới R0, R1… bên trong là dữ liệu in, không nâng cấp thành lưới
  root.querySelectorAll('section[data-erp="print-document"]').forEach((p) => enhancePrintDocument(/** @type {HTMLElement} */ (p), ctx));
  root.querySelectorAll('section[data-erp="print-designer"]').forEach((p) => enhancePrintDesigner(/** @type {HTMLElement} */ (p), ctx));
  root.querySelectorAll('section[data-erp="layout-designer"]').forEach((p) => enhanceLayoutDesigner(/** @type {HTMLElement} */ (p), ctx));
  root.querySelectorAll('[data-erp="toolbar"]').forEach((m) => enhanceToolbar(/** @type {HTMLElement} */ (m), ctx));
  root.querySelectorAll('form[data-erp="filter"]').forEach((f) => enhanceFilter(/** @type {HTMLFormElement} */ (f)));
  root.querySelectorAll('form[data-erp="record"]').forEach((f) => enhanceRecord(/** @type {HTMLFormElement} */ (f)));
  enhanceFields(root, ctx);
  root.querySelectorAll('table[data-erp="grid"]').forEach((t) => enhanceGrid(/** @type {HTMLTableElement} */ (t), ctx));
  root.querySelectorAll('nav[data-erp="pager"]').forEach((n) => enhancePager(/** @type {HTMLElement} */ (n)));
  root.querySelectorAll('section[data-erp="tabs"]').forEach((t) => enhanceDetailTabs(/** @type {HTMLElement} */ (t), ctx));
  enhanceMessages(root);
  enhanceDashboard(root);
  root.querySelectorAll('[data-erp="attachments"]').forEach((a) => a.classList.add('erp-attachments'));
  root.querySelectorAll('section[data-erp="report-result"]').forEach((a) => {
    a.classList.add('erp-report-result');
    // Gọn: nút Xuất/In của kết quả báo cáo đưa lên thanh công cụ của lưới
    const tb = a.querySelector(':scope > .erp-toolbar');
    const bar = a.querySelector('.erp-grid__bar');
    if (tb && bar) { tb.classList.add('erp-toolbar--inline'); bar.append(tb); }
  });
  for (const b of Array.from(root.querySelectorAll('form:not([data-erp]) > button, [data-erp="dialog"] button, [data-erp="attachments"] button'))) {
    if (!b.classList.contains('erp-btn')) b.classList.add('erp-btn');
    const a = b.getAttribute('data-action');
    if (a === 'save' || a === 'approve' || a === 'attach' || a === 'login' || a === 'confirm-yes') b.classList.add('erp-btn--primary');
  }
}

/** @type {Record<string, string>} */
const PAGER_ICON = { first: 'first', prev: 'prev', next: 'next', last: 'last' };

/**
 * Phân trang (chuẩn 11.5): gắn vào cuối lưới đứng ngay trước nó; các liên kết mở trang khác trong cùng tab (giữ bộ lọc vì BE đặt sẵn
 * trong href). FE không tự ghép URL trang.
 * @param {HTMLElement} nav
 */
function enhancePager(nav) {
  nav.classList.add('erp-pager');
  for (const a of Array.from(nav.querySelectorAll('a[href]'))) {
    const rel = a.getAttribute('rel') || '';
    if (!a.hasAttribute('data-target')) a.setAttribute('data-target', 'self');
    a.classList.add('erp-gbtn');
    a.setAttribute('title', a.textContent?.trim() || rel);
    if (PAGER_ICON[rel]) a.prepend(icon(PAGER_ICON[rel]));
  }
  nav.querySelector(':scope > span')?.classList.add('erp-pager__info');
  const grid = nav.previousElementSibling;
  if (grid?.classList.contains('erp-grid')) grid.append(nav);
}

/** Thanh lọc: gọn trên màn hẹp, nút Lọc nổi bật. @param {HTMLFormElement} form */
function enhanceFilter(form) {
  form.classList.add('erp-filter');
  const btn = form.querySelector('button[type=submit], button:not([type])');
  btn?.classList.add('erp-btn', 'erp-btn--primary', 'erp-filter__submit');
  if (btn && !btn.querySelector('svg')) btn.prepend(icon('filter'));
  const n = form.querySelectorAll('[data-erp="field"]').length;
  if (n > 2) {
    form.classList.add('erp-filter--collapsible');
    const toggle = h('button', { type: 'button', class: 'erp-btn erp-filter__toggle', 'aria-expanded': 'false', onclick: () => {
      const open = !form.classList.contains('is-open');
      form.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    } }, icon('filter'), h('span', {}, `Bộ lọc (${n})`));
    form.prepend(toggle);
  }
}

/** Bản ghi: các fieldset[data-erp=tab] thành tab khi có từ 2 tab. @param {HTMLFormElement} form */
function enhanceRecord(form) {
  form.classList.add('erp-record');
  const tabs = /** @type {HTMLFieldSetElement[]} */ (Array.from(form.querySelectorAll(':scope > fieldset[data-erp="tab"]')));
  tabs.forEach((t) => t.classList.add('erp-fieldset'));
  if (tabs.length < 2) {
    for (const t of tabs) {
      t.classList.add('is-single');
      const legend = t.querySelector(':scope > legend');
      if (legend) {
        // legend không phải phần tử lưới: thay bằng tiêu đề trong lưới, legend giữ cho trình đọc màn hình
        legend.classList.add('erp-visually-hidden');
        t.insertBefore(h('div', { class: 'erp-fieldset__title', 'aria-hidden': 'true' }, legend.textContent || ''), legend.nextSibling);
      }
    }
    return;
  }
  const bar = h('div', { class: 'erp-subtabs', role: 'tablist' });
  const select = (/** @type {number} */ i) => tabs.forEach((t, j) => {
    t.hidden = i !== j;
    const b = /** @type {HTMLElement} */ (bar.children[j]);
    b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1;
  });
  tabs.forEach((t, i) => {
    const id = t.id || uid('ft');
    t.id = id;
    t.setAttribute('role', 'tabpanel');
    const legend = t.querySelector(':scope > legend');
    const label = legend?.textContent?.trim() || `Trang ${i + 1}`;
    legend?.classList.add('erp-visually-hidden');
    bar.append(h('button', { type: 'button', role: 'tab', class: 'erp-subtab', 'aria-controls': id, onclick: () => select(i) }, label));
    t.addEventListener('erp:show-tab', () => select(i));
  });
  tabs[0].before(bar);
  select(0);
}

/**
 * Tab chi tiết (chuẩn ERP-HTML mục 12): panel có data-src nạp khi mở lần đầu. Panel có sẵn nội dung (ô của chứng từ đặt
 * trên trang chi tiết, LYT5…13 của ERP) thì giữ nội dung đó, phần nạp về đặt phía sau.
 * @param {HTMLElement} section @param {import('../shell/tabs.js').TabContext} ctx
 */
function enhanceDetailTabs(section, ctx) {
  section.classList.add('erp-dtabs');
  const panels = /** @type {HTMLElement[]} */ (Array.from(section.querySelectorAll(':scope > [data-erp="tab-panel"]')));
  if (!panels.length) return;
  const bar = h('div', { class: 'erp-subtabs erp-subtabs--detail', role: 'tablist' });
  const select = async (/** @type {number} */ i) => {
    panels.forEach((p, j) => { p.hidden = i !== j; const b = /** @type {HTMLElement} */ (bar.children[j]); b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    const p = panels[i];
    const src = p.getAttribute('data-src');
    if (src && !p.dataset.loaded) {
      p.dataset.loaded = '1';
      const box = p.children.length ? p.appendChild(h('div', { class: 'erp-dtabs__lazy' })) : p;
      box.replaceChildren(h('div', { class: 'erp-empty' }, 'Đang tải…'));
      try {
        const res = await fetchHtml(src, { tabId: ctx.tab?.id });
        const content = pick(res.doc, 'tab-panel') || res.doc.body;
        box.replaceChildren(...Array.from(content.childNodes).map((n) => adopt(n)));
        enhanceFragment(box, ctx);
      } catch (err) { box.replaceChildren(h('div', { class: 'erp-empty erp-empty--error' }, `Không tải được: ${String(/** @type {any} */ (err)?.message || err)}`)); }
    }
  };
  panels.forEach((p, i) => {
    const id = p.id || uid('dt');
    p.id = id;
    p.setAttribute('role', 'tabpanel');
    p.classList.add('erp-dtabs__panel');
    p.querySelectorAll(':scope > fieldset').forEach((f) => f.classList.add('erp-fieldset'));
    const badge = p.getAttribute('data-badge');
    bar.append(h('button', { type: 'button', role: 'tab', class: 'erp-subtab', 'aria-controls': id, onclick: () => select(i) },
      p.getAttribute('data-title') || `Chi tiết ${i + 1}`, badge && badge !== '0' ? h('span', { class: 'erp-count' }, badge) : null));
  });
  bar.addEventListener('keydown', (e) => {
    const btns = Array.from(bar.children);
    const i = btns.indexOf(/** @type {Element} */ (document.activeElement));
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
      select(n); /** @type {HTMLElement} */ (btns[n]).focus();
    }
  });
  section.prepend(bar);
  select(0);
}
