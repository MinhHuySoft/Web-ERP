// @ts-check
/**
 * Ngôn ngữ biểu thức an toàn của mẫu in (docs/kien-truc/06-mau-in.md §4): chỉ tính giá trị, không gán, không vòng lặp,
 * không truy cập đối tượng JS. Dùng chung cho trình thiết kế, xem trước và in.
 *
 * Cú pháp: `c ? a : b`, `or`/`||`, `and`/`&&`, `not`/`!`, `= == <> != < <= > >=`, `like`, `in (…)`, `+ - &`, `* / % \ mod`,
 * số, chuỗi '…' hoặc "…", `true false null`, cột `Ten`, `[Tên có dấu cách]`, tham số `@X` / `Param.X`, hệ thống `Sys.X`,
 * biến trang `PageNumber`…, hàm `Ten(…)` trong danh sách FUNCS.
 *
 * Quy ước giá trị: null nối chuỗi là rỗng, null trong phép tính là 0, chia cho 0 ra null; so sánh chuỗi không phân biệt
 * hoa thường (như DataTable/SQL Server của ERP); Round làm tròn nửa về chẵn như Math.Round của .NET.
 */
import { formatValue, makeLocale, parseIsoDate } from './netformat.js';
import { currencyToWords } from './words.js';

export const LIMITS = Object.freeze({ length: 2000, depth: 64, steps: 10000 });

/** Biến của bộ dựng (không phải cột dữ liệu). */
export const SPECIAL = new Set(['PageNumber', 'PageCount', 'GroupPageNumber', 'GroupPageCount', 'RowNumber', 'GroupRowNumber', 'GroupNumber',
  'IsFirstRowOfGroup', 'IsLastRowOfGroup', 'ReportTitle']);
/** Biến chỉ biết sau khi phân trang (bộ dựng tính lượt hai). */
export const PAGE_VARS = new Set(['PageNumber', 'PageCount', 'GroupPageNumber', 'GroupPageCount']);
export const AGGREGATES = new Set(['sum', 'count', 'countdistinct', 'avg', 'min', 'max', 'first', 'last', 'concat']);

/**
 * @typedef {{ t: 'lit', v: any } | { t: 'ref', name: string, kind: 'field'|'param'|'sys'|'var' } | { t: 'un', op: string, a: Ast }
 *   | { t: 'bin', op: string, a: Ast, b: Ast } | { t: 'cond', c: Ast, a: Ast, b: Ast } | { t: 'call', fn: string, args: Ast[] }
 *   | { t: 'in', a: Ast, list: Ast[], not: boolean } | { t: 'like', a: Ast, b: Ast, not: boolean }} Ast
 * @typedef {{ ast: Ast, src: string, fields: Set<string>, params: Set<string>, usesPage: boolean, usesAggregate: boolean }} Compiled
 * @typedef {{
 *   field?: (name: string) => any, hasField?: (name: string) => boolean, param?: (name: string) => any, sys?: (name: string) => any,
 *   special?: (name: string) => any, aggregate?: (fn: string, args: Ast[], ev: (a: Ast) => any) => any,
 *   locale?: import('./netformat.js').NetLocale, minorUnit?: (currency: string) => string, now?: () => Date, monthName?: (m: number) => string,
 * }} EvalCtx
 */

export class ExprError extends Error {
  /** @param {string} msg @param {number} [pos] */
  constructor(msg, pos = -1) { super(pos >= 0 ? `${msg} (vị trí ${pos + 1})` : msg); this.pos = pos; }
}

/* ===================== tách từ ===================== */

/** @typedef {{ k: 'num'|'str'|'id'|'op'|'param'|'eof', v: string, p: number }} Tok */

const OPS = ['<>', '<=', '>=', '==', '!=', '&&', '||', '(', ')', ',', '+', '-', '*', '/', '%', '\\', '&', '<', '>', '=', '!', '?', ':'];

/** @param {string} src @returns {Tok[]} */
function lex(src) {
  /** @type {Tok[]} */ const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.)/.exec(src.slice(i));
      out.push({ k: 'num', v: /** @type {RegExpExecArray} */ (m)[0], p: i }); i += /** @type {RegExpExecArray} */ (m)[0].length; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      for (;;) {
        if (j >= src.length) throw new ExprError('chuỗi chưa đóng', i);
        const d = src[j];
        if (d === '\\' && (src[j + 1] === c || src[j + 1] === '\\')) { s += src[j + 1]; j += 2; continue; }
        if (d === c && src[j + 1] === c) { s += c; j += 2; continue; }
        if (d === c) break;
        s += d; j++;
      }
      out.push({ k: 'str', v: s, p: i }); i = j + 1; continue;
    }
    if (c === '[') {
      const j = src.indexOf(']', i);
      if (j < 0) throw new ExprError('thiếu "]"', i);
      out.push({ k: 'id', v: src.slice(i + 1, j).trim(), p: i }); i = j + 1; continue;
    }
    if (c === '@') {
      const m = /^@([\p{L}_][\p{L}\p{N}_]*)/u.exec(src.slice(i));
      if (!m) throw new ExprError('tên tham số sau "@" không hợp lệ', i);
      out.push({ k: 'param', v: m[1], p: i }); i += m[0].length; continue;
    }
    const id = /^[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)*/u.exec(src.slice(i));
    if (id) { out.push({ k: 'id', v: id[0], p: i }); i += id[0].length; continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`ký tự không hợp lệ "${c}"`, i);
    out.push({ k: 'op', v: op, p: i }); i += op.length;
  }
  out.push({ k: 'eof', v: '', p: src.length });
  return out;
}

/* ===================== phân tích cú pháp ===================== */

/** @type {Map<string, Compiled>} */
const cache = new Map();

/**
 * Biên dịch biểu thức (có bộ đệm). Ném ExprError nếu sai cú pháp / vượt giới hạn / gọi hàm không có.
 * @param {string} src @returns {Compiled}
 */
export function compile(src) {
  const key = String(src ?? '');
  const hit = cache.get(key);
  if (hit) return hit;
  if (key.length > LIMITS.length) throw new ExprError(`biểu thức dài quá ${LIMITS.length} ký tự`);
  const toks = lex(key);
  let i = 0, depth = 0;
  /** @type {Compiled} */ const out = { ast: { t: 'lit', v: null }, src: key, fields: new Set(), params: new Set(), usesPage: false, usesAggregate: false };
  const peek = () => toks[i];
  const isKw = (/** @type {string} */ w) => peek().k === 'id' && peek().v.toLowerCase() === w;
  const isOp = (/** @type {string} */ o) => peek().k === 'op' && peek().v === o;
  const take = () => toks[i++];
  const expect = (/** @type {string} */ o) => { if (!isOp(o)) throw new ExprError(`cần "${o}"`, peek().p); return take(); };
  const enter = () => { if (++depth > LIMITS.depth) throw new ExprError('biểu thức lồng quá sâu', peek().p); };

  /** @returns {Ast} */
  const ternary = () => {
    enter();
    const c = or();
    let r = c;
    if (isOp('?')) { take(); const a = ternary(); expect(':'); const b = ternary(); r = { t: 'cond', c, a, b }; }
    depth--;
    return r;
  };
  const or = () => { let a = and(); while (isOp('||') || isKw('or') || isKw('orelse')) { take(); a = { t: 'bin', op: 'or', a, b: and() }; } return a; };
  const and = () => { let a = not(); while (isOp('&&') || isKw('and') || isKw('andalso')) { take(); a = { t: 'bin', op: 'and', a, b: not() }; } return a; };
  /** @returns {Ast} */
  const not = () => { if (isOp('!') || isKw('not')) { take(); enter(); const a = not(); depth--; return { t: 'un', op: 'not', a }; } return cmp(); };
  const cmp = () => {
    let a = add();
    for (;;) {
      if (peek().k === 'op' && ['=', '==', '<>', '!=', '<', '<=', '>', '>='].includes(peek().v)) {
        const op = take().v; a = { t: 'bin', op: op === '==' ? '=' : op === '!=' ? '<>' : op, a, b: add() };
      } else if (isKw('like') || (isKw('not') && ['like', 'in'].includes(toks[i + 1]?.v.toLowerCase()))) {
        let neg = false;
        if (isKw('not')) { take(); neg = true; }
        if (isKw('like')) { take(); a = { t: 'like', a, b: add(), not: neg }; }
        else { take(); a = inList(a, neg); }
      } else if (isKw('in')) { take(); a = inList(a, false); }
      else return a;
    }
  };
  /** @param {Ast} a @param {boolean} neg @returns {Ast} */
  const inList = (a, neg) => {
    expect('(');
    /** @type {Ast[]} */ const list = [];
    if (!isOp(')')) { list.push(ternary()); while (isOp(',')) { take(); list.push(ternary()); } }
    expect(')');
    return { t: 'in', a, list, not: neg };
  };
  const add = () => { let a = mul(); while (isOp('+') || isOp('-') || isOp('&')) { const op = take().v; a = { t: 'bin', op, a, b: mul() }; } return a; };
  const mul = () => {
    let a = unary();
    while (isOp('*') || isOp('/') || isOp('%') || isOp('\\') || isKw('mod')) { const t = take(); a = { t: 'bin', op: t.v.toLowerCase() === 'mod' ? '%' : t.v, a, b: unary() }; }
    return a;
  };
  /** @returns {Ast} */
  const unary = () => {
    if (isOp('-') || isOp('+')) { const op = take().v; enter(); const a = unary(); depth--; return op === '-' ? { t: 'un', op: 'neg', a } : a; }
    return primary();
  };
  /** @returns {Ast} */
  const primary = () => {
    const t = peek();
    if (isOp('(')) { take(); const a = ternary(); expect(')'); return a; }
    if (t.k === 'num') { take(); return { t: 'lit', v: Number(t.v) }; }
    if (t.k === 'str') { take(); return { t: 'lit', v: t.v }; }
    if (t.k === 'param') { take(); out.params.add(t.v); return { t: 'ref', name: t.v, kind: 'param' }; }
    if (t.k === 'id') {
      take();
      const low = t.v.toLowerCase();
      if (isOp('(')) {
        take();
        /** @type {Ast[]} */ const args = [];
        if (!isOp(')')) { args.push(ternary()); while (isOp(',')) { take(); args.push(ternary()); } }
        expect(')');
        const fn = low.replace(/^(math|strings|convert|system)\./, '');
        if (!FUNCS[fn] && !AGGREGATES.has(fn)) throw new ExprError(`không có hàm "${t.v}"`, t.p);
        if (AGGREGATES.has(fn) && !(fn === 'concat' && args.length !== 1) && !((fn === 'min' || fn === 'max') && args.length === 2)) out.usesAggregate = true;
        if (fn === 'now' || fn === 'today') { /* chạy lúc dựng */ }
        return { t: 'call', fn, args };
      }
      if (low === 'true') return { t: 'lit', v: true };
      if (low === 'false') return { t: 'lit', v: false };
      if (low === 'null' || low === 'nothing') return { t: 'lit', v: null };
      if (/^param\./i.test(t.v) || /^parameters\./i.test(t.v)) { const n = t.v.slice(t.v.indexOf('.') + 1); out.params.add(n); return { t: 'ref', name: n, kind: 'param' }; }
      if (/^sys\./i.test(t.v)) return { t: 'ref', name: t.v.slice(4), kind: 'sys' };
      if (/^fields\./i.test(t.v)) { const n = t.v.slice(7); out.fields.add(n); return { t: 'ref', name: n, kind: 'field' }; }
      const sp = [...SPECIAL].find((s) => s.toLowerCase() === low);
      if (sp) { if (PAGE_VARS.has(sp)) out.usesPage = true; return { t: 'ref', name: sp, kind: 'var' }; }
      out.fields.add(t.v);
      return { t: 'ref', name: t.v, kind: 'field' };
    }
    throw new ExprError(t.k === 'eof' ? 'biểu thức thiếu phần cuối' : `không mong đợi "${t.v}"`, t.p);
  };

  out.ast = ternary();
  if (peek().k !== 'eof') throw new ExprError(`thừa "${peek().v}"`, peek().p);
  if (cache.size > 5000) cache.clear();
  cache.set(key, out);
  return out;
}

/** Kiểm cú pháp, trả thông báo lỗi hoặc null. @param {string} src */
export function check(src) {
  try { compile(src); return null; } catch (e) { return /** @type {Error} */ (e).message; }
}

/* ===================== tính giá trị ===================== */

/** @param {any} v */
export function truthy(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === '' || s === 'false' || s === 'no') return false;
    if (s === 'true') return true;
    const n = Number(s.replace(',', '.'));
    return Number.isNaN(n) ? true : n !== 0;
  }
  return true;
}

/** @param {any} v @returns {number} */
export function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const s = String(v).trim();
  const n = Number(s);
  if (!Number.isNaN(n)) return n;
  const vn = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(vn) ? 0 : vn;
}

/** @param {any} v @returns {Date|null} */
function date(v) {
  if (v instanceof Date) return v;
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return new Date(v);
  const s = String(v).trim();
  const iso = parseIsoDate(s);
  if (iso) return iso;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return null;
}

const coll = new Intl.Collator('vi', { sensitivity: 'accent', numeric: false });

/** So sánh kiểu ERP: số với số, ngày với ngày, còn lại chuỗi không phân biệt hoa thường. @param {any} a @param {any} b */
function compare(a, b) {
  if (a instanceof Date || b instanceof Date) {
    const x = date(a), y = date(b);
    if (x && y) return x.getTime() - y.getTime();
  }
  const an = typeof a === 'number' || typeof a === 'boolean', bn = typeof b === 'number' || typeof b === 'boolean';
  if (an && bn) return num(a) - num(b);
  if (an || bn) {
    const other = an ? b : a;
    if (other !== '' && !Number.isNaN(Number(other))) return num(a) - num(b);
  }
  return coll.compare(String(a), String(b));
}

/** LIKE kiểu SQL: % * = chuỗi bất kỳ, _ ? = một ký tự; không phân biệt hoa thường. @param {string} s @param {string} p */
function like(s, p) {
  const rx = `^${p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*').replace(/[_?]/g, '.')}$`;
  return new RegExp(rx, 'is').test(s);
}

/** Math.Round của .NET: nửa về chẵn. @param {number} x @param {number} d */
export function roundEven(x, d = 0) {
  const f = 10 ** d;
  const y = Number((x * f).toPrecision(15));
  const fl = Math.floor(y);
  const diff = Number((y - fl).toPrecision(12));
  const r = diff > 0.5 ? fl + 1 : diff < 0.5 ? fl : (fl % 2 === 0 ? fl : fl + 1);
  return r / f;
}

/** @param {any} v @param {EvalCtx} ctx */
function str(v, ctx) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return formatValue(v, '', ctx.locale || makeLocale(null));
}

/** @typedef {(args: Ast[], ev: (a: Ast) => any, ctx: EvalCtx) => any} Fn */

/** @param {Date|null} d @param {(x: Date) => Date} f */
const dt = (d, f) => (d ? f(new Date(d.getTime())) : null);

/** @type {Record<string, Fn>} */
const FUNCS = {
  iif: (a, ev) => (truthy(ev(a[0])) ? ev(a[1]) : ev(a[2])),
  if: (a, ev) => (truthy(ev(a[0])) ? ev(a[1]) : ev(a[2])),
  isnull: (a, ev) => { const v = ev(a[0]); if (a.length < 2) return v === null || v === undefined; return v === null || v === undefined ? ev(a[1]) : v; },
  isempty: (a, ev) => { const v = ev(a[0]); return v === null || v === undefined || v === ''; },
  nz: (a, ev) => { const v = ev(a[0]); return v === null || v === undefined ? (a.length > 1 ? ev(a[1]) : '') : v; },
  coalesce: (a, ev) => { for (const x of a) { const v = ev(x); if (v !== null && v !== undefined && v !== '') return v; } return null; },
  len: (a, ev, c) => str(ev(a[0]), c).length,
  trim: (a, ev, c) => str(ev(a[0]), c).trim(),
  ltrim: (a, ev, c) => str(ev(a[0]), c).trimStart(),
  rtrim: (a, ev, c) => str(ev(a[0]), c).trimEnd(),
  upper: (a, ev, c) => str(ev(a[0]), c).toUpperCase(),
  ucase: (a, ev, c) => str(ev(a[0]), c).toUpperCase(),
  lower: (a, ev, c) => str(ev(a[0]), c).toLowerCase(),
  lcase: (a, ev, c) => str(ev(a[0]), c).toLowerCase(),
  left: (a, ev, c) => str(ev(a[0]), c).slice(0, Math.max(0, num(ev(a[1])))),
  right: (a, ev, c) => { const s = str(ev(a[0]), c); const n = Math.max(0, num(ev(a[1]))); return n ? s.slice(-n) : ''; },
  mid: (a, ev, c) => { const s = str(ev(a[0]), c); const st = Math.max(1, num(ev(a[1]))); return a.length > 2 ? s.substr(st - 1, Math.max(0, num(ev(a[2])))) : s.slice(st - 1); },
  substring: (a, ev, c) => { const s = str(ev(a[0]), c); const st = Math.max(0, num(ev(a[1]))); return a.length > 2 ? s.substr(st, Math.max(0, num(ev(a[2])))) : s.slice(st); },
  replace: (a, ev, c) => { const s = str(ev(a[0]), c); const f = str(ev(a[1]), c); return f ? s.split(f).join(str(ev(a[2]), c)) : s; },
  contains: (a, ev, c) => str(ev(a[0]), c).toLowerCase().includes(str(ev(a[1]), c).toLowerCase()),
  startswith: (a, ev, c) => str(ev(a[0]), c).toLowerCase().startsWith(str(ev(a[1]), c).toLowerCase()),
  endswith: (a, ev, c) => str(ev(a[0]), c).toLowerCase().endsWith(str(ev(a[1]), c).toLowerCase()),
  indexof: (a, ev, c) => str(ev(a[0]), c).indexOf(str(ev(a[1]), c)),
  padleft: (a, ev, c) => str(ev(a[0]), c).padStart(Math.min(500, num(ev(a[1]))), a.length > 2 ? str(ev(a[2]), c)[0] || ' ' : ' '),
  padright: (a, ev, c) => str(ev(a[0]), c).padEnd(Math.min(500, num(ev(a[1]))), a.length > 2 ? str(ev(a[2]), c)[0] || ' ' : ' '),
  space: (a, ev) => ' '.repeat(Math.max(0, Math.min(500, num(ev(a[0]))))),
  cstr: (a, ev, c) => str(ev(a[0]), c),
  tostring: (a, ev, c) => (a.length > 1 ? formatValue(ev(a[0]), str(ev(a[1]), c), c.locale || makeLocale(null)) : str(ev(a[0]), c)),
  format: (a, ev, c) => formatValue(ev(a[0]), a.length > 1 ? str(ev(a[1]), c) : '', c.locale || makeLocale(null)),
  val: (a, ev) => num(ev(a[0])),
  cdbl: (a, ev) => num(ev(a[0])),
  cdec: (a, ev) => num(ev(a[0])),
  cint: (a, ev) => roundEven(num(ev(a[0]))),
  clng: (a, ev) => roundEven(num(ev(a[0]))),
  cdate: (a, ev) => date(ev(a[0])),
  cbool: (a, ev) => truthy(ev(a[0])),
  round: (a, ev) => roundEven(num(ev(a[0])), a.length > 1 ? Math.max(0, Math.min(15, num(ev(a[1])))) : 0),
  floor: (a, ev) => Math.floor(num(ev(a[0]))),
  ceiling: (a, ev) => Math.ceil(num(ev(a[0]))),
  int: (a, ev) => Math.floor(num(ev(a[0]))),
  fix: (a, ev) => Math.trunc(num(ev(a[0]))),
  abs: (a, ev) => Math.abs(num(ev(a[0]))),
  sign: (a, ev) => Math.sign(num(ev(a[0]))),
  sqrt: (a, ev) => { const v = num(ev(a[0])); return v < 0 ? null : Math.sqrt(v); },
  power: (a, ev) => { const r = num(ev(a[0])) ** num(ev(a[1])); return Number.isFinite(r) ? r : null; },
  now: (_a, _e, c) => (c.now ? c.now() : new Date()),
  today: (_a, _e, c) => { const d = c.now ? c.now() : new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
  date: (a, ev) => new Date(num(ev(a[0])), num(ev(a[1])) - 1, num(ev(a[2]))),
  day: (a, ev) => date(ev(a[0]))?.getDate() ?? null,
  month: (a, ev) => { const d = date(ev(a[0])); return d ? d.getMonth() + 1 : null; },
  year: (a, ev) => date(ev(a[0]))?.getFullYear() ?? null,
  hour: (a, ev) => date(ev(a[0]))?.getHours() ?? null,
  minute: (a, ev) => date(ev(a[0]))?.getMinutes() ?? null,
  adddays: (a, ev) => dt(date(ev(a[0])), (d) => { d.setDate(d.getDate() + num(ev(a[1]))); return d; }),
  addmonths: (a, ev) => dt(date(ev(a[0])), (d) => { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + num(ev(a[1]))); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d; }),
  addyears: (a, ev) => dt(date(ev(a[0])), (d) => { d.setFullYear(d.getFullYear() + num(ev(a[1]))); return d; }),
  datediff: (a, ev, c) => {
    const u = str(ev(a[0]), c).toLowerCase(), x = date(ev(a[1])), y = date(ev(a[2]));
    if (!x || !y) return null;
    if (u === 'm' || u === 'month') return (y.getFullYear() - x.getFullYear()) * 12 + y.getMonth() - x.getMonth();
    if (u === 'y' || u === 'yyyy' || u === 'year') return y.getFullYear() - x.getFullYear();
    return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 864e5);
  },
  /** DateText(ngày, "Ngày {D} tháng {M} năm {Y}") — như DATETIMEREPORT của WinForms. */
  datetext: (a, ev, c) => dateText(date(ev(a[0])), a.length > 1 ? str(ev(a[1]), c) : 'Ngày {D} tháng {M} năm {Y}', ''),
  monthname: (a, ev, c) => { const m = num(ev(a[0])); return c.monthName ? c.monthName(m) : `Tháng ${m}`; },
  numbertowords: (a, ev, c) => {
    const cur = a.length > 1 ? str(ev(a[1]), c) : 'VND';
    const lang = a.length > 2 ? str(ev(a[2]), c) : 'VN';
    return currencyToWords(num(ev(a[0])), cur, lang, c.minorUnit ? c.minorUnit(cur) : '');
  },
  /** Min(a, b) / Max(a, b) hai đối số là hàm thường; một đối số là hàm tổng (bộ dựng xử lý). */
  min: (a, ev) => { const x = ev(a[0]), y = ev(a[1]); return compare(x, y) <= 0 ? x : y; },
  max: (a, ev) => { const x = ev(a[0]), y = ev(a[1]); return compare(x, y) >= 0 ? x : y; },
  concat: (a, ev, c) => a.map((x) => str(ev(x), c)).join(''),
  choose: (a, ev) => { const k = num(ev(a[0])); return k >= 1 && k < a.length ? ev(a[k]) : null; },
};

/** Danh sách hàm cho trình thiết kế (gợi ý khi gõ). */
export const FUNCTION_NAMES = Object.freeze([...Object.keys(FUNCS), ...AGGREGATES].filter((v, i, s) => s.indexOf(v) === i).sort());

/**
 * {D} {M} {Y} {YY} {longdate} {ReportLocation} như DATETIMEREPORT của ReportViewerFrm; ngày rỗng ⇒ để trống đúng độ rộng.
 * @param {Date|null} d @param {string} tpl @param {string} reportLocation
 */
export function dateText(d, tpl, reportLocation) {
  const two = (/** @type {number} */ n) => String(n).padStart(2, '0');
  if (!d) return tpl.split('{D}').join('  ').split('{M}').join('  ').split('{Y}').join('    ').split('{YY}').join('    ')
    .split('{longdate}').join('                ').split('{ReportLocation}').join(reportLocation);
  return tpl.split('{D}').join(two(d.getDate())).split('{M}').join(two(d.getMonth() + 1)).split('{Y}').join(String(d.getFullYear()))
    .split('{YY}').join(String(d.getFullYear() % 100)).split('{longdate}').join(`${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`)
    .split('{ReportLocation}').join(reportLocation);
}

/**
 * Tính giá trị. Lỗi lúc chạy (vượt số bước…) ném ExprError; bộ dựng bắt và in ô rỗng + ghi cảnh báo.
 * @param {Compiled|string} compiled @param {EvalCtx} ctx
 */
export function evaluate(compiled, ctx) {
  const c = typeof compiled === 'string' ? compile(compiled) : compiled;
  let steps = 0;
  /** @param {Ast} n @returns {any} */
  const ev = (n) => {
    if (++steps > LIMITS.steps) throw new ExprError('biểu thức tính quá lâu');
    switch (n.t) {
      case 'lit': return n.v;
      case 'ref':
        if (n.kind === 'param') return ctx.param ? ctx.param(n.name) ?? null : null;
        if (n.kind === 'sys') return ctx.sys ? ctx.sys(n.name) ?? null : null;
        if (n.kind === 'var') return ctx.special ? ctx.special(n.name) ?? null : null;
        if (ctx.hasField && !ctx.hasField(n.name) && ctx.param) { const p = ctx.param(n.name); if (p !== undefined) return p; }
        return ctx.field ? ctx.field(n.name) ?? null : null;
      case 'un': {
        const v = ev(n.a);
        return n.op === 'not' ? !truthy(v) : v === null ? null : -num(v);
      }
      case 'cond': return truthy(ev(n.c)) ? ev(n.a) : ev(n.b);
      case 'in': { const v = ev(n.a); const hit = n.list.some((x) => { const w = ev(x); return v === null ? w === null : w !== null && compare(v, w) === 0; }); return n.not ? !hit : hit; }
      case 'like': { const r = like(str(ev(n.a), ctx), str(ev(n.b), ctx)); return n.not ? !r : r; }
      case 'call': {
        if (AGGREGATES.has(n.fn) && !(n.fn === 'concat' && n.args.length !== 1) && !((n.fn === 'min' || n.fn === 'max') && n.args.length === 2)) {
          if (!ctx.aggregate) throw new ExprError(`hàm tổng ${n.fn} chỉ dùng trong mẫu in`);
          return ctx.aggregate(n.fn, n.args, ev);
        }
        return FUNCS[n.fn](n.args, ev, ctx);
      }
      case 'bin': {
        if (n.op === 'and') return truthy(ev(n.a)) && truthy(ev(n.b));
        if (n.op === 'or') return truthy(ev(n.a)) || truthy(ev(n.b));
        const a = ev(n.a), b = ev(n.b);
        switch (n.op) {
          case '&': return str(a, ctx) + str(b, ctx);
          case '+':
            if (typeof a === 'string' || typeof b === 'string') return str(a, ctx) + str(b, ctx);
            if (a instanceof Date && b !== null) return dt(a, (d) => { d.setTime(d.getTime() + num(b) * 864e5); return d; });
            return num(a) + num(b);
          case '-':
            if (a instanceof Date && b instanceof Date) return (a.getTime() - b.getTime()) / 864e5;
            if (a instanceof Date) return dt(a, (d) => { d.setTime(d.getTime() - num(b) * 864e5); return d; });
            return num(a) - num(b);
          case '*': return num(a) * num(b);
          case '/': { const d = num(b); return d === 0 ? null : num(a) / d; }
          case '\\': { const d = num(b); return d === 0 ? null : Math.trunc(num(a) / d); }
          case '%': { const d = num(b); return d === 0 ? null : num(a) % d; }
          case '=': case '<>': {
            let eq;
            if (a === null || a === undefined || b === null || b === undefined) eq = (a ?? '') === '' && (b ?? '') === '';
            else eq = compare(a, b) === 0;
            return n.op === '=' ? eq : !eq;
          }
          default: {
            if (a === null || a === undefined || b === null || b === undefined) return false;
            const r = compare(a, b);
            return n.op === '<' ? r < 0 : n.op === '<=' ? r <= 0 : n.op === '>' ? r > 0 : r >= 0;
          }
        }
      }
      default: return null;
    }
  };
  return ev(c.ast);
}
