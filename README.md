# Web-ERP

Dựng lại giao diện nền tảng **ERP.NET** (VB.NET WinForms + Janus + ActiveReports + SQL Server, triển khai cho nhiều
khách hàng trong `D:\Data`) thành ứng dụng web.

## Trạng thái

- **Giai đoạn 1 — Phân tích hệ cũ (đang hoàn thiện):** tài liệu ở [docs/legacy-analysis](docs/legacy-analysis/).
  Bắt đầu từ [01-tong-quan.md](docs/legacy-analysis/01-tong-quan.md).
- **Quyết định đã chốt:** [docs/QUYET-DINH.md](docs/QUYET-DINH.md) (chạy song song WinForms, schema `web`, giữ nguyên
  nghiệp vụ, Ribbon + theme, .NET 10 + SQL Server).
- **Công nghệ (đã duyệt 2026-11-11):** [docs/kien-truc/01-de-xuat-cong-nghe.md](docs/kien-truc/01-de-xuat-cong-nghe.md).
- **Phạm vi (QĐ-06):** dự án này **chỉ làm frontend**. Backend do đội khác làm và trả HTML theo chuẩn
  [docs/kien-truc/02-chuan-html-erp.md](docs/kien-truc/02-chuan-html-erp.md) (ERP-HTML v1.0).
- **Giai đoạn 2 — Frontend:** bản demo chạy bằng mock HTML sinh từ metadata Medcom. Xem [web/README.md](web/README.md).

## Chạy thử

```bash
python -I tools/dev-server.py --port 5180
```

Mở http://127.0.0.1:5180/. Kiểm tra HTML của backend tại http://127.0.0.1:5180/tools/validate.html.

## Thư mục

| Thư mục | Nội dung |
|---|---|
| `docs/legacy-analysis/` | Phân tích ERP.NET: kiến trúc engine, màn hình, nghiệp vụ, metadata, khách hàng, bài học |
| `web/` | Frontend HTML/CSS/JS thuần (không build) + `web/mock/` (HTML mẫu đóng vai backend) |
| `tools/dev-server.py` | Dev server tĩnh, nhận POST cho mock và in dữ liệu gửi lên |
| `tools/mock-gen/` | Sinh `web/mock/` từ metadata Medcom (dữ liệu dòng là dữ liệu giả) |
| `tools/legacy-decompile/` | Script giải mã chuỗi cho bản build bị obfuscate |
| `tools/metadata-export/` | Script xuất metadata `SY_*` chỉ đọc từ DB khách hàng |
| `.legacy/` | (không commit) mã dịch ngược, bảng chuỗi, metadata xuất ra |

## Quy tắc

- Làm việc với DB ERP theo `D:\Data\Skills\SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md`: không bịa schema, đọc trước khi ghi,
  luôn có đường lùi.
- Không commit mật khẩu, chuỗi kết nối, `settings.config`, mã dịch ngược hay dữ liệu khách hàng.
