// @ts-check
import { h, fold } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { openDialog } from '../core/ui.js';
import { getRecent, getFavorites } from '../core/settings.js';
import { leaves } from './menu-model.js';

/**
 * Bảng lệnh (Ctrl+K): tìm mọi chức năng trong menu, tab đang mở, gần đây, yêu thích. Tìm không dấu.
 * @param {any} shell
 */
export function openPalette(shell) {
  if (document.querySelector('.erp-palette')) return;
  const all = leaves(shell.menu).map((n) => ({ title: n.label, sub: n.path.join(' › '), url: n.url, icon: n.icon, kind: n.kind, action: n.action, target: n.target, key: fold(`${n.label} ${n.path.join(' ')} ${n.screenId}`) }));
  const input = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'erp-input erp-palette__input', placeholder: 'Gõ tên chức năng, báo cáo, mã form… (không cần dấu)', 'aria-label': 'Tìm chức năng', 'aria-controls': 'erp-palette-list', autocomplete: 'off' }));
  const list = h('ul', { class: 'erp-palette__list', id: 'erp-palette-list', role: 'listbox' });
  /** @type {any[]} */ let items = [];
  let sel = 0;

  const render = () => {
    const q = fold(input.value.trim());
    /** @type {any[]} */
    let res;
    if (!q) {
      const open = (shell.tabs?.tabs || []).map((/** @type {any} */ t) => ({ title: t.title, sub: 'Đang mở', icon: 'columns', tab: t }));
      const rec = getRecent().slice(0, 8).map((x) => ({ title: x.title, sub: 'Gần đây', url: x.url, icon: 'clock' }));
      const fav = getFavorites().map((x) => ({ title: x.title, sub: 'Yêu thích', url: x.url, icon: 'star' }));
      res = [...open, ...fav, ...rec];
    } else {
      const words = q.split(/\s+/);
      res = all.filter((x) => words.every((w) => x.key.includes(w)))
        .sort((a, b) => Number(!fold(a.title).startsWith(words[0])) - Number(!fold(b.title).startsWith(words[0])))
        .slice(0, 60);
    }
    items = res;
    sel = 0;
    list.replaceChildren(...(res.length ? res.map((x, i) => h('li', { role: 'option', id: `pal-${i}`, class: 'erp-palette__item', 'aria-selected': String(i === 0),
      onclick: () => go(i), onmousemove: () => mark(i) },
    icon(x.icon || 'form'), h('span', { class: 'erp-palette__title' }, x.title), h('small', {}, x.kind === 'report' ? `Báo cáo · ${x.sub}` : x.sub)))
      : [h('li', { class: 'erp-palette__empty' }, q ? 'Không tìm thấy chức năng phù hợp.' : 'Gõ để tìm trong toàn bộ menu.')]));
    input.setAttribute('aria-activedescendant', res.length ? 'pal-0' : '');
  };
  const mark = (/** @type {number} */ i) => {
    sel = i;
    list.querySelectorAll('[role=option]').forEach((el, j) => el.setAttribute('aria-selected', String(j === i)));
    list.querySelector(`#pal-${i}`)?.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `pal-${i}`);
  };
  const go = (/** @type {number} */ i) => {
    const x = items[i];
    if (!x) return;
    d.close();
    if (x.tab) shell.tabs.activate(x.tab);
    else if (x.action === 'logout') shell.logout(x.url);
    else shell.open(x.url, { target: x.target || 'tab' });
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); mark(Math.min(sel + 1, items.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); mark(Math.max(sel - 1, 0)); }
    else if (ev.key === 'Enter') { ev.preventDefault(); go(sel); }
  });
  const d = openDialog({ title: 'Tìm chức năng', body: h('div', { class: 'erp-palette' }, input, list), size: 'md', className: 'erp-dialog--palette' });
  render();
  input.focus();
}
