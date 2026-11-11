// @ts-check
/**
 * Làm sạch HTML nhận từ backend (chuẩn ERP-HTML mục 18) và chuyển URL tương đối thành tuyệt đối theo URL response.
 * - Bỏ thẻ nguy hiểm/không cần (script, style, link, iframe, object, embed, base…).
 * - Bỏ thuộc tính on*, style, class; bỏ URL javascript:.
 * - Thẻ lạ không nằm trong danh sách được "mở gói" (giữ nội dung con).
 */

const DROP = new Set(['SCRIPT', 'STYLE', 'LINK', 'IFRAME', 'OBJECT', 'EMBED', 'BASE', 'META', 'NOSCRIPT', 'FRAME', 'FRAMESET', 'APPLET']);
const ALLOW = new Set(`SECTION NAV UL OL LI SPAN A MENU BUTTON FORM FIELDSET LEGEND DIV LABEL INPUT SELECT OPTION OPTGROUP
  TEXTAREA OUTPUT SMALL TABLE CAPTION THEAD TBODY TFOOT TR TH TD COLGROUP COL TEMPLATE DATA TIME DL DT DD H1 H2 H3 H4 H5 H6
  P B I STRONG EM U BR HR SUP SUB IMG DETAILS SUMMARY MAIN HEADER FOOTER ARTICLE ASIDE FIGURE FIGCAPTION ABBR CODE PRE MARK
  PROGRESS METER BLOCKQUOTE Q S KBD`.split(/\s+/));
const URL_ATTRS = ['href', 'action', 'formaction', 'src', 'data-src', 'data-lookup-src', 'data-query-src', 'data-refresh-src',
  'data-options-src', 'data-upload', 'data-lookup-add'];

/** @param {Element|DocumentFragment} root */
export function sanitize(root) {
  const walk = (/** @type {Element|DocumentFragment} */ node) => {
    for (const el of Array.from(node.children)) {
      if (DROP.has(el.tagName)) { el.remove(); continue; }
      if (el.tagName === 'TEMPLATE') walk(/** @type {HTMLTemplateElement} */ (el).content);
      for (const a of Array.from(el.attributes)) {
        const n = a.name.toLowerCase();
        if (n.startsWith('on') || n === 'style' || n === 'class' || n === 'srcdoc') el.removeAttribute(a.name);
        else if (URL_ATTRS.includes(n) && /^\s*(javascript|vbscript|data):/i.test(a.value) && !(n === 'src' && /^\s*data:image\//i.test(a.value))) el.removeAttribute(a.name);
      }
      walk(el);
      if (!ALLOW.has(el.tagName) && el.isConnected !== false) {
        el.replaceWith(...Array.from(el.childNodes));
      }
    }
  };
  walk(root);
  return root;
}

/** @param {Element|DocumentFragment} root @param {string} baseUrl */
export function absolutize(root, baseUrl) {
  const fix = (/** @type {Element} */ el) => {
    for (const n of URL_ATTRS) {
      const v = el.getAttribute(n);
      if (!v || v.startsWith('#')) continue;
      try {
        const keep = v.replace(/\{q\}/g, '__ERPQ__');
        el.setAttribute(n, new URL(keep, baseUrl).href.replace(/__ERPQ__/g, '{q}'));
      } catch { el.removeAttribute(n); }
    }
  };
  const walk = (/** @type {Element|DocumentFragment} */ node) => {
    for (const el of Array.from(node.children)) {
      fix(el);
      if (el.tagName === 'TEMPLATE') walk(/** @type {HTMLTemplateElement} */ (el).content);
      walk(el);
    }
  };
  walk(root);
  return root;
}
