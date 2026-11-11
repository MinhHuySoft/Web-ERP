// @ts-check
import { sanitize, absolutize } from './sanitize.js';

/** redirected: response đến sau redirect (vd 303 Post/Redirect/Get) ⇒ `url` là URL GET tải lại được.
 * @typedef {{ status:number, ok:boolean, url:string, redirected:boolean, doc:Document, title:string }} HtmlResponse */

const cfg = /** @type {any} */ (window).ERP_CONFIG || {};

/** URL có được phép gọi không (cùng origin hoặc trong danh sách cấu hình). @param {string} url */
export function isAllowedUrl(url) {
  try {
    const u = new URL(url, location.href);
    return u.origin === location.origin || (cfg.allowedOrigins || []).includes(u.origin);
  } catch { return false; }
}

/**
 * Gọi backend, nhận HTML, làm sạch và trả về Document.
 * @param {string} url
 * @param {{ method?: string, body?: BodyInit|null, tabId?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<HtmlResponse>}
 */
export async function fetchHtml(url, opts = {}) {
  if (!isAllowedUrl(url)) throw new Error(`URL không được phép: ${url}`);
  /** @type {Record<string,string>} */
  const headers = { Accept: 'text/html', 'X-ERP-Request': 'fragment', 'X-ERP-Contract': cfg.contractVersion || '1.0' };
  if (opts.tabId) headers['X-ERP-Tab'] = opts.tabId;
  const res = await fetch(url, {
    method: opts.method || 'GET', body: opts.body ?? null, headers, credentials: 'include', redirect: 'follow',
    signal: opts.signal,
  });
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/html');
  sanitize(doc.body);
  absolutize(doc.body, res.url || url);
  const title = res.headers.get('X-ERP-Title') || doc.title || '';
  return { status: res.status, ok: res.ok, url: res.url || url, redirected: res.redirected, doc, title };
}

/** Lấy phần tử vai trò đầu tiên trong response. @param {Document|Element} doc @param {string} role */
export const pick = (doc, role) => /** @type {HTMLElement|null} */ (doc.querySelector(`[data-erp="${role}"]`));

/** @param {Document|Element} doc @param {string} role */
export const pickAll = (doc, role) => /** @type {HTMLElement[]} */ (Array.from(doc.querySelectorAll(`[data-erp="${role}"]`)));

/** Nhập phần tử từ document khác vào document hiện tại. @template {Node} T @param {T} node @returns {T} */
export const adopt = (node) => /** @type {T} */ (document.importNode(node, true));
