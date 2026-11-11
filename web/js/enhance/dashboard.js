// @ts-check
import { h } from '../core/dom.js';
import { formatNumber } from '../core/format.js';

/**
 * Dashboard (chuẩn ERP-HTML 16): section[data-erp=kpi] thành thẻ chỉ số; table[data-erp=chart] thành biểu đồ SVG
 * (cột / đường), bảng gốc vẫn giữ để đọc bằng trình đọc màn hình.
 * @param {HTMLElement} root
 */
export function enhanceDashboard(root) {
  const kpis = Array.from(root.querySelectorAll('section[data-erp="kpi"]'));
  if (kpis.length) {
    const wrap = h('div', { class: 'erp-kpis' });
    kpis[0].before(wrap);
    for (const k of kpis) {
      k.classList.add('erp-kpi');
      const v = k.querySelector('data');
      if (v) v.classList.add('erp-kpi__value');
      wrap.append(k);
    }
  }
  for (const t of Array.from(root.querySelectorAll('table[data-erp="chart"]'))) chart(/** @type {HTMLTableElement} */ (t));
  for (const p of Array.from(root.querySelectorAll('[data-form-type="DASHBOARD"] > [data-erp="tab-panel"]'))) p.classList.add('erp-card-block');
}

/** @param {HTMLTableElement} table */
function chart(table) {
  const kind = table.getAttribute('data-chart') || 'bar';
  const rows = Array.from(table.tBodies[0]?.rows || []);
  const data = rows.map((r) => ({ label: r.cells[0]?.textContent?.trim() || '', value: Number(r.cells[1]?.getAttribute('data-value') ?? r.cells[1]?.textContent) || 0 }));
  if (!data.length) return;
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 560, H = 220, pad = 28, bw = (W - pad * 2) / data.length;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 30}`);
  svg.setAttribute('class', 'erp-chart__svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', table.caption?.textContent || 'Biểu đồ');
  const el = (/** @type {string} */ tag, /** @type {Record<string,string|number>} */ a, /** @type {string} */ text = '') => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(a)) n.setAttribute(k, String(v));
    if (text) n.textContent = text;
    svg.append(n);
    return n;
  };
  for (let i = 0; i <= 4; i++) {
    const y = pad + ((H - pad * 2) * i) / 4;
    el('line', { x1: pad, x2: W - pad, y1: y, y2: y, class: 'erp-chart__grid' });
  }
  if (kind === 'line') {
    const pts = data.map((d, i) => `${pad + bw * i + bw / 2},${H - pad - ((H - pad * 2) * d.value) / max}`).join(' ');
    el('polyline', { points: pts, class: 'erp-chart__line', fill: 'none' });
  }
  data.forEach((d, i) => {
    const x = pad + bw * i;
    const hh = ((H - pad * 2) * d.value) / max;
    if (kind !== 'line') {
      const r = el('rect', { x: x + bw * 0.18, y: H - pad - hh, width: bw * 0.64, height: Math.max(hh, 1), rx: 6, class: 'erp-chart__bar' });
      const t = document.createElementNS(ns, 'title'); t.textContent = `${d.label}: ${formatNumber(d.value)}`; r.append(t);
    }
    el('text', { x: x + bw / 2, y: H - pad - hh - 6, 'text-anchor': 'middle', class: 'erp-chart__value' }, formatNumber(d.value));
    el('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle', class: 'erp-chart__label' }, d.label);
  });
  const fig = h('figure', { class: 'erp-chart' }, h('figcaption', {}, table.caption?.textContent || ''), svg);
  table.before(fig);
  table.classList.add('erp-visually-hidden');
  fig.append(table);
}
