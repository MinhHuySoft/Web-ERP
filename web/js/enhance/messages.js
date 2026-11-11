// @ts-check
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';

/** @typedef {{ text:string, type:string, field:string, legacy:string }} Msg */

/**
 * Đọc thông điệp (chuẩn ERP-HTML 13.1). Nếu truyền `exclude`, bỏ các thông điệp nằm trong phần tử đó
 * (vì chúng được hiển thị tại chỗ khi nâng cấp màn hình).
 * @param {Document|Element} doc @param {Element|null} [exclude] @returns {Msg[]}
 */
export function readMessages(doc, exclude = null) {
  return Array.from(doc.querySelectorAll('[data-erp="messages"] [data-erp="message"], [data-erp="messages"] > p'))
    .filter((p) => !exclude || !exclude.contains(p))
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .map((p) => ({
      text: p.textContent?.trim() || '', type: normalizeType(p.getAttribute('data-msg-type'), p.getAttribute('data-legacy-type')),
      field: p.getAttribute('data-field') || '', legacy: p.getAttribute('data-legacy-type') || '',
    }))
    .filter((m) => m.text);
}

/** Ánh xạ MsgType cũ của ERP khi backend chỉ gửi data-legacy-type. @param {string|null} t @param {string|null} legacy */
function normalizeType(t, legacy) {
  if (t && ['error', 'warning', 'info', 'success'].includes(t)) return t;
  if (legacy === '1' || legacy === '4') return 'error';
  if (legacy === '0' || legacy === '5') return 'warning';
  return 'info';
}

/** Hiển thị khối thông điệp ngay trong màn hình; gắn thông điệp có data-field vào ô tương ứng. @param {HTMLElement} root */
export function enhanceMessages(root) {
  for (const box of Array.from(root.querySelectorAll('[data-erp="messages"]'))) {
    const msgs = readMessages(box);
    box.classList.add('erp-messages');
    box.replaceChildren(...msgs.map((m) => h('div', { class: `erp-msg erp-msg--${m.type}`, role: m.type === 'error' ? 'alert' : 'status' },
      icon(m.type === 'success' ? 'success' : m.type === 'info' ? 'info' : m.type === 'warning' ? 'warning' : 'error'),
      h('span', {}, m.text),
      h('button', { class: 'erp-iconbtn', type: 'button', 'aria-label': 'Ẩn thông báo', onclick: (/** @type {Event} */ e) => /** @type {HTMLElement} */ (e.currentTarget).parentElement?.remove() }, icon('close')))));
    for (const m of msgs) {
      if (!m.field) continue;
      const input = root.querySelector(`[name="${CSS.escape(m.field)}"]`);
      const field = input?.closest('[data-erp="field"]');
      if (field) {
        field.setAttribute(m.type === 'error' ? 'data-invalid' : 'data-warn', '');
        if (!field.querySelector('[data-erp="error"]')) field.append(h('small', { 'data-erp': 'error' }, m.text));
      }
    }
  }
}
