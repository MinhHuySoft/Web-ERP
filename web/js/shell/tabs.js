// @ts-check
import { h, uid } from '../core/dom.js';
import { fetchHtml, pick, pickAll, adopt } from '../core/http.js';
import { icon } from '../core/icons.js';
import { toast, confirmBox, messageBox, openDialog, setBusy } from '../core/ui.js';
import { pushRecent, toggleFavorite, isFavorite } from '../core/settings.js';
import { enhanceScreen, enhanceFragment } from '../enhance/screen.js';
import { readMessages } from '../enhance/messages.js';
import { collectFormData, isEmptyResponse, validateRecord } from '../enhance/forms.js';
import { popupMenu } from './shell.js';

/**
 * @typedef {{ id:string, url:string, key:string, title:string, btn:HTMLElement, panel:HTMLElement, dirty:boolean,
 *   pinned:boolean, keys: Map<string, (ev:KeyboardEvent)=>void>, ctrl: TabContext|null }} Tab
 */

/**
 * Ngữ cảnh mà các bộ nâng cấp (enhance/*) dùng để điều hướng, gửi form, đăng ký phím tắt.
 * @typedef {{ tab: Tab|null, shell: any, navigate:(url:string, target?:string)=>Promise<void>|void,
 *   submit:(form:HTMLFormElement, submitter?:HTMLElement|null, extra?:[string,string][])=>Promise<void>,
 *   reload:()=>void, setDirty:(d:boolean)=>void, registerKey:(combo:string, fn:(ev:KeyboardEvent)=>void)=>void,
 *   dialog?: { close:()=>void, body:HTMLElement }|null }} TabContext
 */

export class TabManager {
  /** @param {any} shell @param {HTMLElement} host thanh chứa tab (.erp-docbar) @param {HTMLElement} workspace */
  constructor(shell, host, workspace) {
    this.shell = shell;
    this.workspace = workspace;
    // Thanh tab: vùng cuộn (ẩn thanh cuộn) + nút cuộn trái/phải + danh sách mọi tab đang mở
    this.bar = h('div', { class: 'erp-docbar__tabs', role: 'tablist', 'aria-label': 'Màn hình đang mở' });
    const scroll = (/** @type {number} */ d) => this.bar.scrollBy({ left: d * Math.max(200, this.bar.clientWidth * 0.6), behavior: 'smooth' });
    this.prevBtn = h('button', { type: 'button', class: 'erp-docbar__nav', 'aria-label': 'Cuộn tab sang trái', onclick: () => scroll(-1) }, icon('prev'));
    this.nextBtn = h('button', { type: 'button', class: 'erp-docbar__nav', 'aria-label': 'Cuộn tab sang phải', onclick: () => scroll(1) }, icon('next'));
    this.listBtn = h('button', { type: 'button', class: 'erp-docbar__nav erp-docbar__list', title: 'Danh sách màn hình đang mở', 'aria-label': 'Danh sách màn hình đang mở',
      onclick: () => this.showTabList(this.listBtn) }, icon('chevron-down'), h('span', { class: 'erp-docbar__count' }, '0'));
    host.append(this.prevBtn, this.bar, this.nextBtn, this.listBtn);
    const sync = () => {
      const over = this.bar.scrollWidth > this.bar.clientWidth + 2;
      host.classList.toggle('is-overflow', over);
      this.prevBtn.toggleAttribute('disabled', this.bar.scrollLeft <= 0);
      this.nextBtn.toggleAttribute('disabled', this.bar.scrollLeft + this.bar.clientWidth >= this.bar.scrollWidth - 2);
    };
    this.syncBar = sync;
    this.bar.addEventListener('scroll', sync, { passive: true });
    new ResizeObserver(sync).observe(this.bar);
    this.bar.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { this.bar.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    /** @type {Tab[]} */ this.tabs = [];
    /** @type {Tab|null} */ this.active = null;
    window.addEventListener('beforeunload', (ev) => { if (this.tabs.some((t) => t.dirty)) { ev.preventDefault(); ev.returnValue = ''; } });
  }

  /**
   * @param {string} url
   * @param {{ target?: string, title?: string, pinned?: boolean, from?: Tab|null }} [opts]
   */
  async open(url, opts = {}) {
    const target = opts.target || 'tab';
    if (target === '_blank') return this.download(url);
    if (target === 'dialog') return this.openInDialog(url, opts.from || this.active);
    if (target === 'self' && (opts.from || this.active)) return this.load(/** @type {Tab} */ (opts.from || this.active), url);
    const existing = this.tabs.find((t) => t.url === url);
    if (existing) { this.activate(existing); return; }
    const tab = this.createTab(opts.title || 'Đang tải…', !!opts.pinned);
    await this.load(tab, url, true);
  }

  /** @param {string} title @param {boolean} pinned @returns {Tab} */
  createTab(title, pinned) {
    const id = uid('tab');
    const label = h('span', { class: 'erp-doctab__label' }, title);
    const btn = h('div', { class: 'erp-doctab', role: 'tab', id: `${id}-btn`, 'aria-controls': id, 'aria-selected': 'false', tabindex: '-1' },
      h('button', { type: 'button', class: 'erp-doctab__main', onclick: () => this.activate(tab), onauxclick: (/** @type {MouseEvent} */ e) => { if (e.button === 1 && !pinned) this.close(tab); } },
        pinned ? icon('home') : null, label, h('span', { class: 'erp-doctab__dirty', title: 'Có thay đổi chưa lưu', 'aria-hidden': 'true' })),
      pinned ? null : h('button', { type: 'button', class: 'erp-doctab__close', 'aria-label': `Đóng ${title}`, onclick: () => this.close(tab) }, icon('close')));
    btn.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.tabMenu(tab, btn); });
    const panel = h('section', { class: 'erp-tabpanel', id, role: 'tabpanel', 'aria-labelledby': `${id}-btn`, hidden: true });
    /** @type {Tab} */
    const tab = { id, url: '', key: '', title, btn, panel, dirty: false, pinned, keys: new Map(), ctrl: null };
    this.bar.append(btn);
    this.workspace.append(panel);
    this.tabs.push(tab);
    this.activate(tab);
    return tab;
  }

  /** @param {Tab} tab */
  activate(tab) {
    this.active = tab;
    for (const t of this.tabs) {
      const on = t === tab;
      t.btn.setAttribute('aria-selected', String(on));
      t.btn.classList.toggle('is-active', on);
      t.panel.hidden = !on;
    }
    tab.btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.syncCount();
    this.shell.onActiveTab?.(tab);
  }

  syncCount() {
    const c = this.listBtn?.querySelector('.erp-docbar__count');
    if (c) c.textContent = String(this.tabs.length);
    this.syncBar?.();
  }

  /** @param {string} key */
  activateKey(key) { const t = this.tabs.find((x) => x.key === key); if (t) this.activate(t); }

  /** @param {number} dir */
  cycle(dir) {
    if (!this.tabs.length || !this.active) return;
    const i = this.tabs.indexOf(this.active);
    this.activate(this.tabs[(i + dir + this.tabs.length) % this.tabs.length]);
  }

  /** @param {Tab} tab @param {string} title */
  setTitle(tab, title) {
    tab.title = title;
    const l = tab.btn.querySelector('.erp-doctab__label');
    if (l) l.textContent = title;
    tab.btn.title = title;
  }

  /** @param {Tab} tab @param {boolean} d */
  setDirty(tab, d) { tab.dirty = d; tab.btn.classList.toggle('is-dirty', d); }

  /** @param {Tab} tab */
  async close(tab) {
    if (tab.pinned) return true;
    if (tab.dirty && !(await confirmBox(`"${tab.title}" có thay đổi chưa lưu. Đóng và bỏ thay đổi?`, { ok: 'Đóng, bỏ thay đổi', tone: 'danger' }))) return false;
    const i = this.tabs.indexOf(tab);
    this.tabs.splice(i, 1);
    tab.btn.remove();
    tab.panel.remove();
    if (this.active === tab) { const n = this.tabs[Math.min(i, this.tabs.length - 1)]; if (n) this.activate(n); else this.active = null; }
    this.syncCount();
    return true;
  }

  closeActive() { if (this.active) this.close(this.active); }

  async closeAll() {
    for (const t of [...this.tabs]) { if (!t.pinned && !(await this.close(t))) return false; }
    return true;
  }

  /** @param {Tab} tab @param {HTMLElement} anchor */
  tabMenu(tab, anchor) {
    popupMenu(anchor, [
      { icon: 'reload', label: 'Nạp lại', onClick: () => this.load(tab, tab.url) },
      { icon: 'star', label: isFavorite(tab.url) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích', onClick: () => { toast(toggleFavorite({ url: tab.url, title: tab.title }) ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích', 'success', 2000); } },
      { icon: 'close', label: 'Đóng', onClick: () => this.close(tab), disabled: tab.pinned },
      { icon: 'close', label: 'Đóng các tab khác', onClick: async () => { for (const t of [...this.tabs]) if (t !== tab && !t.pinned && !(await this.close(t))) break; } },
    ]);
  }

  /** @param {HTMLElement} [anchorEl] */
  showTabList(anchorEl) {
    const anchor = anchorEl || /** @type {HTMLElement} */ (document.querySelector('.erp-bottombar') || this.bar);
    popupMenu(anchor, [
      ...this.tabs.map((t) => ({ icon: t.pinned ? 'home' : 'form', label: t.title + (t.dirty ? ' •' : ''), checked: t === this.active, onClick: () => this.activate(t) })),
      ...(this.tabs.length > 2 ? [{ icon: 'close', label: 'Đóng tất cả (trừ Trang chủ)', onClick: () => this.closeAll() }] : []),
    ]);
  }

  /** Phím tắt: phím của tab đang mở trước, rồi phím chung. @param {KeyboardEvent} ev */
  handleKey(ev) {
    if (!this.active || document.querySelector('dialog[open]')) return;
    const combo = comboOf(ev);
    const fn = this.active.keys.get(combo);
    if (fn) { ev.preventDefault(); fn(ev); return; }
    if (combo === 'F5') { ev.preventDefault(); this.load(this.active, this.active.url); }
  }

  /** @param {Tab} tab @returns {TabContext} */
  ctx(tab) {
    return {
      tab, shell: this.shell,
      navigate: (url, target = 'tab') => this.open(url, { target, from: tab }),
      submit: (form, submitter, extra) => this.submit(tab, form, submitter, extra),
      reload: () => this.load(tab, tab.url),
      setDirty: (d) => this.setDirty(tab, d),
      registerKey: (combo, fn) => tab.keys.set(combo, fn),
    };
  }

  /** Tải URL vào tab. @param {Tab} tab @param {string} url @param {boolean} [fresh] */
  async load(tab, url, fresh = false) {
    if (!fresh && tab.dirty && !(await confirmBox('Màn hình có thay đổi chưa lưu. Tiếp tục và bỏ thay đổi?', { ok: 'Tiếp tục', tone: 'danger' }))) return;
    setBusy(this.workspace, true);
    try {
      const res = await fetchHtml(url, { tabId: tab.id });
      await this.handle(res, tab, { fresh });
    } catch (err) {
      this.renderError(tab, err, url);
    } finally { setBusy(this.workspace, false); }
  }

  /**
   * Xử lý response HTML chung cho điều hướng và gửi form (chuẩn ERP-HTML mục 3.2, 13, 14).
   * @param {import('../core/http.js').HtmlResponse} res @param {Tab} tab
   * @param {{ fresh?: boolean, form?: HTMLFormElement, formData?: [string,string][], dialog?: any }} [o]
   */
  async handle(res, tab, o = {}) {
    if (res.status === 401) { await this.shell.showLogin(); return; }
    const confirm = pick(res.doc, 'confirm');
    if (confirm) { await this.askConfirm(confirm, tab, o); if (o.fresh && !tab.key) this.close(tab); return; }
    const screen = pick(res.doc, 'screen');
    const dialog = pick(res.doc, 'dialog');
    const msgs = readMessages(res.doc, screen);
    if (screen) {
      const key = screen.getAttribute('data-screen-key') || '';
      const dup = o.fresh ? this.tabs.find((t) => t !== tab && t.key && t.key === key) : null;
      if (dup) { this.close(tab); this.activate(dup); return; }
      if (o.dialog) o.dialog.close();
      this.render(tab, adopt(screen), res.url);
    } else if (o.fresh && !tab.key) {
      // tab mới mà không có màn hình ⇒ không giữ tab rỗng
      this.close(tab);
    }
    if (dialog) this.showDialog(adopt(dialog), tab, o.dialog);
    if (!screen) this.showMessages(msgs, !dialog, o.dialog);
    if (!res.ok && !screen && !dialog && !msgs.length) messageBox([{ text: `Backend trả lỗi ${res.status}.`, type: 'error' }]);
    if (screen && !res.ok && !msgs.length) toast(`Backend trả mã ${res.status}`, 'warning');
  }

  /** @param {Tab} tab @param {HTMLElement} screen @param {string} url */
  render(tab, screen, url) {
    tab.keys.clear();
    tab.url = url;
    tab.key = screen.getAttribute('data-screen-key') || url;
    const title = screen.querySelector('h1')?.textContent?.trim() || 'Màn hình';
    this.setTitle(tab, title);
    tab.panel.replaceChildren(screen);
    const ctx = this.ctx(tab);
    tab.ctrl = ctx;
    this.setDirty(tab, false);
    enhanceScreen(screen, ctx);
    if (!tab.pinned) pushRecent({ url, title, screenId: screen.getAttribute('data-screen-id') || '' });
    tab.panel.scrollTop = 0;
    if (this.active === tab) this.shell.onActiveTab?.(tab);
  }

  /** @param {{text:string,type:string,field?:string}[]} msgs @param {boolean} modalForErrors @param {any} [dialog] */
  showMessages(msgs, modalForErrors, dialog) {
    if (!msgs.length) return;
    const errors = msgs.filter((m) => m.type === 'error' || m.type === 'warning');
    msgs.filter((m) => m.type === 'success' || m.type === 'info').forEach((m) => toast(m.text, /** @type {any} */ (m.type)));
    if (errors.length) {
      if (modalForErrors) messageBox(errors, 'Không thực hiện được');
      else errors.forEach((m) => toast(m.text, /** @type {any} */ (m.type), 7000));
    } else if (dialog) dialog.close();
  }

  /**
   * Gửi form theo chuẩn: GET ⇒ điều hướng self với query; POST ⇒ FormData + dòng lưới.
   * @param {Tab} tab @param {HTMLFormElement} form @param {HTMLElement|null} [submitter] @param {[string,string][]} [extra] @param {any} [dialog]
   */
  async submit(tab, form, submitter, extra = [], dialog = null) {
    const method = (submitter?.getAttribute('formmethod') || form.getAttribute('method') || 'get').toUpperCase();
    const action = submitter?.getAttribute('formaction') || form.getAttribute('action') || tab.url;
    const act = submitter?.getAttribute('data-action') || '';
    if (method === 'POST' && (act === 'save' || act === 'save-new') && !validateRecord(form)) {
      toast('Còn ô bắt buộc chưa nhập hoặc nhập sai định dạng.', 'error');
      return;
    }
    const msg = submitter?.getAttribute('data-confirm');
    if (msg && !(await confirmBox(msg, { ok: submitter?.textContent?.trim() || 'Đồng ý', tone: submitter?.getAttribute('data-action') === 'delete' ? 'danger' : 'warning' }))) return;
    const data = [...collectFormData(form, submitter || null), ...extra];
    if (method === 'GET') {
      const u = new URL(action, location.href);
      for (const [k, v] of data) if (v !== '' && !k.startsWith('__')) u.searchParams.set(k, v);
      return this.open(u.href, { target: dialog ? 'dialog' : 'self', from: tab });
    }
    const btns = /** @type {HTMLButtonElement[]} */ (Array.from(tab.panel.querySelectorAll('button')));
    btns.forEach((b) => b.toggleAttribute('data-pending', true));
    setBusy(this.workspace, true);
    try {
      let body;
      if (form.enctype === 'multipart/form-data') {
        // giữ nguyên file đính kèm: dùng FormData gốc của form + phần bổ sung (dòng lưới, xác nhận)
        body = new FormData(form, /** @type {any} */ (submitter?.matches?.('button,input[type=submit]') ? submitter : undefined));
        extra.forEach(([k, v]) => /** @type {FormData} */ (body).append(k, v));
      } else body = new URLSearchParams(data);
      const res = await fetchHtml(action, { method: 'POST', body, tabId: tab.id });
      if (isEmptyResponse(res)) { toast('Đã gửi.', 'success'); if (dialog) dialog.close(); return; }
      await this.handle(res, tab, { form, formData: data, dialog });
    } catch (err) {
      messageBox([{ text: `Không gửi được dữ liệu: ${String(/** @type {any} */ (err)?.message || err)}`, type: 'error' }]);
    } finally {
      btns.forEach((b) => b.removeAttribute('data-pending'));
      setBusy(this.workspace, false);
    }
  }

  /** Hỏi xác nhận (data-erp=confirm), gửi lại kèm toàn bộ dữ liệu form gốc. @param {HTMLElement} confirmForm @param {Tab} tab @param {any} o */
  async askConfirm(confirmForm, tab, o) {
    const texts = Array.from(confirmForm.querySelectorAll('[data-erp="message"]')).map((p) => p.textContent?.trim() || '').filter(Boolean);
    const buttons = /** @type {HTMLButtonElement[]} */ (Array.from(confirmForm.querySelectorAll('button[name]')));
    const yes = buttons.find((b) => b.getAttribute('data-action') === 'confirm-yes') || buttons[0];
    const no = buttons.find((b) => b !== yes);
    const ok = await confirmBox(h('div', {}, ...texts.map((t) => h('p', {}, t))), { title: 'Cần xác nhận', ok: yes?.textContent?.trim() || 'Tiếp tục', cancel: no?.textContent?.trim() || 'Hủy' });
    const answer = ok ? yes : no;
    if (!answer) return;
    /** @type {[string,string][]} */
    const data = [...(o.formData || []).filter(([k]) => k !== '__answer')];
    for (const inp of Array.from(confirmForm.querySelectorAll('input[name]'))) data.push([/** @type {HTMLInputElement} */ (inp).name, /** @type {HTMLInputElement} */ (inp).value]);
    data.push([answer.name, answer.value]);
    if (!ok && !confirmForm.getAttribute('action')) return;
    const res = await fetchHtml(confirmForm.getAttribute('action') || tab.url, { method: 'POST', body: new URLSearchParams(data), tabId: tab.id });
    await this.handle(res, tab, { ...o, formData: data });
  }

  /** @param {string} url @param {Tab|null} origin */
  async openInDialog(url, origin) {
    try {
      const res = await fetchHtml(url, { tabId: origin?.id });
      const dlg = pick(res.doc, 'dialog');
      if (dlg) { this.showDialog(adopt(dlg), origin, null); return; }
      const screen = pick(res.doc, 'screen');
      if (screen) {
        const s = adopt(screen);
        const d = openDialog({ title: s.querySelector('h1')?.textContent || '', body: s, size: 'lg' });
        s.querySelector('h1')?.remove();
        enhanceFragment(s, this.dialogCtx(origin, d));
        return;
      }
      this.showMessages(readMessages(res.doc), true);
    } catch (err) { messageBox([{ text: String(/** @type {any} */ (err)?.message || err), type: 'error' }]); }
  }

  /** @param {HTMLElement} section @param {Tab|null} origin @param {any} existing */
  showDialog(section, origin, existing) {
    const title = section.querySelector(':scope > h1')?.textContent?.trim() || '';
    section.querySelector(':scope > h1')?.remove();
    const size = /** @type {any} */ (section.getAttribute('data-size') || 'md');
    if (existing) { existing.body.replaceChildren(section); existing.setTitle?.(title); enhanceFragment(section, this.dialogCtx(origin, existing)); return; }
    const d = openDialog({ title, body: section, size });
    enhanceFragment(section, this.dialogCtx(origin, d));
  }

  /** @param {Tab|null} origin @param {any} d @returns {TabContext} */
  dialogCtx(origin, d) {
    const base = origin ? this.ctx(origin) : /** @type {any} */ ({ tab: null, shell: this.shell, setDirty() {}, registerKey() {}, reload() {} });
    return {
      ...base,
      dialog: d,
      navigate: (url, target = 'tab') => { if (target !== 'dialog') d.close(); return this.open(url, { target, from: origin }); },
      submit: (form, submitter, extra) => (origin ? this.submit(origin, form, submitter, extra, d) : Promise.resolve()),
    };
  }

  /** Tải file (_blank / download): HTML ⇒ hiển thị thông điệp; file ⇒ tải về. @param {string} url */
  async download(url) {
    try {
      const res = await fetch(url, { credentials: 'include', headers: { Accept: '*/*', 'X-ERP-Request': 'fragment' } });
      const type = res.headers.get('Content-Type') || '';
      if (type.includes('text/html')) {
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        this.showMessages(readMessages(doc), true);
        return;
      }
      const blob = await res.blob();
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(res.headers.get('Content-Disposition') || '')?.[1];
      const a = h('a', { href: URL.createObjectURL(blob), download: name ? decodeURIComponent(name) : '' });
      if (!name && type.includes('pdf')) { window.open(/** @type {HTMLAnchorElement} */ (a).href, '_blank', 'noopener'); return; }
      document.body.append(a); a.click(); a.remove();
    } catch (err) { messageBox([{ text: `Không tải được: ${String(/** @type {any} */ (err)?.message || err)}`, type: 'error' }]); }
  }

  /** @param {Tab} tab @param {any} err @param {string} url */
  renderError(tab, err, url) {
    if (!tab.key) this.setTitle(tab, 'Lỗi');
    tab.panel.replaceChildren(h('div', { class: 'erp-empty erp-empty--error' }, icon('error'), h('h2', {}, 'Không tải được màn hình'),
      h('p', {}, String(err?.message || err)), h('button', { class: 'erp-btn', type: 'button', onclick: () => this.load(tab, url, true) }, icon('reload'), 'Thử lại')));
  }
}

/** @param {KeyboardEvent} ev */
export function comboOf(ev) {
  const parts = [];
  if (ev.ctrlKey || ev.metaKey) parts.push('Ctrl');
  if (ev.altKey) parts.push('Alt');
  if (ev.shiftKey) parts.push('Shift');
  let k = ev.key;
  if (k === ' ') k = 'Space';
  else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join('+');
}

