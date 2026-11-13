// Bộ chuyển .rpx (mẫu tự viết): quy ước ERP thành thuộc tính, và định dạng theo cột như FormatField của ReportViewerFrm.
import { convertRpx } from '../../web/js/print/rpx.js';
import { buildDocument } from '../../web/js/print/engine.js';

const ctl = (type, name, attrs) => `<Control Type="${type}" Name="${name}" Left="0" Top="0" Width="1440" Height="300"${Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('')} />`;
const rpx = `﻿<?xml version="1.0" encoding="UTF-8"?>
<ActiveReportsLayout Version="3.1" PrintWidth="10800">
  <StyleSheet><Style Name="Normal" Value="font-family: Arial; font-size: 10pt" /></StyleSheet>
  <Sections>
    <Section Type="Detail" Name="Detail" Height="2000">
      ${ctl('AR.Field', 'Ngay', { DataField: 'DocumentDate' })}
      ${ctl('AR.Field', 'SoTien', { DataField: 'Amount' })}
      ${ctl('AR.Field', 'SoTienDinhDang', { DataField: 'Amount', OutputFormat: '#,##0.00' })}
      ${ctl('AR.Field', 'BieuThuc', { DataField: '=Amount * 2' })}
      ${ctl('AR.Label', 'NhanCot', { DataField: 'Amount' })}
      ${ctl('AR.Field', 'TheoTag', { Tag: 'Format;Amount', Text: '5000' })}
      ${ctl('AR.Field', 'COUNTNUMBER_1', { DataField: 'Amount' })}
    </Section>
  </Sections>
  <PageSettings PaperSize="phieugiaohang" PaperWidth="11909" PaperHeight="7949" />
</ActiveReportsLayout>\u0000\u0000`;

export default function run(t) {
  const { template } = convertRpx(rpx, { file: 'TEST_Report.rpx' });
  const by = Object.fromEntries(template.bands[0].controls.map((c) => [c.id, c]));
  t.eq([template.page.paper, template.page.width, template.page.height], ['custom', 210.06, 140.21], 'khổ tùy chỉnh theo PaperWidth/PaperHeight');
  t.eq(by.Ngay.autoFormat, true, 'TextBox trống OutputFormat ⇒ theo định dạng cột');
  t.eq(by.SoTienDinhDang.autoFormat, undefined, 'có OutputFormat thì giữ');
  t.eq(by.BieuThuc.autoFormat, undefined, 'biểu thức "=" không có định dạng cột');
  t.eq(by.NhanCot.autoFormat, undefined, 'Label không qua FormatField');
  t.eq(by.TheoTag.autoFormat, 'Amount', 'Tag Format;Cột');

  const data = {
    main: {
      columns: [{ name: 'DocumentDate', type: 'datetime', format: 'dd/MM/yyyy' }, { name: 'Amount', type: 'number', format: '#,##0' }],
      rows: [{ DocumentDate: new Date(2026, 10, 9), Amount: 2000000 }],
    },
  };
  const texts = buildDocument(template, data).pages[0].boxes.filter((b) => b.kind === 'text').map((b) => b.text);
  t.eq(texts, ['09/11/2026', '2.000.000', '2.000.000,00', '4000000', '2000000', '5000', 'Hai triệu đồng ./.'], 'định dạng như WinForms');
  // Không có định dạng cột (BE cũ): ngày in đủ ngày giờ như ToString() của .NET
  const bare = buildDocument(template, { main: { columns: [{ name: 'DocumentDate', type: 'datetime' }, { name: 'Amount', type: 'number' }], rows: data.main.rows } });
  t.eq(bare.pages[0].boxes.find((b) => b.ctl === 'Ngay').text, '09/11/2026 00:00:00', 'không có định dạng cột ⇒ ToString()');
}
