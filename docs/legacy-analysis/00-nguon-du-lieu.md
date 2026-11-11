# 00 — Bản đồ nguồn dữ liệu (đọc trước)

Ngày khảo sát: 2026-11-11. Phạm vi: toàn bộ `D:\Data`.

## 1. Kết luận chính

Tất cả "các ERP" trong `D:\Data` thực chất là **một nền tảng duy nhất — ERP.NET** (WinForms, VB.NET, .NET Framework 4.6.2,
giao diện Janus WinForms v4 + báo cáo ActiveReports 6, SQL Server), được **triển khai riêng cho từng khách hàng**:
mỗi khách hàng một thư mục chạy (exe + DLL + `Reports\*.rpx` + `Layout\<DB>\*.dat` + `settings.config` mã hóa) và một
hoặc nhiều database SQL Server.

- `ERP.NET.exe` — ứng dụng nghiệp vụ (namespace `ERP`): MainFrm, LoginFrm, ~240 form "viết tay" (hardcoded).
- `Tools.dll` — engine/framework (namespace `Tools`): form động sinh từ metadata DB (`SY_Menu`, `SY_FrmLstTbl`,
  `SY_FrmCfg`, `SY_FrmDrdwTbl`...), lưới GridX, layout LayoutX, lưu dữ liệu Storer, toolbar, báo cáo, phân quyền...
- Biến thể cùng engine: `BanHang.exe` (bán lẻ/POS — Spa, Santino), `ERP.VLS.exe` (+ `VLS.Schedule*.dll`,
  `VLS.Student*.dll` — trung tâm đào tạo VLS), `SoBaBuoc.exe` (sổ 3 bước ATTP — DIM).
- Phần lớn màn hình **không nằm trong code** mà nằm trong **metadata của database** → muốn biết đủ các trang của một
  khách hàng phải đọc bảng `SY_*` trong DB của khách hàng đó.

## 2. Mã nguồn đã dịch ngược (cục bộ, không commit)

Thư mục `D:\Data\Web-ERP\.legacy\` (đã `.gitignore`):

| Thư mục | Nguồn | Ghi chú |
|---|---|---|
| `.legacy/decompiled/ERP.NET/` | `D:\Data\Meracine-HN\KetoanDemo202609Dev\ERP.NET.exe` (bản mới nhất 09/11/2026, 7.747.073 byte) | Form nghiệp vụ ở `ERP/`, `ERP.eInvoice/`, `ERP.ePOST/`, `ERP.Taxsync/`, `ERP.CHAT/`, `ERP.Schedule/`, `ERP.Stock/`, `ERP.Sys/`, `ERP.VNPT*/` (proxy SOAP) |
| `.legacy/decompiled/Tools/` | `Tools.dll` cùng bản (8.337.921 byte) | Engine ở `Tools/`, `Tools.Data/`, `Tools.Layout/`, `Tools.SysForm/`, `Tools.Grid/`, `Tools.Utils/`... |
| `.legacy/decompiled/BanHang/` | `D:\Data\Santino\BanHang_SantinoTest2026\BanHang.exe` | Biến thể bán lẻ |
| `.legacy/decompiled/ERP.VLS/`, `VLS.Schedule/`, `VLS.Student/` | `D:\Data\VLS\bin_VLS_Dev\` | Biến thể trung tâm đào tạo |
| `.legacy/decompiled/SoBaBuoc/` | `D:\Data\DIM-ATTP\SoBaBuoc_ATTP_Dim\SoBaBuoc.exe` | Biến thể sổ ATTP |

Mã bị obfuscate bằng .NET Reactor: tên namespace/lớp phụ trợ ngẫu nhiên, **chuỗi đã được giải mã và chèn lại** vào mã
(`.legacy/tools/decrypt.ps1` + `inline_strings.py`; bảng chuỗi `.legacy/tools/*_strings.tsv`, base64 UTF-8). Lớp/form
nghiệp vụ giữ nguyên tên. Công cụ dịch ngược: `D:\Data\Medcom\TechnicalDocs\db-audit\tools\decompiler\ilspycmd.exe` (11.1).

Muốn dịch ngược lại bản khác:

```bash
/d/Data/Medcom/TechnicalDocs/db-audit/tools/decompiler/ilspycmd.exe -p -o <thư mục ra> <file exe/dll>
```

## 3. Metadata & schema database đã trích xuất sẵn (chỉ đọc)

| Nguồn | Nội dung |
|---|---|
| `D:\Data\Medcom\TechnicalDocs\db-audit\workflow-config-20261019\` | Snapshot metadata DB **MedData** (Medcom): `menus.json` (482 menu), `forms.json` (287 form `SY_FrmLstTbl`), `form_config.json` (3.419 dòng `SY_FrmCfg`), `option_buttons.json`, `grid_actions.json`, `form_actions.json`, `form_filters.json`, `user_groups.json`, `group_permissions.json`, `document_types.json`, các bảng trạng thái |
| `D:\Data\Medcom\TechnicalDocs\db-audit\run-20261019\` | Toàn bộ catalog schema MedData: `objects.json`, `columns.json`, `modules.json` (định nghĩa SP/view/function), `parameters.json`, `foreign_keys.json`, `indexes.json`, `triggers.json`, `row_counts.json` |
| `D:\Data\Medcom\TechnicalDocs\db-audit\evidence-sql\` | 1.038 file định nghĩa SP/view/function của MedData |
| `D:\Data\Medcom\TechnicalDocs\db-audit\analysis\` | Phân tích trước: `client-source/` (22 file dịch ngược), `workflow-trace/` (menu_availability, form_config_coverage, configured_buttons) |
| `D:\Data\TinPhong\Tools\BeeCMigration\audit-20261019-01\results\` | `ui-SY_FrmLstTbl.json`, `ui-SY_FrmCfg.json` của DB TinPhong |
| `D:\Data\Agent\sql-bridge\` | Cầu nối sqlcmd cho DB CT05KEIK (KEIKO) — cần mật khẩu do người dùng nhập; kết quả mẫu trong `out\` |
| `D:\Data\Skills\SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md` | Quy tắc an toàn khi làm việc với DB ERP (bắt buộc tuân thủ) |

## 4. Bản triển khai theo khách hàng

Xem chi tiết ở `02-trien-khai-khach-hang.md`. Thư mục: AnDat, DIM-GiaThanh, DIM-ATTP, DemoKetoan, DuocEuro,
KeToanTranformer, Kona, MAK-KEIKO (MAK, KEIKO), Medcom (ERP_Medcom2026), Medstand, Meracine-HN, Meracine-VietDuc, Novo,
PhuongDung, Santino (KeToanTest2026, BanHang_SantinoTest2026), Spa, TinPhong, VLS (bin_VLS_Dev, bin_VLS_Dev_NamA), WA-Spa.

## 5. Các dự án web đã làm trước (tham khảo kinh nghiệm)

| Dự án | Mô tả |
|---|---|
| `D:\Data\Medcom\Medcom` (đã fast-forward tới PR #260, 03/11/2026 — bản mới nhất) và `D:\Data\Medcom\ERP_Medcom2026\work\Medcom` (bản sao cũ hơn) | Chuyển ERP Medcom lên web: .NET 10 API (`Medcom.Api/Application/Infrastructure/Contracts`) + Next.js/React/Tailwind/shadcn (`apps/medcom-sites`), ~240 PR. Tài liệu reverse-engineering rất chi tiết ở `docs/erp/` |
| `D:\Data\Mak\MakMain` (Mak-Group, MakNongDan) | App tích điểm nông dân/đại lý (ASP.NET Core MVC + Core VB.NET) — không phải bản web của ERP nhưng dùng chung DB khách hàng |
| `D:\Data\POS_DEMO\POS_DEMO` | Demo POS web tĩnh (HTML/JS/Bootstrap) |

## 6. Tài liệu nghiệp vụ

- `D:\Data\Medcom\ERP 2026 (Quy trình, biểu mẫu)\` — quy trình mua hàng/nhập kho, xuất khẩu, bán hàng trong nước, trả lại, mua hàng hành chính, chi phí công tác + biểu mẫu.
- `D:\Data\VLS\Phan mem ERP - Đề xuất & mô tả chức năng giải pháp - Đề xuất ERP (1).pdf` — đề xuất chức năng ERP.
- `D:\Data\Santino\HUONG_DAN_*.docx` — hướng dẫn chấm hàng bán lẻ tự động.
- `D:\Data\Medcom\ERP_Medcom2026\work\Medcom\src\helps\` — Help/HDSD của bản web Medcom.
