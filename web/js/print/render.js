// @ts-check
/**
 * Vẽ trang do bộ dựng tạo ra thành DOM khổ thật (mm), và đo chữ bằng chính trình duyệt để ô CanGrow cao đúng.
 * Mọi chữ gán bằng textContent; màu / font chỉ nhận giá trị qua kiểm tra; ảnh chỉ data:image hoặc cùng origin.
 * Viền ô vẽ thành đoạn thẳng nằm giữa mép (SVG), nên hai ô kề nhau chung một nét như ActiveReports.
 */
import { code128Svg } from './barcode.js';

const NS = 'http://www.w3.org/2000/svg';
const PX_MM = 25.4 / 96;
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,30})$/i;
const FONT = /^[\p{L}\p{N} _-]{1,60}$/u;
const FALLBACK = /** @type {Record<string,string>} */ ({
  tahoma: '"Tahoma", "Segoe UI", "DejaVu Sans", Arial, sans-serif',
  'times new roman': '"Times New Roman", "Liberation Serif", "Tinos", serif',
  'arial narrow': '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif',
  'microsoft sans serif': '"Microsoft Sans Serif", Tahoma, Arial, sans-serif',
});
const DASH = /** @type {Record<string,string>} */ ({ dash: '1.2 0.6', dot: '0.25 0.45', dashDot: '1.2 0.5 0.25 0.5', dashDotDot: '1.2 0.4 0.25 0.4 0.25 0.4', thickDash: '1.6 0.8', thickDot: '0.4 0.6' });

/** @typedef {import('./engine.js').Box} Box @typedef {import('./engine.js').Page} Page @typedef {Record<string, any>} Obj */

/** @param {string} f */
export function fontFamily(f) {
  if (!f || !FONT.test(f)) return 'Arial, sans-serif';
  return FALLBACK[f.toLowerCase()] || `"${f}", Arial, sans-serif`;
}

/** Áp kiểu chữ của ô lên phần tử (dùng chung khi vẽ và khi đo). @param {HTMLElement} el @param {Obj} st @param {Obj} [pad] */
export function applyTextStyle(el, st, pad = {}) {
  const s = el.style;
  s.fontFamily = fontFamily(st.font);
  s.fontSize = `${Math.max(1, Math.min(200, Number(st.size) || 10))}pt`;
  s.fontWeight = st.bold ? '700' : '400';
  s.fontStyle = st.italic ? 'italic' : 'normal';
  s.textDecoration = [st.underline ? 'underline' : '', st.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none';
  if (st.color && COLOR.test(st.color)) s.color = st.color;
  s.textAlign = ['left', 'center', 'right', 'justify'].includes(st.align) ? st.align : 'left';
  s.whiteSpace = st.wrap === false ? 'pre' : 'pre-wrap';
  s.overflowWrap = 'break-word';
  s.lineHeight = st.lineSpacing ? `calc(1.15em + ${Number(st.lineSpacing) * 0.75}pt)` : '1.15';
  if (st.letterSpacing) s.letterSpacing = `${Number(st.letterSpacing) * 0.75}pt`;
  s.padding = `${Number(pad.t) || 0}pt ${Number(pad.r) || 0}pt ${Number(pad.b) || 0}pt ${Number(pad.l) || 0}pt`;
}

/**
 * Hàm đo chiều cao chữ (mm) bằng một vùng ẩn trong tài liệu hiện tại; có bộ đệm.
 * @param {Document} [doc] @returns {(r: import('./engine.js').MeasureReq) => number}
 */
export function domMeasure(doc = document) {
  const host = doc.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'absolute', left: '-20000px', top: '0', visibility: 'hidden', contain: 'layout style' });
  const el = doc.createElement('div');
  el.style.boxSizing = 'border-box';
  host.append(el);
  doc.body.append(host);
  /** @type {Map<string, number>} */ const cache = new Map();
  return (r) => {
    const key = `${r.wMm}|${JSON.stringify(r.style)}|${JSON.stringify(r.padding)}|${r.text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    el.removeAttribute('style');
    el.style.boxSizing = 'border-box';
    applyTextStyle(el, r.style, r.padding);
    el.style.width = `${r.wMm}mm`;
    el.textContent = r.text;
    const h = el.getBoundingClientRect().height * PX_MM;
    if (cache.size > 20000) cache.clear();
    cache.set(key, h);
    return h;
  };
}

/** @param {string|null|undefined} src */
function safeSrc(src) {
  if (!src) return null;
  if (/^data:image\/(png|jpeg|gif|bmp);base64,[A-Za-z0-9+/=]+$/.test(src)) return src;
  try { const u = new URL(src, location.href); return u.origin === location.origin ? u.href : null; } catch { return null; }
}

/**
 * @param {Page[]} pages
 * @param {{ doc?: Document, onBox?: (el: Element, box: Box, page: number) => void }} [o]
 * @returns {HTMLElement} div.pp-doc chứa các div.pp-page
 */
export function renderPages(pages, o = {}) {
  const doc = o.doc || document;
  const root = doc.createElement('div');
  root.className = 'pp-doc';
  pages.forEach((p, pi) => root.append(renderPage(p, pi, doc, o.onBox)));
  return root;
}

/** @param {Page} p @param {number} pi @param {Document} doc @param {((el: Element, box: Box, page: number) => void)|undefined} onBox */
function renderPage(p, pi, doc, onBox) {
  const page = doc.createElement('div');
  page.className = 'pp-page';
  page.style.width = `${p.width}mm`;
  page.style.height = `${p.height}mm`;
  page.dataset.page = String(pi + 1);
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'pp-lines');
  svg.setAttribute('viewBox', `0 0 ${p.width} ${p.height}`);
  svg.setAttribute('width', `${p.width}mm`);
  svg.setAttribute('height', `${p.height}mm`);
  const seen = new Set();
  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {string} style @param {string|undefined} color @param {number} [weight] */
  const seg = (x1, y1, x2, y2, style, color, weight = 1) => {
    const k = [x1, y1, x2, y2].map((v) => v.toFixed(2)).join(',') + style;
    if (seen.has(k)) return;
    seen.add(k);
    const l = doc.createElementNS(NS, 'line');
    l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1)); l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
    const thick = style.startsWith('thick') || style === 'double';
    l.setAttribute('stroke', color && COLOR.test(color) ? color : '#000');
    l.setAttribute('stroke-width', String((thick ? 0.4 : 0.18) * Math.max(1, Math.min(6, weight))));
    if (DASH[style]) l.setAttribute('stroke-dasharray', DASH[style]);
    svg.append(l);
  };
  /** @param {Box} b */
  const edges = (b) => {
    const bd = b.border;
    if (!bd) return;
    if (bd.top) seg(b.x, b.y, b.x + b.w, b.y, bd.top.style, bd.top.color, b.weight);
    if (bd.bottom) seg(b.x, b.y + b.h, b.x + b.w, b.y + b.h, bd.bottom.style, bd.bottom.color, b.weight);
    if (bd.left) seg(b.x, b.y, b.x, b.y + b.h, bd.left.style, bd.left.color, b.weight);
    if (bd.right) seg(b.x + b.w, b.y, b.x + b.w, b.y + b.h, bd.right.style, bd.right.color, b.weight);
  };
  for (const b of p.boxes) {
    /** @type {HTMLElement|null} */ let el = null;
    if (b.kind === 'line') { seg(b.x, b.y, b.x2 ?? b.x, b.y2 ?? b.y, b.lineStyle || 'solid', b.color, b.weight); continue; }
    if (b.kind === 'rect') {
      if (b.radius || b.fill) {
        el = box(doc, b, 'pp-rect');
        if (b.fill && COLOR.test(b.fill)) el.style.background = b.fill;
        if (b.radius) { el.style.borderRadius = `${Math.min(b.w, b.h) * 0.5 * b.radius}mm`; if (b.border) el.style.border = '0.18mm solid #000'; }
      }
      if (!b.radius) edges(b);
    } else if (b.kind === 'text') {
      el = box(doc, b, 'pp-text');
      el.style.justifyContent = b.style?.valign === 'middle' ? 'center' : b.style?.valign === 'bottom' ? 'flex-end' : 'flex-start';
      if (b.style?.background && COLOR.test(b.style.background)) el.style.background = b.style.background;
      const inner = doc.createElement('div');
      inner.className = 'pp-text__in';
      applyTextStyle(inner, b.style || {}, b.padding || {});
      inner.textContent = b.text ?? '';
      el.append(inner);
      edges(b);
    } else if (b.kind === 'image') {
      el = box(doc, b, 'pp-image');
      const src = safeSrc(b.src);
      if (src) {
        const img = doc.createElement('img');
        img.alt = '';
        img.src = src;
        img.style.objectFit = b.fit === 'stretch' ? 'fill' : b.fit === 'zoom' ? 'contain' : 'none';
        img.style.objectPosition = b.fit === 'clip' ? 'left top' : 'center';
        el.append(img);
      }
      edges(b);
    } else if (b.kind === 'checkbox') {
      el = box(doc, b, 'pp-check');
      const sq = doc.createElement('span');
      sq.className = 'pp-check__box';
      if (b.checked) sq.textContent = '✓';
      const cap = doc.createElement('span');
      applyTextStyle(cap, b.style || {}, b.padding || {});
      cap.textContent = b.caption || '';
      el.append(sq, cap);
      edges(b);
    } else if (b.kind === 'barcode') {
      el = box(doc, b, 'pp-barcode');
      if (b.symbology === 'code128') el.append(code128Svg(b.text || '', b.w, b.h, !!b.showText));
      else { el.classList.add('pp-barcode--todo'); el.textContent = b.text || ''; el.title = 'Mã QR sẽ vẽ ở giai đoạn sau'; }
    }
    if (el) { page.append(el); onBox?.(el, b, pi); }
  }
  page.append(svg);
  return page;
}

/** @param {Document} doc @param {Box} b @param {string} cls */
function box(doc, b, cls) {
  const el = doc.createElement('div');
  el.className = `pp-box ${cls}`;
  el.style.left = `${b.x}mm`;
  el.style.top = `${b.y}mm`;
  el.style.width = `${Math.max(0, b.w)}mm`;
  el.style.height = `${Math.max(0, b.h)}mm`;
  return el;
}
