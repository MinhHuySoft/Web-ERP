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

  // Tiêu đề + trạng thái chế độ + yêu thích
  const h1 = screen.querySelector(':scope > h1');
  if (h1) {
    const url = ctx.tab?.url || '';
    const fav = h('button', { type: 'button', class: 'erp-iconbtn erp-fav', 'aria-pressed': String(isFavorite(url)), title: 'Yêu thích',
      onclick: () => { const on = toggleFavorite({ url, title: h1.textContent || '' }); fav.setAttribute('aria-pressed', String(on)); toast(on ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích', 'success', 1800); } }, icon('star'));
    const badge = mode !== 'view' || type === 'EDIT' ? h('span', { class: `erp-badge erp-badge--mode-${mode}` }, /** @type {any} */ (MODE_LABEL)[mode] || mode) : null;
    const head = h('div', { class: 'erp-screen__head' }, h('h1', { class: 'erp-screen__title' }, h1.textContent || ''), badge, fav);
    h1.replaceWith(head);
  }
  enhanceFragment(screen, ctx);
}

/**
 * Nâng cấp các thành phần bên trong (dùng cho cả màn hình và hộp thoại).
 * @param {HTMLElement} root @param {import('../shell/tabs.js').TabContext} ctx
 */
export function enhanceFragment(root, ctx) {
  interceptNavigation(root, ctx);
  // FE tự kiểm tra (validateRecord) để mở đúng tab chứa ô lỗi; tắt bong bóng kiểm tra mặc định của trình duyệt
  root.querySelectorAll('form').forEach((f) => { /** @type {HTMLFormElement} */ (f).noValidate = true; });
  root.querySelectorAll('[data-erp="toolbar"]').forEach((m) => enhanceToolbar(/** @type {HTMLElement} */ (m), ctx));
  root.querySelectorAll('form[data-erp="filter"]').forEach((f) => enhanceFilter(/** @type {HTMLFormElement} */ (f)));
  root.querySelectorAll('form[data-erp="record"]').forEach((f) => enhanceRecord(/** @type {HTMLFormElement} */ (f)));
  enhanceFields(root, ctx);
  root.querySelectorAll('table[data-erp="grid"]').forEach((t) => enhanceGrid(/** @type {HTMLTableElement} */ (t), ctx));
  root.querySelectorAll('section[data-erp="tabs"]').forEach((t) => enhanceDetailTabs(/** @type {HTMLElement} */ (t), ctx));
  enhanceMessages(root);
  enhanceDashboard(root);
  root.querySelectorAll('[data-erp="attachments"]').forEach((a) => a.classList.add('erp-attachments'));
  root.querySelectorAll('section[data-erp="report-result"]').forEach((a) => a.classList.add('erp-report-result'));
  for (const b of Array.from(root.querySelectorAll('form:not([data-erp]) > button, [data-erp="dialog"] button, [data-erp="attachments"] button'))) {
    if (!b.classList.contains('erp-btn')) b.classList.add('erp-btn');
    const a = b.getAttribute('data-action');
    if (a === 'save' || a === 'approve' || a === 'attach' || a === 'login' || a === 'confirm-yes') b.classList.add('erp-btn--primary');
  }
}

/** Thanh lọc: gọn trên màn hẹp, nút Lọc nổi bật. @param {HTMLFormElement} form */
function enhanceFilter(form) {
  form.classList.add('erp-filter');
  const btn = form.querySelector('button[type=submit], button:not([type])');
  btn?.classList.add('erp-btn', 'erp-btn--primary', 'erp-filter__submit');
  if (btn && !btn.querySelector('svg')) btn.prepend(icon('filter'));
  const n = form.querySelectorAll('[data-erp="field"]').length;
  if (n > 2) {
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
 * Tab chi tiết (chuẩn ERP-HTML mục 12): panel có data-src nạp khi mở lần đầu.
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
      p.replaceChildren(h('div', { class: 'erp-empty' }, 'Đang tải…'));
      try {
        const res = await fetchHtml(src, { tabId: ctx.tab?.id });
        const content = pick(res.doc, 'tab-panel') || res.doc.body;
        p.replaceChildren(...Array.from(content.childNodes).map((n) => adopt(n)));
        enhanceFragment(p, ctx);
      } catch (err) { p.replaceChildren(h('div', { class: 'erp-empty erp-empty--error' }, `Không tải được: ${String(/** @type {any} */ (err)?.message || err)}`)); }
    }
  };
  panels.forEach((p, i) => {
    const id = p.id || uid('dt');
    p.id = id;
    p.setAttribute('role', 'tabpanel');
    p.classList.add('erp-dtabs__panel');
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
