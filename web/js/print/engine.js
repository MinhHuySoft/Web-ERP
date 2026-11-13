// @ts-check
/**
 * Bộ dựng mẫu in: mẫu `erp-print-template/1` + dữ liệu → danh sách trang, mỗi trang là các hộp tuyệt đối (mm). Không đụng
 * DOM (đo chữ qua `opts.measure`), nên dùng chung cho xem trước, in, trình thiết kế và test trong Node.
 *
 * Trình tự (docs/kien-truc/06-mau-in.md §5): sắp dữ liệu theo cột nhóm → cây nhóm → luồng band → dàn từng band (đo ô
 * CanGrow, đẩy ô bên dưới, kéo ô tới đáy band) → phân trang (sang trang trước/sau nhóm, giữ liền, lặp tiêu đề nhóm, in ở
 * đáy trang) → lượt hai cho số trang, tổng trang.
 *
 * Hành vi lấy theo ActiveReports 3 + ReportViewerFrm của ERP.NET; chỗ còn suy luận ghi [S] trong tài liệu.
 */
import { compile, evaluate, truthy, num, roundEven, dateText, ExprError } from './expr.js';
import { formatValue, formatNumber, makeLocale } from './netformat.js';
import { currencyToWords } from './words.js';

/**
 * @typedef {Record<string, any>} Obj
 * @typedef {{ name: string, type: string }} Column
 * @typedef {{ columns: Column[], rows: Obj[] }} DataSet
 * @typedef {{ main: DataSet, sets?: DataSet[], params?: Map<string, any>, paramCaptions?: Map<string, string>, sys?: Map<string, any>|null,
 *   lang?: Map<string, string>, images?: Map<string, string> }} PrintData
 * @typedef {{ text: string, style: Obj, wMm: number, padding: Obj }} MeasureReq
 * @typedef {{ measure?: (r: MeasureReq) => number, now?: Date, locale?: Partial<import('./netformat.js').NetLocale>|null, maxPages?: number }} BuildOpts
 * @typedef {{ kind: 'text'|'line'|'rect'|'image'|'checkbox'|'barcode'|'placeholder', x: number, y: number, w: number, h: number, text?: string,
 *   style?: Obj, border?: Obj, padding?: Obj, src?: string|null, fit?: string, x2?: number, y2?: number, lineStyle?: string, weight?: number,
 *   color?: string, fill?: string, radius?: number, checked?: boolean, caption?: string, symbology?: string, showText?: boolean,
 *   ctl?: string, band?: string, deferred?: (p: PageInfo) => string }} Box
 * @typedef {{ number: number, count: number, groupNumber: (g?: string) => number, groupCount: (g?: string) => number, rows: number[] }} PageInfo
 * @typedef {{ width: number, height: number, boxes: Box[] }} Page
 */

const DEFAULT_STYLE = { font: 'Arial', size: 10, bold: false, italic: false, underline: false, strike: false, color: '#000000', align: 'left', valign: 'top', wrap: true };
const PT_MM = 25.4 / 72;

/** Ước lượng chiều cao chữ khi không có DOM (Node / test). @param {MeasureReq} r */
export function estimateHeight(r) {
  const size = r.style.size || 10;
  const line = size * 1.2 * PT_MM;
  const pad = ((r.padding?.t || 0) + (r.padding?.b || 0)) * PT_MM;
  const usable = Math.max(1, r.wMm - ((r.padding?.l || 0) + (r.padding?.r || 0)) * PT_MM);
  const charW = size * 0.5 * PT_MM;
  let lines = 0;
  for (const para of String(r.text).split('\n')) lines += r.style.wrap === false ? 1 : Math.max(1, Math.ceil((para.length * charW) / usable));
  return lines * line + pad;
}

/* ===================== dữ liệu ===================== */

/** Bảng dữ liệu tra cột không phân biệt hoa thường. */
class Table {
  /** @param {DataSet} ds */
  constructor(ds) {
    this.columns = ds?.columns || [];
    this.rows = ds?.rows || [];
    /** @type {Map<string,string>} */ this.map = new Map();
    for (const c of this.columns) this.map.set(c.name.toLowerCase(), c.name);
    if (!this.columns.length && this.rows[0]) for (const k of Object.keys(this.rows[0])) this.map.set(k.toLowerCase(), k);
  }
  /** @param {string} n */ key(n) { return this.map.get(String(n).toLowerCase()); }
  /** @param {string} n */ has(n) { return this.map.has(String(n).toLowerCase()); }
  /** @param {number} i @param {string} n */ get(i, n) { const k = this.key(n); const r = this.rows[i]; return k === undefined || !r ? null : (Object.hasOwn(r, k) ? r[k] : null); }
}

/** @param {any} a @param {any} b */
function cmpValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'vi', { sensitivity: 'base' });
}

/** @param {any} v */
const keyOf = (v) => (v === null || v === undefined ? '\u0000' : v instanceof Date ? `d${v.getTime()}` : String(v));

/* ===================== tổng ===================== */

/**
 * @param {string} func @param {any[]} values @param {{ distinct?: boolean, separator?: string }} [o]
 */
function aggregate(func, values, o = {}) {
  const f = func.toLowerCase();
  if (f === 'concat') {
    const seen = new Set();
    /** @type {string[]} */ const out = [];
    for (const v of values) {
      if (v === null || v === undefined || v === '') continue;
      const s = String(v);
      if (o.distinct) { if (seen.has(s)) continue; seen.add(s); }
      out.push(s);
    }
    return out.join(o.separator ?? '; ');
  }
  let vals = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (o.distinct) { const seen = new Set(); vals = vals.filter((v) => { const k = keyOf(v); if (seen.has(k)) return false; seen.add(k); return true; }); }
  if (f === 'count') return vals.length;
  if (f === 'countdistinct') return new Set(vals.map(keyOf)).size;
  if (f === 'first') return vals[0] ?? null;
  if (f === 'last') return vals[vals.length - 1] ?? null;
  if (f === 'min' || f === 'max') {
    if (!vals.length) return null;
    return vals.reduce((m, v) => ((f === 'min' ? cmpValues(v, m) < 0 : cmpValues(v, m) > 0) ? v : m));
  }
  const nums = vals.map(num);
  const sum = nums.reduce((s, x) => s + x, 0);
  if (f === 'sum') return Number(sum.toPrecision(15));
  if (f === 'avg') return nums.length ? sum / nums.length : null;
  if (f.startsWith('var') || f.startsWith('stddev')) {
    const n = nums.length;
    if (n < (f.endsWith('p') ? 1 : 2)) return null;
    const mean = sum / n;
    const v = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (f.endsWith('p') ? n : n - 1);
    return f.startsWith('var') ? v : Math.sqrt(v);
  }
  return null;
}

/* ===================== bộ dựng ===================== */

/**
 * @param {Obj} template mẫu erp-print-template/1
 * @param {PrintData} data
 * @param {BuildOpts} [opts]
 * @returns {{ pages: Page[], warnings: string[] }}
 */
export function buildDocument(template, data, opts = {}) {
  /** @type {string[]} */ const warnings = [];
  const warnOnce = new Set();
  const warn = (/** @type {string} */ m) => { if (!warnOnce.has(m)) { warnOnce.add(m); warnings.push(m); } };
  const locale = makeLocale({ ...(template.locale || {}), ...(opts.locale || {}) });
  const measure = opts.measure || estimateHeight;
  const now = opts.now || new Date();
  const maxPages = opts.maxPages || 2000;
  const params = data.params || new Map();
  const sysMap = data.sys ?? null;
  const lang = data.lang || new Map();
  const T = new Table(data.main);
  const page = template.page;
  const styles = template.styles || {};
  const normal = { ...DEFAULT_STYLE, ...(styles.Normal || {}) };
  const getParam = (/** @type {string} */ n) => { for (const [k, v] of params) if (k.toLowerCase() === String(n).toLowerCase()) return v; return undefined; };
  const getSys = (/** @type {string} */ n) => { if (!sysMap) return undefined; for (const [k, v] of sysMap) if (k.toLowerCase() === String(n).toLowerCase()) return v; return undefined; };
  const getLang = (/** @type {string} */ n) => { for (const [k, v] of lang) if (k.toLowerCase() === String(n).toLowerCase()) return v; return undefined; };
  const minorUnit = (/** @type {string} */ c) => String(getSys(`CurrencyMinor.${c}`) ?? '');

  // ---- 1. sắp dữ liệu ----
  const groups = /** @type {Obj[]} */ (template.groups || []);
  /** @type {number[]} */ let order = T.rows.map((_r, i) => i);
  const sort = template.data?.sort || { auto: true };
  if (sort.auto !== false) {
    const keys = [...groups.map((g) => g.by).filter(Boolean), ...(sort.by || [])].filter((k, i, s) => s.indexOf(k) === i && T.has(k));
    if (keys.length) order = order.slice().sort((a, b) => { for (const k of keys) { const c = cmpValues(T.get(a, k), T.get(b, k)); if (c) return c; } return a - b; });
  }
  const rowAt = (/** @type {number} */ i) => order[i];
  const N = order.length;

  // ---- 2. cây nhóm: mỗi cấp một danh sách đoạn [s, e) ----
  /** @type {{ s: number, e: number, n: number }[][]} */ const inst = groups.map(() => []);
  for (let level = 0; level < groups.length; level++) {
    const by = groups[level].by;
    let s = 0;
    for (let i = 1; i <= N; i++) {
      const parentBreak = level > 0 && inst[level - 1].some((p) => p.s === i);
      const change = i === N || parentBreak || (by && keyOf(T.get(rowAt(i), by)) !== keyOf(T.get(rowAt(i - 1), by)));
      if (change) { inst[level].push({ s, e: i, n: inst[level].length + 1 }); s = i; }
    }
    if (N === 0) inst[level].push({ s: 0, e: 0, n: 1 });
  }
  const groupIndex = new Map(groups.map((g, i) => [g.id, i]));
  /** Đoạn của cấp `level` chứa dòng i. @param {number} level @param {number} i */
  const instAt = (level, i) => inst[level].find((g) => i >= g.s && i < g.e) || inst[level][inst[level].length - 1];

  // ---- 3. luồng band ----
  const bands = /** @type {Obj[]} */ (template.bands || []);
  const bandOf = (/** @type {string} */ type, /** @type {string|null} */ gid = null) => bands.find((b) => b.type === type && (gid === null || b.group === gid));
  /** @typedef {{ band: Obj, kind: string, row: number, level: number, g: { s: number, e: number, n: number }|null }} Item */
  /** @type {Item[]} */ const stream = [];
  const rh = bandOf('reportHeader'), rf = bandOf('reportFooter'), ph = bandOf('pageHeader'), pf = bandOf('pageFooter'), det = bandOf('detail');
  if (rh) stream.push({ band: rh, kind: 'rh', row: 0, level: -1, g: null });
  stream.push({ band: /** @type {Obj} */ ({ type: 'phFirst', controls: [] }), kind: 'phFirst', row: 0, level: -1, g: null });
  const ghs = groups.map((g) => bandOf('groupHeader', g.id));
  const gfs = groups.map((g) => bandOf('groupFooter', g.id));
  for (let i = 0; i < N || (i === 0 && N === 0 && groups.length); i++) {
    for (let l = 0; l < groups.length; l++) {
      const g = instAt(l, i);
      if (g.s === i) { const b = ghs[l]; if (b) stream.push({ band: b, kind: 'gh', row: i, level: l, g }); }
    }
    if (det && N > 0) stream.push({ band: det, kind: 'detail', row: i, level: groups.length, g: groups.length ? instAt(groups.length - 1, i) : null });
    for (let l = groups.length - 1; l >= 0; l--) {
      const g = instAt(l, i);
      if (g.e - 1 === i || (N === 0)) { const b = gfs[l]; if (b) stream.push({ band: b, kind: 'gf', row: Math.max(0, g.e - 1), level: l, g }); }
    }
    if (N === 0) break;
  }
  if (rf) stream.push({ band: rf, kind: 'rf', row: Math.max(0, N - 1), level: -1, g: null });

  // ---- 4. tính giá trị ô ----
  /** @type {Map<string, string>} */ const lastText = new Map();

  /**
   * Ngữ cảnh biểu thức cho một dòng / nhóm.
   * @param {number} i chỉ số dòng đã sắp @param {Item|null} item @param {PageInfo|null} pg
   */
  const evalCtx = (i, item, pg) => {
    /** @type {import('./expr.js').EvalCtx} */
    const c = {
      locale, now: () => now, minorUnit,
      field: (n) => (N ? T.get(rowAt(Math.min(i, N - 1)), n) : null),
      hasField: (n) => T.has(n),
      param: (n) => getParam(n),
      sys: (n) => getSys(n),
      monthName: (m) => getLang(`Month${m}`) ?? `Tháng ${m}`,
      special: (n) => {
        if (n === 'PageNumber') return pg ? pg.number : 1;
        if (n === 'PageCount') return pg ? pg.count : 1;
        if (n === 'GroupPageNumber') return pg ? pg.groupNumber() : 1;
        if (n === 'GroupPageCount') return pg ? pg.groupCount() : 1;
        if (n === 'RowNumber') return i + 1;
        if (n === 'GroupRowNumber') return item?.g ? i - item.g.s + 1 : i + 1;
        if (n === 'GroupNumber') return item?.g ? item.g.n : 1;
        if (n === 'IsFirstRowOfGroup') return item?.g ? i === item.g.s : i === 0;
        if (n === 'IsLastRowOfGroup') return item?.g ? i === item.g.e - 1 : i === N - 1;
        if (n === 'ReportTitle') return template.title || '';
        return null;
      },
      aggregate: (fn, args, ev) => {
        let range = item?.g && item.kind !== 'rf' && item.kind !== 'rh' ? item.g : { s: 0, e: N };
        if (args.length > 1 && args[1].t === 'lit' && typeof args[1].v === 'string') {
          const l = groupIndex.get(args[1].v);
          range = args[1].v.toLowerCase() === 'report' ? { s: 0, e: N } : l !== undefined ? instAt(l, i) : range;
        }
        if (pg && args.length > 1 && args[1].t === 'lit' && args[1].v === 'page') return aggregate(fn, pg.rows.map((r) => evaluate({ ast: args[0], src: '', fields: new Set(), params: new Set(), usesPage: false, usesAggregate: false }, evalCtx(r, item, null))));
        /** @type {any[]} */ const vals = [];
        for (let r = range.s; r < range.e; r++) {
          const sub = evalCtx(r, item, pg);
          vals.push(args.length ? evaluate({ ast: args[0], src: '', fields: new Set(), params: new Set(), usesPage: false, usesAggregate: false }, sub) : 1);
        }
        return aggregate(fn, vals);
      },
    };
    return c;
  };

  /** @param {string} src @param {number} i @param {Item|null} item @param {PageInfo|null} pg @param {any} fallback */
  const safeEval = (src, i, item, pg, fallback) => {
    try { return evaluate(compile(src), evalCtx(i, item, pg)); }
    catch (e) { warn(`Biểu thức lỗi "${String(src).slice(0, 60)}": ${/** @type {Error} */ (e).message}`); return fallback; }
  };

  /** Giá trị gốc (chưa định dạng) của một ô văn bản. @param {Obj} c @param {number} i @param {Item} item @param {PageInfo|null} pg */
  const rawValue = (c, i, item, pg) => {
    const v = c.value || {};
    if (c.summary) return summaryValue(c, i, item, pg);
    if ('field' in v && !('dateText' in v)) return N ? T.get(rowAt(Math.min(i, N - 1)), v.field) : null;
    if ('expr' in v) return safeEval(v.expr, i, item, pg, null);
    if ('exprRaw' in v) { warn(`Ô ${c.id}: biểu thức gốc chưa chuyển được, in rỗng`); return null; }
    return undefined;
  };

  /** @param {Obj} c @param {number} i @param {Item} item @param {PageInfo|null} pg */
  const summaryValue = (c, i, item, pg) => {
    const s = c.summary;
    const v = c.value || {};
    const val = (/** @type {number} */ r) => {
      if ('field' in v) return T.get(rowAt(r), v.field);
      if ('expr' in v) return safeEval(v.expr, r, item, pg, null);
      return 1;
    };
    let lo = 0, hi = N;
    if (s.scope?.startsWith('group:')) {
      const l = groupIndex.get(s.scope.slice(6));
      const g = l !== undefined ? instAt(l, i) : item.g;
      if (g) { lo = g.s; hi = g.e; }
    } else if (s.scope === 'page') {
      if (!pg) return null;
      const rows = pg.rows;
      return aggregate(s.func, rows.map(val), { distinct: s.distinct, separator: s.separator });
    }
    if (s.running === 'all') { lo = 0; hi = i + 1; }
    else if (s.running === 'group') {
      const g = s.scope?.startsWith('group:') ? null : item.g;
      if (g) lo = g.s;
      hi = i + 1;
    }
    /** @type {any[]} */ const vals = [];
    if (s.distinctField) {
      const seen = new Set();
      for (let r = lo; r < hi; r++) { const k = keyOf(T.get(rowAt(r), s.distinctField)); if (seen.has(k)) continue; seen.add(k); vals.push(val(r)); }
    } else for (let r = lo; r < hi; r++) vals.push(val(r));
    return aggregate(s.func, vals, { distinct: s.distinct, separator: s.separator });
  };

  /** Chữ hiển thị của ô (theo đúng thứ tự xử lý của ReportViewerFrm). @param {Obj} c @param {number} i @param {Item} item @param {PageInfo|null} pg */
  const textOf = (c, i, item, pg) => {
    const v = c.value || {};
    if ('text' in v && !c.summary) return String(v.text ?? '');
    if ('template' in v) {
      return String(v.template).replace(/\{([A-Za-z0-9_]+)\}/g, (m, n) => {
        if (!T.has(n)) return m;
        const x = N ? T.get(rowAt(Math.min(i, N - 1)), n) : null;
        return x instanceof Date ? formatValue(x, 'dd/MM/yyyy', locale) : formatValue(x, '', locale);
      });
    }
    if ('dateText' in v) {
      const d = v.field ? (N ? T.get(rowAt(Math.min(i, N - 1)), v.field) : null) : (getSys('ServerDate') ?? now);
      const dd = d instanceof Date ? d : d ? new Date(String(d)) : null;
      return dateText(dd && !Number.isNaN(dd.getTime()) ? dd : null, String(v.dateText || ''), String(getSys('ReportLocation') ?? ''));
    }
    if ('sys' in v) { const s = getSys(v.sys); return s === undefined ? (sysMap ? '' : String(v.fallback ?? '')) : String(s ?? ''); }
    if ('lang' in v) return String(getLang(v.lang) ?? v.fallback ?? '');
    if ('subtitle' in v) return String(getSys('SubTitle') ?? (sysMap ? '' : v.fallback ?? ''));
    if ('paramCaption' in v) return String(data.paramCaptions?.get(v.paramCaption) ?? v.fallback ?? '');
    if ('userInput' in v) { const p = getParam(v.userInput); return p === undefined ? String(v.fallback ?? '') : String(p ?? ''); }
    if ('printDate' in v) { const on = getSys('ReportPrintDate'); return on === undefined || truthy(on) ? formatValue(now, 'dd/MM/yyyy HH:mm', locale) : ''; }
    if ('pageInfo' in v) {
      const word = v.pageInfo === 'EN' ? 'Page' : v.pageInfo === 'VN' ? 'Trang' : String(getLang('LngPage') ?? 'Trang');
      const n = pg ? (v.groupScope ? pg.groupNumber(v.groupScope) : pg.number) : 1;
      const m = pg ? (v.groupScope ? pg.groupCount(v.groupScope) : pg.count) : 1;
      return `${word} ${n}/${m}`;
    }
    let raw = rawValue(c, i, item, pg);
    if (raw === undefined) return '';
    if (c.abs && typeof raw === 'number') raw = Math.abs(raw);
    const fmt = c.format;
    if (fmt && typeof fmt === 'object') {
      if (fmt.kind === 'words') {
        const n = num(raw);
        const w = currencyToWords(fmt.abs ? Math.abs(n) : n, fmt.currency || 'VND', fmt.lang || 'VN', minorUnit(fmt.currency || 'VND'));
        return indent(c, w ?? formatValue(raw, '', locale));
      }
      if (fmt.kind === 'monthName') return getLang(`Month${raw}`) ?? `Tháng ${raw ?? ''}`;
      if (fmt.kind === 'date') raw = raw instanceof Date ? raw : raw;
    }
    const f = typeof fmt === 'string' ? fmt : '';
    let text;
    if ((f === '#,###.##' || f === '#,###.####') && typeof raw === 'number' && raw < 1 && raw > -1) {
      const r = roundEven(raw, 2);
      text = formatValue(r, f, locale);
      if (r > 0) text = `0${text}`; else if (r < 0) text = text.replace('-', '-0');
    } else text = formatValue(raw, f, locale);
    if (c.suppressZero && num(raw) === 0) text = '';
    if (c.roundIfInteger && typeof raw === 'number' && raw === roundEven(raw, 0)) text = formatNumber(raw, '#,##0', locale);
    return indent(c, text);
  };
  const indent = (/** @type {Obj} */ c, /** @type {string} */ t) => (c.indent ? ' '.repeat(c.indent) + t : t);

  /** @param {Obj} c @param {Obj} st @param {number} i @param {Item} item @param {PageInfo|null} pg */
  const applyRules = (c, st, i, item, pg) => {
    for (const r of c.rules || []) {
      if (!truthy(safeEval(r.when || 'true', i, item, pg, false))) continue;
      if (r.style) Object.assign(st, r.style);
      if (r.styleFrom) for (const [k, col] of Object.entries(r.styleFrom)) { const color = cssColor(N ? T.get(rowAt(Math.min(i, N - 1)), String(col)) : null); if (color) st[k] = color; }
    }
    return st;
  };

  // ---- 5. dàn một band ----
  /**
   * @param {Item} item @param {PageInfo|null} pg
   * @returns {{ height: number, boxes: Box[], visible: boolean }}
   */
  const layoutBand = (item, pg) => {
    const b = item.band;
    const i = item.row;
    if (b.visible === false) return { height: 0, boxes: [], visible: false };
    if (b.visibleWhen && !truthy(safeEval(b.visibleWhen, i, item, pg, true))) return { height: 0, boxes: [], visible: false };
    /** @type {{ c: Obj, box: Box, grow: number }[]} */ const laid = [];
    for (const c of b.controls || []) {
      if (c.visible === false) continue;
      if (c.visibleWhen && !truthy(safeEval(c.visibleWhen, i, item, pg, true))) continue;
      const st = applyRules(c, { ...normal, ...(c.style || {}) }, i, item, pg);
      /** @type {Box} */ let box;
      if (c.type === 'line') box = { kind: 'line', x: c.x1, y: c.y1, x2: c.x2, y2: c.y2, w: 0, h: 0, lineStyle: c.style?.lineStyle || 'solid', weight: c.weight || 1, color: c.color };
      else if (c.type === 'rect') box = { kind: 'rect', x: c.x, y: c.y, w: c.w, h: c.h, border: c.border, fill: c.fill, radius: c.radius, weight: c.weight };
      else if (c.type === 'image') box = { kind: 'image', x: c.x, y: c.y, w: c.w, h: c.h, src: imageSrc(c, i), fit: c.fit, border: c.border };
      else if (c.type === 'checkbox') box = { kind: 'checkbox', x: c.x, y: c.y, w: c.w, h: c.h, checked: truthy(rawValue(c, i, item, pg) ?? false), caption: c.caption, style: st, border: c.border, padding: c.padding };
      else if (c.type === 'barcode') { const t = textOf(c, i, item, pg); box = { kind: 'barcode', x: c.x, y: c.y, w: c.w, h: c.h, text: t, symbology: c.symbology, showText: !!c.caption, style: st }; }
      else if (c.type === 'text') {
        const usesPage = pageDependent(c);
        const text = textOf(c, i, item, pg);
        if (c.hideIfEmpty && text === '') continue;
        if (c.hideDuplicates && item.kind === 'detail') {
          const k = `${b.id}/${c.id}`;
          const dup = lastText.get(k) === text;
          lastText.set(k, text);
          if (dup && c.hideDuplicates === 'control') continue;
          if (dup) { laid.push({ c, box: { kind: 'text', x: c.x, y: c.y, w: c.w, h: c.h, text: '', style: st, border: c.border, padding: c.padding, ctl: c.id }, grow: 0 }); continue; }
        }
        box = { kind: 'text', x: c.x, y: c.y, w: c.w, h: c.h, text, style: st, border: c.border, padding: c.padding, ctl: c.id };
        if (usesPage) box.deferred = (p) => textOf(c, i, item, p);
      } else if (c.type === 'subreport') { warn('Subreport chưa in được trên web (giai đoạn sau)'); continue; }
      else if (c.type === 'crossLine' || c.type === 'chart' || c.type === 'pageBreak') { if (c.type !== 'pageBreak') warn(`Control ${c.type} chưa in được trên web`); continue; }
      else continue;
      let grow = 0;
      if (box.kind === 'text' && c.canGrow && box.text) {
        const need = measure({ text: box.text, style: st, wMm: c.w, padding: c.padding || {} });
        if (need > c.h + 0.05) grow = need - c.h;
      }
      laid.push({ c, box, grow });
    }
    // Ô lớn lên đẩy các ô nằm hẳn bên dưới nó xuống [S]
    const growers = laid.filter((l) => l.grow > 0);
    for (const l of laid) {
      const top = l.box.kind === 'line' ? Math.min(l.box.y, l.box.y2 ?? l.box.y) : l.box.y;
      let shift = 0;
      for (const g of growers) if (g !== l && g.c.y + g.c.h <= top + 0.01) shift = Math.max(shift, g.grow);
      if (shift) { l.box.y += shift; if (l.box.kind === 'line') l.box.y2 = (l.box.y2 ?? 0) + shift; }
      if (l.grow) l.box.h += l.grow;
    }
    let height = b.height || 0;
    const bottom = Math.max(0, ...laid.map((l) => (l.box.kind === 'line' ? Math.max(l.box.y, l.box.y2 ?? 0) : l.box.y + l.box.h)));
    if (b.canGrow !== false && bottom > height) height = bottom;
    if (b.canShrink) height = Math.min(height, bottom);
    if (b.stretchControls && b.canGrow !== false && height > (b.height || 0) + 0.01) {
      for (const l of laid) if (l.box.kind === 'text' && l.c.canGrow) l.box.h = Math.max(l.box.h, height - l.box.y - 0.01 * PT_MM);
    }
    const boxes = laid.map((l) => { l.box.band = b.id; return l.box; });
    if (b.background) boxes.unshift({ kind: 'rect', x: 0, y: 0, w: page.bodyWidth, h: height, fill: b.background, band: b.id });
    return { height, boxes, visible: true };
  };

  /** @param {Obj} c */
  const pageDependent = (c) => {
    const v = c.value || {};
    if ('pageInfo' in v) return true;
    if (c.summary?.scope === 'page') return true;
    if ('expr' in v) { try { return compile(v.expr).usesPage; } catch { return false; } }
    return false;
  };

  /** @param {Obj} c @param {number} i */
  const imageSrc = (c, i) => {
    const s = c.src;
    if (!s) return null;
    if (s.asset) { const a = template.assets?.[s.asset]; if (!a) return null; if (a.href) return a.href; if (a.data && /^image\/(png|jpeg|gif|bmp)$/.test(a.mime)) return `data:${a.mime};base64,${a.data}`; return null; }
    if (s.system) return data.images?.get(s.system) ?? null;
    if (s.field) { const v = N ? T.get(rowAt(Math.min(i, N - 1)), s.field) : null; return typeof v === 'string' && /^(data:image\/(png|jpeg|gif);base64,|\/|https?:)/.test(v) ? v : null; }
    return null;
  };

  // ---- 6. phân trang ----
  const bodyTop = page.margin.top, bodyLeft = page.margin.left;
  const pageBottom = page.height - page.margin.bottom;
  /** @type {Page[]} */ const pages = [];
  /** @type {{ rows: number[], groupStart: Map<string, { s: number, e: number }>, pfBox: Box[]|null }[]} */ const meta = [];
  /** @type {Map<string, Map<number, { first: number, last: number }>>} */ const groupPages = new Map(groups.map((g) => [g.id, new Map()]));
  let cur = /** @type {Page} */ ({ width: page.width, height: page.height, boxes: [] });
  let y = bodyTop;
  let pfReserve = 0;
  let bodyEmpty = true;
  /** @type {Item[]} */ let openHeaders = []; // tiêu đề nhóm đang mở (để lặp ở trang mới)

  const pfHeight = () => {
    if (!pf) return 0;
    const l = layoutBand({ band: pf, kind: 'pf', row: 0, level: -1, g: null }, null);
    return l.visible ? l.height : 0;
  };
  pfReserve = pfHeight();
  const limit = () => pageBottom - pfReserve;

  /** @param {Box[]} boxes @param {number} top */
  const put = (boxes, top) => {
    for (const bx of boxes) { bx.x += bodyLeft; bx.y += top; if (bx.kind === 'line') { bx.x2 = (bx.x2 ?? 0) + bodyLeft; bx.y2 = (bx.y2 ?? 0) + top; } cur.boxes.push(bx); }
  };
  const startPage = (/** @type {boolean} */ first) => {
    if (!first) {
      pages.push(cur);
      if (pages.length >= maxPages) throw new ExprError(`Quá ${maxPages} trang — dừng dựng`);
      cur = { width: page.width, height: page.height, boxes: [] };
      meta.push({ rows: [], groupStart: new Map(), pfBox: null });
    } else meta.push({ rows: [], groupStart: new Map(), pfBox: null });
    y = bodyTop;
    bodyEmpty = true;
    if (!first && ph) placePageHeader();
    if (!first) for (const h of openHeaders) if (groups[h.level]?.repeatHeader === 'onPage') { const l = layoutBand(h, null); if (l.visible) { put(l.boxes, y); y += l.height; } }
  };
  const placePageHeader = () => {
    if (!ph) return;
    const pi = pages.length;
    const l = layoutBand({ band: ph, kind: 'ph', row: meta[pi]?.rows[0] ?? 0, level: -1, g: null }, pageInfoStub(pi));
    if (l.visible) { put(l.boxes, y); y += l.height; }
  };
  /** Thông tin trang tạm khi dàn (số trang tổng chưa biết). @param {number} pi */
  const pageInfoStub = (pi) => ({ number: pi + 1, count: 999, groupNumber: () => 1, groupCount: () => 99, rows: meta[pi]?.rows || [] });

  startPage(true);
  /** @param {number} from */
  const heightOf = (from, to) => { let h = 0; for (let k = from; k < to; k++) h += laidStream[k].height; return h; };
  const laidStream = stream.map((it) => (it.kind === 'phFirst' ? { height: 0, boxes: [], visible: true } : layoutBand(it, null)));
  for (let k = 0; k < stream.length; k++) {
    const it = stream[k];
    if (it.kind === 'phFirst') { placePageHeader(); continue; }
    let l = laidStream[k];
    const g = it.level >= 0 && it.level < groups.length ? groups[it.level] : null;
    if (it.kind === 'gh' && g?.newPage === 'before' && !bodyEmpty) startPage(false);
    if (!l.visible) {
      if (it.kind === 'gh') openHeaders = [...openHeaders.filter((h) => h.level < it.level), it];
      if (it.kind === 'gf') openHeaders = openHeaders.filter((h) => h.level < it.level);
      continue;
    }
    // giữ liền nhóm / band
    let need = l.height;
    if (it.kind === 'gh' && g) {
      if (g.keepTogether === 'all') {
        let e = k + 1; while (e < stream.length && !(stream[e].kind === 'gf' && stream[e].level === it.level) && !(stream[e].kind === 'gh' && stream[e].level <= it.level)) e++;
        const whole = heightOf(k, Math.min(stream.length, e + 1));
        need = whole <= limit() - bodyTop ? whole : l.height + (laidStream[k + 1]?.height || 0);
      } else if (g.keepTogether === 'firstDetail') need = l.height + (laidStream[k + 1]?.height || 0);
    }
    const keep = it.band.keepTogether || it.kind === 'detail' || need > l.height;
    if (y + need > limit() + 0.01 && !bodyEmpty && (keep || y + l.height > limit() + 0.01)) startPage(false);
    if (it.kind === 'gh') openHeaders = [...openHeaders.filter((h) => h.level < it.level), it];
    let top = y;
    if (it.band.printAtBottom) top = Math.max(y, limit() - l.height);
    put(l.boxes, top);
    y = top + l.height;
    if (l.height > 0 || l.boxes.length) bodyEmpty = false;
    const pi = pages.length;
    if (it.kind === 'detail') meta[pi].rows.push(it.row);
    for (let lv = 0; lv < groups.length; lv++) {
      if (!inst[lv].length) continue;
      const gi = instAt(lv, it.row);
      const m = /** @type {Map<number, {first:number,last:number}>} */ (groupPages.get(groups[lv].id));
      const r = m.get(gi.n);
      if (!r) m.set(gi.n, { first: pi, last: pi }); else r.last = pi;
    }
    if (it.kind === 'gf') {
      openHeaders = openHeaders.filter((h) => h.level < it.level);
      const last = k === stream.length - 1 || stream.slice(k + 1).every((s) => s.kind === 'rf' || s.kind === 'gf');
      if ((g?.newPage === 'after' || it.band.printAtBottom) && !last) startPage(false);
    }
  }
  pages.push(cur);

  // ---- 7. lượt hai: đầu/cuối trang và các ô phụ thuộc số trang ----
  const count = pages.length;
  for (let pi = 0; pi < count; pi++) {
    const rows = meta[pi]?.rows || [];
    /** @param {string} [gid] */
    const groupRange = (gid) => {
      const id = gid || groups.find((g) => g.newPage !== 'none')?.id || groups[0]?.id;
      const m = id ? groupPages.get(id) : null;
      if (!m) return { first: 0, last: count - 1 };
      for (const r of m.values()) if (pi >= r.first && pi <= r.last) return r;
      return { first: pi, last: pi };
    };
    /** @type {PageInfo} */ const info = { number: pi + 1, count, rows, groupNumber: (g) => pi - groupRange(g).first + 1, groupCount: (g) => groupRange(g).last - groupRange(g).first + 1 };
    for (const bx of pages[pi].boxes) if (bx.deferred) { bx.text = bx.deferred(info); delete bx.deferred; }
    if (pf) {
      const l = layoutBand({ band: pf, kind: 'pf', row: rows[rows.length - 1] ?? Math.max(0, N - 1), level: -1, g: null }, info);
      if (l.visible) {
        const top = pageBottom - l.height;
        for (const bx of l.boxes) { bx.x += bodyLeft; bx.y += top; if (bx.kind === 'line') { bx.x2 = (bx.x2 ?? 0) + bodyLeft; bx.y2 = (bx.y2 ?? 0) + top; } if (bx.deferred) { bx.text = bx.deferred(info); delete bx.deferred; } pages[pi].boxes.push(bx); }
      }
    }
    // đầu trang đã đặt lúc dàn với tổng trang tạm: tính lại chữ phụ thuộc trang
    for (const bx of pages[pi].boxes) delete bx.deferred;
  }
  if (ph) {
    // PageHeader dàn lại với số trang thật (thường chứa "Trang N/M" hoặc visibleWhen PageNumber = 1)
    for (let pi = 0; pi < count; pi++) {
      const rows = meta[pi]?.rows || [];
      const info = { number: pi + 1, count, rows, groupNumber: () => 1, groupCount: () => 1 };
      const hasDeferred = (ph.controls || []).some((/** @type {Obj} */ c) => pageDependent(c));
      if (!hasDeferred) continue;
      const fresh = layoutBand({ band: ph, kind: 'ph', row: rows[0] ?? 0, level: -1, g: null }, info);
      const old = pages[pi].boxes.filter((bx) => bx.band === ph.id);
      for (let j = 0; j < old.length && j < fresh.boxes.length; j++) if (fresh.boxes[j].kind === 'text') old[j].text = fresh.boxes[j].text;
    }
  }
  return { pages, warnings };
}

/** Màu từ dữ liệu (BackColorFormat): tên màu / #hex / số ARGB của .NET. @param {any} v */
export function cssColor(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' || /^-?\d+$/.test(String(v))) {
    const n = Number(v) >>> 0;
    if ((n >>> 24) === 0 && n !== 0) return null; // trong suốt
    return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }
  const s = String(v).trim();
  return /^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]{3,30})$/i.test(s) ? s : null;
}
