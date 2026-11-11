# AGENTS.md — điểm vào cho agent lập trình

Dự án **Web-ERP**: dựng lại giao diện ERP.NET (WinForms) thành web. Repo này **chỉ làm frontend** (QĐ-06):
backend do đội khác làm, trả **HTML thô theo chuẩn ERP-HTML v1.0**; FE (HTML/CSS/JS thuần, không build) dựng giao diện.
Ngôn ngữ tài liệu, chú thích, chữ giao diện: **tiếng Việt**.

## Đọc gì trước (theo việc)

| Bạn đang làm | Đọc |
|---|---|
| **Backend** cần trả HTML cho FE | [`docs/huong-dan/be-tra-html-cho-fe.md`](docs/huong-dan/be-tra-html-cho-fe.md) → đặc tả [`docs/kien-truc/02-chuan-html-erp.md`](docs/kien-truc/02-chuan-html-erp.md) |
| **Frontend** (sửa / thêm tính năng trong `web/`) | [`docs/huong-dan/fe-cau-truc-va-to-chuc.md`](docs/huong-dan/fe-cau-truc-va-to-chuc.md) → [`docs/kien-truc/03-chuan-giao-dien.md`](docs/kien-truc/03-chuan-giao-dien.md) |
| Nghiệp vụ / màn hình của hệ cũ | [`docs/legacy-analysis/01-tong-quan.md`](docs/legacy-analysis/01-tong-quan.md) và các file cùng thư mục |
| Vì sao làm thế này | [`docs/QUYET-DINH.md`](docs/QUYET-DINH.md) |

## Lệnh

```bash
python -I tools/dev-server.py --port 5180     # chạy FE với mock: http://127.0.0.1:5180/
python -I tools/mock-gen/build_mock.py         # sinh lại web/mock/ (không sửa tay web/mock/)
```

Kiểm tra HTML theo chuẩn: `http://127.0.0.1:5180/tools/validate.html` — mock và HTML của BE phải **0 lỗi**.

## Quy tắc bắt buộc

- **Không** đưa mật khẩu, chuỗi kết nối, token, `settings.config`, mã dịch ngược hay dữ liệu khách hàng vào repo /
  mock / tài liệu. Dữ liệu mock là dữ liệu giả.
- **Không** kết nối DB khách hàng. Việc chạm DB ERP theo `D:\Data\Skills\SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md`.
- FE **không** chạy script / style / class từ HTML của BE (`web/js/core/sanitize.js`); FE không tự ghép URL nghiệp vụ.
- Giao diện: chỉ dùng token `--erp-*`, theo danh sách cấm và danh sách kiểm tra trong `03-chuan-giao-dien.md`.
- Đổi cách FE và BE trao đổi → cập nhật **đặc tả + hướng dẫn BE + validator** cùng lúc.
- Không thêm thư viện, framework hay bước build cho FE.
