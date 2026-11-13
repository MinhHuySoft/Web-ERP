// Ngôn ngữ biểu thức của mẫu in: cú pháp, ngữ nghĩa giá trị, giới hạn an toàn.
import { compile, evaluate, check, roundEven, dateText } from '../../web/js/print/expr.js';

const row = { Amount: 1234.5, Qty: 3, Price: 2.5, Name: 'Hàng A', Empty: null, DocDate: new Date(2026, 10, 13), IsBold: 1, 'Tên có dấu': 'x' };
const ctx = {
  field: (n) => row[Object.keys(row).find((k) => k.toLowerCase() === n.toLowerCase())] ?? null,
  hasField: (n) => Object.keys(row).some((k) => k.toLowerCase() === n.toLowerCase()),
  param: (n) => { const p = { FromDate: new Date(2026, 0, 1), Template: 'PT01' }; return Object.hasOwn(p, n) ? p[n] : undefined; },
  sys: (n) => ({ CompanyName: 'Công ty Mẫu' })[n],
  special: (n) => ({ PageNumber: 2, PageCount: 5, RowNumber: 7 })[n],
  aggregate: (fn, args, ev) => (fn === 'sum' ? 100 : fn === 'count' ? 4 : null),
  now: () => new Date(2026, 10, 13, 9, 30),
};
const E = (s) => evaluate(s, ctx);

export default function run(t) {
  t.eq(E('1 + 2 * 3'), 7, 'ưu tiên toán tử');
  t.eq(E('(1 + 2) * 3'), 9, 'ngoặc');
  t.eq(E("'Trang ' + PageNumber + '/' + PageCount"), 'Trang 2/5', 'nối chuỗi với số');
  t.eq(E('Qty * Price'), 7.5, 'cột');
  t.eq(E('Amount / 0'), null, 'chia 0 ra null');
  t.eq(E('Empty + 1'), 1, 'null trong phép tính là 0');
  t.eq(E("Empty & 'x'"), 'x', 'null nối chuỗi là rỗng');
  t.eq(E("Empty = ''"), true, 'null bằng chuỗi rỗng');
  t.eq(E('Empty > 0'), false, 'null so thứ tự là false');
  t.eq(E("Name = 'HÀNG A'"), true, 'so chuỗi không phân biệt hoa thường');
  t.eq(E("Name = 'Hang A'"), false, 'nhưng phân biệt dấu');
  t.eq(E("Name like 'hàng%'"), true, 'like');
  t.eq(E("Qty in (1, 2, 3)"), true, 'in');
  t.eq(E("Qty not in (1, 2)"), true, 'not in');
  t.eq(E('IsBold = 1 or IsBold = true'), true, 'or');
  t.eq(E('not (Qty > 2) and true'), false, 'not/and');
  t.eq(E('Qty > 2 ? "nhiều" : "ít"'), 'nhiều', 'ternary');
  t.eq(E('IIf(Qty = 3, "ba", "khác")'), 'ba', 'IIf');
  t.eq(E('[Tên có dấu]'), 'x', 'tên trong ngoặc vuông');
  t.eq(E('@Template'), 'PT01', '@ tham số');
  t.eq(E('Param.Template'), 'PT01', 'Param.X');
  t.eq(E('Template'), 'PT01', 'tên trơn không phải cột thì tìm tham số');
  t.eq(E('Sys.CompanyName'), 'Công ty Mẫu', 'Sys.X');
  t.eq(E('Format(Amount, "#,##0.00")'), '1.234,50', 'Format số');
  t.eq(E('Format(DocDate, "dd/MM/yyyy")'), '13/11/2026', 'Format ngày');
  t.eq(E('Format(Now(), "dd/MM/yyyy HH:mm")'), '13/11/2026 09:30', 'Now');
  t.eq(E('Day(DocDate) & "/" & Month(DocDate)'), '13/11', 'Day/Month');
  t.eq(E('Format(AddMonths(DocDate, 3), "dd/MM/yyyy")'), '13/02/2027', 'AddMonths');
  t.eq(E('NumberToWords(1250000)'), 'Một triệu hai trăm năm mươi nghìn đồng ./.', 'NumberToWords');
  t.eq(E('Sum(Amount)'), 100, 'hàm tổng gọi về bộ dựng');
  t.eq(E('Max(1, 5)'), 5, 'Max hai đối số là hàm thường');
  t.eq(E('Left(Name, 4) & Right("abcdef", 2) & Mid("abcdef", 2, 3)'), 'Hàngefbcd', 'chuỗi');
  t.eq(E('Round(2.5) + Round(3.5) + Round(-2.5)'), 2 + 4 - 2, 'Round nửa về chẵn như .NET');
  t.eq(roundEven(1.005, 2), 1, 'roundEven 1.005 (15 chữ số → 1.005, nửa về chẵn → 1.00)');
  t.eq(E('10 \\ 3 + 10 % 3 + 10 mod 4'), 3 + 1 + 2, 'chia nguyên, dư');
  t.eq(E("'It''s' + \"a \\\"q\\\"\""), 'It\'sa "q"', 'thoát nháy');
  t.eq(dateText(new Date(2026, 1, 3), 'Ngày {D} tháng {M} năm {Y}', ''), 'Ngày 03 tháng 02 năm 2026', 'DATETIMEREPORT');
  t.eq(dateText(null, 'Ngày {D} tháng {M} năm {Y}', ''), 'Ngày    tháng    năm     ', 'DATETIMEREPORT rỗng');
  t.ok(compile('PageNumber + 1').usesPage, 'đánh dấu biến trang');
  t.ok(compile('Sum(Qty * Price)').usesAggregate, 'đánh dấu hàm tổng');
  t.eq([...compile('Qty * Price + [Tên có dấu]').fields].join(','), 'Qty,Price,Tên có dấu', 'liệt kê cột');
  // an toàn
  t.ok(check('alert(1)'), 'không có hàm lạ');
  t.ok(check('constructor.constructor("x")()'), 'không có truy cập thuộc tính JS');
  t.ok(check('a = '), 'thiếu phần cuối');
  t.ok(check('x'.repeat(2001)), 'giới hạn độ dài');
  t.ok(check('('.repeat(80) + '1' + ')'.repeat(80)), 'giới hạn độ sâu');
  t.eq(E('__proto__'), null, '__proto__ chỉ là tên cột');
  t.eq(check("'Trang ' + PageNumber + '/' + PageCount"), null, 'cú pháp hợp lệ');
}
