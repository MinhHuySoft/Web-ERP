# web/ — Frontend Web-ERP (HTML + CSS + JS thuần)

Frontend nhận **HTML thô theo chuẩn ERP-HTML** từ backend (QĐ-06) rồi dựng thành giao diện ERP. Thành phần dựng ra:

- Ribbon và menu, tab tài liệu;
- lưới dữ liệu, form 40 cột, tra cứu F4, hộp thoại;
- 12 theme, responsive.

Không build, không npm, không framework. Sửa file, tải lại trang là thấy.

- Cấu trúc, luồng chạy, "muốn sửa X mở file Y", công thức mở rộng: [../docs/huong-dan/fe-cau-truc-va-to-chuc.md](../docs/huong-dan/fe-cau-truc-va-to-chuc.md)
- Chuẩn giao tiếp với backend: [../docs/kien-truc/02-chuan-html-erp.md](../docs/kien-truc/02-chuan-html-erp.md)
  (bản thực hành cho BE: [../docs/huong-dan/be-tra-html-cho-fe.md](../docs/huong-dan/be-tra-html-cho-fe.md))
- Chuẩn giao diện (token, danh sách cấm, kiểm tra trước khi merge): [../docs/kien-truc/03-chuan-giao-dien.md](../docs/kien-truc/03-chuan-giao-dien.md)
- Quyết định liên quan: [../docs/QUYET-DINH.md](../docs/QUYET-DINH.md) (QĐ-04 giao diện, QĐ-05 công nghệ, QĐ-06 phạm vi)

## Chạy thử với mock

```bash
python -I tools/dev-server.py --port 5180
```

Mở http://127.0.0.1:5180/

- **Dữ liệu mock:** `web/mock/` được sinh từ metadata Medcom bằng `python -I tools/mock-gen/build_mock.py`. Bao gồm 301 menu,
  151 màn danh sách, 246 bản ghi mẫu, 128 báo cáo. Dữ liệu dòng là dữ liệu giả.
- **Gửi form:** dev server nhận POST tới `/mock/*` và in toàn bộ dữ liệu gửi lên ra console. Dùng để kiểm tra FE gửi đúng
  chuẩn (mục 11.6, 13.2).
- **Kịch bản thử:**
  - Bán hàng → Hóa đơn bán hàng → mở `BH1126/0001` → Sửa.
  - Đổi số lượng trên lưới → Lưu → hộp "vượt tồn kho" → Vẫn lưu.
- **Kiểm tra HTML của backend:** mở `/tools/validate.html`, nhập URL hoặc dán HTML.

## Nối backend thật

Sửa `config.js`:

- `loginUrl`, `sessionUrl`, `menuUrl`, `homeUrl` — 4 điểm vào, chuẩn mục 3.4;
- `allowedOrigins` nếu backend khác origin.
- `maxLiveTabs` (mặc định 12): số tab giữ màn trong bộ nhớ; tab ít dùng hơn "ngủ" (nhả bộ nhớ) và tự tải lại khi được chọn.

Backend có thể phục vụ thư mục `web/` như file tĩnh, cùng origin là đơn giản nhất. Mọi URL khác nằm trong HTML backend trả về.

## Cấu trúc

```
index.html            khung trang, nạp CSS theo lớp và js/app.js
config.js             điểm vào backend
css/
  layers.css          thứ tự lớp: reset, tokens, base, components, themes, utilities
  tokens.css          design token --erp-* (mặc định = ribbon-classic) + biến dẫn xuất (màu nhấn người dùng)
  base.css            reset, nút, huy hiệu, thông điệp, toast, menu bật lên
  shell.css           thanh tiêu đề, sidebar, tab tài liệu, thanh trạng thái, đăng nhập, bảng cài đặt
  ribbon.css          Ribbon
  screen.css          màn hình, toolbar, thanh lọc, bản ghi, tab con
  fields.css          lưới 40 cột (→20→4 theo container query), ô nhập, ngày, tra cứu
  grid.css            lưới dữ liệu, dạng thẻ
  dialog.css · dashboard.css · responsive.css · print.css
  themes/*.css        12 theme, mỗi theme chỉ ghi đè token + hiệu ứng lớp vỏ
js/
  app.js              khởi động
  core/               dom, http (fetch + làm sạch HTML), sanitize, format (số/ngày VN), settings, icons, ui (toast, dialog),
                      pwa (cài thành ứng dụng)
  shell/              shell (vỏ), ribbon, sidebar, tabs (điều hướng + xử lý response), palette (Ctrl+K), settings-panel
  enhance/            "nâng cấp" HTML theo vai trò data-erp: screen, toolbar, fields, lookup, grid, forms, messages, dashboard
  tools/validate.js   bộ kiểm tra chuẩn ERP-HTML
tools/validate.html   trang kiểm tra cho đội backend
mock/                 HTML mẫu do tools/mock-gen sinh (đóng vai backend)
assets/               favicon/logo; icons/ = icon PWA (tools/icons/build_icons.py sinh)
manifest.webmanifest  PWA: tên, icon, màu, standalone
sw.js                 service worker: chỉ giữ vỏ tĩnh FE (xem docs/huong-dan/fe-cau-truc-va-to-chuc.md mục 6.1)
```

## Quy ước code

- **Kiểm tra kiểu:** mỗi file JS có `// @ts-check` + JSDoc; VS Code tự kiểm tra kiểu, không cần build TypeScript.
- **Module:** dùng ES Modules. Không biến toàn cục, trừ `window.ERP_CONFIG` (cấu hình) và `window.ErpApp` (để gỡ lỗi).
- **Đặt tên:**
  - Lớp CSS có tiền tố `erp-`.
  - Component không đặt màu cứng, chỉ dùng biến `--erp-*`.
  - Theme mới: thêm `css/themes/<tên>.css` (khối `:root[data-theme="<tên>"]`), khai báo trong `THEMES` của
    `js/core/settings.js`, thêm `<link>` vào `index.html`.
- **HTML từ backend:**
  - Không bao giờ chạy script nhận từ backend.
  - `core/sanitize.js` bỏ `script/style/on*/class/style` và URL `javascript:`.
- **Trạng thái người dùng** (theme, mật độ, cỡ chữ, bố cục lưới, gần đây, yêu thích): hiện lưu ở `localStorage`, gom trong
  `core/settings.js`. Khi backend có endpoint lưu cài đặt thì chỉ thay lớp lưu trữ ở file này.

## Phím tắt

| Phím | Tác dụng |
|---|---|
| Ctrl+K | Tìm chức năng (không dấu) |
| Ctrl+Tab / Ctrl+Shift+Tab | Chuyển tab |
| Alt+W | Đóng tab |
| Ctrl+F1 | Thu gọn / mở Ribbon |
| Ctrl+B / nút ☰ | Thu gọn / mở rộng Sidebar (hoặc Ribbon khi đang dùng Ribbon) |
| (nút trên thanh tiêu đề) | Chuyển Ribbon (ngang) ↔ Sidebar (dọc); kéo mép phải Sidebar để đổi độ rộng, nhấp đúp để về mặc định |
| F2 / F3 | Thêm / Sửa |
| Ctrl+S | Lưu |
| Esc | Hủy |
| F5 | Nạp lại |
| Ctrl+P | In |
| F4 | Tra cứu (ô tra cứu, ô ngày, ô lưới) |
| Insert / Ctrl+Delete | Thêm / xóa dòng lưới |
| Enter / F2 | Sửa ô lưới |
