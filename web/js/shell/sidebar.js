// @ts-check
import { h, fold } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { getSettings, setSettings, getFavorites, SIDEBAR_W } from '../core/settings.js';

/** @typedef {import('./menu-model.js').MenuNode} MenuNode */

/**
 * Sidebar dọc (kiểu điều hướng "Sidebar"), cũng dùng làm ngăn kéo menu trên điện thoại.
 *  - Mỗi phân hệ (menu cấp 1) là một mục có biểu tượng; mở ra thấy nhóm chức năng (cấp 2) và các màn hình.
 *  - Mục lá thẳng dưới phân hệ chia thành "Chức năng" và "Báo cáo" (giống Ribbon).
 *  - Thu gọn thành thanh biểu tượng (rail): bấm/di chuột vào biểu tượng mở bảng nổi bên phải.
 *  - Ô lọc tìm không dấu; tự đánh dấu màn hình đang mở.
 */
export class Sidebar {
  /** @param {any} shell @param {HTMLElement} host */
  constructor(shell, host) {
    this.shell = shell;
    this.host = host;
    /** @type {HTMLInputElement|null} */ this.search = null;
    /** @type {MenuNode[]} */ this.menu = [];
    /** @type {HTMLElement|null} */ this.flyout = null;
    this.activeUrl = '';
  }

  /** @param {MenuNode[]} menu */
  render(menu) {
    this.menu = menu;
    this.search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'erp-input erp-snav__search', placeholder: 'Lọc menu…', 'aria-label': 'Lọc menu',
      oninput: () => this.filter(this.search?.value || '') }));
    this.list = h('ul', { class: 'erp-snav', role: 'tree', 'aria-label': 'Menu chính' },
      this.homeItem(), ...menu.map((m) => this.module(m)));
    this.favBox = h('div', { class: 'erp-snav__favs' });
    this.collapseBtn = h('button', { class: 'erp-iconbtn erp-snav__collapse', type: 'button', onclick: () => this.toggleCollapsed() });
    this.resizer = h('div', { class: 'erp-sidebar__resizer', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical',
      'aria-label': 'Kéo để đổi độ rộng menu (nhấp đúp: mặc định)', title: 'Kéo để đổi độ rộng · nhấp đúp để về mặc định',
      'aria-valuemin': String(SIDEBAR_W.min), 'aria-valuemax': String(SIDEBAR_W.max) });
    this.bindResize(this.resizer);
    this.host.replaceChildren(
      h('div', { class: 'erp-sidebar__head' },
        h('span', { class: 'erp-snav__searchwrap' }, icon('search'), this.search),
        h('button', { class: 'erp-iconbtn erp-snav__foldall', type: 'button', title: 'Thu gọn tất cả nhóm', 'aria-label': 'Thu gọn tất cả nhóm',
          onclick: () => this.list?.querySelectorAll('.erp-snav__module.is-open').forEach((li) => this.setOpen(/** @type {HTMLElement} */ (li), false)) }, icon('collapse')),
        h('button', { class: 'erp-iconbtn erp-sidebar__close', type: 'button', 'aria-label': 'Đóng menu', onclick: () => this.shell.toggleDrawer(false) }, icon('close'))),
      h('div', { class: 'erp-sidebar__scroll' }, this.favBox, this.list),
      h('div', { class: 'erp-sidebar__foot' }, this.collapseBtn,
        h('button', { class: 'erp-snav__switch', type: 'button', title: 'Chuyển sang Ribbon', onclick: () => setSettings({ nav: 'ribbon' }) }, icon('ribbon'), h('span', {}, 'Dùng Ribbon'))),
      this.resizer);
    this.syncCollapsed();
    this.renderFavorites();
  }

  /** Kéo mép phải để đổi độ rộng; phím ←/→ chỉnh 16px; nhấp đúp về mặc định. Độ rộng lưu theo người dùng. @param {HTMLElement} handle */
  bindResize(handle) {
    const set = (/** @type {number} */ w, /** @type {boolean} */ save) => {
      const v = Math.round(Math.max(SIDEBAR_W.min, Math.min(SIDEBAR_W.max, w)));
      document.documentElement.style.setProperty('--erp-sidebar-w', `${v}px`);
      handle.setAttribute('aria-valuenow', String(v));
      if (save) setSettings({ sidebarWidth: v });
    };
    handle.setAttribute('aria-valuenow', String(getSettings().sidebarWidth || SIDEBAR_W.def));
    handle.addEventListener('pointerdown', (e) => {
      if (this.isRail()) return;
      e.preventDefault();
      const startX = e.clientX, startW = this.host.getBoundingClientRect().width;
      document.documentElement.classList.add('is-resizing-sidebar');
      handle.setPointerCapture(e.pointerId);
      const move = (/** @type {PointerEvent} */ ev) => set(startW + ev.clientX - startX, false);
      const up = (/** @type {PointerEvent} */ ev) => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        document.documentElement.classList.remove('is-resizing-sidebar');
        set(startW + ev.clientX - startX, true);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
    handle.addEventListener('dblclick', () => set(SIDEBAR_W.def, true));
    handle.addEventListener('keydown', (e) => {
      const cur = this.host.getBoundingClientRect().width;
      if (e.key === 'ArrowLeft') { e.preventDefault(); set(cur - 16, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); set(cur + 16, true); }
    });
  }

  homeItem() {
    return h('li', { class: 'erp-snav__module erp-snav__module--home', role: 'none' },
      h('button', { class: 'erp-snav__mhead', type: 'button', role: 'treeitem', 'data-tip': 'Trang chủ', onclick: () => this.shell.tabs?.activateKey('Home') },
        icon('home'), h('span', { class: 'erp-snav__label' }, 'Trang chủ')));
  }

  /** @param {MenuNode} m */
  module(m) {
    const body = h('div', { class: 'erp-snav__body', role: 'group' }, ...this.sections(m));
    const head = h('button', { class: 'erp-snav__mhead', type: 'button', role: 'treeitem', 'aria-expanded': 'false', 'data-tip': m.label,
      onclick: (/** @type {MouseEvent} */ e) => {
        if (this.isRail()) { this.openFlyout(m, /** @type {HTMLElement} */ (e.currentTarget)); return; }
        this.setOpen(li, head.getAttribute('aria-expanded') !== 'true', true);
      },
      onmouseenter: (/** @type {MouseEvent} */ e) => { if (this.isRail()) this.openFlyout(m, /** @type {HTMLElement} */ (e.currentTarget)); } },
    icon(m.icon || 'form'), h('span', { class: 'erp-snav__label' }, m.label), h('span', { class: 'erp-snav__count' }, String(countLeaves(m))), icon('chevron-right', 'erp-snav__caret'));
    const li = h('li', { class: 'erp-snav__module', role: 'none', dataset: { id: m.id } }, head, body);
    return li;
  }

  /** Nội dung một phân hệ: Chức năng · các nhóm cấp 2 · Báo cáo. @param {MenuNode} m @returns {HTMLElement[]} */
  sections(m) {
    const direct = m.children.filter((c) => !c.children.length);
    const groups = m.children.filter((c) => c.children.length);
    const forms = direct.filter((c) => c.kind !== 'report');
    const reports = direct.filter((c) => c.kind === 'report');
    /** @type {HTMLElement[]} */ const out = [];
    if (forms.length) out.push(this.group('Chức năng', forms, true));
    for (const g of groups) out.push(this.group(g.label, flatten(g.children), false));
    if (reports.length) out.push(this.group('Báo cáo', reports, false));
    return out;
  }

  /** @param {string} title @param {MenuNode[]} items @param {boolean} open */
  group(title, items, open) {
    const ul = h('ul', { role: 'group' }, ...items.map((n) => this.item(n)));
    const head = h('button', { class: 'erp-snav__ghead', type: 'button', 'aria-expanded': String(open),
      onclick: () => head.setAttribute('aria-expanded', String(head.getAttribute('aria-expanded') !== 'true')) },
    icon('chevron-right', 'erp-snav__caret'), h('span', {}, title), h('small', {}, String(items.length)));
    return h('div', { class: 'erp-snav__group' }, head, ul);
  }

  /** @param {MenuNode} n */
  item(n) {
    return h('li', { role: 'none' },
      h('a', { href: n.url, class: 'erp-snav__item', role: 'treeitem', title: n.label, dataset: { url: n.url, menuId: n.id },
        onclick: (/** @type {MouseEvent} */ e) => {
          e.preventDefault();
          this.closeFlyout();
          if (n.action === 'logout') this.shell.logout(n.url); else this.shell.open(n.url, { target: n.target });
        } },
      icon(n.kind === 'report' ? 'report' : n.icon), h('span', {}, n.label)));
  }

  renderFavorites() {
    const favs = getFavorites();
    this.favBox.replaceChildren(...(favs.length ? [h('div', { class: 'erp-snav__title' }, icon('star'), h('span', {}, 'Yêu thích')),
      h('ul', { class: 'erp-snav__favlist' }, ...favs.slice(0, 8).map((f) => h('li', {},
        h('a', { href: f.url, class: 'erp-snav__item', title: f.title, dataset: { url: f.url },
          onclick: (/** @type {MouseEvent} */ e) => { e.preventDefault(); this.shell.open(f.url); } }, icon('star'), h('span', {}, f.title)))))] : []));
  }

  /** @param {HTMLElement} li @param {boolean} open @param {boolean} [exclusive] */
  setOpen(li, open, exclusive = false) {
    if (open && exclusive) {
      this.list?.querySelectorAll('.erp-snav__module.is-open').forEach((x) => { if (x !== li) this.setOpen(/** @type {HTMLElement} */ (x), false); });
    }
    li.classList.toggle('is-open', open);
    li.querySelector('.erp-snav__mhead')?.setAttribute('aria-expanded', String(open));
  }

  isRail() { return getSettings().sidebarCollapsed && !this.shell.root.classList.contains('is-drawer-open') && innerWidth >= 768; }

  toggleCollapsed() { setSettings({ sidebarCollapsed: !getSettings().sidebarCollapsed }); }

  syncCollapsed() {
    const rail = getSettings().sidebarCollapsed;
    this.collapseBtn?.replaceChildren(icon(rail ? 'chevrons-right' : 'chevrons-left'));
    this.collapseBtn?.setAttribute('aria-label', rail ? 'Mở rộng menu' : 'Thu gọn menu');
    this.collapseBtn?.setAttribute('title', rail ? 'Mở rộng menu' : 'Thu gọn thành thanh biểu tượng');
    this.closeFlyout();
  }

  /** Bảng nổi khi menu ở dạng thanh biểu tượng. @param {MenuNode} m @param {HTMLElement} anchor */
  openFlyout(m, anchor) {
    if (this.flyout?.dataset.id === m.id) return;
    this.closeFlyout();
    const fly = h('div', { class: 'erp-snav-fly erp-surface', role: 'dialog', 'aria-label': m.label, dataset: { id: m.id } },
      h('div', { class: 'erp-snav-fly__head' }, icon(m.icon || 'form'), h('strong', {}, m.label)),
      h('div', { class: 'erp-snav-fly__body' }, ...this.sections(m).map((g) => { g.querySelector('.erp-snav__ghead')?.setAttribute('aria-expanded', 'true'); return g; })));
    document.body.append(fly);
    const r = anchor.getBoundingClientRect();
    fly.style.left = `${r.right + 6}px`;
    fly.style.top = `${Math.max(8, Math.min(r.top - 8, innerHeight - fly.offsetHeight - 8))}px`;
    this.flyout = fly;
    this.markActive(fly);
    const leave = (/** @type {MouseEvent} */ e) => {
      const to = /** @type {Node|null} */ (e.relatedTarget);
      if (to && (fly.contains(to) || anchor.contains(to))) return;
      this.flyTimer = setTimeout(() => this.closeFlyout(), 220);
    };
    const enter = () => clearTimeout(this.flyTimer);
    fly.addEventListener('mouseleave', leave);
    fly.addEventListener('mouseenter', enter);
    anchor.addEventListener('mouseleave', leave, { once: true });
    this.outside = (/** @type {Event} */ e) => { if (!fly.contains(/** @type {Node} */ (e.target)) && !anchor.contains(/** @type {Node} */ (e.target))) this.closeFlyout(); };
    setTimeout(() => document.addEventListener('pointerdown', /** @type {any} */ (this.outside), true));
  }

  closeFlyout() {
    clearTimeout(this.flyTimer);
    this.flyout?.remove();
    this.flyout = null;
    if (this.outside) document.removeEventListener('pointerdown', this.outside, true);
  }

  /** Đánh dấu màn hình đang mở và mở phân hệ chứa nó. @param {string} url @param {string} [menuId] */
  highlight(url, menuId = '') {
    this.activeUrl = url;
    this.activeMenuId = menuId;
    if (!this.list) return;
    this.markActive(this.host);
    const cur = /** @type {HTMLElement|null} */ (this.list.querySelector('[aria-current="page"]'));
    if (cur && !this.search?.value) {
      const li = /** @type {HTMLElement|null} */ (cur.closest('.erp-snav__module'));
      if (li && !li.classList.contains('is-open')) this.setOpen(li, true, true);
      cur.closest('.erp-snav__group')?.querySelector('.erp-snav__ghead')?.setAttribute('aria-expanded', 'true');
    }
    this.renderFavorites();
    this.markActive(this.host);
  }

  /** @param {HTMLElement} root */
  markActive(root) {
    root.querySelectorAll('.erp-snav__item').forEach((a) => {
      const d = /** @type {HTMLElement} */ (a).dataset;
      const on = d.url === this.activeUrl || (!!this.activeMenuId && d.menuId === this.activeMenuId);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  focusSearch() { setTimeout(() => this.search?.focus(), 50); }

  /** @param {string} q */
  filter(q) {
    const f = fold(q.trim());
    for (const li of Array.from(this.list?.querySelectorAll('.erp-snav__module:not(.erp-snav__module--home)') || [])) {
      let any = false;
      for (const g of Array.from(li.querySelectorAll('.erp-snav__group'))) {
        let gAny = false;
        for (const it of Array.from(g.querySelectorAll('li'))) {
          const ok = !f || fold(it.textContent || '').includes(f);
          /** @type {HTMLElement} */ (it).hidden = !ok;
          gAny = gAny || ok;
        }
        /** @type {HTMLElement} */ (g).hidden = !gAny;
        if (f) g.querySelector('.erp-snav__ghead')?.setAttribute('aria-expanded', 'true');
        any = any || gAny;
      }
      /** @type {HTMLElement} */ (li).hidden = !any;
      if (f) this.setOpen(/** @type {HTMLElement} */ (li), any);
    }
    if (!f) { this.list?.querySelectorAll('.erp-snav__module').forEach((li) => this.setOpen(/** @type {HTMLElement} */ (li), false)); this.highlight(this.activeUrl, this.activeMenuId); }
  }
}

/** @param {MenuNode[]} nodes @returns {MenuNode[]} */
function flatten(nodes) {
  /** @type {MenuNode[]} */ const out = [];
  for (const n of nodes) { if (n.children.length) out.push(...flatten(n.children)); else out.push(n); }
  return out;
}

/** @param {MenuNode} m */
function countLeaves(m) { return m.children.length ? m.children.reduce((s, c) => s + countLeaves(c), 0) : 1; }
