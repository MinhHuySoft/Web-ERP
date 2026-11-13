// Bộ dựng mẫu in trên mẫu và dữ liệu giả: nhóm, tổng (cả ở đầu nhóm), STT, sang trang theo nhóm, Trang N/M, CanGrow.
import { buildDocument } from '../../web/js/print/engine.js';

const T = (id, x, y, w, h, value, extra = {}) => ({ id, type: 'text', x, y, w, h, value, ...extra });
const template = {
  $schema: 'erp-print-template/1', id: 'TEST_DocReport', unit: 'mm',
  page: { paper: 'A5', orientation: 'portrait', width: 148, height: 210, margin: { top: 10, right: 10, bottom: 10, left: 10 }, bodyWidth: 128 },
  data: { sort: { auto: true } },
  styles: { Normal: { font: 'Arial', size: 10 } },
  groups: [{ id: 'GH1', by: 'DocumentID', newPage: 'before', keepTogether: 'none', repeatHeader: 'onPage' }],
  bands: [
    { id: 'ReportHeader', type: 'reportHeader', height: 0, controls: [] },
    { id: 'PageHeader', type: 'pageHeader', height: 6, controls: [T('ph', 0, 0, 60, 5, { sys: 'SysCom1', fallback: 'CÔNG TY' })] },
    { id: 'GH1', type: 'groupHeader', group: 'GH1', height: 12, controls: [
      T('doc', 0, 0, 60, 5, { field: 'DocumentID' }),
      T('total', 60, 0, 60, 5, { field: 'Amount' }, { format: '#,##0', summary: { func: 'sum', scope: 'group:GH1', running: 'none', lookAhead: true } }),
      T('date', 0, 6, 120, 5, { dateText: 'Ngày {D} tháng {M} năm {Y}', field: 'DocDate' }),
    ] },
    { id: 'Detail', type: 'detail', height: 6, keepTogether: true, stretchControls: true, controls: [
      T('stt', 0, 0, 10, 6, { field: 'ItemID' }, { summary: { func: 'count', scope: 'group:GH1', running: 'group' }, border: { left: { style: 'solid' } } }),
      T('item', 10, 0, 40, 6, { field: 'ItemName' }, { canGrow: true }),
      T('amt', 50, 0, 30, 6, { field: 'Amount' }, { format: '#,###.##', style: { align: 'right' } }),
    ] },
    { id: 'GF1', type: 'groupFooter', group: 'GH1', height: 12, controls: [
      T('sum', 50, 0, 30, 5, { field: 'Amount' }, { format: '#,##0', summary: { func: 'sum', scope: 'group:GH1', running: 'none' } }),
      T('words', 0, 6, 128, 5, { field: 'Amount' }, { summary: { func: 'sum', scope: 'group:GH1', running: 'none' }, format: { kind: 'words', currency: 'VND', lang: 'VN' } }),
    ] },
    { id: 'PageFooter', type: 'pageFooter', height: 5, controls: [T('pg', 0, 0, 40, 5, { pageInfo: 'VN' }), T('pg2', 40, 0, 40, 5, { expr: '"p" & PageNumber & "/" & PageCount' })] },
    { id: 'ReportFooter', type: 'reportFooter', height: 5, controls: [T('grand', 50, 0, 30, 5, { field: 'Amount' }, { format: '#,##0', summary: { func: 'sum', scope: 'report', running: 'none' } })] },
  ],
};
const rows = [];
for (const [doc, n] of [['PT02', 3], ['PT01', 2], ['PT03', 40]]) for (let i = 1; i <= n; i++) rows.push({ DocumentID: doc, DocDate: new Date(2026, 10, 13), ItemID: `${doc}-${i}`, ItemName: i === 2 ? 'Tên hàng rất dài cần xuống dòng nhiều lần cho chắc chắn là ô tự cao lên' : `Hàng ${i}`, Amount: 1000 * i + 0.5 });
const data = { main: { columns: [{ name: 'DocumentID', type: 'text' }, { name: 'DocDate', type: 'date' }, { name: 'ItemID', type: 'text' }, { name: 'ItemName', type: 'text' }, { name: 'Amount', type: 'money' }], rows }, sys: new Map([['SysCom1', 'Công ty Mẫu']]) };

export default function run(t) {
  const { pages, warnings } = buildDocument(template, data);
  t.eq(warnings, [], 'không cảnh báo');
  const texts = (p) => pages[p].boxes.filter((b) => b.kind === 'text').map((b) => b.text);
  const all = pages.flatMap((_p, i) => texts(i));
  t.ok(pages.length >= 4, `sang trang trước mỗi nhóm + nhóm dài (${pages.length} trang)`);
  t.eq(texts(0)[0], 'Công ty Mẫu', 'tham số hệ thống SysCom1');
  t.eq(texts(0)[1], 'PT01', 'tự sắp theo cột nhóm');
  t.eq(texts(0)[2], '3.001', 'tổng nhóm in ở đầu nhóm (look-ahead): 1000,5 + 2000,5');
  t.eq(texts(0)[3], 'Ngày 13 tháng 11 năm 2026', 'DATETIMEREPORT');
  t.eq(texts(0)[4], '1', 'STT');
  t.ok(all.includes('Ba nghìn không trăm lẻ một đồng ./.'), 'số thành chữ của tổng nhóm');
  t.eq(texts(pages.length - 1).slice(-2), ['Trang ' + pages.length + '/' + pages.length, 'p' + pages.length + '/' + pages.length], 'Trang N/M ở trang cuối');
  t.ok(all.includes('Trang 1/' + pages.length), 'Trang 1/M');
  const grand = rows.reduce((s, r) => s + r.Amount, 0);
  t.ok(all.includes(new Intl.NumberFormat('vi-VN').format(Math.round(grand))), 'tổng báo cáo');
  // nhóm PT03 dài 40 dòng: tiêu đề nhóm lặp lại ở trang sau
  t.ok(pages.filter((_p, i) => texts(i).includes('PT03')).length >= 2, 'lặp tiêu đề nhóm trên trang mới');
  // ô CanGrow cao lên và ô STT cùng dòng được kéo tới đáy band
  const det = pages[0].boxes.filter((b) => b.band === 'Detail');
  const long = det.find((b) => b.text?.startsWith('Tên hàng rất dài'));
  t.ok(long && long.h > 6, 'ô CanGrow cao lên');
  t.ok(pages.every((p) => p.boxes.every((b) => b.y + (b.h || 0) <= 210 + 0.01)), 'không hộp nào tràn khổ giấy');
  // dữ liệu rỗng vẫn ra một trang
  const empty = buildDocument(template, { main: { columns: data.main.columns, rows: [] }, sys: new Map() });
  t.eq(empty.pages.length, 1, 'không có dòng vẫn in một trang');
}
