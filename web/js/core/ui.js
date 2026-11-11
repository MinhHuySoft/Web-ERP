// @ts-check
import { h } from './dom.js';
import { icon } from './icons.js';

/* ----------------------------------------------------------------------------------------------------------------
 * Toast
 * -------------------------------------------------------------------------------------------------------------- */
/** @type {HTMLElement|null} */
let toastHost = null;

const TOAST_TITLE = { success: 'Thành công', info: 'Thông báo', warning: 'Cảnh báo', error: 'Có lỗi' };
const TOAST_MAX = 4;

/**
 * Toast: thẻ nổi góc dưới phải — biểu tượng theo loại, tiêu đề + nội dung, thanh đếm thời gian.
 * Rê chuột vào thì dừng đếm; trùng nội dung đang hiện thì làm mới thay vì chồng thêm; tối đa 4 cái.
 * `ms` = 0: không tự đóng.
 * @param {string} text @param {'info'|'success'|'warning'|'error'} [type] @param {number} [ms]
 */
export function toast(text, type = 'info', ms = 4500) {
  if (!toastHost) {
    toastHost = h('div', { class: 'erp-toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const dup = /** @type {any} */ (Array.from(toastHost.children).find((x) => !x.classList.contains('is-leaving')
    && /** @type {HTMLElement} */ (x).dataset.tone === type && /** @type {HTMLElement} */ (x).dataset.text === text));
  if (dup) { dup.restart?.(); return; }

  let timer = 0, left = ms, started = 0;
  const dismiss = () => {
    if (el.classList.contains('is-leaving')) return;
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  const run = () => { if (left > 0) { started = Date.now(); timer = window.setTimeout(dismiss, left); } };
  const bar = ms > 0 ? h('span', { class: 'erp-toast__bar', style: `animation-duration:${ms}ms` }) : null;
  const el = /** @type {any} */ (h('div', { class: `erp-toast erp-toast--${type}`, role: type === 'error' ? 'alert' : 'status', dataset: { tone: type, text },
    onmouseenter: () => { if (ms > 0) { clearTimeout(timer); left -= Date.now() - started; } },
    onmouseleave: run },
    h('span', { class: 'erp-toast__icon', 'aria-hidden': 'true' }, icon(type === 'error' ? 'error' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info')),
    h('div', { class: 'erp-toast__body' }, h('strong', { class: 'erp-toast__title' }, TOAST_TITLE[type] || TOAST_TITLE.info), h('span', { class: 'erp-toast__text' }, text)),
    h('button', { class: 'erp-iconbtn erp-toast__close', type: 'button', 'aria-label': 'Đóng thông báo', onclick: dismiss }, icon('close')),
    bar));
  el.restart = () => {
    clearTimeout(timer); left = ms; run();
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
  };
  toastHost.append(el);
  const live = Array.from(toastHost.children).filter((x) => !x.classList.contains('is-leaving'));
  live.slice(0, Math.max(0, live.length - TOAST_MAX)).forEach((x) => /** @type {HTMLElement} */ (x).querySelector('.erp-toast__close')?.dispatchEvent(new MouseEvent('click')));
  run();
}

/* ----------------------------------------------------------------------------------------------------------------
 * Hộp thoại (dùng <dialog> gốc của trình duyệt)
 * -------------------------------------------------------------------------------------------------------------- */
/**
 * @param {{ title?: string, body?: Node|null, size?: 'sm'|'md'|'lg'|'full', footer?: Node[]|null,
 *   onClose?: (()=>void)|null, closable?: boolean, className?: string }} opts
 */
export function openDialog(opts) {
  const dlg = /** @type {HTMLDialogElement} */ (h('dialog', { class: `erp-dialog erp-dialog--${opts.size || 'md'} ${opts.className || ''}` }));
  const close = () => { if (dlg.open) dlg.close(); };
  const head = h('header', { class: 'erp-dialog__head' },
    h('h2', { class: 'erp-dialog__title' }, opts.title || ''),
    opts.closable === false ? null : h('button', { class: 'erp-iconbtn', type: 'button', 'aria-label': 'Đóng', onclick: close }, icon('close')));
  const body = h('div', { class: 'erp-dialog__body' });
  if (opts.body) body.append(opts.body);
  dlg.append(head, body);
  if (opts.footer?.length) dlg.append(h('footer', { class: 'erp-dialog__foot' }, ...opts.footer));
  dlg.addEventListener('close', () => { opts.onClose?.(); dlg.remove(); });
  dlg.addEventListener('cancel', (ev) => { if (opts.closable === false) ev.preventDefault(); });
  document.body.append(dlg);
  dlg.showModal();
  return { el: dlg, body, close, setTitle: (/** @type {string} */ t) => { head.querySelector('h2').textContent = t; } };
}

/**
 * @param {string|Node} message
 * @param {{ title?: string, ok?: string, cancel?: string, tone?: 'warning'|'danger'|'info' }} [o]
 * @returns {Promise<boolean>}
 */
export function confirmBox(message, o = {}) {
  return new Promise((resolve) => {
    let result = false;
    const ok = h('button', { class: 'erp-btn erp-btn--primary', type: 'button', onclick: () => { result = true; d.close(); } }, o.ok || 'Đồng ý');
    const cancel = h('button', { class: 'erp-btn', type: 'button', onclick: () => d.close() }, o.cancel || 'Hủy');
    const body = h('div', { class: `erp-confirm erp-confirm--${o.tone || 'warning'}` }, icon(o.tone === 'danger' ? 'error' : 'warning'),
      typeof message === 'string' ? h('p', {}, message) : message);
    const d = openDialog({ title: o.title || 'Xác nhận', body, size: 'sm', footer: [cancel, ok], onClose: () => resolve(result) });
    ok.focus();
  });
}

/** Hiển thị danh sách thông điệp lỗi/cảnh báo trong hộp thoại. @param {{text:string, type:string}[]} msgs @param {string} [title] */
export function messageBox(msgs, title = 'Thông báo') {
  const list = h('ul', { class: 'erp-msglist' }, ...msgs.map((m) => h('li', { class: `erp-msg erp-msg--${m.type}` }, icon(m.type === 'success' ? 'success' : m.type === 'info' ? 'info' : m.type === 'warning' ? 'warning' : 'error'), h('span', {}, m.text))));
  const ok = h('button', { class: 'erp-btn erp-btn--primary', type: 'button', onclick: () => d.close() }, 'Đóng');
  const d = openDialog({ title, body: list, size: 'sm', footer: [ok] });
  ok.focus();
  return d;
}

/** Thanh tiến trình mỏng trên đầu vùng làm việc. @param {HTMLElement} el @param {boolean} on */
export function setBusy(el, on) {
  el.toggleAttribute('data-busy', on);
  el.setAttribute('aria-busy', on ? 'true' : 'false');
}
