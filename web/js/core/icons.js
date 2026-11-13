// @ts-check
/**
 * Bộ biểu tượng SVG nét (24×24, stroke = currentColor). Backend chỉ gửi tên (chuẩn ERP-HTML mục 17).
 * Tên không có trong bộ ⇒ dùng biểu tượng mặc định 'dot'.
 */

/** @type {Record<string,string>} */
const P = {
  // phân hệ
  system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  catalog: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h7"/>',
  purchase: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.1h7.7a1.5 1.5 0 0 0 1.4-1l1.9-6.3H6.2"/>',
  sales: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  warehouse: '<path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-8h10v8M7 17h10"/>',
  stock: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v.01M18 15v.01"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.3-.4-.4-2.3z"/>',
  asset: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M2 20h20M9 16v4M15 16v4"/>',
  cost: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18.5h8"/>',
  ledger: '<path d="M2.5 5.5c3-1.5 6-1.5 9.5 1 3.5-2.5 6.5-2.5 9.5-1V19c-3-1.5-6-1.5-9.5 1-3.5-2.5-6.5-2.5-9.5-1z"/><path d="M12 6.5V20"/>',
  business: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  hr: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
  office: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2.5v3M16 2.5v3M7.5 13h3v3h-3z"/>',
  report: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  form: '<path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-11z"/><path d="M14 2.5v6h6M8 13h8M8 17h5"/>',
  // hành động
  add: '<path d="M12 5v14M5 12h14"/>',
  new: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  save: '<path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M7 21v-7h10v7"/>',
  'save-new': '<path d="M5 3h11l4 4v5"/><path d="M4 4v15a2 2 0 0 0 2 2h6M8 3v5h7V3"/><path d="M18 15v6M15 18h6"/>',
  delete: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  cancel: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  find: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  reload: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
  export: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  import: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
  install: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 6v8M9 11l3 3 3-3M10 18h4"/>',
  attach: '<path d="m21 11.5-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>',
  approve: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  unapprove: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  lock: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.7-1.5"/>',
  first: '<path d="M18 17l-5-5 5-5M11 17l-5-5 5-5"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  last: '<path d="m6 17 5-5-5-5M13 17l5-5-5-5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 4M12 17.5h.01"/>',
  run: '<path d="M7 4.5v15l12-7.5z"/>',
  custom: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>',
  confirm: '<path d="m5 12 5 5L20 7"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  filter: '<path d="M3 4.5h18l-7 8.3V19l-4 2v-8.2z"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  group: '<path d="M3 5h11M3 10h8M7 15h11M7 20h8"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-up': '<path d="m6 15 6-6 6 6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  theme: '<path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3.2 3H16a2 2 0 0 0-1.5 3.3c.6.7.2 2.7-2.5 2.7z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.3 20a1.9 1.9 0 0 0 3.4 0"/>',
  pin: '<path d="M12 17v5M8.5 3h7l-1 6 3.5 3.5V15H6v-2.5L9.5 9z"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  warning: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  truck: '<path d="M2 5h12v11H2zM14 9h4l3 3.5V16h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M20 20h-3M14 20v.01"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 6.5 9 6.5 9-6.5"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  collapse: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  cards: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/>',
  'row-add': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M12 13v5M9.5 15.5h5"/>',
  'row-delete': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9.5 15.5h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M5.5 8h1M5.5 11h1M5.5 14h1"/>',
  ribbon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M6.5 7h2.5M11 7h2.5"/>',
  'chevrons-left': '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
  'chevrons-right': '<path d="m13 17 5-5-5-5M6 17l5-5-5-5"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 21v-4h6v4M8 7h1M11.5 7h1M15 7h1M8 11h1M11.5 11h1M15 11h1"/>',
  'undo': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  'redo': '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  'minus': '<path d="M4 12h16"/>',
  'square': '<rect x="4" y="4" width="16" height="16" rx="1"/>',
  'image': '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  'file': '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  'align-left': '<path d="M4 3v18"/><rect x="8" y="6" width="10" height="4"/><rect x="8" y="14" width="6" height="4"/>',
  'align-center': '<path d="M12 3v18"/><rect x="6" y="6" width="12" height="4"/><rect x="8" y="14" width="8" height="4"/>',
  'align-right': '<path d="M20 3v18"/><rect x="6" y="6" width="10" height="4"/><rect x="10" y="14" width="6" height="4"/>',
  'align-top': '<path d="M3 4h18"/><rect x="6" y="8" width="4" height="10"/><rect x="14" y="8" width="4" height="6"/>',
  'align-middle': '<path d="M3 12h18"/><rect x="6" y="6" width="4" height="12"/><rect x="14" y="8" width="4" height="8"/>',
  'align-bottom': '<path d="M3 20h18"/><rect x="6" y="6" width="4" height="10"/><rect x="14" y="10" width="4" height="6"/>',
  'width': '<path d="M4 12h16"/><path d="m7 9-3 3 3 3"/><path d="m17 9 3 3-3 3"/>',
  'height': '<path d="M12 4v16"/><path d="m9 7 3-3 3 3"/><path d="m9 17 3 3 3-3"/>',
  'dist-h': '<path d="M4 4v16M20 4v16"/><rect x="9" y="8" width="6" height="8"/>',
  'dist-v': '<path d="M4 4h16M4 20h16"/><rect x="8" y="9" width="8" height="6"/>',
  'front': '<rect x="9" y="9" width="11" height="11"/><path d="M4 15V4h11"/>',
  'back': '<rect x="4" y="4" width="11" height="11"/><path d="M9 20h11V9"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
};

/** Đoán biểu tượng từ chữ (menu không có data-icon). @param {string} text */
export function guessIcon(text) {
  const t = String(text || '').toLowerCase();
  const rules = [
    [/báo cáo|bảng kê|sổ |tổng hợp|bảng cân|thẻ kho|nhật ký/, 'report'], [/duyệt|phê duyệt/, 'approve'],
    [/người dùng|phân quyền|nhóm người/, 'users'], [/danh mục|danh sách/, 'list'], [/kho|xuất|nhập/, 'stock'],
    [/thu|chi|quỹ|tiền|ngân hàng/, 'cash'], [/hóa đơn|bán/, 'sales'], [/mua|đặt hàng|đơn hàng/, 'purchase'],
    [/tài sản|máy/, 'asset'], [/dụng cụ|thiết bị/, 'tools'], [/thiết lập|cấu hình|khai báo|tham số/, 'settings'],
    [/hợp đồng/, 'form'], [/qr|mã vạch/, 'qr'], [/vận chuyển|giao/, 'truck'], [/lịch|kỳ/, 'calendar'],
    [/khóa/, 'lock'], [/nhân viên|nhân sự|chấm công/, 'hr'], [/email|thư/, 'mail'],
  ];
  for (const [re, name] of rules) if (/** @type {RegExp} */ (re).test(t)) return /** @type {string} */ (name);
  return 'form';
}

/** @param {string} name @param {string} [cls] @returns {SVGSVGElement} */
export function icon(name, cls = '') {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="erp-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || P.dot}</svg>`;
  return /** @type {SVGSVGElement} */ (tpl.content.firstElementChild);
}

export const hasIcon = (/** @type {string} */ name) => name in P;
