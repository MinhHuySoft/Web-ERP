# Web-ERP

Dựng lại giao diện nền tảng **ERP.NET** (VB.NET WinForms + Janus + ActiveReports + SQL Server, triển khai cho nhiều
khách hàng trong `D:\Data`) thành ứng dụng web.

## Trạng thái

- **Giai đoạn 1 — Phân tích hệ cũ (đang hoàn thiện):** tài liệu ở [docs/legacy-analysis](docs/legacy-analysis/).
  Bắt đầu từ [01-tong-quan.md](docs/legacy-analysis/01-tong-quan.md).
- **Giai đoạn 2 — Build web:** chưa bắt đầu, chờ chốt phân tích.

## Thư mục

| Thư mục | Nội dung |
|---|---|
| `docs/legacy-analysis/` | Phân tích ERP.NET: kiến trúc engine, màn hình, nghiệp vụ, metadata, khách hàng, bài học |
| `tools/legacy-decompile/` | Script giải mã chuỗi cho bản build bị obfuscate |
| `tools/metadata-export/` | Script xuất metadata `SY_*` chỉ đọc từ DB khách hàng |
| `.legacy/` | (không commit) mã dịch ngược, bảng chuỗi, metadata xuất ra |

## Quy tắc

- Làm việc với DB ERP theo `D:\Data\Skills\SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md`: không bịa schema, đọc trước khi ghi,
  luôn có đường lùi.
- Không commit mật khẩu, chuỗi kết nối, `settings.config`, mã dịch ngược hay dữ liệu khách hàng.
