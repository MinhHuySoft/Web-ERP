// @ts-check
import { h, $ } from '../core/dom.js';
import { fetchHtml, pick, adopt } from '../core/http.js';
import { icon } from '../core/icons.js';
import { toast, messageBox } from '../core/ui.js';
import { getSettings, setSettings, onSettings } from '../core/settings.js';
import { parseMenu } from './menu-model.js';
import { Ribbon } from './ribbon.js';
import { Sidebar } from './sidebar.js';
import { TabManager } from './tabs.js';
import { openPalette } from './palette.js';
import { openSettingsPanel } from './settings-panel.js';
import { installMode, install, onInstallChange } from '../core/pwa.js';
import { enhanceFields } from '../enhance/fields.js';
import { readMessages } from '../enhance/messages.js';

const cfg = /** @type {any} */ (window).ERP_CONFIG || {};

/** @typedef {{ key:string, label:string, text:string, value:string }} SessionItem */

/**
 * Vỏ ứng dụng: thanh tiêu đề, Ribbon / Sidebar, thanh tab tài liệu, vùng làm việc, thanh trạng thái.
 * Dữ liệu vỏ lấy từ backend qua 3 điểm vào cấu hình sẵn: session, menu, home (chuẩn ERP-HTML mục 3.4).
 */
export class Shell {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    /** @type {import('./menu-model.js').MenuNode[]} */
    this.menu = [];
    /** @type {SessionItem[]} */
    this.session = [];
    /** @type {Record<string,string>} */
    this.sessionLinks = {};
    /** @type {TabManager|null} */
    this.tabs = null;
  }

  async start() {
    try {
      const res = await fetchHtml(cfg.sessionUrl);
      const s = pick(res.doc, 'session');
      if (res.status === 401 || !s) return this.showLogin();
      this.readSession(s);
      await this.build();
    } catch (err) {
      this.fatal(err);
    }
  }

  /** @param {HTMLElement} s */
  readSession(s) {
    this.session = Array.from(s.querySelectorAll('dl > div[data-key]')).map((d) => ({
      key: d.getAttribute('data-key') || '', label: d.querySelector('dt')?.textContent?.trim() || '',
      text: d.querySelector('dd')?.textContent?.trim() || '', value: d.querySelector('dd')?.getAttribute('data-value') || '',
    }));
    this.sessionLinks = {};
    for (const a of Array.from(s.querySelectorAll('a[data-action]'))) {
      this.sessionLinks[a.getAttribute('data-action') || ''] = a.getAttribute('href') || '';
    }
  }

  /** @param {string} key */
  sess(key) { return this.session.find((x) => x.key === key)?.text || ''; }

  async build() {
    const menuRes = await fetchHtml(cfg.menuUrl);
    const nav = pick(menuRes.doc, 'menu');
    this.menu = nav ? parseMenu(nav) : [];

    this.root.replaceChildren();
    this.root.removeAttribute('aria-busy');
    this.root.className = 'erp-app';

    const titlebar = this.buildTitlebar();
    const ribbonHost = h('div', { class: 'erp-ribbon-host' });
    const sidebarHost = h('aside', { class: 'erp-sidebar', 'aria-label': 'Menu' });
    const docbar = h('div', { class: 'erp-docbar' });
    const workspace = h('main', { class: 'erp-workspace', id: 'erp-workspace' });
    const statusbar = this.buildStatusbar();
    const bottombar = this.buildBottombar();
    const scrim = h('div', { class: 'erp-scrim', onclick: () => this.toggleDrawer(false) });

    this.root.append(titlebar, ribbonHost, h('div', { class: 'erp-body' }, sidebarHost, h('div', { class: 'erp-main' }, docbar, workspace)),
      statusbar, bottombar, scrim);

    this.tabs = new TabManager(this, docbar, workspace);
    this.ribbon = new Ribbon(this, ribbonHost);
    this.sidebar = new Sidebar(this, sidebarHost);
    this.ribbon.render(this.menu);
    this.sidebar.render(this.menu);

    this.bindKeys();
    onSettings(() => { this.ribbon?.syncCollapsed(); this.sidebar?.syncCollapsed(); this.syncNavButton(); });
    await this.tabs.open(cfg.homeUrl, { target: 'tab', pinned: true });
  }

  /** Tab đang xem đổi ⇒ đánh dấu mục tương ứng trong Sidebar (theo URL hoặc data-menu-id của màn hình). @param {{url:string, panel?:HTMLElement}} tab */
  onActiveTab(tab) {
    const menuId = tab.panel?.querySelector('[data-erp="screen"]')?.getAttribute('data-menu-id') || '';
    this.sidebar?.highlight(tab.url, menuId);
  }

  /**
   * Đường dẫn menu (để làm breadcrumb) của một màn hình: tìm theo data-menu-id, nếu không có thì theo URL.
   * @param {string} menuId @param {string} url @returns {string[]}
   */
  menuPath(menuId, url) {
    /** @type {string[]|null} */ let found = null;
    const walk = (/** @type {import('./menu-model.js').MenuNode[]} */ ns) => {
      for (const n of ns) {
        if (found) return;
        if (!n.children.length && ((menuId && n.id === menuId) || (url && n.url === url))) { found = [...n.path, n.label]; return; }
        walk(n.children);
      }
    };
    walk(this.menu);
    return found || [];
  }

  syncNavButton() {
    const side = getSettings().nav === 'sidebar';
    if (!this.navBtn) return;
    this.navBtn.replaceChildren(icon(side ? 'ribbon' : 'sidebar'));
    this.navBtn.title = side ? 'Chuyển sang Ribbon (menu ngang)' : 'Chuyển sang Sidebar (menu dọc)';
    this.navBtn.setAttribute('aria-label', this.navBtn.title);
  }

  buildTitlebar() {
    const company = this.sess('company');
    const ctxItems = ['branch', 'period', 'database'].map((k) => this.session.find((x) => x.key === k)).filter(Boolean);
    const ctxBtn = ctxItems.length ? h('button', { class: 'erp-ctxbtn', type: 'button', title: 'Thông tin làm việc', 'aria-haspopup': 'dialog',
      onclick: (/** @type {MouseEvent} */ e) => this.openContext(/** @type {HTMLElement} */ (e.currentTarget)) },
    icon('building'), h('span', {}, ctxItems.slice(0, 2).map((x) => x?.text).join(' · ')), icon('chevron-down')) : null;
    this.navBtn = h('button', { class: 'erp-iconbtn', type: 'button', onclick: () => setSettings({ nav: getSettings().nav === 'ribbon' ? 'sidebar' : 'ribbon' }), dataset: { only: 'wide' } });
    this.syncNavButton();
    const user = this.session.find((x) => x.key === 'user');
    const userBtn = h('button', { class: 'erp-userbtn', type: 'button', 'aria-haspopup': 'menu', onclick: (/** @type {MouseEvent} */ e) => this.openUserMenu(/** @type {HTMLElement} */ (e.currentTarget)) },
      h('span', { class: 'erp-avatar', 'aria-hidden': 'true' }, (user?.text || '?').trim().charAt(0).toUpperCase()),
      h('span', { class: 'erp-userbtn__name' }, user?.text || ''), icon('chevron-down'));
    return h('header', { class: 'erp-titlebar erp-chrome' },
      h('button', { class: 'erp-iconbtn erp-titlebar__menu', type: 'button', 'aria-label': 'Thu gọn / mở rộng menu', title: 'Thu gọn / mở rộng menu (Ctrl+B)', onclick: () => this.toggleNavPanel() }, icon('menu')),
      h('div', { class: 'erp-brand' }, h('span', { class: 'erp-brand__logo', 'aria-hidden': 'true' }),
        h('span', { class: 'erp-brand__text' }, h('strong', {}, cfg.appName || 'ERP'), h('small', {}, company))),
      h('button', { class: 'erp-searchbtn', type: 'button', onclick: () => this.palette(), title: 'Tìm chức năng (Ctrl+K)' },
        icon('search'), h('span', {}, 'Tìm chức năng, màn hình…'), h('kbd', {}, 'Ctrl K')),
      h('div', { class: 'erp-titlebar__actions' },
        ctxBtn,
        h('button', { class: 'erp-iconbtn', type: 'button', title: 'Tìm (Ctrl+K)', 'aria-label': 'Tìm', onclick: () => this.palette(), dataset: { only: 'narrow' } }, icon('search')),
        this.navBtn,
        h('button', { class: 'erp-iconbtn', type: 'button', title: 'Giao diện', 'aria-label': 'Giao diện', onclick: () => openSettingsPanel() }, icon('theme')),
        userBtn));
  }

  /** Bảng thông tin làm việc: công ty, MST, chi nhánh, kỳ, dữ liệu. @param {HTMLElement} anchor */
  openContext(anchor) {
    const keys = ['company', 'tax-code', 'branch', 'period', 'database', 'language'];
    popupMenu(anchor, this.session.filter((x) => keys.includes(x.key)).map((x) => ({
      icon: { company: 'building', 'tax-code': 'form', branch: 'warehouse', period: 'calendar', database: 'system', language: 'info' }[x.key] || 'info',
      label: `${x.label}: ${x.text}`,
    })));
  }

  buildStatusbar() {
    const items = this.session.filter((x) => ['company', 'tax-code', 'database', 'user', 'language'].includes(x.key));
    return h('footer', { class: 'erp-statusbar erp-chrome' },
      ...items.map((x) => h('span', {}, h('small', {}, `${x.label}: `), x.text)),
      h('span', { class: 'erp-statusbar__spacer' }),
      /mock/.test(cfg.sessionUrl || '') ? h('span', { class: 'erp-badge erp-badge--warning' }, 'Dữ liệu mock') : null,
      h('span', {}, `Chuẩn ERP-HTML ${cfg.contractVersion || '1.0'}`));
  }

  buildBottombar() {
    const b = (/** @type {string} */ ic, /** @type {string} */ label, /** @type {()=>void} */ fn) =>
      h('button', { type: 'button', onclick: fn }, icon(ic), h('span', {}, label));
    return h('nav', { class: 'erp-bottombar erp-chrome', 'aria-label': 'Điều hướng nhanh' },
      b('menu', 'Menu', () => this.toggleDrawer()),
      b('home', 'Trang chủ', () => this.tabs?.activateKey('Home')),
      b('search', 'Tìm', () => this.palette()),
      b('columns', 'Đang mở', () => this.tabs?.showTabList()),
      b('theme', 'Giao diện', () => openSettingsPanel()));
  }

  /** Nút ☰ / Ctrl+B: điện thoại ⇒ ngăn kéo menu; Sidebar ⇒ thu gọn/mở rộng; Ribbon ⇒ thu gọn/mở Ribbon. */
  toggleNavPanel() {
    if (innerWidth < 768) { this.toggleDrawer(); return; }
    if (getSettings().nav === 'sidebar') setSettings({ sidebarCollapsed: !getSettings().sidebarCollapsed });
    else this.ribbon?.toggleCollapsed();
  }

  /** @param {boolean} [force] */
  toggleDrawer(force) {
    const on = force ?? !this.root.classList.contains('is-drawer-open');
    this.root.classList.toggle('is-drawer-open', on);
    if (on) this.sidebar?.focusSearch();
  }

  /** @param {HTMLElement} anchor */
  openUserMenu(anchor) {
    const items = [
      ['user', this.sess('user'), null],
      ['key', 'Đổi mật khẩu', () => this.sessionLinks['change-password'] && this.open(this.sessionLinks['change-password'], { target: 'dialog' })],
      ['theme', 'Giao diện & hiển thị', () => openSettingsPanel()],
      ...(installMode() ? [['install', 'Cài ứng dụng lên máy', () => install()]] : []),
      [getSettings().nav === 'ribbon' ? 'sidebar' : 'ribbon', getSettings().nav === 'ribbon' ? 'Dùng Sidebar (menu dọc)' : 'Dùng Ribbon (menu ngang)', () => setSettings({ nav: getSettings().nav === 'ribbon' ? 'sidebar' : 'ribbon' })],
      ['logout', 'Đăng xuất', () => this.logout(this.sessionLinks.logout)],
    ];
    popupMenu(anchor, items.map(([ic, label, fn]) => ({ icon: /** @type {string} */ (ic), label: /** @type {string} */ (label), onClick: /** @type {any} */ (fn) })));
  }

  palette() { openPalette(this); }

  /**
   * Mở URL: target tab (mặc định) / self / dialog / _blank.
   * @param {string} url @param {{ target?: string, title?: string, from?: any }} [opts]
   */
  open(url, opts = {}) {
    if (!url || url === '#') return;
    this.toggleDrawer(false);
    return this.tabs?.open(url, opts);
  }

  /** @param {string} [url] */
  async logout(url) {
    if (this.tabs && !(await this.tabs.closeAll())) return;
    this.showLogin(url);
  }

  /** Màn đăng nhập (form[data-erp=login]). @param {string} [url] */
  async showLogin(url) {
    try {
      const res = await fetchHtml(url || cfg.loginUrl);
      const form = pick(res.doc, 'login');
      if (!form) {
        // BE từ chối có lý do (domain chưa gắn công ty, đang bảo trì…) ⇒ hiện đúng thông điệp đó.
        const msg = readMessages(res.doc).find((m) => m.type === 'error' || m.type === 'warning');
        if (msg) throw Object.assign(new Error(msg.text), { name: 'ErpMessage', msgType: msg.type });
        throw new Error('Backend không trả form đăng nhập (data-erp="login").');
      }
      const el = adopt(form);
      this.root.replaceChildren();
      this.root.className = 'erp-app erp-app--login';
      this.root.removeAttribute('aria-busy');
      el.classList.add('erp-login__form', 'erp-surface');
      enhanceFields(el, null);
      const submitBtn = el.querySelector('button[type=submit],button:not([type])');
      submitBtn?.classList.add('erp-btn', 'erp-btn--primary', 'erp-btn--block');
      const card = h('div', { class: 'erp-login' },
        h('div', { class: 'erp-login__brand' }, h('span', { class: 'erp-brand__logo', 'aria-hidden': 'true' }),
          h('div', {}, h('strong', {}, cfg.appName || 'ERP'), h('small', {}, 'Đăng nhập bằng tài khoản ERP'))),
        el, this.installButton());
      this.root.append(h('div', { class: 'erp-login-page' }, card));
      el.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        submitBtn?.setAttribute('disabled', '');
        try {
          const r = await fetchHtml(el.getAttribute('action') || location.href, { method: 'POST', body: new URLSearchParams(/** @type {any} */ (new FormData(/** @type {HTMLFormElement} */ (el)))) });
          const s = pick(r.doc, 'session');
          if (s) { this.readSession(s); await this.build(); return; }
          const msgs = readMessages(r.doc);
          // Chuẩn mục 5.1: thành công có thể là 303 về homeUrl (hoặc 200 + screen) — không có lỗi và không trả lại form
          // đăng nhập ⇒ nạp lại phiên và vào ứng dụng.
          if (r.ok && !pick(r.doc, 'login') && !msgs.some((m) => m.type === 'error' || m.type === 'warning')) { await this.start(); return; }
          messageBox(msgs.length ? msgs : [{ text: 'Đăng nhập không thành công.', type: 'error' }], 'Đăng nhập');
        } catch (err) {
          toast(String(/** @type {any} */ (err)?.message || err), 'error');
        } finally { submitBtn?.removeAttribute('disabled'); }
      });
      /** @type {HTMLInputElement|null} */ (el.querySelector('input[type=password]'))?.focus();
    } catch (err) { this.fatal(err); }
  }

  bindKeys() {
    document.addEventListener('keydown', (ev) => {
      const k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === 'k') { ev.preventDefault(); this.palette(); return; }
      if ((ev.ctrlKey || ev.metaKey) && k === 'b' && !ev.shiftKey) { ev.preventDefault(); this.toggleNavPanel(); return; }
      if (ev.altKey && k === 'w') { ev.preventDefault(); this.tabs?.closeActive(); return; }
      if ((ev.ctrlKey) && ev.key === 'Tab') { ev.preventDefault(); this.tabs?.cycle(ev.shiftKey ? -1 : 1); return; }
      this.tabs?.handleKey(ev);
    });
  }

  /**
   * Nút "Cài ứng dụng" dưới form đăng nhập: chỉ hiện khi trình duyệt cho cài (sự kiện có thể đến sau khi trang đã vẽ).
   * Tự gỡ theo dõi khi màn đăng nhập bị thay.
   */
  installButton() {
    const btn = h('button', { class: 'erp-btn erp-btn--block', type: 'button', onclick: () => install() }, icon('install'), h('span', {}, 'Cài ứng dụng lên máy'));
    const sync = () => {
      if (!btn.isConnected && btn.dataset.shown) { off(); return; }
      btn.hidden = !installMode();
      btn.dataset.shown = '1';
    };
    const off = onInstallChange(sync);
    sync();
    return btn;
  }

  /** @param {any} err */
  fatal(err) {
    console.error(err);
    this.root.removeAttribute('aria-busy');
    // Mất mạng (thường gặp khi mở app đã cài): nói rõ và tự thử lại khi có mạng.
    const offline = navigator.onLine === false;
    if (offline) addEventListener('online', () => location.reload(), { once: true });
    // Thông điệp do BE gửi (đã kết nối được, nhưng BE từ chối): không gọi là "không kết nối được".
    const fromBe = err?.name === 'ErpMessage';
    this.root.replaceChildren(h('div', { class: 'erp-fatal' }, icon(offline || err?.msgType === 'warning' ? 'warning' : 'error'),
      h('h1', {}, offline ? 'Máy đang mất mạng' : fromBe ? 'Chưa vào được ứng dụng' : 'Không kết nối được backend'),
      h('p', {}, offline ? 'Ứng dụng cần mạng để làm việc với dữ liệu ERP. Kiểm tra Wi-Fi / 4G, khi có mạng trang sẽ tự tải lại.'
        : err instanceof TypeError && /fetch|network|load failed/i.test(err.message) ? 'Không liên lạc được máy chủ ERP. Kiểm tra mạng hoặc thử lại sau ít phút.' : String(err?.message || err)),
      h('button', { class: 'erp-btn erp-btn--primary', type: 'button', onclick: () => location.reload() }, 'Thử lại')));
  }
}

/**
 * Menu bật lên đơn giản.
 * @param {HTMLElement} anchor @param {{icon?:string,label:string,onClick?:(()=>void)|null,disabled?:boolean,checked?:boolean}[]} items
 */
export function popupMenu(anchor, items) {
  document.querySelectorAll('.erp-popmenu').forEach((m) => m.remove());
  const menu = h('div', { class: 'erp-popmenu erp-surface', role: 'menu' },
    ...items.map((it) => it.onClick
      ? h('button', { type: 'button', role: 'menuitem', class: it.checked ? 'is-checked' : '', disabled: it.disabled, onclick: () => { close(); it.onClick?.(); } },
        it.icon ? icon(it.icon) : h('span', { class: 'erp-icon' }), h('span', {}, it.label))
      : h('div', { class: 'erp-popmenu__label' }, it.icon ? icon(it.icon) : null, h('span', {}, it.label))));
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8))}px`;
  menu.style.top = `${r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4}px`;
  const close = () => { menu.remove(); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', esc, true); };
  const outside = (/** @type {Event} */ e) => { if (!menu.contains(/** @type {Node} */ (e.target)) && e.target !== anchor) close(); };
  const esc = (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus(); } };
  setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', esc, true); });
  /** @type {HTMLElement|null} */ (menu.querySelector('button:not([disabled])'))?.focus();
  return { el: menu, close };
}

export { $ };
