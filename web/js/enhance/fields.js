// @ts-check
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatNumber, parseNumber, toInvariant, formatDate, parseDate } from '../core/format.js';
import { attachLookup } from './lookup.js';

const NUMERIC = new Set(['number', 'money', 'quantity', 'percent']);

/**
 * Nâng cấp mọi [data-erp=field] trong root (chuẩn ERP-HTML 9.2): bố cục lưới 40 cột, ô số định dạng VN, tra cứu F4,
 * công tắc, ô mật khẩu, tự giãn textarea, đánh dấu bắt buộc / lỗi, theo dõi thay đổi.
 * @param {HTMLElement} root @param {import('../shell/tabs.js').TabContext|null} ctx
 */
export function enhanceFields(root, ctx) {
  for (const box of /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll('[data-erp="field"]')))) {
    if (box.dataset.enhanced) continue;
    box.dataset.enhanced = '1';
    enhanceField(box);
  }
  // Vùng chứa ô: fieldset tab, filter, form trong dialog, login
  for (const c of [root, ...Array.from(root.querySelectorAll('fieldset, form'))]) {
    if (c instanceof HTMLElement && c.querySelector(':scope > [data-erp="field"]')) c.classList.add('erp-fields');
  }
  if (ctx) trackDirty(root, ctx);
}

/**
 * Số cột tối thiểu (lưới 40 cột) để ô không cắt chữ. Lưới WinForms dùng font nhỏ hơn, nên LYT SizeX 3–4 của ô ngày / ô chọn
 * trên web quá hẹp: ô ngày cần đủ "dd/mm/yyyy" + nút lịch, ô chọn cần nhãn nằm trên một dòng (tối đa 12 cột).
 * @param {string} ctl @param {string} label
 */
function minSpan(ctl, label) {
  if (ctl === 'date') return 5;
  if (ctl === 'datetime') return 7;
  if (ctl === 'checkbox') return Math.min(12, Math.ceil((label.length * 7 + 58) / 33));
  // Nút: chữ (~7,5 px/ký tự) + lề trong + viền phải nằm gọn trong khung (LYT SizeX 3–4 của WinForms hẹp hơn với font web).
  if (ctl === 'button') return Math.min(16, Math.ceil((label.length * 7.5 + 42) / 33));
  return 1;
}

/** @param {HTMLElement} box */
function enhanceField(box) {
  const ctl = box.dataset.control || 'text';
  box.classList.add('erp-field', `erp-field--${ctl}`);
  const caption = (box.querySelector(':scope > label') || (ctl === 'button' ? box.querySelector(':scope > button, :scope > a') : null))?.textContent?.trim() || '';
  const span = clamp(Math.max(Number(box.dataset.span || 10), minSpan(ctl, caption)), 1, 40);
  box.style.setProperty('--span', String(span));
  // Màn vừa: lưới 20 cột (tỷ lệ giữ nguyên, tối thiểu 1/4 dòng). Màn hẹp: lưới 4 cột (ô ngắn 1/2, còn lại cả dòng).
  box.style.setProperty('--span-md', String(clamp(Math.round(span / 2), 5, 20)));
  const shortCtl = ['date', 'checkbox', 'number', 'money', 'quantity', 'percent', 'select'].includes(ctl);
  box.style.setProperty('--span-m', box.dataset.spanMobile ? String(clamp(Number(box.dataset.spanMobile), 1, 4)) : (span <= 8 && shortCtl ? '2' : '4'));
  if (box.hasAttribute('data-row-start')) box.classList.add('is-row-start');
  if (box.dataset.rows && Number(box.dataset.rows) > 1) box.style.setProperty('--rows', box.dataset.rows);
  if (box.dataset.gapAfter) {
    const gap = h('div', { class: 'erp-field-gap', 'aria-hidden': 'true' });
    gap.style.setProperty('--span', String(clamp(Number(box.dataset.gapAfter), 1, 39)));
    box.after(gap);
  }
  const label = box.querySelector(':scope > label');
  const control = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|null} */ (box.querySelector(':scope input:not([type=hidden]), :scope select, :scope textarea'));
  if (label) label.classList.add('erp-field__label');
  if (control?.required && label) label.classList.add('is-required');
  if (control && (control.hasAttribute('readonly') || control.disabled)) box.classList.add('is-readonly');
  if (box.hasAttribute('data-invalid')) control?.setAttribute('aria-invalid', 'true');
  const err = box.querySelector('[data-erp="error"]');
  if (err && control) { err.id = err.id || `${control.id}-err`; control.setAttribute('aria-describedby', err.id); }

  if (NUMERIC.has(ctl) && control instanceof HTMLInputElement) return numeric(control, ctl);
  if (ctl === 'date' && control instanceof HTMLInputElement && control.type === 'date') return dateField(control);
  if (ctl === 'lookup' && control instanceof HTMLInputElement) {
    control.classList.add('erp-input');
    attachLookup(control, (name, value) => setFieldValue(box.closest('form, [data-erp="record"], [data-erp="screen"]') || document.body, name, value));
    return;
  }
  if (ctl === 'checkbox' && control instanceof HTMLInputElement) { control.classList.add('erp-switch'); control.setAttribute('role', 'switch'); return; }
  if (ctl === 'password' && control instanceof HTMLInputElement) {
    control.classList.add('erp-input');
    const wrap = h('span', { class: 'erp-pass' });
    control.replaceWith(wrap);
    const eye = h('button', { type: 'button', class: 'erp-pass__btn', 'aria-label': 'Hiện mật khẩu', onclick: () => {
      const show = control.type === 'password';
      control.type = show ? 'text' : 'password';
      eye.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    } }, icon('key'));
    wrap.append(control, eye);
    return;
  }
  if (control instanceof HTMLSelectElement) { control.classList.add('erp-input', 'erp-select'); return; }
  if (control instanceof HTMLTextAreaElement) {
    control.classList.add('erp-input', 'erp-textarea');
    const fit = () => { control.style.height = 'auto'; control.style.height = `${Math.min(control.scrollHeight + 2, 320)}px`; };
    control.addEventListener('input', fit);
    requestAnimationFrame(fit);
    return;
  }
  if (control) control.classList.add('erp-input');
  const out = box.querySelector(':scope > output');
  if (out && !control) out.classList.add('erp-output');
  const btn = box.querySelector(':scope > button, :scope > a');
  if (btn) btn.classList.add('erp-btn');
}

/** Ô số: input gốc (có name, giá trị bất biến) thành hidden; ô hiển thị định dạng 1.234.567,89. @param {HTMLInputElement} orig @param {string} ctl */
function numeric(orig, ctl) {
  const dec = orig.dataset.decimals !== undefined ? Number(orig.dataset.decimals) : (ctl === 'money' ? 0 : null);
  const vis = /** @type {HTMLInputElement} */ (h('input', { type: 'text', inputmode: 'decimal', class: `erp-input erp-input--num erp-input--${ctl}`, id: orig.id,
    readonly: orig.readOnly, disabled: orig.disabled, required: orig.required, placeholder: orig.placeholder || '', autocomplete: 'off',
    'aria-invalid': orig.getAttribute('aria-invalid') || false, 'aria-describedby': orig.getAttribute('aria-describedby') || false }));
  orig.removeAttribute('id');
  orig.type = 'hidden';
  orig.required = false;
  orig.after(vis);
  vis.value = orig.value === '' ? '' : formatNumber(orig.value, dec);
  if (ctl === 'percent') vis.after(h('span', { class: 'erp-suffix', 'aria-hidden': 'true' }, '%'));
  const commit = () => {
    if (vis.value.trim() === '') { orig.value = ''; vis.removeAttribute('aria-invalid'); return; }
    const n = parseNumber(vis.value);
    if (!Number.isFinite(n)) { vis.setAttribute('aria-invalid', 'true'); return; }
    vis.removeAttribute('aria-invalid');
    const min = orig.min !== '' ? Number(orig.min) : null, max = orig.max !== '' ? Number(orig.max) : null;
    if ((min !== null && n < min) || (max !== null && n > max)) vis.setAttribute('aria-invalid', 'true');
    orig.value = toInvariant(dec !== null ? Number(n.toFixed(dec)) : n);
    vis.value = formatNumber(orig.value, dec);
  };
  vis.addEventListener('blur', commit);
  vis.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  vis.addEventListener('input', () => orig.dispatchEvent(new Event('input', { bubbles: true })));
  orig.addEventListener('erp:set', () => { vis.value = orig.value === '' ? '' : formatNumber(orig.value, dec); });
}

/**
 * Ô ngày luôn hiển thị dd/MM/yyyy (không phụ thuộc ngôn ngữ trình duyệt). Input gốc (ISO, có name) thành hidden;
 * gõ được "11/11", "11/11/26", "11-11-2026"; nút lịch mở bộ chọn ngày gốc của trình duyệt.
 * @param {HTMLInputElement} orig
 */
function dateField(orig) {
  const vis = /** @type {HTMLInputElement} */ (h('input', { type: 'text', inputmode: 'numeric', class: 'erp-input erp-input--date', id: orig.id,
    readonly: orig.readOnly, disabled: orig.disabled, required: orig.required, placeholder: 'dd/mm/yyyy', autocomplete: 'off', maxlength: '10',
    'aria-describedby': orig.getAttribute('aria-describedby') || false }));
  const picker = /** @type {HTMLInputElement} */ (h('input', { type: 'date', class: 'erp-date__picker', tabindex: '-1', 'aria-hidden': 'true', min: orig.min || false, max: orig.max || false }));
  orig.removeAttribute('id');
  orig.type = 'hidden';
  orig.required = false;
  const btn = h('button', { type: 'button', class: 'erp-lookup__btn', tabindex: '-1', 'aria-label': 'Chọn ngày', disabled: orig.readOnly || orig.disabled,
    onclick: () => { picker.value = orig.value; try { picker.showPicker(); } catch { picker.focus(); } } }, icon('calendar'));
  const wrap = h('span', { class: 'erp-lookup erp-date' });
  orig.after(wrap);
  wrap.append(vis, btn, picker);
  const show = () => { vis.value = orig.value ? formatDate(orig.value) : ''; };
  show();
  const commit = () => {
    if (!vis.value.trim()) { orig.value = ''; vis.removeAttribute('aria-invalid'); return; }
    const iso = parseDate(vis.value);
    if (!iso) { vis.setAttribute('aria-invalid', 'true'); return; }
    vis.removeAttribute('aria-invalid');
    if (iso !== orig.value) { orig.value = iso; orig.dispatchEvent(new Event('change', { bubbles: true })); }
    show();
  };
  vis.addEventListener('blur', commit);
  vis.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) { e.preventDefault(); btn.click(); }
  });
  picker.addEventListener('change', () => { if (picker.value) { orig.value = picker.value; show(); orig.dispatchEvent(new Event('change', { bubbles: true })); vis.focus(); } });
  orig.addEventListener('erp:set', show);
}

/**
 * Gán giá trị cho ô theo name trong phạm vi (dùng khi tra cứu điền kèm trường).
 * @param {Element} scope @param {string} name @param {string} value
 */
export function setFieldValue(scope, name, value) {
  const els = /** @type {HTMLInputElement[]} */ (Array.from(scope.querySelectorAll(`[name="${CSS.escape(name)}"]`)));
  for (const el of els) {
    if (el.type === 'checkbox') el.checked = value === 'true';
    else if (el.type !== 'hidden' || el.closest('[data-erp="field"]')) el.value = value;
    el.dispatchEvent(new Event('erp:set'));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (!els.length) {
    // Không có ô trùng tên: có thể là chữ hiển thị (output)
    const out = scope.querySelector(`output[name="${CSS.escape(name)}"]`);
    if (out) out.textContent = value;
  }
}

/** Đánh dấu "có thay đổi" khi màn hình đang ở chế độ thêm/sửa. @param {HTMLElement} root @param {import('../shell/tabs.js').TabContext} ctx */
function trackDirty(root, ctx) {
  const screen = root.closest('[data-erp="screen"]') || root;
  const mode = screen.getAttribute('data-mode');
  if (mode !== 'new' && mode !== 'edit') return;
  for (const rec of Array.from(root.querySelectorAll('[data-erp="record"]'))) {
    const on = (/** @type {Event} */ e) => { if (e.isTrusted || e.type === 'change') ctx.setDirty(true); };
    rec.addEventListener('input', on);
    rec.addEventListener('change', on);
  }
}

/** @param {number} n @param {number} a @param {number} b */
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
