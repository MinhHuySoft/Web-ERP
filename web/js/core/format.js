// @ts-check
/** Định dạng / phân tích số và ngày theo kiểu Việt Nam (1.234.567,89 · dd/MM/yyyy). */

const LOCALE = 'vi-VN';
/** @type {Map<string, Intl.NumberFormat>} */
const cache = new Map();

/** @param {number} d */
function nf(d) {
  const k = String(d);
  let f = cache.get(k);
  if (!f) { f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d }); cache.set(k, f); }
  return f;
}

/** @param {string|number|null|undefined} v @param {number|null} [decimals] */
export function formatNumber(v, decimals = null) {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  const d = decimals ?? (Number.isInteger(n) ? 0 : Math.min(String(n).split('.')[1]?.length || 0, 6));
  return nf(d).format(n);
}

/**
 * Phân tích số người dùng gõ: chấp nhận "1.234,5", "1234,5", "1234.5", "1,234.5".
 * @param {string} text @returns {number}
 */
export function parseNumber(text) {
  let s = String(text ?? '').trim().replace(/\s| /g, '');
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-+]/g, '');
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) && s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return neg ? -n : n;
}

/** Chuỗi bất biến để gửi backend. @param {number} n */
export const toInvariant = (n) => (Number.isFinite(n) ? String(n) : '');

/** @param {string} iso */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

/** @param {string} iso */
export function formatDateTime(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : formatDate(iso);
}

/** "11/11/2026" | "11-11-26" | "2026-11-11" → "2026-11-11" (rỗng nếu không hợp lệ). @param {string} text */
export function parseDate(text) {
  const s = String(text || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/.exec(s);
  if (!m) return '';
  let y = m[3] ? +m[3] : new Date().getFullYear();
  if (y < 100) y += 2000;
  return iso(y, +m[2], +m[1]);
}

/** @param {number} y @param {number} mo @param {number} d */
function iso(y, mo, d) {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Định dạng một giá trị theo kiểu cột. @param {string} raw @param {string} type @param {number|null} [decimals] */
export function formatByType(raw, type, decimals = null) {
  switch (type) {
    case 'money': return formatNumber(raw, decimals ?? 0);
    case 'quantity': case 'number': case 'percent': return formatNumber(raw, decimals);
    case 'date': return formatDate(raw);
    case 'datetime': return formatDateTime(raw);
    case 'bool': return raw === 'true' ? '✓' : '';
    default: return raw ?? '';
  }
}

/** So sánh để sắp xếp theo kiểu cột. @param {string} type */
export function comparator(type) {
  if (['money', 'quantity', 'number', 'percent'].includes(type)) {
    return (/** @type {string} */ a, /** @type {string} */ b) => (Number(a) || 0) - (Number(b) || 0);
  }
  const coll = new Intl.Collator(LOCALE, { numeric: true, sensitivity: 'base' });
  return (/** @type {string} */ a, /** @type {string} */ b) => coll.compare(a ?? '', b ?? '');
}
