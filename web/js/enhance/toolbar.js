// @ts-check
import { h } from '../core/dom.js';
import { icon, hasIcon } from '../core/icons.js';
import { popupMenu } from '../shell/shell.js';

/** Phím tắt mặc định theo data-action (chuẩn ERP-HTML mục 7). */
const DEFAULT_KEYS = {
  new: 'F2', edit: 'F3', save: 'Ctrl+S', 'save-new': 'Ctrl+Shift+S', cancel: 'Escape', delete: 'Ctrl+Delete', find: 'Ctrl+F',
  reload: 'F5', print: 'Ctrl+P', close: 'Alt+W', help: 'F1',
};
const ACTION_TONE = { save: 'primary', 'save-new': 'primary', delete: 'danger', approve: 'success' };

/**
 * Nâng cấp menu[data-erp=toolbar]: nút có biểu tượng, nhóm, phím tắt, nút ít dùng vào menu "Thêm".
 * @param {HTMLElement} menu @param {import('../shell/tabs.js').TabContext} ctx
 */
export function enhanceToolbar(menu, ctx) {
  menu.classList.add('erp-toolbar');
  menu.setAttribute('role', 'toolbar');
  /** @type {HTMLElement[]} */ const overflow = [];
  let lastGroup = '';
  for (const li of Array.from(menu.children)) {
    const btn = /** @type {HTMLElement|null} */ (li.querySelector('a, button'));
    if (!btn) continue;
    const action = btn.getAttribute('data-action') || 'custom';
    const name = btn.getAttribute('data-icon') || action;
    const label = btn.textContent?.trim() || action;
    btn.classList.add('erp-tbtn');
    const tone = /** @type {Record<string,string>} */ (ACTION_TONE)[action];
    if (tone) btn.classList.add(`erp-tbtn--${tone}`);
    btn.replaceChildren(icon(hasIcon(name) ? name : 'custom'), h('span', { class: 'erp-tbtn__label' }, label));
    const key = btn.getAttribute('data-shortcut') || /** @type {Record<string,string>} */ (DEFAULT_KEYS)[action] || '';
    btn.title = key ? `${label} (${key})` : label;
    if (btn.tagName === 'A' && btn.hasAttribute('disabled')) btn.setAttribute('aria-disabled', 'true');
    const group = li.getAttribute('data-group') || '';
    if (group && group !== lastGroup && lastGroup) li.classList.add('is-begin');
    lastGroup = group || lastGroup;
    if (li.hasAttribute('data-overflow')) { overflow.push(btn); li.hidden = true; }
    if (key && !btn.hasAttribute('disabled')) {
      ctx.registerKey(normalizeCombo(key), (ev) => {
        if (action === 'cancel' && ev.target instanceof HTMLElement && ev.target.closest('.erp-lookup-pop, .erp-grid__editor')) return;
        if (!btn.isConnected || btn.hasAttribute('disabled')) return;
        btn.click();
      });
    }
  }
  if (overflow.length) {
    const more = h('button', { class: 'erp-tbtn', type: 'button', 'aria-haspopup': 'menu', onclick: () =>
      popupMenu(more, overflow.map((b) => ({ icon: b.getAttribute('data-icon') || b.getAttribute('data-action') || 'custom', label: b.textContent?.trim() || '', disabled: b.hasAttribute('disabled'), onClick: () => b.click() }))) },
    icon('more'), h('span', { class: 'erp-tbtn__label' }, 'Thêm'));
    menu.append(h('li', {}, more));
  }
}

/** "ctrl+s" | "Ctrl+S" ⇒ "Ctrl+S"; "Esc" ⇒ "Escape". @param {string} combo */
export function normalizeCombo(combo) {
  const parts = combo.split('+').map((p) => p.trim());
  const key = parts.pop() || '';
  const mods = parts.map((m) => m[0].toUpperCase() + m.slice(1).toLowerCase()).map((m) => (m === 'Cmd' || m === 'Meta' ? 'Ctrl' : m));
  const order = ['Ctrl', 'Alt', 'Shift'].filter((m) => mods.includes(m));
  let k = key === 'Esc' ? 'Escape' : key === 'Del' ? 'Delete' : key;
  if (k.length === 1) k = k.toUpperCase();
  return [...order, k].join('+');
}
