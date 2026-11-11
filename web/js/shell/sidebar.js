// @ts-check
import { h, fold } from '../core/dom.js';
import { icon } from '../core/icons.js';

/**
 * Menu dạng cây: dùng khi người dùng chọn kiểu điều hướng "Sidebar", và làm ngăn kéo menu trên màn hẹp.
 */
export class Sidebar {
  /** @param {import('./shell.js').Shell} shell @param {HTMLElement} host */
  constructor(shell, host) {
    this.shell = shell;
    this.host = host;
    /** @type {HTMLInputElement|null} */ this.search = null;
  }

  /** @param {import('./menu-model.js').MenuNode[]} menu */
  render(menu) {
    const tree = h('ul', { class: 'erp-tree', role: 'tree' }, ...menu.map((n) => this.node(n, 1)));
    this.search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'erp-input', placeholder: 'Lọc menu…', 'aria-label': 'Lọc menu',
      oninput: () => this.filter(tree, this.search?.value || '') }));
    this.host.replaceChildren(
      h('div', { class: 'erp-sidebar__head' }, this.search,
        h('button', { class: 'erp-iconbtn erp-sidebar__close', type: 'button', 'aria-label': 'Đóng menu', onclick: () => this.shell.toggleDrawer(false) }, icon('close'))),
      h('div', { class: 'erp-sidebar__scroll' }, tree));
  }

  focusSearch() { setTimeout(() => this.search?.focus(), 50); }

  /** @param {import('./menu-model.js').MenuNode} n @param {number} level @returns {HTMLElement} */
  node(n, level) {
    if (n.children.length) {
      const sub = h('ul', { role: 'group' }, ...n.children.map((c) => this.node(c, level + 1)));
      const btn = h('button', { type: 'button', class: 'erp-tree__group', 'aria-expanded': 'false',
        onclick: () => { const open = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', String(open)); } },
      icon('chevron-right', 'erp-tree__caret'), level === 1 ? icon(n.icon || 'form') : null, h('span', {}, n.label));
      return h('li', { role: 'treeitem', dataset: { level: String(level) } }, btn, sub);
    }
    return h('li', { role: 'treeitem', dataset: { level: String(level) } },
      h('a', { href: n.url, class: 'erp-tree__item', onclick: (/** @type {MouseEvent} */ e) => {
        e.preventDefault();
        if (n.action === 'logout') this.shell.logout(n.url); else this.shell.open(n.url, { target: n.target });
      } }, icon(n.icon), h('span', {}, n.label)));
  }

  /** @param {HTMLElement} tree @param {string} q */
  filter(tree, q) {
    const f = fold(q.trim());
    const walk = (/** @type {HTMLElement} */ li) => {
      const sub = li.querySelector(':scope > ul');
      if (!sub) {
        const ok = !f || fold(li.textContent || '').includes(f);
        li.hidden = !ok;
        return ok;
      }
      let any = false;
      for (const c of Array.from(sub.children)) any = walk(/** @type {HTMLElement} */ (c)) || any;
      li.hidden = !any;
      li.querySelector(':scope > button')?.setAttribute('aria-expanded', String(!!f && any));
      return any;
    };
    for (const li of Array.from(tree.children)) walk(/** @type {HTMLElement} */ (li));
  }
}
