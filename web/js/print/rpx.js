// @ts-check
/**
 * Chuyển layout ActiveReports 3 (`.rpx` của ERP.NET) sang mẫu in `erp-print-template/1` (docs/kien-truc/06-mau-in.md).
 * Mọi quy ước riêng của ERP mà `ReportViewerFrm` xử lý ngầm (tên control `SysCom1`, `Lng*`, `DATETIMEREPORT*`,
 * `COUNTNUMBER*`, Tag `isBold`, `StringSummary`, `VisibleExp:`…) được đổi thành thuộc tính tường minh, để bộ dựng web và
 * trình thiết kế không phải đoán lại. Mã Script của mẫu không bao giờ được chạy: chỉ nhận dạng vài mẫu quen thuộc, phần
 * còn lại ghi cảnh báo "manual".
 *
 * Cảnh báo: `{ level: 'info'|'auto'|'layout'|'later'|'manual', msg }`
 *  - auto: đã tự chuyển (biểu thức viết lại, script quen thuộc); layout: vị trí cần hiệu chỉnh khi xem;
 *  - later: tính năng giai đoạn sau, bản in có thể thiếu; manual: cần người sửa mẫu trên web.
 */
import { parseXml, child } from './xml.js';
import { check } from './expr.js';

export const TEMPLATE_SCHEMA = 'erp-print-template/1';
export const CONVERTER_VERSION = 'rpx2json/1';

const TW_PER_MM = 1440 / 25.4;
/** twip → mm (0,01) @param {string|undefined|null} v */
const mm = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round((n / TW_PER_MM) * 100) / 100 : 0; };
const BORDER = /** @type {Record<string,string>} */ ({ 1: 'solid', 2: 'dash', 3: 'dot', 4: 'dashDot', 5: 'dashDotDot', 6: 'double', 7: 'thickSolid', 8: 'thickDash', 9: 'thickDot' });
const PAPER = /** @type {Record<string,string>} */ ({ 8: 'A3', 9: 'A4', 11: 'A5', 1: 'Letter', 5: 'Legal' });
const SUM_FUNC = ['sum', 'avg', 'count', 'min', 'max', 'var', 'varp', 'stddev', 'stddevp', 'sum', 'avg', 'count', 'var', 'varp', 'stddev', 'stddevp'];
const SECTION = /** @type {Record<string,string>} */ ({ ReportHeader: 'reportHeader', PageHeader: 'pageHeader', GroupHeader: 'groupHeader', Detail: 'detail',
  GroupFooter: 'groupFooter', PageFooter: 'pageFooter', ReportFooter: 'reportFooter' });
const CSS_COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,30})$/i;

/** Màu OLE (BGR số nguyên) → #rrggbb. @param {string|undefined} v */
function oleColor(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return undefined;
  const r = n & 255, g = (n >> 8) & 255, b = (n >> 16) & 255;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * @typedef {{ level: 'info'|'auto'|'layout'|'later'|'manual', msg: string }} Warn
 * @typedef {Record<string, any>} Obj
 */

/**
 * @param {string} xml nội dung `.rpx`
 * @param {{ file?: string, fileDate?: string, id?: string }} [meta]
 * @returns {{ template: Obj, warnings: Warn[] }}
 */
export function convertRpx(xml, meta = {}) {
  /** @type {Warn[]} */ const warnings = [];
  const warn = (/** @type {Warn['level']} */ level, /** @type {string} */ msg) => warnings.push({ level, msg });
  if (xml.includes('\u0000')) warn('info', 'Ký tự NUL thừa sau thẻ đóng (đã bỏ)');
  const root = parseXml(xml);
  if (root.name !== 'ActiveReportsLayout') throw new Error('Không phải tệp layout ActiveReports (.rpx)');
  const ps = child(root, 'PageSettings')?.attrs || {};
  const landscape = ps.Orientation === '2';
  let width = mm(ps.PaperWidth || '11906'), height = mm(ps.PaperHeight || '16838');
  const paper = PAPER[ps.PaperSize || '9'] || (ps.PaperSize ? 'custom' : 'A4');
  if (paper === 'A3') { width = 297; height = 420; } else if (paper === 'A5') { width = 148; height = 210; } else if (paper === 'A4' && !ps.PaperWidth) { width = 210; height = 297; }
  if (landscape && width < height) [width, height] = [height, width];
  const margin = { top: mm(ps.TopMargin ?? '1440'), right: mm(ps.RightMargin ?? '1440'), bottom: mm(ps.BottomMargin ?? '1440'), left: mm(ps.LeftMargin ?? '1440') };
  const bodyWidth = mm(root.attrs.PrintWidth || '0') || Math.round((width - margin.left - margin.right) * 100) / 100;
  if (bodyWidth > width - margin.left - margin.right + 0.5) warn('layout', 'Độ rộng vùng in (PrintWidth) vượt khổ giấy trừ lề');
  if (child(root, 'Watermark') || root.attrs.Watermark) warn('later', 'Ảnh chìm (Watermark)');
  const calc = child(root, 'CalculatedFields');
  if (calc?.children.length) warn('later', 'Trường tính toán (CalculatedFields)');

  const fileId = (meta.file || '').replace(/\.rpx$/i, '');
  /** @type {Obj} */ const tpl = {
    $schema: TEMPLATE_SCHEMA,
    id: meta.id || fileId || 'report',
    title: '',
    unit: 'mm',
    page: { paper, orientation: landscape ? 'landscape' : 'portrait', width, height, margin, bodyWidth },
    data: { sort: { auto: true } },
    styles: {},
    groups: [],
    bands: [],
    assets: {},
    source: { kind: 'rpx', file: meta.file || '', fileDate: meta.fileDate || '', version: root.attrs.Version || '', scriptLang: root.attrs.ScriptLang || '',
      converter: CONVERTER_VERSION, warnings: [] },
  };
  for (const st of child(root, 'StyleSheet')?.children || []) tpl.styles[st.attrs.Name] = parseStyle(st.attrs.Value, warn);

  const secs = child(root, 'Sections')?.children.filter((s) => s.name === 'Section') || [];
  const groupNames = secs.filter((s) => s.attrs.Type === 'GroupHeader').map((s) => s.attrs.Name);
  /** @type {string[]} */ const gstack = [];
  const ctx = { tpl, warn, groupNames, ids: new Set(), sort: /** @type {{by: string[], none: boolean}} */ ({ by: [], none: false }) };
  for (const s of secs) {
    const a = s.attrs;
    const type = SECTION[a.Type];
    if (!type) { warn('manual', `Section lạ ${a.Type}`); continue; }
    /** @type {Obj} */ const band = { id: a.Name || type, type, height: mm(a.Height) };
    if (a.Visible === '0') band.visible = false;
    band.canGrow = a.CanGrow !== '0';
    if (a.CanShrink === '1') band.canShrink = true;
    if (a.KeepTogether === '1') band.keepTogether = true;
    if (a.PrintAtBottom === '1') band.printAtBottom = true;
    const bg = oleColor(a.BackColor);
    if (bg && bg !== '#ffffff') band.background = bg;
    const tag = a.Tag || '';
    if (tag === 'AutoGrow') band.stretchControls = true;
    if (tag.startsWith('VisibleExp:')) {
      band.visibleWhen = visibleExp(tag.slice(11));
      if (check(band.visibleWhen)) warn('manual', `VisibleExp của section ${band.id} không đọc được`);
    }
    if (type === 'detail') {
      if (a.ColumnCount && a.ColumnCount !== '1') {
        band.columns = { count: Number(a.ColumnCount), direction: a.ColumnDirection === '1' ? 'acrossThenDown' : 'downThenAcross', spacing: mm(a.ColumnSpacing) };
        warn('later', 'Detail nhiều cột (tem nhãn)');
      }
      if (a.RepeatToFill === '1') { band.repeatToFill = true; warn('later', 'RepeatToFill (kẻ dòng trống tới cuối trang)'); }
      band.stretchControls = true; // viewer luôn kéo ô CanGrow tới đáy section ở Detail
    }
    if (type === 'groupHeader') {
      /** @type {Obj} */ const g = { id: band.id, by: a.DataField || null,
        newPage: a.NewPage === '1' ? 'before' : a.NewPage === '2' ? 'after' : 'none',
        keepTogether: a.GroupKeepTogether === '2' ? 'all' : a.GroupKeepTogether === '1' ? 'firstDetail' : 'none',
        repeatHeader: ['1', '3', '4'].includes(a.RepeatStyle || '') ? 'onPage' : 'none' };
      if (!g.by) warn('info', 'GroupHeader không có DataField (một nhóm duy nhất)');
      if (a.UnderlayNext === '1') { g.underlayNext = true; warn('later', 'UnderlayNext'); }
      tpl.groups.push(g);
      gstack.push(g.id);
      band.group = g.id;
    }
    if (type === 'groupFooter') {
      band.group = gstack.pop() || null;
      if (a.NewPage === '2' || a.NewPage === '1') {
        const g = tpl.groups.find((/** @type {Obj} */ x) => x.id === band.group);
        if (g && g.newPage === 'none') g.newPage = 'after';
      }
    }
    band.controls = [];
    for (const c of s.children.filter((x) => x.name === 'Control')) {
      const o = convertControl(c, band, ctx);
      if (o) band.controls.push(o);
    }
    if (band.visible !== false) {
      const bottom = Math.max(0, ...band.controls.map((/** @type {Obj} */ o) => (o.type === 'line' ? Math.max(o.y1, o.y2) : (o.y ?? 0) + (o.h ?? 0))));
      if (bottom > band.height + 0.3) warn('layout', 'Control vượt chiều cao section (WinForms vẫn in, trên web band tự cao theo)');
    }
    tpl.bands.push(band);
  }
  if (ctx.sort.none) tpl.data.sort = { auto: false };
  else if (ctx.sort.by.length) tpl.data.sort = { auto: true, by: ctx.sort.by };
  const sc = child(root, 'Script');
  if (sc && sc.text.trim()) convertScript(sc.text, tpl, warn);
  tpl.source.warnings = warnings.map((w) => `${w.level}: ${w.msg}`);
  return { template: tpl, warnings };
}

/** @param {string} hex */
function hexToBase64(hex) {
  let bin = '';
  for (let i = 0; i + 1 < hex.length; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin);
}

/** VisibleExp của ERP: `{COT}` / `'{COT}'` thay bằng giá trị rồi tính → tham chiếu cột / tham số. @param {string} e */
export function visibleExp(e) {
  return e.replace(/'?\{([A-Za-z0-9_]+)\}'?/g, (_m, n) => n).trim();
}

/** @param {string|undefined} s @param {(l: Warn['level'], m: string) => void} warn */
function parseStyle(s, warn) {
  /** @type {Record<string,string>} */ const d = {};
  for (const part of (s || '').split(';')) {
    const k = part.indexOf(':');
    if (k > 0) d[part.slice(0, k).trim().toLowerCase()] = part.slice(k + 1).trim();
  }
  /** @type {Obj} */ const st = {};
  if (d['font-family']) st.font = d['font-family'].replace(/["']/g, '');
  if (d['font-size']) { const n = parseFloat(d['font-size']); if (n > 0 && n < 200) st.size = n; }
  if (d['font-weight'] === 'bold') st.bold = true; else if (d['font-weight'] === 'normal') st.bold = false;
  if (d['font-style'] === 'italic') st.italic = true; else if (d['font-style'] === 'normal') st.italic = false;
  if (/underline/.test(d['text-decoration'] || '')) st.underline = true;
  if (/line-through/.test(d['text-decoration'] || '')) st.strike = true;
  if (d.color && CSS_COLOR.test(d.color)) st.color = d.color;
  if (d['background-color'] && CSS_COLOR.test(d['background-color'])) st.background = d['background-color'];
  if (['left', 'center', 'right', 'justify'].includes(d['text-align'])) st.align = d['text-align'];
  if (['top', 'middle', 'bottom'].includes(d['vertical-align'])) st.valign = d['vertical-align'];
  if (d['white-space'] === 'nowrap') st.wrap = false;
  if (d['ddo-font-vertical'] === 'true') warn('later', 'Chữ dọc (ddo-font-vertical)');
  return st;
}

/** @param {Obj} a thuộc tính control */
function borders(a) {
  /** @type {Obj} */ const b = {};
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
    const v = a[`Border${side}Style`];
    if (v && BORDER[v]) {
      /** @type {Obj} */ const e = { style: BORDER[v] };
      const col = a[`Border${side}Color`];
      if (col) { const c = /^\d+$/.test(col) ? oleColor(col) : CSS_COLOR.test(col) ? col : undefined; if (c && c !== '#000000') e.color = c; }
      b[side.toLowerCase()] = e;
    }
  }
  return Object.keys(b).length ? b : undefined;
}

/** AR "=biểu thức" (C#/VB) → ngôn ngữ biểu thức an toàn. @param {string} e */
export function rewriteArExpr(e) {
  let s = e.trim().replace(/;\s*$/, '');
  s = s.replace(/System\.DateTime\.Now|DateTime\.Now/g, 'Now()').replace(/DateTime\.Today/g, 'Today()');
  s = s.replace(/(Now\(\)|Today\(\)|[A-Za-z_][\w]*)\.ToString\(\s*("[^"]*")\s*\)/g, 'Format($1, $2)');
  s = s.replace(/(Now\(\)|[A-Za-z_][\w]*)\.ToString\(\s*\)/g, 'CStr($1)');
  s = s.replace(/\(\s*([^()]+?)\s*\)\s*\?\s*true\s*:\s*false/gi, '($1)');
  s = s.replace(/\bstring\.Format\(/gi, 'Format(');
  return s.trim();
}

/** @type {Array<[RegExp, (m: RegExpMatchArray) => Obj]>} */
const NAME_ROLES = [
  [/^syscom(\d)/i, (m) => ({ role: `company.line${m[1]}` })],
  [/^syslogo/i, () => ({ role: 'company.logo' })],
  [/^sysreportprintdate$/i, () => ({ role: 'report.printDate' })],
  [/^lngpageinfo(en|vn)?$/i, (m) => ({ role: 'page.info', lang: (m[1] || '').toUpperCase() })],
];

/**
 * @param {import('./xml.js').XmlNode} c
 * @param {Obj} band
 * @param {{ tpl: Obj, warn: (l: Warn['level'], m: string) => void, groupNames: string[], ids: Set<string>, sort: { by: string[], none: boolean } }} ctx
 * @returns {Obj|null}
 */
function convertControl(c, band, ctx) {
  const a = c.attrs;
  const { warn, tpl } = ctx;
  const type = a.Type || '';
  const name = a.Name || '';
  const NAME = name.toUpperCase();
  let id = name || `c${ctx.ids.size + 1}`;
  while (ctx.ids.has(id)) id = `${name || 'c'}_${ctx.ids.size + 1}`;
  ctx.ids.add(id);
  /** @type {Obj} */ const o = { id };
  if (name && name !== id) o.name = name;
  if (type === 'AR.Line') {
    Object.assign(o, { type: 'line', x1: mm(a.X1), y1: mm(a.Y1), x2: mm(a.X2), y2: mm(a.Y2) });
    if (a.LineStyle && BORDER[a.LineStyle]) o.style = { lineStyle: BORDER[a.LineStyle] };
    if (a.LineWeight && Number(a.LineWeight) > 1) o.weight = Number(a.LineWeight);
    const col = oleColor(a.LineColor); if (col && col !== '#000000') o.color = col;
    return o;
  }
  if (type === 'AR.CrossSectionLine') {
    Object.assign(o, { type: 'crossLine', x: mm(a.Left), y1: mm(a.Top), y2: mm(a.Bottom), toBand: 'groupFooter' });
    warn('later', 'CrossSectionLine (đường dọc xuyên section)');
    return o;
  }
  Object.assign(o, { x: mm(a.Left), y: mm(a.Top), w: mm(a.Width), h: mm(a.Height) });
  const st = parseStyle(a.Style, warn);
  if (Object.keys(st).length) o.style = st;
  const bd = borders(a);
  if (bd) o.border = bd;
  if (a.Visible === '0') o.visible = false;
  for (const [k, s] of [['PaddingLeft', 'l'], ['PaddingRight', 'r'], ['PaddingTop', 't'], ['PaddingBottom', 'b']]) {
    if (a[k]) (o.padding ||= {})[s] = Math.round(Number(a[k]) * 0.75 * 100) / 100; // px (96 dpi) → pt
  }
  if (a.LineSpacing && Number(a.LineSpacing)) (o.style ||= {}).lineSpacing = Number(a.LineSpacing);
  if (a.CharacterSpacing && Number(a.CharacterSpacing)) (o.style ||= {}).letterSpacing = Number(a.CharacterSpacing);
  if (a.Angle && a.Angle !== '0') { (o.style ||= {}).angle = Number(a.Angle) / 10; warn('later', 'Chữ xoay (Angle)'); }
  const bg = oleColor(a.BackColor);
  if (bg && type !== 'AR.Shape' && bg !== '#ffffff') (o.style ||= {}).background = bg;
  if (/crosstab/i.test(name)) warn('later', 'CrossTab (xoay cột động)');
  for (const [rx, f] of NAME_ROLES) { const m = name.match(rx); if (m) { Object.assign(o, f(m)); break; } }
  if (o.lang === '') delete o.lang;

  const df = a.DataField || '';
  const bind = () => {
    if (df.startsWith('=')) {
      const e = rewriteArExpr(df.slice(1));
      const err = check(e);
      if (err) { o.value = { exprRaw: df.slice(1) }; warn('manual', `Biểu thức DataField của ${name} không đọc được (${err})`); }
      else { o.value = { expr: e }; warn('auto', 'Biểu thức "=" đã viết lại'); }
    } else if (df) o.value = { field: df };
  };

  if (type === 'AR.Label' || type === 'AR.Field' || type === 'AR.TextBox') {
    o.type = 'text';
    const staticText = type === 'AR.Label' ? a.Caption || '' : a.Text || '';
    if (df) bind(); else o.value = { text: staticText };
    if (type !== 'AR.Label') {
      if (a.OutputFormat) o.format = a.OutputFormat;
      // FormatField của ReportViewerFrm: TextBox để trống OutputFormat thì lấy định dạng của cột (SY_FmtFldTbl) lúc chạy.
      else if (df && !df.startsWith('=')) o.autoFormat = true;
      o.canGrow = a.CanGrow !== '0';
      if (a.CanShrink === '1') o.canShrink = true;
      summary(a, o, band, ctx);
      if (a.HyperLink) { o.link = { raw: a.HyperLink }; warn('info', 'HyperLink (chỉ có nghĩa khi xem trên màn hình)'); }
    } else o.canGrow = false;
    // Quy ước theo tên (ReportViewerFrm lúc nạp mẫu)
    if (NAME.includes('DATETIMEREPORT')) o.value = df && !df.startsWith('=') ? { dateText: staticText, field: df } : { dateText: staticText };
    else if (NAME.includes('TITLE') && !df && /\{[A-Za-z0-9_]+\}/.test(staticText)) o.value = { template: staticText };
    if (NAME.includes('COUNTNUMBER') && !o.format?.kind) o.format = { kind: 'words', currency: 'VND', lang: 'VN' };
    const p3 = NAME.slice(0, 3);
    if (NAME.length > 2 && !o.role && !df) { // ô gắn DataField: giá trị cột đè chữ gán lúc nạp
      if (p3 === 'SYS') o.value = { sys: name.split('_')[0], fallback: staticText };
      else if (p3 === 'LNG') o.value = { lang: name.slice(3), fallback: staticText };
      else if (p3 === 'SUB') o.value = { subtitle: true, fallback: staticText };
      else if (p3 === 'PAR' && a.Tag) o.value = { paramCaption: a.Tag, fallback: staticText };
      else if (/^UINPUT\d/.test(NAME)) o.value = { userInput: name, fallback: staticText };
      else if (p3 === 'DAY' && !df) { o.value = { text: staticText }; warn('later', `Nhãn tuổi nợ ${name} (DAY*: nhân CycleCount)`); }
    }
    if (o.role === 'page.info') o.value = { pageInfo: o.lang || 'VN', groupScope: a.SummaryGroup || undefined };
    if (o.role === 'report.printDate') o.value = { printDate: true };
    if (o.role?.startsWith('company.line')) o.value = { sys: name.split('_')[0], fallback: staticText };
    if (NAME === 'SORTBY') { for (const f of staticText.split(',').map((x) => x.trim()).filter(Boolean)) ctx.sort.by.push(f); o.visible = false; }
    if (NAME === 'NOSORT') { ctx.sort.none = true; o.visible = false; }
    if (NAME === 'TXTNOAUTOSORTCROSSTAB' || NAME === 'TXTNOAUTOSORTCOLUMNCROSSTAB') o.visible = false;
  } else if (type === 'AR.CheckBox') {
    o.type = 'checkbox';
    o.caption = a.Caption || '';
    if (df) bind();
  } else if (type === 'AR.Image' || type === 'AR.Picture') {
    o.type = 'image';
    o.fit = a.SizeMode === '1' ? 'stretch' : a.SizeMode === '2' ? 'zoom' : 'clip';
    let hex = c.text.replace(/\s+/g, '');
    // Ảnh nhúng của AR: 0D 0D 00 04 · loại (02 PNG, 00 JPEG…) · độ dài uint32 LE · dữ liệu ảnh
    if (/^0D0D0004/i.test(hex) && hex.length > 18) {
      const len = parseInt(hex.slice(16, 18) + hex.slice(14, 16) + hex.slice(12, 14) + hex.slice(10, 12), 16);
      hex = hex.slice(18, len > 0 ? 18 + len * 2 : undefined);
    }
    if (hex && /^[0-9A-Fa-f]+$/.test(hex)) {
      const aid = `img${Object.keys(tpl.assets).length + 1}`;
      const mime = hex.startsWith('89504E47') ? 'image/png' : hex.startsWith('FFD8') ? 'image/jpeg' : hex.startsWith('424D') ? 'image/bmp' : hex.startsWith('47494638') ? 'image/gif' : '';
      if (mime) { tpl.assets[aid] = { mime, data: hexToBase64(hex) }; o.src = { asset: aid }; }
      else { o.src = null; warn('later', `Ảnh nhúng ${name} định dạng lạ (không phải PNG/JPEG/BMP/GIF)`); }
    } else if (df) o.src = { field: df };
    else if (NAME.includes('SYSLOGO')) o.src = { system: 'logo' };
    else if (/^SYSSIGNATURE/.test(NAME)) o.src = { system: name.replace(/^sys/i, '') };
    else { o.src = null; warn('info', `Ảnh trống ${name} (gán lúc chạy?)`); }
  } else if (type === 'AR.Shape') {
    o.type = 'rect';
    if (a.RoundingRadius && Number(a.RoundingRadius) > 0) o.radius = Math.min(10, Number(a.RoundingRadius)) / 10;
    const fill = oleColor(a.BackColor); if (fill && fill !== '#ffffff') o.fill = fill;
    if (a.LineWeight && Number(a.LineWeight) > 1) o.weight = Number(a.LineWeight);
    if (!o.border) o.border = { top: { style: 'solid' }, right: { style: 'solid' }, bottom: { style: 'solid' }, left: { style: 'solid' } };
  } else if (type === 'AR.Subreport') {
    o.type = 'subreport';
    o.template = (a.ReportName || '').replace(/\.rpx$/i, '');
    const tg = a.Tag || '';
    if (tg.startsWith('Filter:')) o.filter = { field: tg.slice(7) };
    else if (tg) { o.dataSource = { tagRaw: true }; warn('manual', `Subreport ${name} có Tag SQL/mã hóa (ReportPropertyX)`); }
    o.dataSource ||= { resultSet: 'next' };
    warn('later', 'Subreport');
  } else if (type === 'AR.ReportInfo') {
    o.type = 'text';
    const fs = a.FormatString || '{PageNumber}/{PageCount}';
    const parts = fs.split(/(\{PageNumber\}|\{PageCount\}|\{RunDateTime(?::[^}]*)?\})/).filter((x) => x !== '');
    o.value = { expr: parts.map((p) => (p === '{PageNumber}' ? (a.SummaryGroup ? 'GroupPageNumber' : 'PageNumber') : p === '{PageCount}' ? (a.SummaryGroup ? 'GroupPageCount' : 'PageCount')
      : p.startsWith('{RunDateTime') ? `Format(Now(), "${p.slice(13, -1) || 'dd/MM/yyyy HH:mm'}")` : `"${p.replace(/"/g, '""')}"`)).join(' & ') || '""' };
    if (a.SummaryGroup) o.value.groupScope = a.SummaryGroup;
  } else if (type === 'AR.Barcode') {
    o.type = 'barcode';
    o.symbology = a.BarStyle === '24' ? 'qr' : 'code128';
    if (df) bind(); else o.value = { text: a.Text || '' };
    o.caption = !!a.CaptionPos && a.CaptionPos !== '0';
    if (o.symbology === 'qr') warn('later', 'Mã QR');
  } else if (type === 'AR.ChartControl') {
    o.type = 'chart';
    warn('manual', 'Biểu đồ (ChartControl)');
    return o;
  } else if (type === 'AR.RichTextBox' || type === 'AR.OleObject' || type === 'AR.PageBreak') {
    o.type = type === 'AR.PageBreak' ? 'pageBreak' : 'text';
    if (type !== 'AR.PageBreak') { o.value = { text: '' }; warn('manual', `Control ${type} chưa hỗ trợ`); }
    return o;
  } else {
    warn('manual', `Control lạ ${type}`);
    return null;
  }
  tagConventions(a, o, ctx);
  return o;
}

/** Tổng của AR (SummaryType / SummaryFunc / SummaryRunning / SummaryGroup). @param {Obj} a @param {Obj} o @param {Obj} band @param {any} ctx */
function summary(a, o, band, ctx) {
  const st = a.SummaryType, fn = a.SummaryFunc, run = a.SummaryRunning;
  if (st === '4') { // PageCount
    o.value = { expr: a.SummaryGroup ? (run === '2' || run === '1' ? 'GroupPageNumber' : 'GroupPageCount') : (run === '2' || run === '1' ? 'PageNumber' : 'PageCount') };
    if (a.SummaryGroup) o.value.groupScope = a.SummaryGroup;
    return;
  }
  if (!st || st === '0') return; // SummaryType = None: AR bỏ qua SummaryFunc / SummaryRunning
  let scope = 'report';
  if (st === '2') scope = 'page';
  else if (st === '3') scope = `group:${a.SummaryGroup || ctx.groupNames[ctx.groupNames.length - 1] || ''}`;
  /** @type {Obj} */ const s = { func: SUM_FUNC[Number(fn || 0)] || 'sum', scope, running: run === '1' ? 'group' : run === '2' ? 'all' : 'none' };
  if (Number(fn) >= 9) s.distinct = true;
  if (a.SummaryDistinct) s.distinctField = a.SummaryDistinct;
  if (['groupHeader', 'reportHeader', 'pageHeader'].includes(band.type) && s.running === 'none') s.lookAhead = true;
  if (s.func === 'var' || s.func === 'varp' || s.func.startsWith('stddev')) ctx.warn('later', `Hàm tổng ${s.func}`);
  o.summary = s;
}

/** Quy ước Tag của ERP (DesinerToolAR / ReportViewerFrm). @param {Obj} a @param {Obj} o @param {any} ctx */
function tagConventions(a, o, ctx) {
  const tg = a.Tag || '';
  if (!tg || o.type === 'subreport') return;
  const T = tg.toUpperCase();
  const lastGroup = ctx.groupNames[ctx.groupNames.length - 1] || '';
  if (T === 'ISBOLD') (o.rules ||= []).push({ when: 'IsBold = 1 or IsBold = true', style: { bold: true } });
  else if (T.startsWith('BACKCOLORFORMAT;')) (o.rules ||= []).push({ when: 'true', styleFrom: { background: tg.split(';')[1] } });
  else if (T.startsWith('FORECOLORFORMAT;')) (o.rules ||= []).push({ when: 'true', styleFrom: { color: tg.split(';')[1] } });
  else if (T.startsWith('STRINGSUMMARY')) {
    const n = T.slice(13) || '1';
    o.summary = { func: 'concat', separator: ({ 1: '; ', 2: '\n', 3: ', ', 4: '; ', 5: '\n', 6: ', ' })[n] || '; ', distinct: ['4', '5', '6'].includes(n),
      scope: `group:${a.SummaryGroup || lastGroup}`, running: 'none' };
    ctx.warn('info', 'StringSummary (nối chuỗi theo nhóm) — cần đối chứng ký tự nối');
  } else if (T.startsWith('COUNTNUMBER')) {
    const p = tg.split(';');
    o.format = { kind: 'words', currency: p[1] || 'VND', lang: p[2] || 'VN' };
    if ((p[3] || '') !== '') o.format.abs = true;
    const sp = /Space(\d+)/i.exec(p[3] || '');
    if (sp) o.indent = Number(sp[1]) + 1;
  } else if (T.startsWith('SPACE')) o.indent = Number(T.replace(/\D/g, '') || 0) + 1;
  else if (T === 'DUPLICATEHIDE' || T === 'DUPLICATEINVISIBLE') o.hideDuplicates = T === 'DUPLICATEHIDE' ? 'value' : 'control';
  else if (T === 'HIDEEMPTY') o.hideIfEmpty = true;
  else if (T === 'SUPPRESSZERO') o.suppressZero = true;
  else if (T === 'NOSIGN') o.abs = true;
  else if (T === 'ROUND') o.roundIfInteger = true;
  else if (T === 'MONTH') o.format = { kind: 'monthName' };
  else if (T.startsWith('VISIBLEEXP:')) {
    o.visibleWhen = visibleExp(tg.slice(11));
    if (check(o.visibleWhen)) ctx.warn('manual', `VisibleExp của ${o.id} không đọc được`);
  } else if (T.startsWith('FILTER:')) o.filter = { field: tg.slice(7) };
  else if (tg.length >= 100 && /^[A-Za-z0-9+/=]+$/.test(tg)) { o.propertyX = true; ctx.warn('manual', `ReportPropertyX (SQL / tham số riêng trong Tag) ở ${o.id}`); }
  else if (T === 'SUMMARYEXPRESSION') ctx.warn('manual', 'SummaryExpression');
  else if (T.startsWith('FORMAT') && !a.DataField && !a.OutputFormat && a.Type !== 'AR.Label') o.autoFormat = tg.slice(7); // Tag "Format;TênCột"
  else if (/DATETIMEREPORT|\{[DMY]\}/i.test(tg)) { /* mẫu ngày đã xử lý theo tên */ }
  else ctx.warn('info', `Tag chưa biết: ${tg.slice(0, 24)}`);
}

/** Nhận dạng các script quen thuộc; KHÔNG chạy mã. @param {string} code @param {Obj} tpl @param {(l: Warn['level'], m: string) => void} warn */
function convertScript(code, tpl, warn) {
  let body = code.replace(/(public\s+|private\s+)?void\s+\w+\s*\(\s*\)\s*\{\s*\}/g, '');
  body = body.replace(/Sub\s+\w+\s*(\([^)]*\))?\s*End Sub/gi, '');
  body = body.replace(/\/\/[^\n]*|^\s*'[^\n]*/gm, '').trim();
  if (!body) { warn('info', 'Script rỗng (bỏ)'); return; }
  let known = false;
  if (/Fields\.Item\("IsBold"\)/i.test(body) || /Fields\("IsBold"\)/i.test(body)) {
    known = true;
    const det = tpl.bands.find((/** @type {Obj} */ b) => b.type === 'detail');
    for (const c of det?.controls || []) if (c.type === 'text') (c.rules ||= []).some((/** @type {Obj} */ r) => r.when.startsWith('IsBold')) || c.rules.push({ when: 'IsBold = 1 or IsBold = true', style: { bold: true } });
    warn('auto', 'Script in đậm theo IsBold → rules');
  }
  if (/Sections\("PageHeader"\)\.Visible\s*=\s*False/i.test(body)) {
    known = true;
    const ph = tpl.bands.find((/** @type {Obj} */ b) => b.type === 'pageHeader');
    if (ph) ph.visibleWhen = 'PageNumber = 1';
    warn('auto', 'Script ẩn PageHeader từ trang 2 → visibleWhen PageNumber = 1');
  }
  const rest = body.replace(/if\s*\(?\s*rpt\.Fields\.Item\("IsBold"\)\.Value\s*=+\s*(true|1)[^\n]*?then|\w+\.Font\s*=\s*[^\n]+|\belse\b|End If|Sub \w+(\([^)]*\))?|End Sub|rpt\.Sections\("PageHeader"\)\.Visible\s*=\s*False|Dim\s+\w+\s+As\s+[^\n]+/gi, '');
  if (!known || /\w/.test(rest)) { tpl.source.script = code.slice(0, 20000); warn('manual', 'Script C#/VB cần chuyển tay (mã gốc giữ ở source.script, không chạy)'); }
}
