// @ts-check
import { guessIcon } from '../core/icons.js';

/**
 * @typedef {{ id:string, label:string, icon:string, kind:string, url:string, screenId:string, para:string,
 *   action:string, target:string, beginGroup:boolean, strong:boolean, shortcut:string, children:MenuNode[], path:string[] }} MenuNode
 */

/**
 * Đọc nav[data-erp=menu] (chuẩn ERP-HTML mục 5.3) thành cây.
 * @param {HTMLElement} nav @returns {MenuNode[]}
 */
export function parseMenu(nav) {
  const ul = nav.querySelector(':scope > ul');
  return ul ? parseList(ul, []) : [];
}

/** @param {Element} ul @param {string[]} path @returns {MenuNode[]} */
function parseList(ul, path) {
  /** @type {MenuNode[]} */
  const out = [];
  for (const li of Array.from(ul.children)) {
    if (li.tagName !== 'LI') continue;
    const role = li.getAttribute('data-erp');
    const d = /** @type {HTMLElement} */ (li).dataset;
    if (role === 'menu-group') {
      const label = li.querySelector(':scope > span')?.textContent?.trim() || '';
      const sub = li.querySelector(':scope > ul');
      const node = base(d, label, path);
      node.children = sub ? parseList(sub, [...path, label]) : [];
      node.icon = d.icon || '';
      if (node.children.length) out.push(node);
    } else if (role === 'menu-item') {
      const a = li.querySelector(':scope > a');
      if (!a) continue;
      const label = a.textContent?.trim() || '';
      const node = base(d, label, path);
      node.url = a.getAttribute('href') || '';
      node.kind = d.kind || 'form';
      node.action = a.getAttribute('data-action') || '';
      node.icon = d.icon || (node.kind === 'report' ? 'report' : guessIcon(label));
      out.push(node);
    }
  }
  return out;
}

/** @param {DOMStringMap} d @param {string} label @param {string[]} path @returns {MenuNode} */
function base(d, label, path) {
  return {
    id: d.menuId || label, label, icon: '', kind: '', url: '', screenId: d.screenId || '', para: d.para || '', action: '',
    target: d.target || 'tab', beginGroup: 'beginGroup' in d, strong: 'strong' in d, shortcut: d.shortcut || '',
    children: [], path,
  };
}

/** Mọi mục lá. @param {MenuNode[]} tree @returns {MenuNode[]} */
export function leaves(tree) {
  /** @type {MenuNode[]} */ const out = [];
  const walk = (/** @type {MenuNode[]} */ ns) => ns.forEach((n) => (n.children.length ? walk(n.children) : n.url && out.push(n)));
  walk(tree);
  return out;
}
