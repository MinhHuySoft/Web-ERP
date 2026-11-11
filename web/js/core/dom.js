// @ts-check
/** Tiện ích DOM nhỏ dùng chung. */

/** @param {string} sel @param {ParentNode} [root] @returns {HTMLElement|null} */
export const $ = (sel, root = document) => /** @type {HTMLElement|null} */ (root.querySelector(sel));

/** @param {string} sel @param {ParentNode} [root] @returns {HTMLElement[]} */
export const $$ = (sel, root = document) => /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll(sel)));

/**
 * Tạo phần tử: h('button', { class: 'x', onclick: fn, dataset: { a: 1 } }, 'Nội dung', childNode)
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {...(Node|string|number|null|undefined|false)} children
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === undefined || c === null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

let seq = 0;
/** @param {string} [prefix] */
export const uid = (prefix = 'erp') => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** Phần tử gần nhất có data-erp = role. @param {Element|null} el @param {string} role */
export const closestRole = (el, role) => /** @type {HTMLElement|null} */ (el ? el.closest(`[data-erp="${role}"]`) : null);

/** Bỏ dấu tiếng Việt và chữ thường — dùng cho tìm kiếm. @param {string} s */
export function fold(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** Giới hạn tần suất gọi. @template {(...a:any[])=>void} F @param {F} fn @param {number} ms @returns {F} */
export function debounce(fn, ms) {
  /** @type {any} */ let t;
  return /** @type {F} */ ((...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); });
}

/** Đặt focus an toàn. @param {HTMLElement|null|undefined} el */
export function focusSafe(el) { try { el?.focus({ preventScroll: false }); } catch { /* bỏ qua */ } }
