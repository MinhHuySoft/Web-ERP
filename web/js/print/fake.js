// @ts-check
/**
 * Dữ liệu giả cho một mẫu in: lấy các cột mà mẫu dùng (ô gắn cột, cột nhóm, biểu thức, điều kiện hiện) và đoán kiểu theo
 * tên. Dùng khi xem trước trong trình thiết kế lúc chưa có dữ liệu thật, và trong test / kiểm hàng loạt.
 */
import { compile } from './expr.js';

/** @typedef {Record<string, any>} Obj */

/** Các cột mẫu in tham chiếu. @param {Obj} tpl @returns {string[]} */
export function referencedFields(tpl) {
  const out = new Set();
  const addExpr = (/** @type {string} */ e) => { try { for (const f of compile(e).fields) out.add(f); } catch { /* bỏ qua */ } };
  for (const g of tpl.groups || []) if (g.by) out.add(g.by);
  for (const f of tpl.data?.sort?.by || []) out.add(f);
  for (const b of tpl.bands || []) {
    if (b.visibleWhen) addExpr(b.visibleWhen);
    for (const c of b.controls || []) {
      const v = c.value || {};
      if (v.field) out.add(v.field);
      if (v.expr) addExpr(v.expr);
      if (c.visibleWhen) addExpr(c.visibleWhen);
      if (c.src?.field) out.add(c.src.field);
      if (c.summary?.distinctField) out.add(c.summary.distinctField);
      for (const r of c.rules || []) { if (r.when) addExpr(r.when); for (const col of Object.values(r.styleFrom || {})) out.add(col); }
      if (v.template) for (const m of String(v.template).matchAll(/\{([A-Za-z0-9_]+)\}/g)) out.add(m[1]);
    }
  }
  return [...out];
}

/** Đoán kiểu cột theo tên (quy ước đặt tên của ERP). @param {string} name */
export function guessType(name) {
  if (/date|ngay|time$/i.test(name)) return 'date';
  if (/^is|^has|bold$/i.test(name)) return 'bool';
  if (/amount|qty|quantity|price|cost|total|vat|tax|rate|percent|tien|soluong|sl$|dongia|gia$|thanhtien|tyle|discount|balance|debit|credit|number$|^no$|^stt$/i.test(name)) return 'money';
  return 'text';
}

/**
 * @param {Obj} tpl @param {{ rows?: number, groups?: number, seed?: number }} [o]
 * @returns {{ columns: { name: string, type: string }[], rows: Obj[] }}
 */
export function fakeData(tpl, o = {}) {
  const n = o.rows ?? 12;
  const ng = Math.max(1, o.groups ?? 2);
  let seed = o.seed ?? 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const groupCols = new Set((tpl.groups || []).map((/** @type {Obj} */ g) => g.by).filter(Boolean));
  const cols = referencedFields(tpl).map((name) => ({ name, type: groupCols.has(name) ? (guessType(name) === 'date' ? 'date' : 'text') : guessType(name) }));
  /** @type {Obj[]} */ const rows = [];
  for (let i = 0; i < n; i++) {
    /** @type {Obj} */ const r = {};
    for (const c of cols) {
      const g = Math.floor((i * ng) / n);
      if (groupCols.has(c.name)) r[c.name] = c.type === 'date' ? new Date(2026, 10, 1 + g) : `${c.name.slice(0, 3).toUpperCase()}${String(g + 1).padStart(4, '0')}`;
      else if (c.type === 'money') r[c.name] = Math.round(rnd() * 1e6) / (rnd() < 0.3 ? 100 : 1);
      else if (c.type === 'date') r[c.name] = new Date(2026, 10, 1 + (i % 28));
      else if (c.type === 'bool') r[c.name] = i % 4 === 0;
      else r[c.name] = `${c.name} ${i + 1}`;
    }
    rows.push(r);
  }
  return { columns: cols, rows };
}
