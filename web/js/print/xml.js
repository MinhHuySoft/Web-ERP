// @ts-check
/**
 * Bộ đọc XML tối giản cho tệp `.rpx` (ActiveReports 3): phần tử, thuộc tính, chữ, CDATA, chú thích, `<?xml?>`.
 * Không cần DOM (chạy được trong trình duyệt và Node), không nạp thực thể ngoài / DTD — tệp mẫu chỉ là dữ liệu.
 */

/** @typedef {{ name: string, attrs: Record<string, string>, children: XmlNode[], text: string }} XmlNode */

const ENT = /** @type {Record<string,string>} */ ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" });

/** @param {string} s */
function decode(s) {
  return s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : '';
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

/**
 * @param {string} src nội dung tệp (đã giải mã UTF-8; BOM và ký tự NUL thừa được bỏ)
 * @returns {XmlNode} phần tử gốc
 */
export function parseXml(src) {
  const s = src.replace(/^﻿/, '').replace(/\u0000/g, '');
  /** @type {XmlNode} */ const doc = { name: '#document', attrs: {}, children: [], text: '' };
  /** @type {XmlNode[]} */ const stack = [doc];
  let i = 0;
  const top = () => stack[stack.length - 1];
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { top().text += decode(s.slice(i)); break; }
    if (lt > i) top().text += decode(s.slice(i, lt));
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); i = e < 0 ? s.length : e + 3; continue; }
    if (s.startsWith('<![CDATA[', lt)) { const e = s.indexOf(']]>', lt + 9); top().text += s.slice(lt + 9, e < 0 ? s.length : e); i = e < 0 ? s.length : e + 3; continue; }
    if (s.startsWith('<?', lt)) { const e = s.indexOf('?>', lt + 2); i = e < 0 ? s.length : e + 2; continue; }
    if (s.startsWith('<!', lt)) { const e = s.indexOf('>', lt + 2); i = e < 0 ? s.length : e + 1; continue; }
    if (s[lt + 1] === '/') {
      const e = s.indexOf('>', lt + 2);
      const name = s.slice(lt + 2, e < 0 ? s.length : e).trim();
      while (stack.length > 1) { const n = /** @type {XmlNode} */ (stack.pop()); if (n.name === name) break; }
      i = e < 0 ? s.length : e + 1;
      continue;
    }
    // thẻ mở
    let j = lt + 1;
    const nm = /^[^\s/>]+/.exec(s.slice(j, j + 200));
    if (!nm) throw new Error(`XML lỗi ở vị trí ${lt}`);
    /** @type {XmlNode} */ const node = { name: nm[0], attrs: {}, children: [], text: '' };
    j += nm[0].length;
    const attrRx = /\s*([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')|\s*(\/?>)/y;
    let selfClose = false;
    for (;;) {
      attrRx.lastIndex = j;
      const m = attrRx.exec(s);
      if (!m) throw new Error(`XML lỗi trong thẻ <${node.name}> ở vị trí ${j}`);
      j = attrRx.lastIndex;
      if (m[5]) { selfClose = m[5] === '/>'; break; }
      node.attrs[m[1]] = decode(m[3] ?? m[4] ?? '');
    }
    top().children.push(node);
    if (!selfClose) stack.push(node);
    i = j;
  }
  const root = doc.children[0];
  if (!root) throw new Error('XML rỗng');
  return root;
}

/** @param {XmlNode|undefined} n @param {string} name */
export const child = (n, name) => n?.children.find((c) => c.name === name);
/** Mọi phần tử con cháu có tên `name` (theo thứ tự tài liệu). @param {XmlNode} n @param {string} name @returns {XmlNode[]} */
export function descendants(n, name) {
  /** @type {XmlNode[]} */ const out = [];
  const walk = (/** @type {XmlNode} */ x) => { for (const c of x.children) { if (c.name === name) out.push(c); walk(c); } };
  walk(n);
  return out;
}
