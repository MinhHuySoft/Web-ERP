// @ts-check
/**
 * Chuỗi định dạng .NET (OutputFormat của ActiveReports, Format() của biểu thức) cho số và ngày, theo cách .NET Framework
 * mà WinForms dùng: làm tròn trên 15 chữ số có nghĩa, nửa xa số 0; "#" bỏ số 0 vô nghĩa (0 với "#,###" ra rỗng); số âm
 * làm tròn về 0 thì không có dấu "-". Văn hóa mặc định giống ERP.NET ép lúc khởi động (`SysFunction.SetSystemDateDMY`):
 * ngày dd/MM/yyyy, giờ HH:mm, nhóm nghìn ".", thập phân "," (công ty khác có thể đổi qua `locale`).
 */
import { plain15 } from './words.js';

/** @typedef {{ group: string, decimal: string, shortDate: string, shortTime: string, longTime: string, monthNames: string[], dayNames: string[], abbrDayNames: string[], am: string, pm: string, percent: string, currency: string }} NetLocale */

/** @type {NetLocale} */
export const DEFAULT_LOCALE = Object.freeze({
  group: '.', decimal: ',', shortDate: 'dd/MM/yyyy', shortTime: 'HH:mm', longTime: 'HH:mm:ss',
  monthNames: ['Tháng Giêng', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư', 'Tháng Năm', 'Tháng Sáu', 'Tháng Bảy', 'Tháng Tám', 'Tháng Chín', 'Tháng Mười', 'Tháng Mười Một', 'Tháng Mười Hai'],
  dayNames: ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
  abbrDayNames: ['SU', 'MO', 'TU', 'WE', 'TH', 'FI', 'SA'],
  am: 'SA', pm: 'CH', percent: '%', currency: '₫',
});

/** @param {Partial<NetLocale>|null|undefined} p @returns {NetLocale} */
export function makeLocale(p) {
  return p ? { ...DEFAULT_LOCALE, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== '')) } : DEFAULT_LOCALE;
}

/**
 * Định dạng một giá trị như `String.Format("{0:fmt}")` / `TextBox.OutputFormat`.
 * Chuỗi giữ nguyên; null/undefined → rỗng; số và ngày theo `fmt` (rỗng → ToString() mặc định).
 * @param {unknown} v @param {string|null|undefined} fmt @param {NetLocale} [loc]
 */
export function formatValue(v, fmt, loc = DEFAULT_LOCALE) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : formatDate(v, fmt || '', loc);
  if (typeof v === 'number') return Number.isFinite(v) ? formatNumber(v, fmt || '', loc) : '';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

/* ================= số ================= */

/**
 * @param {number} n @param {string} fmt @param {NetLocale} [loc]
 */
export function formatNumber(n, fmt, loc = DEFAULT_LOCALE) {
  if (!fmt) return general(n, loc);
  const std = /^([NnFfDdPpCcGgEeXx])(\d{0,2})$/.exec(fmt);
  if (std) return standard(n, std[1], std[2] === '' ? null : Number(std[2]), loc);
  return custom(n, fmt, loc);
}

/** ToString() mặc định: 15 chữ số có nghĩa, không nhóm nghìn. @param {number} n @param {NetLocale} loc */
function general(n, loc) {
  const neg = n < 0;
  const s = plain15(Math.abs(n));
  if (/e/i.test(String(Math.abs(n))) && (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-5 && n !== 0))) {
    return (neg ? '-' : '') + Math.abs(n).toExponential(14).replace(/\.?0+e/, 'E').replace('e', 'E').replace('.', loc.decimal).replace(/E([+-])(\d)$/, 'E$10$2');
  }
  return (neg && s !== '0' ? '-' : '') + s.replace('.', loc.decimal);
}

/** @param {number} n @param {string} k @param {number|null} p @param {NetLocale} loc */
function standard(n, k, p, loc) {
  const K = k.toUpperCase();
  if (K === 'G') return general(n, loc);
  if (K === 'X') return Math.trunc(n).toString(16)[k === 'X' ? 'toUpperCase' : 'toLowerCase']().padStart(p ?? 0, '0');
  if (K === 'E') return n.toExponential(p ?? 6).replace('.', loc.decimal).replace(/e([+-])(\d+)/, (_, s, d) => `${k}${s}${d.padStart(3, '0')}`);
  if (K === 'D') { const t = String(Math.abs(Math.trunc(n))).padStart(p ?? 0, '0'); return (n < 0 ? '-' : '') + t; }
  const d = p ?? 2;
  const x = K === 'P' ? n * 100 : n;
  const pat = `${K === 'F' ? '0' : '#,##0'}${d ? `.${'0'.repeat(d)}` : ''}`;
  const body = custom(Math.abs(x), pat, loc);
  const zero = !/[1-9]/.test(body);
  const sign = x < 0 && !zero ? '-' : '';
  if (K === 'P') return `${sign}${body} ${loc.percent}`;
  if (K === 'C') return `${sign}${body} ${loc.currency}`;
  return sign + body;
}

/** Tách chuỗi định dạng theo ";" (bỏ qua ";" trong nháy và sau "\\"). @param {string} fmt */
function sections(fmt) {
  /** @type {string[]} */ const out = [];
  let cur = '', q = '';
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i];
    if (q) { cur += c; if (c === q) q = ''; continue; }
    if (c === '\\') { cur += c + (fmt[i + 1] ?? ''); i++; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ';') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.slice(0, 3);
}

/**
 * @typedef {{ kind: 'digit', ch: '0'|'#' } | { kind: 'point' } | { kind: 'lit', text: string } | { kind: 'group' } | { kind: 'percent' } | { kind: 'permille' } | { kind: 'exp', text: string, plus: boolean, digits: number }} Tok
 */

/** @param {string} sec @returns {Tok[]} */
function tokenize(sec) {
  /** @type {Tok[]} */ const out = [];
  for (let i = 0; i < sec.length; i++) {
    const c = sec[i];
    if (c === '0' || c === '#') out.push({ kind: 'digit', ch: c });
    else if (c === '.') out.push({ kind: 'point' });
    else if (c === ',') out.push({ kind: 'group' });
    else if (c === '%') out.push({ kind: 'percent' });
    else if (c === '‰') out.push({ kind: 'permille' });
    else if (c === '\\') { out.push({ kind: 'lit', text: sec[i + 1] ?? '' }); i++; }
    else if (c === '"' || c === "'") {
      const j = sec.indexOf(c, i + 1);
      out.push({ kind: 'lit', text: sec.slice(i + 1, j < 0 ? sec.length : j) });
      i = j < 0 ? sec.length : j;
    } else if ((c === 'E' || c === 'e') && /^[eE][+-]?0/.test(sec.slice(i))) {
      const m = /^[eE]([+-]?)(0+)/.exec(sec.slice(i)) || ['', '', '0'];
      out.push({ kind: 'exp', text: c, plus: m[1] === '+', digits: m[2].length });
      i += m[0].length - 1;
    } else out.push({ kind: 'lit', text: c });
  }
  return out;
}

/** Làm tròn chuỗi thập phân không dấu tới `d` chữ số lẻ, nửa xa 0. @param {string} s @param {number} d */
function roundDec(s, d) {
  let [a, b = ''] = s.split('.');
  if (b.length <= d) return { int: a.replace(/^0+(?=\d)/, ''), frac: b.padEnd(d, '0') };
  const up = Number(b[d]) >= 5;
  let digits = (a + b.slice(0, d)).split('').map(Number);
  if (up) {
    let i = digits.length - 1;
    while (i >= 0) { if (digits[i] === 9) { digits[i] = 0; i--; } else { digits[i]++; break; } }
    if (i < 0) digits = [1, ...digits];
  }
  const all = digits.join('');
  const intPart = all.slice(0, all.length - d) || '0';
  return { int: intPart.replace(/^0+(?=\d)/, ''), frac: d ? all.slice(all.length - d) : '' };
}

/**
 * Chọn phần định dạng như .NET Framework: 1 phần cho mọi số; 2 phần = dương và 0 / âm (không thêm dấu "-"), số âm làm tròn
 * thành 0 thì định dạng 0 theo phần đầu; 3 phần = thêm phần cho số 0, số khác 0 làm tròn thành 0 cũng dùng phần thứ ba.
 * @param {number} n @param {string} fmt @param {NetLocale} loc
 */
function custom(n, fmt, loc) {
  const secs = sections(fmt);
  if (n === 0 && secs.length === 3 && secs[2] !== '') return applySection(0, secs[2], loc).text;
  const neg = n < 0;
  const negSec = neg && secs.length >= 2 && secs[1] !== '';
  const out = applySection(Math.abs(n), negSec ? secs[1] : secs[0], loc);
  if (/[1-9]/.test(out.digits)) return (neg && !negSec ? '-' : '') + out.text;
  // làm tròn thành 0
  if (secs.length === 3 && secs[2] !== '') return applySection(0, secs[2], loc).text;
  if (negSec) return applySection(0, secs[0], loc).text;
  return out.text;
}

/** @param {number} n không âm @param {string} sec @param {NetLocale} loc @returns {{ text: string, digits: string }} */
function applySection(n, sec, loc) {
  const toks = tokenize(sec);
  // Vị trí chấm thập phân đầu tiên; chữ số trước / sau chấm
  const pointAt = toks.findIndex((t) => t.kind === 'point');
  const firstDigit = toks.findIndex((t) => t.kind === 'digit');
  let lastDigit = -1;
  toks.forEach((t, i) => { if (t.kind === 'digit') lastDigit = i; });
  const intEnd = pointAt >= 0 ? pointAt : lastDigit + 1;
  // Dấu phẩy: nhóm nghìn khi nằm giữa hai ký tự chữ số; chia 1000 khi đứng ngay trước chấm thập phân / cuối phần số
  let grouping = false, scale = 0;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].kind !== 'group') continue;
    let j = i; while (toks[j + 1]?.kind === 'group') j++;
    const before = toks.slice(0, i).some((t) => t.kind === 'digit');
    const nextT = toks[j + 1];
    if (before && nextT?.kind === 'digit' && (pointAt < 0 || i < pointAt)) grouping = true;
    else if (before && (j + 1 === intEnd || (pointAt < 0 && j >= lastDigit))) scale += j - i + 1;
    i = j;
  }
  let x = n;
  for (const t of toks) { if (t.kind === 'percent') x *= 100; if (t.kind === 'permille') x *= 1000; }
  x /= 1000 ** scale;
  const intDigits = toks.slice(0, intEnd).filter((t) => t.kind === 'digit');
  const fracDigits = pointAt >= 0 ? toks.slice(pointAt + 1).filter((t) => t.kind === 'digit') : [];
  const expTok = /** @type {Extract<Tok,{kind:'exp'}>|undefined} */ (toks.find((t) => t.kind === 'exp'));
  let expText = '';
  let r = roundDec(plain15(x), fracDigits.length);
  if (expTok) {
    const width = Math.max(1, intDigits.length);
    let e = 0;
    if (x !== 0) { e = Math.floor(Math.log10(x)) - (width - 1); x /= 10 ** e; }
    r = roundDec(plain15(x), fracDigits.length);
    if (r.int.length > width) { x /= 10; e++; r = roundDec(plain15(x), fracDigits.length); } // 9,9995 → 10,000 ⇒ 1,000E+1
    expText = expTok.text + (e < 0 ? '-' : expTok.plus ? '+' : '') + String(Math.abs(e)).padStart(expTok.digits, '0');
  }
  // phần nguyên
  const minInt = (() => { const k = intDigits.findIndex((t) => t.ch === '0'); return k < 0 ? 0 : intDigits.length - k; })();
  let ip = r.int === '0' ? '' : r.int;
  if (ip.length < minInt) ip = ip.padStart(minInt, '0');
  // phần lẻ: "0" bắt buộc, "#" bỏ số 0 ở cuối
  let fp = r.frac;
  let keep = fp.length;
  for (let i = fracDigits.length - 1; i >= 0; i--) { if (fracDigits[i].ch === '#' && fp[i] === '0' && i === keep - 1) keep = i; else break; }
  fp = fp.slice(0, keep);
  // dựng chuỗi: chữ số phần nguyên rải từ phải sang trái vào các ô chữ số, ô đầu tiên nhận phần còn lại; ký tự khác giữ chỗ
  const intSlots = [];
  toks.forEach((t, i) => { if (t.kind === 'digit' && (pointAt < 0 || i < pointAt)) intSlots.push(i); });
  /** @type {Map<number,string>} */ const slotText = new Map();
  let rest = ip;
  for (let k = intSlots.length - 1; k >= 0; k--) {
    if (k === 0) { slotText.set(intSlots[k], rest); rest = ''; }
    else { slotText.set(intSlots[k], rest.slice(-1)); rest = rest.slice(0, -1); }
  }
  let text = '';
  let fracIdx = 0;
  let left = ip.length; // số chữ số phần nguyên còn phải in (để chèn dấu nhóm nghìn)
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === 'digit') {
      if (pointAt < 0 || i < pointAt) {
        for (const ch of slotText.get(i) || '') {
          text += ch;
          left--;
          if (grouping && left > 0 && left % 3 === 0) text += loc.group;
        }
      } else { if (fracIdx < fp.length) text += fp[fracIdx]; fracIdx++; }
    } else if (t.kind === 'point') { if (fp.length) text += loc.decimal; }
    else if (t.kind === 'lit') text += t.text;
    else if (t.kind === 'percent') text += loc.percent;
    else if (t.kind === 'permille') text += '‰';
    else if (t.kind === 'exp') text += expText;
  }
  if (firstDigit < 0) text = sec.replace(/["']/g, '');
  return { text: text.replace(/\u0000/g, loc.group), digits: ip + fp };
}

/* ================= ngày ================= */

const pad = (/** @type {number} */ v, /** @type {number} */ n = 2) => String(v).padStart(n, '0');

/**
 * @param {Date} d @param {string} fmt @param {NetLocale} [loc]
 */
export function formatDate(d, fmt, loc = DEFAULT_LOCALE) {
  if (!fmt) fmt = `${loc.shortDate} ${loc.longTime}`;
  else if (fmt.length === 1) {
    fmt = /** @type {Record<string,string>} */ ({ d: loc.shortDate, D: loc.shortDate, g: `${loc.shortDate} ${loc.shortTime}`, G: `${loc.shortDate} ${loc.longTime}`,
      t: loc.shortTime, T: loc.longTime, f: `${loc.shortDate} ${loc.shortTime}`, F: `${loc.shortDate} ${loc.longTime}`, s: "yyyy'-'MM'-'dd'T'HH':'mm':'ss",
      M: 'dd MMMM', m: 'dd MMMM', Y: 'MMMM yyyy', y: 'MMMM yyyy' })[fmt] ?? `%${fmt}`;
  }
  let out = '';
  for (let i = 0; i < fmt.length;) {
    const c = fmt[i];
    if (c === '%' ) { i++; continue; }
    if (c === '\\') { out += fmt[i + 1] ?? ''; i += 2; continue; }
    if (c === '"' || c === "'") { const j = fmt.indexOf(c, i + 1); out += fmt.slice(i + 1, j < 0 ? fmt.length : j); i = j < 0 ? fmt.length : j + 1; continue; }
    let n = 1; while (fmt[i + n] === c) n++;
    const h = d.getHours();
    switch (c) {
      case 'd': out += n === 1 ? d.getDate() : n === 2 ? pad(d.getDate()) : n === 3 ? loc.abbrDayNames[d.getDay()] : loc.dayNames[d.getDay()]; break;
      case 'M': out += n === 1 ? d.getMonth() + 1 : n === 2 ? pad(d.getMonth() + 1) : n === 3 ? `Thg${d.getMonth() + 1}` : loc.monthNames[d.getMonth()]; break;
      case 'y': out += n === 1 ? d.getFullYear() % 100 : n === 2 ? pad(d.getFullYear() % 100) : pad(d.getFullYear(), n); break;
      case 'H': out += n === 1 ? h : pad(h); break;
      case 'h': out += n === 1 ? (h % 12 || 12) : pad(h % 12 || 12); break;
      case 'm': out += n === 1 ? d.getMinutes() : pad(d.getMinutes()); break;
      case 's': out += n === 1 ? d.getSeconds() : pad(d.getSeconds()); break;
      case 'f': case 'F': { let s = pad(d.getMilliseconds(), 3).padEnd(n, '0').slice(0, n); if (c === 'F') s = s.replace(/0+$/, ''); out += s; break; }
      case 't': out += (h < 12 ? loc.am : loc.pm).slice(0, n === 1 ? 1 : undefined); break;
      case '/': out += '/'.repeat(n); break;
      case ':': out += ':'.repeat(n); break;
      default: out += c.repeat(n);
    }
    i += n;
  }
  return out;
}

/** Ngày ISO từ HTML ("2026-11-13", "2026-11-13T08:30:00") → Date theo giờ ghi (không đổi múi giờ). @param {string} s */
export function parseIsoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?/.exec(String(s || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0), +((m[7] || '0').padEnd(3, '0')));
}
