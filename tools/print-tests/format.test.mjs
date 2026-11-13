// Đối chiếu web/js/print/netformat.js với .NET (văn hóa như ERP.NET ép: nhóm ".", thập phân ",", ngày dd/MM/yyyy, giờ HH:mm).
// format-gold.tsv sinh bằng .NET 10. Khác biệt có chủ ý (.NET Framework mà WinForms chạy, khác .NET Core 3.0+): số âm làm
// tròn về 0 không in dấu "-"; 3 phần thì số khác 0 làm tròn thành 0 dùng phần thứ ba; định dạng chuẩn N/F làm tròn trên 15
// chữ số, nửa xa 0 (.NET Core: giá trị nhị phân chính xác, nửa về chẵn). Các dòng đó tính lại ở FRAMEWORK / bỏ qua.
import { readFileSync } from 'node:fs';
import { formatValue, parseIsoDate } from '../../web/js/print/netformat.js';

const FRAMEWORK = (f, v, s) => {
  if (f === '#,##0;(#,##0);-' && v !== 0 && Math.abs(v) < 0.5) return '-';
  if (f === '' && v === 123456789012345.6) return '123456789012346'; // ToString() của Framework: 15 chữ số có nghĩa
  return v < 0 && /^-[^1-9]*$/.test(s) ? s.replace('-', '') : s;
};
const STANDARD = /^[NF]\d*$/;
/** Kết quả .NET Framework của định dạng chuẩn (kiểm bằng tay). */
const STANDARD_CASES = [['N0', 0.5, '1'], ['N0', -0.5, '-1'], ['N0', 1234.5, '1.235'], ['N2', 0.125, '0,13'], ['N2', 1.005, '1,01'],
  ['N2', 2.675, '2,68'], ['N2', 1234567.891, '1.234.567,89'], ['F2', 0.125, '0,13'], ['F2', -98765.4321, '-98765,43'], ['N2', -0.004, '0,00']];

export default function run(t) {
  const lines = readFileSync(new URL('./format-gold.tsv', import.meta.url), 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const [f, v, expected] = line.split('\t');
    if (f.startsWith('D:')) t.eq(formatValue(parseIsoDate(v), f.slice(2)), expected, `ngày ${f.slice(2)} ${v}`);
    else if (!STANDARD.test(f)) t.eq(formatValue(Number(v), f), FRAMEWORK(f, Number(v), expected), `số "${f}" ${v}`);
  }
  for (const [f, v, e] of STANDARD_CASES) t.eq(formatValue(v, f), e, `chuẩn ${f} ${v}`);
}
