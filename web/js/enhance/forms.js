// @ts-check
import { gridsOfForm, gridsIn } from './grid.js';

/**
 * Thu dữ liệu một form để gửi backend (chuẩn ERP-HTML 9, 11.6):
 *  - mọi control có name trong form (kể cả control đặt ngoài form với thuộc tính form=…);
 *  - nút submitter (name/value);
 *  - dòng của các lưới có data-form = id của form: T1[i].__key, T1[i].__state, T1[i].<field>;
 *  - __selected = khóa các dòng đang chọn, khi nút có data-requires-selection.
 * @param {HTMLFormElement} form @param {HTMLElement|null} submitter @returns {[string,string][]}
 */
export function collectFormData(form, submitter) {
  /** @type {FormData} */
  let fd;
  try { fd = new FormData(form, /** @type {any} */ (submitter && isSubmitButton(submitter) ? submitter : undefined)); } catch { fd = new FormData(form); }
  /** @type {[string,string][]} */
  const out = [];
  fd.forEach((v, k) => { if (typeof v === 'string') out.push([k, v]); });
  if (submitter && !isSubmitButton(submitter) && submitter.getAttribute('name')) {
    out.push([submitter.getAttribute('name') || '', submitter.getAttribute('value') || '']);
  }
  if (form.id) for (const g of gridsOfForm(form.id)) out.push(...g.serialize());
  if (submitter?.hasAttribute('data-requires-selection')) {
    const screen = form.closest('[data-erp="screen"]') || document;
    const g = gridsIn(/** @type {HTMLElement} */ (screen))[0];
    g?.selectedKeys().forEach((k) => out.push(['__selected', k]));
  }
  return out;
}

/**
 * Kiểm tra ô bắt buộc / ô sai định dạng trước khi lưu (giao diện chỉ hỗ trợ — backend vẫn kiểm tra lại).
 * Ô nằm ở tab đang ẩn thì mở tab đó trước khi đưa focus vào.
 * @param {HTMLFormElement} form @returns {boolean}
 */
export function validateRecord(form) {
  const controls = /** @type {(HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement)[]} */ (Array.from(form.querySelectorAll('input, select, textarea')));
  /** @type {HTMLElement|null} */ let first = null;
  for (const c of controls) {
    if (c.disabled || c.readOnly || c.type === 'hidden') continue;
    const empty = c.type === 'checkbox' ? false : !String(c.value).trim();
    const bad = (c.required && empty) || c.getAttribute('aria-invalid') === 'true';
    const box = c.closest('[data-erp="field"]');
    box?.toggleAttribute('data-invalid', bad);
    if (bad && !first) first = c;
  }
  if (first) {
    const tab = first.closest('fieldset[data-erp="tab"]');
    if (tab && /** @type {HTMLElement} */ (tab).hidden) tab.dispatchEvent(new CustomEvent('erp:show-tab', { bubbles: true }));
    setTimeout(() => first?.focus(), 30);
    return false;
  }
  if (form.id) for (const g of gridsOfForm(form.id)) if (!g.validate()) return false;
  return true;
}

/** @param {HTMLElement} el */
function isSubmitButton(el) {
  return (el.tagName === 'BUTTON' && (/** @type {HTMLButtonElement} */ (el).type === 'submit')) || (el.tagName === 'INPUT' && /** @type {HTMLInputElement} */ (el).type === 'submit');
}

/** Response không có nội dung ERP nào (backend có thể trả 204/200 rỗng). @param {import('../core/http.js').HtmlResponse} res */
export function isEmptyResponse(res) {
  return res.ok && !res.doc.body.querySelector('[data-erp]') && !(res.doc.body.textContent || '').trim();
}

/**
 * Chặn điều hướng/gửi form mặc định trong phạm vi root; chuyển cho TabContext.
 * @param {HTMLElement} root @param {import('../shell/tabs.js').TabContext} ctx
 */
export function interceptNavigation(root, ctx) {
  root.addEventListener('submit', (ev) => {
    const form = /** @type {HTMLFormElement} */ (ev.target);
    if (!(form instanceof HTMLFormElement)) return;
    ev.preventDefault();
    const submitter = /** @type {HTMLElement|null} */ (/** @type {SubmitEvent} */ (ev).submitter || null);
    if (submitter?.hasAttribute('data-pending') || submitter?.hasAttribute('disabled')) return;
    ctx.submit(form, submitter);
  });
  root.addEventListener('click', (ev) => {
    const t = /** @type {HTMLElement} */ (ev.target);
    // composedPath() giữ đường đi lúc phát sự kiện — đúng cả khi phần tử đã bị vẽ lại (vd lưới cập nhật dòng chọn)
    const a = /** @type {HTMLAnchorElement|undefined} */ (ev.composedPath().find((n) => n instanceof HTMLAnchorElement && n.hasAttribute('href')));
    if (a) {
      if (ev.defaultPrevented || ev.button !== 0) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#')) { ev.preventDefault(); return; }
      ev.preventDefault();
      if (a.getAttribute('aria-disabled') === 'true') return;
      const action = a.getAttribute('data-action');
      if (action === 'logout') { ctx.shell.logout(href); return; }
      let target = a.getAttribute('data-target') || (a.hasAttribute('download') ? '_blank' : 'tab');
      if (ev.ctrlKey || ev.metaKey) target = 'tab';
      const confirmMsg = a.getAttribute('data-confirm');
      if (confirmMsg && !window.confirm(confirmMsg)) return;
      ctx.navigate(href, target);
      return;
    }
    const b = /** @type {HTMLButtonElement|null} */ (t.closest('button[data-action="close"]'));
    if (b && root.contains(b) && b.type !== 'submit') { ev.preventDefault(); ctx.dialog?.close(); }
  });
}
