# 02 — Kiểm kê các bản triển khai theo khách hàng

Ngày khảo sát: 2026-11-11. Chỉ đọc nguồn. Không chạy exe, không kết nối DB/mạng, không giải mã `settings.config`.
Số liệu sinh bằng script (scratchpad), CSV kèm theo ở `data\`:

| File | Nội dung |
|---|---|
| `data\reports-catalog.csv` | 1.192 tên report (.rpx) khác nhau, tiền tố, số khách có, phân loại, danh sách khách |
| `data\layout-forms.csv` | 744 tên file layout (form/report/filter/toolbar) khác nhau, loại, số khách dùng, danh sách khách |

Quy ước: "khách" = một thư mục triển khai (22 thư mục, tính MAK và KEIKO riêng, VLS 2 bản riêng). Ngưỡng "chung" = có ở >= 11/22.
Lưu ý: ngày file là ngày build/sao chép (mtime); `UpdateBK\<ngày>` là ngày chép đè bản mới (file cũ được lưu lại).

## 1. Bảng kiểm kê khách hàng

| # | Thư mục (D:\Data\...) | Loại exe | exe (MB / ngày) | Tools.dll (MB / ngày) | UpdateBK | Database (thư mục con Layout, bỏ qua thư mục rỗng) | rpx | dat | Lĩnh vực (đoán) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | AnDat | ERP.NET | 7,73 / 24-09-2026 | 8,26 / 24-09-2026 | 4 lần (18-08 .. 06-10) | AnDat01, AnDatNB, CTCERABNC(+V), X22CMSADEC, X26CERASG(+V) | 835 | 67 | Sản xuất + thương mại (có phiếu thành phẩm/quyết toán đơn SX); chưa rõ ngành cụ thể |
| 2 | DIM-GiaThanh | ERP.NET | 7,69 / 21-08-2026 | 8,30 / 21-08-2026 | 0 | X26DIMQ8GT | 834 | 23 | Sản xuất — tính giá thành (PC_ProductCost, lệnh sản xuất) |
| 3 | DIM-ATTP\SoBaBuoc_ATTP_Dim | **SoBaBuoc** | 1,70 / 30-06-2026 | 7,67 / 29-06-2026 | 0 | SoBaBuocATTP, SoBaBuocCT, SoBaBuocTB | 23 | 24 | Suất ăn / bếp ăn — "sổ 3 bước" an toàn thực phẩm (giấy ATTP, hợp đồng, món ăn) |
| 4 | DemoKetoan\DemoKetoan | ERP.NET | 7,20 / 09-06-2026 | 8,27 / 09-06-2026 | 0 | Demo2026, Medcom, TestKT, TestSX | 759 | 86 | Bản demo kế toán (bộ chuẩn) |
| 5 | DuocEuro | ERP.NET | 7,30 / 22-07-2026 | 8,29 / 22-07-2026 | 1 (28-07) | X26EURO, AADemoKTChuan/Duoc, X04KONA(2025), X04OHIO2025(+V), X26THIENMY, X26NBTIN, X23STNKT, X24CIBA, X26Toronto... | 759 | 65 | Dược / mỹ phẩm (đoán theo tên thư mục + AADemoKTDuoc); nhiều DB công ty con |
| 6 | KeToanTranformer | ERP.NET | 7,30 / 18-06-2026 | 8,27 / 18-06-2026 | 3 (24-04, 15-06, 18-06) | X22BUUAN, X26CERASG(+V), CTCERABNC(+V), X22CMSADEC | 837 | 59 | Kế toán chung; có form liên DB (`*_LinkDB`), mẫu in TT99 |
| 7 | Kona\KeToan_KONA_ALL_Dev | ERP.NET | 7,30 / 22-07-2026 | 8,29 / 22-07-2026 | 1 (28-07) | như DuocEuro (cùng bộ DB) | 759 | 45 | Bản dev trùng DuocEuro (cùng exe/ngày/danh sách DB) |
| 8 | MAK-KEIKO\MAK | ERP.NET | 7,75 / 05-11-2026 | 8,27 / 05-11-2026 | 1 (06-11) | CT04MAK | 759 | 1 | Nông nghiệp (vật tư, đại lý/nông dân — xem 00 mục 5); bộ báo cáo chuẩn, gần như chưa tùy biến |
| 9 | MAK-KEIKO\KEIKO | ERP.NET | 7,75 / 05-11-2026 | 8,27 / 05-11-2026 | 1 (06-11) | CT05KEIK (+CT04MAK) | 759 | 2 | Chưa rõ ngành (DB CT05KEIK); cùng build với MAK |
| 10 | Medcom\ERP_Medcom2026 | ERP.NET | 7,73 / 09-10-2026 | 8,26 / 09-10-2026 | **14** (22-05 .. 09-10) | Medcom (235 dat), MedData (87) | 787 | 322 | Thiết bị y tế: nhập khẩu, hợp đồng/PO, kiểm nhận hàng, QR, quản lý máy + linh kiện (FA_Machine360, PartGenealogy) |
| 11 | Medstand | ERP.NET | 7,69 / 07-08-2026 | 8,29 / 07-08-2026 | 1 (28-08) | CT04MEDMB, medtest | 765 | 32 | Phân phối y tế/dược (đoán; hồ sơ NV kinh doanh, điểm tích lũy, đơn Viettel) |
| 12 | Meracine-HN\KetoanDemo202609Dev | ERP.NET | **7,75 / 09-11-2026** | **8,34 / 09-11-2026** | 8 (01-10 .. 09-11) | VietDuc (61), Vdata, Demo2026, Medcom, TestKT, TestSX | 776 | 167 | Phân phối dược phẩm (khách là nhà thuốc; hóa đơn thay thế, lô/hạn, bàn giao NV, tem túi). **Bản mới nhất = bản đã dịch ngược (00)** |
| 13 | Meracine-VietDuc\Meracine_VietDuc_Dev | ERP.NET | 7,73 / 05-10-2026 | 8,26 / 05-10-2026 | 2 (10-08, 26-10) | VietDucMN2022, Demo2026, Medcom | 759 | 87 | Như #12 (cùng khách, DB VietDuc) |
| 14 | Novo\KeToanNovoAltacoNovoGutez_Dev | ERP.NET | 7,74 / 29-10-2026 | 8,27 / 29-10-2026 | **12** (07-07 .. 04-11) | CT01NovaNew (91), CT01NovoMN(+V), CT01SOLA(+V), CTAltaco, X02NovoDN, X02NovoSX (33), X02NovoV, X03GUTEZ | 930 | 182 | Phân phối/bán hàng nhiều công ty & nhãn (TMĐT, call list, KH thân thiết, giao hàng barcode, in KONA/Samurai/...) + sản xuất (NovoSX) |
| 15 | PhuongDung | ERP.NET | 7,10 / 17-04-2026 | 8,17 / 17-04-2026 | 0 | X25PhuongDung (41), X25PhuongDung2, X25ATable, X23STNKT, AADemo* | 768 | 82 | Hộ kinh doanh / bán lẻ (module HKD_*, sổ doanh thu S2a/S2b, nghĩa vụ thuế) — **bản cũ nhất** |
| 16 | Santino\KeToanTest2026 | ERP.NET | 7,19 / 05-05-2026 | 8,21 / 05-05-2026 | 0 | X23STNKT (66), X23STNKT_TEST26 (19), AADemo* | 760 | 104 | Thời trang: sản xuất + kế toán (Collection, Tone màu, Size, NPL, định mức, thương hiệu) |
| 17 | Santino\BanHang_SantinoTest2026 | **BanHang** | 9,23 / 26-08-2026 | 8,30 / 26-08-2026 | 5 (14-05 .. 26-08) | X23STN (112), X23STN_TEST26 (95), X23STN1/2/3/24 | 84 | 224 | Chuỗi bán lẻ thời trang (cửa hàng, khen thưởng cửa hàng, châm hàng tự động, ZNS) |
| 18 | Spa | **BanHang** | 5,52 / 12-06-2026 | 7,66 / 09-06-2026 | 0 | X26SPA | 47 | 33 | Spa / dịch vụ làm đẹp (bản BanHang cũ) |
| 19 | TinPhong | ERP.NET | 7,75 / 07-11-2026 | 8,27 / 04-11-2026 | **12** (22-04 .. 09-11) | TinPhong (61), X22LienMai (19), Clisun, TinPhong2021/2022/21A, X02DuocTP | 961 | 97 | Phân phối dược phẩm (thuốc kiểm soát đặc biệt, biên bản kiểm nhập) + đẩy dữ liệu xuất kho/hóa đơn lên GDP/BeeC. Nhiều report nhất (961) |
| 20 | VLS\bin_VLS_Dev | **ERP.VLS** | 3,50 / 29-09-2026 | 8,26 / 29-09-2026 | 2 (30-07, 29-09) | CTVLS (37), CTVLS3 | 397 | 40 | Trung tâm đào tạo (học viên, lịch giảng, phiếu báo giảng, phiếu thu HV) — kèm `VLS.Schedule*.dll`, `VLS.Student*.dll` |
| 21 | VLS\bin_VLS_Dev_NamA | ERP.NET | 7,30 / 30-07-2026 | 8,29 / 30-07-2026 | 0 | CTVLS, CTVLSV (11) | 388 | 12 | Cùng khách VLS, dùng ERP.NET chuẩn (bộ AC_*, ít report hơn vì lược bớt) |
| 22 | WA-Spa | ERP.NET | 7,30 / 22-06-2026 | 8,28 / 22-06-2026 | 0 | X26SPA (39), X26ChoDemo, X23STNKT, AADemo* | 760 | 63 | Spa (menu WA_*, hoa hồng, lương, thu chi) trên nền ERP.NET |

Tổng: 18 ERP.NET + 2 BanHang + 1 ERP.VLS + 1 SoBaBuoc. 76 tên thư mục DB (có trùng giữa khách), 1.817 file `.dat` trong thư mục DB.
Số database thực tế ít hơn vì cùng một DB xuất hiện ở nhiều khách (Demo2026, Medcom, X23STNKT, AADemoKTChuan...).

### 1.1 File đặc biệt (mẫu in Word/Excel và gói kèm)

- **Bộ mẫu in Word/Excel mặc định** nằm trong `Reports\` của 17/22 khách (VLS chỉ có 2 mẫu .xlt) (cùng nội dung): `BangKeThueDauRa(2).xlt`, `BangKeThueDauVao(2).xlt` (bảng kê thuế),
  `CS_Payment{EXIM,EXIMLenhChi,JMB,TECHCOM,UNCBIDVWord}Report.doc/xls` (ủy nhiệm chi theo ngân hàng), `Phieu giu cho`, `Phieu dat coc(2)`,
  `Hop dong nguyen tac`, `Giu cho(Dragon Long Thanh).docx`, `SP Vi bang - Dat coc`, `So rieng - Dat coc` (mẫu **bất động sản: giữ chỗ/đặt cọc** của một khách cũ),
  `testword*.doc(x)`. Đây là mẫu cho tính năng "in ra Word/Excel theo mẫu" (xuất qua bookmark/ô). Web cần cơ chế mẫu tài liệu riêng.
- `1 Bien nhan hop dong.doc`, `1 HDCN DA SANG TEN.doc`, `2 HDCN CHUA SANG TEN.doc`, `2. Test.xls` — mẫu hợp đồng chuyển nhượng (DuocEuro, Kona, PhuongDung, Santino KT, TinPhong, WA-Spa).
- `AP_PurchaseDetailEccelReport.xls`, thư mục `PC_StandardCostDetailReport`, `Reports.zip` (Novo, TinPhong): mẫu Excel riêng + bản nén bộ report.
- `BackupRpt\`, `BackupLast\` trong Reports: bản sao lưu report khi sửa/cập nhật (không phải tài liệu mới).
- `UpdateLog.txt` (DuocEuro, KeToanTranformer, Kona, Santino BanHang, WA-Spa): log "Number of file updated" của bộ tự cập nhật (cơ chế auto-update chép file theo số lượng — có từ 2019).
- `Layout\Admin.data`, `Layout\<tài khoản>.data`, `Remember.pass`: tệp "ghi nhớ đăng nhập" của người dùng (nội dung mã hóa/nhìn như base64). **Không chép**; web không được lặp lại kiểu lưu này.
- Thư mục phụ trong khách: `Tools\` (DemoKetoan, DuocEuro, Kona, MAK, KEIKO, Medcom, Medstand, Meracine, Novo, PhuongDung, Santino KT, TinPhong, WA-Spa), `Audit\`, `output(s)\` (Meracine-HN, Medcom: sản phẩm làm việc/báo cáo audit), `work\` (Medcom: mã nguồn web đã làm), `DatabaseFixes\` (Novo), `SQLBackup\` (VLS Dev), `Temp\`.

### 1.2 Thư mục bỏ qua

- `Individual\CodeForge-AI`: dự án nghiên cứu/khởi nghiệp học lập trình Python (không liên quan ERP).
- `SmartHome`: tài liệu kỹ thuật camera AI giám sát cho khu dân cư (không liên quan ERP).
- `POS_DEMO`: demo POS web tĩnh (đã ghi ở 00). `Web-ERP`: dự án này.

## 2. Nhận xét về phiên bản

- **Cùng một code base, nhiều phiên bản chạy song song.** Kích thước exe 7,10 -> 7,75 MB (17-04-2026 -> 09-11-2026); Tools.dll 8,17 -> 8,34 MB. Có ít nhất 12 build exe khác nhau
  (khác kích thước); không khách nào trùng hoàn toàn trừ cặp DuocEuro = Kona (7.301.632 B / 22-07) và MAK = KEIKO (7.745.024 B / 05-11).
- **Mới nhất:** Meracine-HN (09-11), TinPhong (exe 07-11), MAK/KEIKO (05-11), Novo (29-10), Medcom (09-10). **Cũ nhất:** PhuongDung (17-04), Santino KT (05-05), DemoKetoan (09-06), WA-Spa (22-06), Spa BanHang (Tools 7,66 MB — engine cũ), SoBaBuoc (Tools 7,67 MB).
- **Nhịp cập nhật:** Medcom 14 lần, Novo và TinPhong 12 lần, Meracine-HN 8 lần trong ~6 tháng — mỗi lần chỉ thay `ERP.NET.exe` + `Tools.dll` (xem `UpdateBK\<ngày>\`; VLS còn kèm `VLS.*.dll`).
  Tức là **logic nghiệp vụ biến động mạnh theo từng khách**; việc "một bản web cho tất cả" phải tách rõ phần lõi chung và phần cấu hình/tùy biến.
- Khác biệt kích thước giữa biến thể: BanHang 9,2 MB (Santino) vs 5,5 MB (Spa); ERP.VLS 3,5 MB (phần lớn logic nằm ở `VLS.Schedule`/`VLS.Student`); SoBaBuoc 1,7 MB (nhỏ, chỉ sổ 3 bước).
- Cả "bộ chuẩn" lẫn tùy biến đều **không có số phiên bản** hiển thị trong thư mục (chỉ dựa vào mtime/kích thước) — cần đọc metadata PE nếu muốn định danh phiên bản chính xác.

## 3. Danh mục báo cáo (.rpx)

Chi tiết: `data\reports-catalog.csv` (1.192 report khác nhau; **759 "chung"** (>= 11/22 khách), 272 dùng 2-10 khách, **161 riêng một khách**).

- **Gói chuẩn = 759 file**: DuocEuro, Kona, MAK, KEIKO, Meracine-VietDuc đều đúng 759 file; các khách khác = 759 + báo cáo riêng (Novo 930, TinPhong 961, AnDat 835...). Nghĩa là mỗi triển khai là bản sao gói chuẩn + thêm/sửa mẫu riêng.
- Bản BanHang (Spa 47, Santino BanHang 84) dùng một **bộ báo cáo đặt tên không tiền tố** (BaoCaoBanHangChiTietReport, PhieubanReport...) — 113 tên không tiền tố, 52 riêng một khách.
- VLS: 397/388 report (gồm toàn bộ nhóm `AC_*`). SoBaBuoc: 23 report (nhóm `KD_*`, mẫu Template*).

| Tiền tố | Đoán ý nghĩa | Số report | Chung | Riêng 1 khách |
|---|---|---|---|---|
| AR | Bán hàng/phải thu: đơn hàng, hóa đơn (nhiều mẫu in theo đại lý/khách), công nợ, doanh thu | 324 | 209 | 36 |
| GJ | Sổ cái/nhật ký chung, sổ chi tiết, bảng cân đối, KQKD, lưu chuyển tiền tệ (QĐ15/QĐ48, TT99) | 136 | 102 | 7 |
| (không tiền tố) | Bộ báo cáo BanHang/POS + biểu mẫu in cũ (Template*, Test*, ChungTuGhiSo, ItemList...) | 113 | 18 | 52 |
| CS | Quỹ - ngân hàng (sổ quỹ S05a/S07/S08, phiếu thu/chi, ủy nhiệm chi) | 108 | 92 | 3 |
| IV | Kho (tồn, thẻ kho, nhập/xuất/chuyển, kiểm kê, lô) | 105 | 72 | 12 |
| AP | Mua hàng/phải trả (đặt hàng, nhập mua, công nợ NCC, thuế nhập khẩu) | 67 | 40 | 10 |
| AC | Academy — đào tạo (học viên, lịch giảng, phiếu báo giảng, doanh thu theo chương trình) — chỉ VLS | 48 | 0 | 8 |
| HR | Nhân sự - tiền lương (tuyển dụng, HĐLĐ, chấm công, lương, hoa hồng) | 43 | 35 | 4 |
| ER | Kho nguyên vật liệu + lệnh sản xuất (ProcessOrder, MaterialRequest) | 27 | 27 | 0 |
| GL | Thuyết minh báo cáo tài chính (FinanceInterpretation) | 26 | 26 | 0 |
| TN | Nhà hàng/suất ăn (món ăn, định lượng, doanh thu ngày) | 22 | 14 | 5 |
| FA | Tài sản cố định (khấu hao, thanh lý) + máy/linh kiện (Medcom) | 20 | 15 | 5 |
| EM | Bản sao nhóm IV cho kho khác (đoán: kho phụ/nội bộ; có Invoice/Purchase riêng) | 18 | 18 | 0 |
| KD | Kinh doanh — chỉ SoBaBuoc (ATTP11..40, nhập/xuất, công nợ) | 17 | 0 | 17 |
| EQ | Công cụ dụng cụ (phân bổ, sửa chữa, điều chuyển) | 15 | 15 | 0 |
| CR | CRM (chiến dịch, tiềm năng, chăm sóc KH, email/SMS) | 14 | 2 | 0 |
| CT | Công trình/dự án: dự chi, giá thành, so sánh chi phí, dòng tiền | 13 | 13 | 0 |
| PC | Product Cost — giá thành, định mức (BOM), chi phí trung tâm | 12 | 10 | 0 |
| CF | Danh mục/cấu hình: hợp đồng, đặt cọc, giữ chỗ (bất động sản), ATTP | 12 | 7 | 2 |
| IC | Chi phí nội bộ/công tác (tiếp khách, CSKH, công tác phí, kho vật tư văn phòng) | 12 | 12 | 0 |
| CL | Báo cáo quản trị/tổng hợp (cân đối, KQHĐKD, LCTT, tồn kho, công nợ) | 9 | 8 | 0 |
| WA | Bán hàng/dịch vụ rút gọn (Order, Receipt, Purchase) — dùng cho Spa/WA | 8 | 4 | 0 |
| MR | Kho vật tư/NVL xem tồn | 6 | 6 | 0 |
| OF | Văn phòng: đề nghị tạm ứng/thanh toán/nghỉ phép | 4 | 4 | 0 |
| SY | Hệ thống: kiểm tra chứng từ lỗi | 3 | 3 | 0 |
| GN, PR, POS, WB, B, EL | Giao nhận; in nhãn/barcode; in hóa đơn POS A5; báo cáo WB (doanh thu ngày/tháng); xác nhận công nợ; hóa đơn điện tử tạm | 1-2 mỗi nhóm | — | — |

Báo cáo riêng của khách (ví dụ): VLS nhóm AC (48); SoBaBuoc nhóm KD (17); Medcom (FA_Machine360, kiểm nhận hàng, QR, giao nhận); Meracine (BB thay thế, XDL, T99, tem túi, bàn giao NV);
Novo/TinPhong (hóa đơn đại lý KONA/Samurai/Bruno, bảng kê kèm A5, báo cáo ngày/CSKH, TMĐT); PhuongDung (sổ doanh thu HKD); Santino BanHang (châm hàng, khen thưởng, đề nghị xuất HĐ).

### 3.1 Cấu trúc file .rpx (đã mở AR_Invoice2Report, CS_PaymentReport, GJ_BalanceSheetReport và quét 776 file của Meracine-HN)

- **XML UTF-8** (`<ActiveReportsLayout Version="3.1" PrintWidth=... ScriptLang="C#|VB.NET">`), mẫu **ActiveReports 3/6**: `<StyleSheet>`, `<Sections>` (ReportHeader, PageHeader, GroupHeader/Footer, Detail, PageFooter, ReportFooter), `<PageSettings>` (A4, lề, đơn vị twips), `<Parameters />` (rỗng).
- **Không có `<DataSource>`, không SQL, không chuỗi kết nối** (0/776 file chứa SELECT/ConnectionString). Dữ liệu do ứng dụng đổ vào (từ stored procedure/DataTable); report chỉ ràng buộc theo tên cột qua `DataField="..."`
  (ví dụ DocumentID, ObjectName, Quantity, TotalAmount). Hàm gộp bằng `SummaryType`/`SummaryGroup`; nhóm bằng `GroupHeader DataField=...`.
  => Muốn dựng lại báo cáo phải biết **tên cột trả về của từng SP/view** (nằm ở DB, không ở rpx).
- Điều khiển: Label 14.255, Field 13.058, Image 93, Line 50, Subreport 31, CheckBox 21, ReportInfo 13, Barcode 9, Shape 4, ChartControl 1 (không có RichText/Picture) — chủ yếu bố cục bảng/form in.
- **Script nhúng**: 135/776 file (17%) có `<Script><![CDATA[...]]>` (dạng `Sub Detail_Format` đổi font đậm/nhạt theo cột `IsBold`, tính toán hiển thị...); mặc định khai báo C# (697), VB.NET (79) — nhưng nhiều file khai C# mà script VB. Cần quy tắc dịch/loại bỏ khi chuyển sang web.
- Nhãn đa ngôn ngữ/runtime: các control tên `lngXxx`, `llngTitle`, `SysCom1..3` (tiêu đề công ty) được app thay giá trị lúc chạy. `DocumentName` thường là tên cũ không đáng tin (vd "PP_rptPurRegsDetail" trong AR_Invoice2Report).
- Báo cáo "chung" có nhiều biến thể số thứ tự (`...2Report`, `...3Report`, `..._SubReport_NNN`) -> sinh bởi trình thiết kế; khi kiểm kê chức năng nên gộp theo gốc tên.

## 4. Layout .dat — form nào thực sự được mở

Chi tiết: `data\layout-forms.csv`. Lưu ý quan trọng: `.dat` là **bố cục lưới do người dùng tự chỉnh** (chỉ sinh khi người dùng đổi cột/độ rộng), nên đây là chỉ báo "đã mở và chỉnh", không phải danh sách đầy đủ.

- Định dạng: XML DataSet kèm xsd; bảng `T0` gồm `GridName, ColumnName, Width, Visible, Position, Sum, Wrap, Tag` (+ bảng `Value`) -> **cấu hình cột lưới theo người dùng + theo DB**; `*_RecentlyList.dat` = menu dùng gần đây; `*_filter(_d).dat` = bộ lọc đã lưu; `ToolBarX1btnOpt...` = nút tùy chọn thêm.
- 744 tên: 433 form, 181 report, 44 filter, 35 khác, 34 toolbar, 11 recent, 6 sub-grid. Theo tiền tố form: CF 72, AR 62, IV 46, AP 31, WA 20, HR 16, AC 14, FA 12, GDP 10, CS 9, GJ 9, BEEC 7, HKD 6.

Form được dùng nhiều nhất (số khách có layout):

| Form | Khách | Ý nghĩa |
|---|---|---|
| Admin_RecentlyList | 21 | Menu gần đây của tài khoản Admin |
| FormControlerSetupFrm | 20 | Thiết lập điều khiển form (metadata động) |
| ObjectListFrm | 18 | Danh mục đối tượng (khách hàng/NCC/nhân viên) |
| SystemMenuManagerFrm | 18 | Quản lý menu hệ thống |
| NguoiDungFrm / NguoiDungPhanQuyenFrm | 17 / 17 | Người dùng / phân quyền |
| ItemListFrm | 16 | Danh mục hàng hóa |
| AP_PurchaseFrm | 13 | Phiếu mua hàng/nhập mua |
| DepartmentListFrm, SY_FrmLstSettingXFrm | 13, 13 | Phòng ban; thiết lập danh sách form |
| AR_InvoiceFrm | 12 | Hóa đơn bán hàng |
| ObjectGroupListFrm, UserLogFrm | 12, 12 | Nhóm đối tượng; nhật ký người dùng |
| CS_ReceiptFrm_Bank, ChartAccListFrm, IV_StockInputFrm, NguoiDungNhomFrm | 11 | Phiếu thu ngân hàng; hệ thống tài khoản; nhập kho; nhóm người dùng |
| FrmReportParaSetup(2) | 11 | Thiết lập tham số báo cáo |
| AR_Invoice2Frm | 10 | Hóa đơn bán hàng bản 2 |
| AR_OrderVietDucFrm, AccountBankListFrm, CS_ReceiptFrm, CategoryListFrm, IV_StockOutputFrm | 9 | Đơn hàng (Việt Đức); tài khoản NH; phiếu thu; danh mục; xuất kho |
| AP_OrderFrm, CF_BranchListFrm, CostListFrm, GJ_Entryfrm | 8 | Đơn mua; chi nhánh; khoản mục chi phí; bút toán |
| AP_ServiceFrm, AR_OpListFrm, AR_StockInputFrm, CS_PaymentFrm, LocationListFrm, StorehouseListFrm | 7 | Mua dịch vụ; ...; phiếu chi; vị trí; kho |

=> Lõi thực tế được dùng: **danh mục (đối tượng, hàng, kho, tài khoản, chi nhánh) + mua hàng/bán hàng/kho + thu chi + sổ cái + quản trị hệ thống (menu, form, phân quyền, nhật ký)**. Các nhóm còn lại (sản xuất, FA/EQ, HR, CRM, CT...) chỉ xuất hiện ở 1-5 khách.
Form chỉ 1 khách: nhóm GDP_/BeeC_ (TinPhong), AC_ (VLS), WA_ (Spa), HKD_ (PhuongDung), CF_ thời trang (Santino), BPTM (Medcom).

## 5. Log lỗi Histories (22 thư mục, 197 file, ~320 KB, 1.011 dòng; 995 dòng thuộc 2026; không có log ở MAK/KEIKO/SoBaBuoc/Medstand)

Phân loại lỗi (chuẩn hóa chuỗi/số; không chép dữ liệu cá nhân):

| Nhóm lỗi | Số lần (khách) | Ý nghĩa / lưu ý cho web |
|---|---|---|
| `Form not found : <tên form/report>` | ~455 (14 khách) | Menu trong DB trỏ tới form/report **không có trong exe/Reports** (lệch phiên bản metadata và code). Web cần "danh mục tính năng" nhất quán với metadata, có kiểm tra tồn tại khi đồng bộ menu |
| `UnhandledException : No beginMove call was made` | 191 (1 khách, trong vài giây) | Lỗi lưới Janus (thao tác hàng) — lỗi UI, không phải dữ liệu |
| Lỗi nghiệp vụ trả từ SQL: `The statement has been terminated` | ~87 (8 khách) | Đi kèm lỗi gốc: **PK trùng** (số chứng từ/mã sinh trùng — mã dạng tiền tố + số), **FK khi xóa/thêm** (vd xóa phiếu đã có chi tiết/liên kết), **CHECK**, cắt chuỗi. Web cần cấp số chứng từ an toàn đồng thời và thông báo lỗi ràng buộc thân thiện |
| `The transaction ended in the trigger` | 19 (2 khách) | Quy tắc nghiệp vụ nằm trong **trigger** và dùng RAISERROR/THROW kèm thông điệp tiếng Việt (vd điều kiện nhập linh kiện thu hồi, link phiếu xuất trùng) -> phải mang sang lớp API |
| `Query timeout expired` | 20 (Novo, TinPhong) | Timeout truy vấn (thường là báo cáo/tải danh sách lớn). Cần phân trang, chỉ mục, chạy báo cáo bất đồng bộ |
| `General network error` (DBNETLIB) | ~17 (7 khách) | Mất kết nối giữa client và SQL Server (client nối trực tiếp DB qua OleDb/SQLOLEDB qua WAN/VPN) -> web đặt API gần DB, có retry |
| `Invalid column/object name`, `Ambiguous column`, `View ... has more column names` | ~45 (8 khách) | **Lệch schema giữa các DB** (SP/view/bảng chưa nâng cấp đồng bộ). Cần cơ chế migration/versioning theo khách |
| `Cannot truncate table ... referenced by FOREIGN KEY` | 15 x 3 khách Meracine/DemoKetoan | Công cụ "xóa/reset dữ liệu" của DB demo chạy lỗi |
| `Concurrency violation: the DeleteCommand affected 0 of 1` | 7 x 2 | Xung đột đồng thời của ADO.NET DataAdapter (bản ghi đã bị người khác xóa/sửa) |
| `Conversion failed ... date and/or time` | 17 (Medcom) | Lỗi định dạng ngày (cài đặt vùng/format) — web phải chuẩn hóa ISO |
| `Timer Auto refresh err : Item not found : <cột>` | ~15 | Form tự làm mới (timer) và lưới thiếu cột -> cũng liên quan metadata |
| `Object reference not set...`, `Collection was modified`, `Item not found: UserAutoID`, `Cannot insert explicit value into timestamp column`, `Syntax error` | rải rác | Lỗi lập trình thông thường |
| `On Open : ShrinkDatabaseLog and sp_updatestats` | 12 (AnDat, KeToanTranformer, TinPhong) | **Ứng dụng tự thu nhỏ log và cập nhật thống kê mỗi lần mở** — không nên đưa vào web; chuyển thành job vận hành |
| Log tích hợp ngoài | vài chục dòng | Payload/response ZNS (Zalo) và BeeC/GDP được ghi vào log -> chứa dữ liệu khách; web phải che dữ liệu nhạy cảm trong log |
| `not a valid login`, `Cannot find the object ... because it does not exist or you do not have permission` | 3, 6 | Tài khoản DB/phân quyền DB cấu hình sai |

Không thấy: **deadlock** (0 dòng), thông báo "khóa sổ kỳ" (0 dòng; tính năng khóa kỳ có form `PeriodLockDataFrm` nhưng không xuất hiện trong log lỗi), lỗi SP không tồn tại hàng loạt.
Stack trace cho thấy truy cập dữ liệu bằng **OleDb + DataAdapter.Update** qua lớp `Tools.Data.Storer` (cập nhật cả bảng từ DataTable, đồng bộ nhiều dòng một lần) — khác hẳn mô hình API từng lệnh của web.

## 6. Công cụ và tài liệu phụ trợ

**`D:\Data\App\*`** — gói vận hành cho **TinPhong/Liên Mai** (tích hợp đẩy dữ liệu lên GDP qua nhà cung cấp BeeC):
- `1 click GDP`, `TinPhong - *`: bộ SQL "Apply/Undo/Kiểm tra" (xem trước `@Apply=0`, áp `1`) cài engine đẩy dữ liệu (một STP `GDP_RunStp` + một Agent job): tự nạp, gửi lại khi lỗi mạng/HTTP 5xx, làm mới phát sinh kho, đăng ký đợt/AutoRange, trạng thái/màu, chi tiết kết quả đẩy. Có `ERP_Forms\*.frm.json` (**định nghĩa form ERP dạng JSON**) + DLL `GDP.ErrorExport.dll` thêm nút "Xuất JSON lỗi".
- `GDP Response Mapper`: web tĩnh cục bộ (HTML/JS) để ánh xạ JSON phản hồi API đối tác -> sinh SQL Apply/Undo (cho thấy mô hình "cấu hình tích hợp theo đối tác" bằng metadata).
- `Kiem tra xuat kho TinPhong 2026-10-30`, `JSON loi thieu thanh phan BeeC`, `Kiem tra log`: kết quả đối soát/audit 208 phiếu, 12 phiếu lỗi (JSON chứng từ — dữ liệu khách, không đọc sâu).
- `InputDirector.v2.4`: bộ cài phần mềm chia sẻ chuột/bàn phím (~69 MB) — không liên quan ERP.

**`D:\Data\TinPhong\Tools\`** — ~40 thư mục build/audit theo ngày (10-2026 .. 11-2026): `BeeCMigration` (audit metadata DB TinPhong: `ui-SY_FrmLstTbl.json`, `ui-SY_FrmCfg.json`),
`ERPInspect` (dịch ngược Tools/ERP bằng ilspycmd), `GDPDeployment*` (RC1..RC3 + UI1..3: bộ cài one-click, hướng dẫn, kiểm thử), `ERPStatusColors` (đổi màu trạng thái trong lưới), các thư mục `TinPhong*Audit/Retry/Warehouse...` (script kiểm tra log, tự gửi lại, làm mới kho, bảng `BeeC_*`/`GDP_*`).
Mô hình chung: mỗi thay đổi = gói script có hash, Apply/Undo, chỉ đọc khi audit.

**`D:\Data\Mak\`** — dự án app MAK/MEPES/ATC (ASP.NET Core MVC .NET 10 + VB.NET Core, dùng chung DB ERP):
- `chuyen-doi-db`: bộ PowerShell/Python chuyển đổi và dọn 4 DB trên server mới (backup copy-only, đưa 3 DB App về một bố cục, xóa 215 module thừa, cài 277 module).
- `audit-db`: báo cáo audit DB 06-11-2026 (chỉ đọc): 491 module (277 dùng/214 thừa), procedure App lọt vào ERP, quyền quá rộng, proc xóa dữ liệu trên production, đồng bộ ERP chạy trùng hai luồng, log không được backup.
- `ket-qua-*` (gop, main, moc, test, tham-so, tra, ts): kết quả chạy test (.trx) và log từng đợt hợp nhất; `_fix-main` rỗng; `Mak-Group`, `MakMain`, `MakNongDan`: source app.
- Ghi chú an toàn: tồn tại thông tin kết nối/mật khẩu trong các tài liệu này — không chép sang đây.

**`D:\Data\Novo\KeToanNovoAltacoNovoGutez_Dev\DatabaseFixes`** — 4 file SQL ngày 02-11-2026 trên DB `X02NovoSX`: đồng bộ tự động hóa đơn bán (AR_Invoice) <-> phiếu xuất kho (AR_StockOut) theo `LinkID`/`DocumentID`
(trigger `TR_AR_InvoiceTbl_StockOut2026_AutoSync`, proc `AR_StockOut_AutoSyncOneStp`, `AR_Invoice_AfterSaveStp`; khôi phục trigger, đổi số hóa đơn kéo theo số phiếu xuất). Cho thấy **liên kết hóa đơn–xuất kho đang làm bằng trigger/SP**.

**`D:\Data\Novo\LocData2.aspx.vb`** (thư mục có file cùng tên) — code-behind **ASP.NET WebForms** (`List.aspx`, `CheckUserSession`) cho trang "báo cáo ngày" có ảnh + định vị GPS (đọc `AR_DailyReport2Tbl`: nội dung, 3 ảnh, vĩ/kinh độ, mở Google Maps; yêu cầu HTTPS để dùng camera/vị trí). Đây là **một phần web cũ có thật** (module di động/đi tuyến) của hệ này; có nối chuỗi SQL trực tiếp (rủi ro SQL injection) — không tái sử dụng.

**`D:\Data\Santino\`**:
- `*.sql`: `ChangeHistory.sql` (tạo bảng `CF_ItemGroupTbl`, `CF_SeasonTbl`... nhóm hàng/mùa vụ), `InvoiceMismatchListStp.sql` (liệt kê phiếu bán có tổng header lệch tổng chi tiết).
- `HUONG_DAN_CHAM_HANG_BAN_LE_TU_DONG_V4_1_4_20260903.docx`, `HUONG_DAN_THIET_LAP_VA_SU_DUNG_...20260908.docx`: **nghiệp vụ châm hàng bán lẻ tự động** — khai báo theo *Mã hàng 2* (mã cha, SKU/size con tự liên kết); phạm vi toàn bộ/nhóm cửa hàng/cửa hàng (cụ thể ưu tiên hơn chung); "Nhóm châm hàng" trống = không châm;
  tồn mục tiêu = CEILING(tốc độ bán TB x Target DOC + tồn an toàn); nhu cầu bổ sung = MAX(0, mục tiêu - tồn hiện tại); phân tách *nhu cầu* và *SL đề nghị* (sau khi xét tồn kho tổng + ưu tiên); ưu tiên Marketing/hàng/cửa hàng bằng điểm; *giữ hàng* chủ động cho cửa hàng; lịch tuyến; báo cáo chạy theo cửa hàng/nhóm/tuyến, đọc cột Hành động và Chú giải.
- `CHAM HANG BL-IT.xlsx` (6 sheet: input, danh mục, logic tính, ma trận ưu tiên, output, yêu cầu IT), `DANH_MUC_TEN_HANG_2.xlsx` (danh mục MSP thuế/tên hàng 2/mã hàng bán lẻ-đại lý), `TAO_MSP_2026.xlsx` (sinh mã sản phẩm theo form/size/màu/SKU).

**`D:\Data\VLS\`**:
- `BanGiao_VLS_20261021`: gói bàn giao (2 DLL `VLS.Schedule`/`VLS.Student`, layout, 3 mẫu in, SHA256, hướng dẫn cập nhật, bản xem thử phiếu giao lớp PDF). `LuuTru`: lưu trữ các đợt chỉnh (audit khóa học, chỉnh mẫu in, PGL khổ ngang/Arial 12, phiếu thu trực thuộc nhóm, khôi phục menu giảng viên...); `KET-THUC.txt`: chốt dọn thư mục 21-10-2026.
- `Phan mem ERP - Đề xuất & mô tả chức năng giải pháp - Đề xuất ERP (1).docx/.pdf` (pdftotext không mở được tên file có dấu nên đọc bản .docx cùng nội dung): thực chất là **văn bản góp ý 22 vấn đề** của trung tâm đào tạo (15-07-2026), không phải đề xuất giải pháp. Danh sách chức năng được yêu cầu/chỉnh:
  Phiếu báo giảng (PBG) — đánh dấu dòng đã kiểm tra, mặc định VND (không USD), "copy từ phiếu trước" số tiết mặc định 0, xuất tổng số tiết, nhập mã học viên đúng thì nhận luôn không bật bảng dò, thêm dòng ở đầu, thêm dòng thành tiền/thu khác/trừ khác/thuế TNCN/thu nhập sau thuế, ghi chú diễn giải, gửi mail PBG kèm PDF;
  Danh mục khách hàng — mặc định loại "học viên" thay vì giáo viên; Phiếu thu — ẩn USD, trường xuất hóa đơn đổi thành "Bán cho người tiêu dùng" / "Xuất hóa đơn Cty/cá nhân" (bỏ "chờ xác nhận"), bảng thông tin xuất hóa đơn công ty (tên, MST, địa chỉ, nội dung, email NV, email KH);
  Phiếu thu khác bổ sung NV bán hàng, mã/tên học viên, in kèm người lập; báo cáo công nợ học viên mặc định VND; xuất Excel nhiều sheet gộp 1 file; sổ nhật ký chung bỏ merge cell, đổi vị trí cột TK nợ/có; chứng từ nghiệp vụ khác chọn đối tượng nợ/có theo tên.

**`D:\Data\Agent\`**: `db-fixes` (4 file SQL 06-11-2026: sửa tiền khuyến mại bị mất khi lưu đơn đặt hàng — cập nhật 5 đối tượng DB và sửa lại tổng đơn đã có KM; bật lại 4 công thức cột `SY_FrmExpTbl` của `AR_InvoiceFrm` — kèm rollback; chạy trong transaction, sai số dòng thì rollback);
`sql-bridge` (`db-bridge.ps1`, `probe.sql`, `out\*.read.txt` — cầu nối sqlcmd đọc audit cho DB KEIKO; cần mật khẩu do người dùng nhập, kết quả chỉ đọc: tổng quan, bảng, toàn vẹn, chỉ mục, bảo mật). **Công thức/cột hiển thị được cấu hình trong DB (`SY_FrmExpTbl`)** chứ không nằm trong code.

**`D:\Data\Medcom\TechnicalDocs\`** (chỉ liệt kê chủ đề): `db-audit` (audit DB MedData, metadata workflow, công cụ dịch ngược), `asset-depreciation-policy`/`asset-reconciliation` (khấu hao & đối chiếu tài sản), `inbound-*` (nhập kho: copy, tách lô, nhà sản xuất, lưu một lần, đổi thứ tự quy trình, nhận một phần), `delete-inbound-test`, `internal-transfer-*` (chuyển kho nội bộ), `purchase-approval-permission`, `purchase-request-delete/price-rate`, `sales-accounting-return`, `stock-lot`, `login-initialization`, `sql-naming`, `help-site-review`, `iis-help-deployment`, `workflow-repair/review`.
**`D:\Data\Medcom\outputs\`**: `erp-workflows` (v1..v4, hai nhóm đối tượng), `erp-ui-review/repair`, `workflow-logic/review`, `customer-workflow-compare`, `asset-confirmation/reconciliation`, `help-*` (help theo đối tượng, mua hàng, nhập kho), `medcom-workload`, `sql-naming`, `pr-217-merge`, `relocation-runtime-baseline.json`.

**`D:\Data\Meracine-HN\*.csv`**: 2 file đối soát hóa đơn (tháng 10-11/2026): `DanhSach_67_BBThayThe_MatChiTiet.csv` (67 biên bản thay thế thiếu hóa đơn gốc/chi tiết: số phiếu BB, số HĐ thay thế, mã khách, phiếu gốc, lý do) và `KhoiPhuc_66_HoaDonGoc_ChiTiet.csv` (~393 dòng chi tiết hàng/lô/hạn/thuế để khôi phục 66 hóa đơn gốc, cột "Cần KT xác nhận"). Chứa dữ liệu khách — chỉ ghi chủ đề, không chép. Cho thấy nghiệp vụ **biên bản thay thế hóa đơn điện tử**.
Ngoài ra Meracine-HN có `KetoanDemo202609Dev.zip` (~100 MB, bản nén thư mục chạy).

## 7. Hàm ý cho bản web

1. **Đa khách hàng / đa DB là yêu cầu bắt buộc.** Một khách có 1-18 database (DuocEuro/Kona ~18 DB, Novo 12, AnDat 9); người dùng chọn DB khi đăng nhập; cùng một khách dùng nhiều pháp nhân (CT01NovaNew, CT01SOLA...). Thiết kế: tenant (khách) -> công ty/DB -> chi nhánh; cấu hình kết nối ở tầng quản trị, không phải trong từng máy.
2. **Tách lõi chung và tùy biến.** ~64% báo cáo là gói chuẩn, 36% là mẫu theo khách/biến thể; form riêng theo khách (GDP/BeeC, AC_, HKD_, thời trang...). Cần cơ chế module/feature flag theo khách + mẫu in theo khách thay vì sao chép code.
3. **Metadata là trung tâm.** Menu, form, nút, công thức cột nằm trong DB (`SY_*`); 455 lỗi "Form not found" cho thấy đồng bộ metadata-code là điểm yếu. Bản web nên xem metadata là nguồn sự thật, có kiểm tra tính nhất quán và đóng gói phiên bản cấu hình.
4. **Báo cáo:** rpx chỉ là bố cục ràng buộc theo tên cột, dữ liệu do SP trả về; 17% có script. Cần engine báo cáo web (HTML/PDF/Excel) và chính sách chuyển mẫu (ưu tiên 759 mẫu chuẩn; mẫu riêng chuyển theo yêu cầu khách), cộng thêm mẫu Word/Excel `.doc/.xlt`.
5. **Quy tắc nghiệp vụ nằm trong trigger/SP** (lỗi RAISERROR tiếng Việt, đồng bộ hóa đơn-xuất kho bằng trigger). API web phải gọi lại SP/trigger sẵn có hoặc chuyển có kiểm thử đối chiếu; không được bỏ qua.
6. **Lưới/bố cục theo người dùng**: `.dat` (cột, rộng, vị trí, tổng) -> lưu hồ sơ hiển thị theo người dùng + DB trong cơ sở dữ liệu.
7. **Độ tin cậy:** cấp số chứng từ chống trùng (PK trùng), thông báo lỗi ràng buộc FK thân thiện, xung đột đồng thời, timeout/phân trang, mất kết nối. Không chạy bảo trì DB (shrink log, update stats) theo lần mở app.
8. **Tích hợp ngoài** (hóa đơn điện tử VNPT..., ZNS, BeeC/GDP, Viettel): cần lớp tích hợp có hàng đợi/thử lại, log đã che dữ liệu, cấu hình theo đối tác (ví dụ mô hình response-mapper).
9. **Bảo mật:** tệp ghi nhớ đăng nhập (`*.data`, `Remember.pass`) và `settings.config` giữ bí mật ở client; web phải lưu bí mật ở máy chủ. Quyền DB cần tối thiểu (audit Mak cho thấy db_owner/sysadmin quá rộng).
10. **Có ít nhất một module web cũ** (`LocData2.aspx` — báo cáo ngày kèm ảnh/GPS) và các app web Mak/Medcom đã làm — nên đối chiếu để không làm trùng.
11. **Ưu tiên phạm vi MVP** theo tần suất: danh mục -> mua/bán/kho -> thu chi -> sổ cái/BCTC -> quản trị (menu/phân quyền/nhật ký); sau đó theo khách (dược: lô/hạn/GDP; bán lẻ thời trang: châm hàng; đào tạo: AC_; spa: WA_).

## 8. Câu hỏi còn mở

- Lĩnh vực của AnDat, KEIKO, Medstand, KeToanTranformer, DIM giá thành chỉ đoán từ tên form/DB; cần xác nhận khách thật và ngành.
- Ý nghĩa chính xác các tiền tố EM, ER, IC, CL, WA, WB, GL (đoán theo tên report; cần đối chiếu `SY_Menu` của DB).
- Khách nào đang chạy production và phiên bản nào là "chuẩn"? Các thư mục `_Dev`/`Test`/`Demo` có thể không phản ánh sử dụng thật; `.dat` chỉ phản ánh người dùng đã chỉnh lưới.
- Mối quan hệ pháp nhân giữa các DB trùng tên giữa khách (Demo2026, Medcom, X23STNKT) — bản sao hay DB dùng chung?
- Gói 759 báo cáo chuẩn: tập con nào còn dùng thật (so với menu `SY_Menu` + log sử dụng)? 161 report riêng một khách có nên chuyển hay loại?
- Số phiên bản chính xác của từng exe/Tools.dll (cần đọc metadata PE/AssemblyVersion) và chính sách nâng cấp từng khách.
- Với VLS: file "Đề xuất ERP" là danh sách góp ý — chưa rõ các mục đã xử lý hết chưa (KET-THUC.txt báo hoàn thành 21-10-2026).
- Phạm vi pháp lý/tích hợp bắt buộc theo khách (hóa đơn điện tử nhà cung cấp nào, GDP, TT99) cần liệt kê từ cấu hình DB.
- Mối quan hệ giữa `LocData2.aspx` (WebForms) và hệ ERP.NET: hệ web này còn được dùng ở khách nào?
