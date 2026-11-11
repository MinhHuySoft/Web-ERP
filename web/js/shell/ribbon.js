// @ts-check
import { h, fold } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { getSettings, setSettings, getRecent, getFavorites } from '../core/settings.js';
import { openSettingsPanel } from './settings-panel.js';
import { popupMenu } from './shell.js';

const ROOT_ICON_FALLBACK = 'form';
const SMALL_MAX = 15;     // nhóm nhiều hơn số này ⇒ gom thành nút thả xuống

/**
 * Ribbon dựng từ cây menu (chuẩn ERP-HTML 5.3): tab = cấp 1; nhóm = cấp 2 có con; nút = mục lá.
 * Mục lá thẳng dưới cấp 1 được gom thành nhóm "Chức năng" và "Báo cáo".
 */
export class Ribbon {
  /** @param {import('./shell.js').Shell} shell @param {HTMLElement} host */
  constructor(shell, host) {
    this.shell = shell;
    this.host = host;
    this.active = 0;
    /** @type {HTMLElement[]} */ this.tabBtns = [];
    /** @type {HTMLElement[]} */ this.panels = [];
  }

  /** @param {import('./menu-model.js').MenuNode[]} menu */
  render(menu) {
    const tabsRow = h('div', { class: 'erp-ribbon__tabs', role: 'tablist', 'aria-label': 'Phân hệ' });
    const body = h('div', { class: 'erp-ribbon__body' });
    const roots = [{ id: '__home', label: 'Trang chủ', icon: 'home', children: [] }, ...menu];
    roots.forEach((root, i) => {
      const btn = h('button', { class: 'erp-ribbon__tab', role: 'tab', type: 'button', id: `rb-tab-${i}`,
        'aria-controls': `rb-panel-${i}`, 'aria-selected': 'false', tabindex: '-1',
        onclick: () => this.select(i, true), ondblclick: () => this.toggleCollapsed() },
      root.icon ? icon(root.icon || ROOT_ICON_FALLBACK) : null, h('span', {}, root.label));
      const panel = h('div', { class: 'erp-ribbon__panel', role: 'tabpanel', id: `rb-panel-${i}`, 'aria-labelledby': `rb-tab-${i}`, hidden: true });
      if (root.id === '__home') this.fillHome(panel); else this.fillPanel(panel, /** @type {any} */ (root));
      tabsRow.append(btn);
      body.append(panel);
      this.tabBtns.push(btn);
      this.panels.push(panel);
    });
    tabsRow.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        const n = (this.active + (ev.key === 'ArrowRight' ? 1 : -1) + this.tabBtns.length) % this.tabBtns.length;
        this.select(n, true); this.tabBtns[n].focus();
      }
    });
    const collapseBtn = h('button', { class: 'erp-iconbtn erp-ribbon__collapse', type: 'button', title: 'Thu gọn / mở rộng Ribbon (Ctrl+F1)',
      'aria-label': 'Thu gọn Ribbon', onclick: () => this.toggleCollapsed() }, icon('chevron-up'));
    this.collapseBtn = collapseBtn;
    // Nút cuộn khi các nhóm vượt quá bề ngang (thay cho thanh cuộn)
    const step = (/** @type {number} */ d) => body.scrollBy({ left: d * body.clientWidth * 0.7, behavior: 'smooth' });
    const left = h('button', { type: 'button', class: 'erp-ribbon__scroll erp-ribbon__scroll--left', 'aria-label': 'Cuộn Ribbon sang trái', onclick: () => step(-1) }, icon('prev'));
    const right = h('button', { type: 'button', class: 'erp-ribbon__scroll erp-ribbon__scroll--right', 'aria-label': 'Cuộn Ribbon sang phải', onclick: () => step(1) }, icon('next'));
    const syncScroll = () => {
      left.hidden = body.scrollLeft <= 2;
      right.hidden = body.scrollLeft + body.clientWidth >= body.scrollWidth - 2;
    };
    this.syncScroll = syncScroll;
    body.addEventListener('scroll', syncScroll, { passive: true });
    new ResizeObserver(syncScroll).observe(body);
    this.el = h('nav', { class: 'erp-ribbon erp-chrome', 'aria-label': 'Ribbon' }, h('div', { class: 'erp-ribbon__tabsrow' }, tabsRow, collapseBtn),
      h('div', { class: 'erp-ribbon__bodywrap' }, left, body, right));
    this.host.replaceChildren(this.el);
    this.select(1 < roots.length ? 1 : 0, false);
    this.syncCollapsed();
    document.addEventListener('keydown', (ev) => { if (ev.ctrlKey && ev.key === 'F1') { ev.preventDefault(); this.toggleCollapsed(); } });
    document.addEventListener('pointerdown', (ev) => {
      if (this.el?.classList.contains('is-peek') && !this.el.contains(/** @type {Node} */ (ev.target))) this.el.classList.remove('is-peek');
    });
  }

  /** @param {number} i @param {boolean} user */
  select(i, user) {
    this.active = i;
    this.tabBtns.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    this.panels.forEach((p, j) => { p.hidden = i !== j; });
    const body = this.el?.querySelector('.erp-ribbon__body');
    if (body) body.scrollLeft = 0;
    requestAnimationFrame(() => this.syncScroll?.());
    if (user && getSettings().ribbonCollapsed) this.el?.classList.add('is-peek');
  }

  toggleCollapsed() { setSettings({ ribbonCollapsed: !getSettings().ribbonCollapsed }); }

  syncCollapsed() {
    const c = getSettings().ribbonCollapsed;
    this.el?.classList.toggle('is-collapsed', c);
    this.el?.classList.remove('is-peek');
    if (this.collapseBtn) this.collapseBtn.replaceChildren(icon(c ? 'chevron-down' : 'chevron-up'));
  }

  /** @param {HTMLElement} panel */
  fillHome(panel) {
    const sh = this.shell;
    const big = (/** @type {string} */ ic, /** @type {string} */ label, /** @type {(e:MouseEvent)=>void} */ fn) =>
      h('button', { class: 'erp-rbtn erp-rbtn--large', type: 'button', onclick: fn }, icon(ic), h('span', {}, label));
    panel.append(
      group('Điều hướng', [
        big('dashboard', 'Trang chủ', () => sh.tabs?.activateKey('Home')),
        big('search', 'Tìm chức năng', () => sh.palette()),
        big('clock', 'Gần đây', (e) => this.navMenu(/** @type {HTMLElement} */ (e.currentTarget), getRecent(), 'Chưa mở màn hình nào')),
        big('star', 'Yêu thích', (e) => this.navMenu(/** @type {HTMLElement} */ (e.currentTarget), getFavorites(), 'Chưa có mục yêu thích (bấm ☆ trên tiêu đề màn hình)')),
      ], 'large'),
      group('Giao diện', [
        big('theme', 'Theme & hiển thị', () => openSettingsPanel()),
        big('sidebar', 'Sidebar dọc', () => setSettings({ nav: 'sidebar' })),
      ], 'large'),
      group('Tài khoản', [
        big('key', 'Đổi mật khẩu', () => sh.sessionLinks['change-password'] && sh.open(sh.sessionLinks['change-password'], { target: 'dialog' })),
        big('logout', 'Đăng xuất', () => sh.logout(sh.sessionLinks.logout)),
      ], 'large'),
    );
  }

  /** @param {HTMLElement} anchor @param {{url:string,title:string}[]} list @param {string} empty */
  navMenu(anchor, list, empty) {
    popupMenu(anchor, list.length ? list.slice(0, 15).map((x) => ({ icon: 'form', label: x.title, onClick: () => this.shell.open(x.url) }))
      : [{ label: empty }]);
  }

  /** @param {HTMLElement} panel @param {import('./menu-model.js').MenuNode} root */
  fillPanel(panel, root) {
    const direct = root.children.filter((c) => !c.children.length);
    const groups = root.children.filter((c) => c.children.length);
    const forms = direct.filter((c) => c.kind !== 'report');
    const reports = direct.filter((c) => c.kind === 'report');
    if (forms.length) panel.append(this.group('Chức năng', forms, root.icon));
    for (const g of groups) panel.append(this.group(g.label, flatten(g.children), root.icon));
    if (reports.length) panel.append(this.group('Báo cáo', reports, 'report'));
  }

  /** @param {string} title @param {import('./menu-model.js').MenuNode[]} items @param {string} groupIcon */
  group(title, items, groupIcon) {
    if (items.length > SMALL_MAX) {
      const btn = h('button', { class: 'erp-rbtn erp-rbtn--large erp-rbtn--drop', type: 'button', 'aria-haspopup': 'dialog',
        onclick: () => this.openGroupPopover(btn, title, items) },
      icon(groupIcon || 'list'), h('span', {}, title), h('small', { class: 'erp-rbtn__count' }, String(items.length)), icon('chevron-down', 'erp-rbtn__caret'));
      const first = items.slice(0, 6).map((n) => this.itemBtn(n, 'small'));
      return group(title, [btn, ...first], 'mixed');
    }
    const size = items.length <= 3 ? 'large' : 'small';
    return group(title, items.map((n) => this.itemBtn(n, size)), size);
  }

  /** @param {import('./menu-model.js').MenuNode} n @param {'large'|'small'} size */
  itemBtn(n, size) {
    return h('button', { class: `erp-rbtn erp-rbtn--${size}${n.beginGroup ? ' is-begin' : ''}${n.strong ? ' is-strong' : ''}`, type: 'button',
      title: [n.label, n.shortcut].filter(Boolean).join(' — '), dataset: { menuId: n.id },
      onclick: () => (n.action === 'logout' ? this.shell.logout(n.url) : this.shell.open(n.url, { target: n.target })) },
    icon(n.icon), h('span', {}, n.label));
  }

  /** Nhóm lớn: bảng chọn nhiều cột có ô tìm. @param {HTMLElement} anchor @param {string} title @param {import('./menu-model.js').MenuNode[]} items */
  openGroupPopover(anchor, title, items) {
    document.querySelectorAll('.erp-rpop').forEach((x) => x.remove());
    const list = h('div', { class: 'erp-rpop__list' });
    const fill = (/** @type {string} */ q) => {
      const f = fold(q);
      list.replaceChildren(...items.filter((n) => !f || fold(n.label).includes(f)).map((n) =>
        h('button', { type: 'button', class: 'erp-rpop__item', onclick: () => { close(); this.shell.open(n.url, { target: n.target }); } },
          icon(n.icon), h('span', {}, n.label))));
    };
    const input = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'erp-input', placeholder: `Tìm trong ${title}…`, oninput: () => fill(input.value) }));
    const pop = h('div', { class: 'erp-rpop erp-surface', role: 'dialog', 'aria-label': title }, h('div', { class: 'erp-rpop__head' }, h('strong', {}, title), input), list);
    document.body.append(pop);
    fill('');
    const r = anchor.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${r.bottom + 4}px`;
    input.focus();
    const close = () => { pop.remove(); document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', esc, true); };
    const out = (/** @type {Event} */ e) => { if (!pop.contains(/** @type {Node} */ (e.target)) && !anchor.contains(/** @type {Node} */ (e.target))) close(); };
    const esc = (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus(); } };
    setTimeout(() => { document.addEventListener('pointerdown', out, true); document.addEventListener('keydown', esc, true); });
  }
}

/** @param {string} title @param {HTMLElement[]} buttons @param {string} layout */
function group(title, buttons, layout) {
  return h('section', { class: `erp-rgroup erp-rgroup--${layout}`, 'aria-label': title },
    h('div', { class: 'erp-rgroup__items' }, ...buttons), h('h3', { class: 'erp-rgroup__title' }, title));
}

/** @param {import('./menu-model.js').MenuNode[]} nodes @returns {import('./menu-model.js').MenuNode[]} */
function flatten(nodes) {
  /** @type {import('./menu-model.js').MenuNode[]} */ const out = [];
  for (const n of nodes) { if (n.children.length) out.push(...flatten(n.children)); else out.push(n); }
  return out;
}
