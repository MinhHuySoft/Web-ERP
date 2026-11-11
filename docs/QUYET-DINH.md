# Nhật ký quyết định

Mỗi quyết định ghi: ngày, người quyết, nội dung, hệ quả kỹ thuật. Quyết định mới không xóa quyết định cũ; nếu thay đổi
thì thêm dòng mới và ghi "thay thế QĐ-xx".

| Mã | Ngày | Người quyết | Trạng thái |
|---|---|---|---|
| QĐ-01 | 2026-11-11 | Chủ dự án | Đã chốt |
| QĐ-02 | 2026-11-11 | Chủ dự án | Đã chốt |
| QĐ-03 | 2026-11-11 | Chủ dự án | Đã chốt |
| QĐ-04 | 2026-11-11 | Chủ dự án | Đã chốt |
| QĐ-05 | 2026-11-11 | Chủ dự án | Đã chốt; phần backend được QĐ-06 thay thế |
| QĐ-06 | 2026-11-11 | Chủ dự án | Đã chốt |

---

## QĐ-01 — WinForms và Web chạy song song, liên tục, trên cùng database

**Nội dung:** ERP.NET WinForms tiếp tục chạy liên tục. Bản web dùng chung database với WinForms, không có ngày tắt
WinForms.

**Hệ quả kỹ thuật (bắt buộc):**

1. **Không đổi schema các bảng hiện có.**
   - Không ALTER, không thêm cột, không thêm trigger vào bảng ERP.
   - Mọi thứ của web nằm trong bảng riêng (QĐ-02).
2. **Dữ liệu web ghi ra phải giống hệt WinForms ghi** để WinForms đọc và sửa tiếp được:
   - `UserAutoID`: chuỗi số 25 ký tự = `yyMMddHHmmss` + mili giây ×2 + số ngẫu nhiên (`Tools.Utils/Functions.cs:7103`).
     Web sinh cùng định dạng, dùng giờ server.
   - Số chứng từ: cùng thuật toán `GetDocumentID` + `SY_DocSetup` + mặt nạ layout (`DPR/DMK/DFP/DW2/DW3`). Cả hai bên
     cùng cấp số, nên phải thử lại khi trùng khóa — WinForms cũng làm vậy.
   - Cột audit `UserCreate/DateCreate/UserUpdate/DateUpdate`, `isLock`, `BranchID`… theo đúng quy tắc của `Storer`.
   - Payload XML gửi các SP hook (`Data/T0, T1…`) đúng định dạng `Db.GetXMLString`.
3. **Mật khẩu:**
   - `SY_User.Password` luôn giữ định dạng hash cũ (MD5 + muối, xem tài liệu 12 §2.5).
   - Web kiểm tra bằng thuật toán cũ, viết lại native, không nạp `Tools.dll`.
   - Đổi mật khẩu trên web phải ghi hash định dạng cũ, để WinForms vẫn đăng nhập được.
4. **Metadata do WinForms quản lý:**
   - Admin vẫn sửa menu, form, layout bằng WinForms (chế độ thiết kế, `SystemMenuManagerFrm`…).
   - Web đọc `SY_*` lúc chạy, cache có hạn. Có cơ chế nạp lại: theo `SY_FrmCfg.VDate`, theo thời gian, và nút "nạp lại
     cấu hình" cho admin.
   - Giai đoạn đầu web không ghi `SY_FrmCfg`.
5. **Xung đột ghi đồng thời:**
   - WinForms không kiểm tra xung đột.
   - Khi lưu, web so `DateUpdate` (và `UserUpdate`) của master với giá trị lúc mở. Nếu khác thì báo xung đột, không ghi
     đè.
   - Chiều ngược lại (WinForms ghi đè thay đổi của web) không chặn được. Ghi rõ trong hướng dẫn sử dụng.
6. **Các việc WinForms tự chạy vẫn tiếp tục chạy**, web không lặp lại:
   - bảo trì dữ liệu ngày 1–2 hằng tháng;
   - `ALTER` khi mở form;
   - `SY_SetupStp` lúc đăng nhập (tự khóa chứng từ ngày cũ).

   Web không gọi lại `SY_SetupStp` khi đăng nhập, trừ khi xác nhận là cần.
7. **Phiên và nhật ký:**
   - Web ghi `SY_UserLog` / `SY_UserLogDetail` cùng định dạng, ví dụ `ComputerName = 'WEB (<ip>)'`, để màn nhật ký cũ
     thấy được thao tác trên web.
   - Thông báo chéo hai bên (WinForms ghi thì web biết) dùng polling hoặc `SY_NotifyMsgTbl`, vì WinForms không phát sự
     kiện.

## QĐ-02 — Được tạo bảng riêng cho web trong DB khách hàng

**Nội dung:** Được phép tạo bảng riêng trong database của khách hàng.

**Hệ quả:**

- Đặt mọi bảng web trong schema SQL riêng `web`, ví dụ `web.UserSetting`, `web.GridLayout`, `web.SavedFilter`,
  `web.Session`, `web.CommandJournal`, `web.MigrationHistory`. Tách bạch hẳn với `dbo` của ERP.
- Tạo bằng script migration đánh số, chạy lại được (idempotent). Có bảng `web.MigrationHistory`, và web kiểm tra phiên
  bản schema khi khởi động.
- Không tạo trigger, không thêm FK trỏ vào bảng `dbo` của ERP.
- Login SQL của web chỉ cần: đọc/ghi bảng ERP, EXEC các SP ERP, DDL trên schema `web`. Không cần `db_owner`.

## QĐ-03 — Giữ toàn bộ hành vi nghiệp vụ của WinForms

**Nội dung:** Web giữ toàn bộ hành vi của ERP WinForms. Ví dụ: chứng từ chưa duyệt vẫn lên sổ.

**Hệ quả:**

- Sổ cái, tồn kho, công nợ **đọc từ chính các view hiện có** (`vGeneralAcc`, `*AccView`, `vItemInput/vItemOutput`…).
  Không dựng bảng nhật ký vật lý riêng. Đề xuất "gl_journal" ở tài liệu 21 §13.1 **không áp dụng**.
- Trạng thái, khóa, đánh số, công thức, hook, thông điệp `Msg/MsgType`, thứ tự kiểm tra, tính giá, khóa sổ chạy qua SP
  cũ: tất cả giống hệt.
- Nghiệp vụ dùng lại SP và view hiện có. Chỉ viết lại ở tầng web những gì WinForms đang làm ở client: tính tổng, kiểm tra
  trước lưu, công thức cột, mặc định… Viết lại phải cho cùng kết quả, và có test đối chiếu với dữ liệu thật.
- Lỗi nghiệp vụ đã ghi nhận (tài liệu 20/21) **giữ nguyên hành vi** để hai bên cho cùng kết quả. Chỉ sửa khi có quyết
  định riêng cho từng lỗi.
- **Cần chủ dự án xác nhận (đề xuất):** ngoại lệ duy nhất là lỗ hổng bảo mật. Danh sách đề xuất (bản web sẽ khác
  WinForms ở các điểm này):
  1. bỏ mật khẩu hệ thống theo ngày, admin theo tên máy, "lỗi thì cho đăng nhập";
  2. SQL ghép chuỗi đổi thành tham số hóa (kết quả như cũ);
  3. kiểm tra quyền, khóa sổ, `isLock` ở server, ngoài việc kiểm ở giao diện;
  4. form không có dòng quyền: vẫn mở được nếu mở từ form cha đã có quyền (giống WinForms), nhưng không cho mở thẳng
     bằng URL;
  5. cột tiền bị ẩn (`HideAmount`) bị loại khỏi dữ liệu trả về;
  6. không trả hash mật khẩu ra ngoài.

## QĐ-04 — Giao diện: Ribbon mặc định + nhiều theme hiện đại, responsive

**Nội dung:**

- Giữ giao diện Ribbon làm mặc định.
- Thêm các giao diện hiện đại để người dùng chọn: glassmorphism, neumorphism, glassy, claymorphism và các phong cách mới
  khác.
- Bắt buộc responsive cho nhiều kích thước màn hình.

**Hệ quả:**

- Hệ theme bằng design token (CSS custom properties).
  - Mỗi theme là một file CSS, chuyển bằng thuộc tính `data-theme`.
  - Theme chỉ đổi lớp "vỏ": ribbon, panel, hộp thoại, nút. Lưới dữ liệu luôn giữ nền đặc để đọc số liệu rõ và chạy mượt.
  - Mọi theme phải đạt độ tương phản chữ tối thiểu WCAG AA.
- Mật độ hiển thị chọn được: gọn / chuẩn / thoáng. Theme, mật độ và cỡ chữ lưu theo user trong `web.UserSetting`.
- Ribbon dựng từ `SY_Menu`:
  - tab = menu cấp 1;
  - nhóm = cấp 2;
  - nút = cấp 3+.
- Mỗi form mở thành một tab tài liệu, giống MDI tab của WinForms.
- Bổ sung 2026-11-11, theo yêu cầu chủ dự án — tùy chọn **Sidebar dọc** thay cho Ribbon:
  - Chuyển bằng nút trên thanh tiêu đề, hoặc trong Giao diện & hiển thị.
  - Sidebar thu gọn được thành thanh biểu tượng, có bảng nổi khi rê chuột.
  - Kéo mép phải để đổi độ rộng (200–480px, nhớ theo trình duyệt; nhấp đúp để về mặc định). Tên dài cắt bằng “…”, không tràn ngang.
  - Thu gọn / mở rộng bằng nút ☰ trên thanh tiêu đề hoặc Ctrl+B. Sidebar không có nút riêng ở đầu/chân để giao diện gọn.
  - Tự đánh dấu màn hình đang mở.
  - Ribbon vẫn là mặc định.
- Điểm gãy responsive:

  | Màn hình | Ribbon | Menu khác | Lưới |
  |---|---|---|---|
  | ≥ 1280 px | Đầy đủ | — | Đầy đủ |
  | 768–1279 px | Thu gọn: biểu tượng, mở nhóm bằng popup | — | Đầy đủ |
  | < 768 px | Ẩn | Ngăn kéo cây menu + thanh dưới | Chuyển sang dạng thẻ (card view — Janus cũng có) |

  Form nhập xếp lại theo `SizeWebM` (vị trí LYT 20).

## QĐ-05 — Công nghệ

**Nội dung:**

- Backend: .NET 10.
- Database: SQL Server (DB ERP hiện có).
- Frontend: chủ dự án nghiêng về HTML + CSS + JS thuần làm gốc cho toàn dự án (dễ bảo trì, IT sửa được không cần học
  mới), và mở cho đề xuất.

**Trạng thái:** chủ dự án **đã duyệt** (2026-11-11) đề xuất ở
[kien-truc/01-de-xuat-cong-nghe.md](kien-truc/01-de-xuat-cong-nghe.md):

- Frontend HTML/CSS/JS thuần, dùng ES Modules + Web Components, không build/npm/framework.
- Thư viện chép sẵn: Tabulator, ECharts, SignalR.
- Backend ASP.NET Core .NET 10, một site IIS phục vụ cả API và frontend.
- Truy cập dữ liệu: Microsoft.Data.SqlClient + Dapper.
- Xuất Excel: ClosedXML.
- Báo cáo `.rpx`: theo hướng C cho bản demo; hướng chính thức còn chờ CQ-03.

## QĐ-06 — Dự án này chỉ làm Frontend; Backend do đội khác làm và trả về HTML thô

Thay thế phần backend của QĐ-05.

**Nội dung:**

- Không xây backend trong dự án này. Một đội khác làm backend: .NET 10 + SQL Server, tuân thủ QĐ-01…QĐ-03.
- Backend trả về **HTML thô** (HTML ngữ nghĩa, không style). Frontend nhận HTML đó, dùng CSS + JS của các theme để dựng
  thành giao diện: Ribbon, tab, lưới, form, tra cứu, hộp thoại, responsive.
- Cần **một chuẩn HTML** để backend tích hợp đúng.
- Giai đoạn đầu, frontend chạy bằng **mock HTML** sinh từ metadata Medcom, viết đúng chuẩn đó.

**Hệ quả:**

- Chuẩn HTML **ERP-HTML** do đội frontend soạn và giữ phiên bản: [kien-truc/02-chuan-html-erp.md](kien-truc/02-chuan-html-erp.md).
  Backend chỉ cần sinh HTML đúng chuẩn. Frontend không gọi API JSON, không biết bảng/SP.
- Mọi nghiệp vụ, quyền, khóa sổ, đánh số, hook SP, giao thức `Msg/MsgType` nằm ở backend. Frontend chỉ hiển thị trạng
  thái backend gửi: nút `disabled`, ô `readonly`, thông điệp.
- HTML đúng chuẩn vẫn dùng được khi không có JS: link mở được, form gửi được. JS chỉ nâng cấp trải nghiệm.
- Mục 3–5 và 8 (phần server) của [kien-truc/01-de-xuat-cong-nghe.md](kien-truc/01-de-xuat-cong-nghe.md) trở thành
  **khuyến nghị cho đội backend**, không còn là phạm vi của dự án này.
- Frontend là thư mục tĩnh `web/` (HTML/CSS/JS thuần, không build). Backend có thể phục vụ nó ở một đường dẫn tĩnh,
  hoặc frontend chạy riêng và gọi sang backend.

---

## Còn chờ quyết định

| Mã | Câu hỏi | Ảnh hưởng |
|---|---|---|
| CQ-01 | Khách hàng / DB nào làm pilot khi nối backend thật? (Demo FE dùng mock Medcom) | Metadata cần export, màn hình ưu tiên |
| CQ-06 | Đội backend duyệt chuẩn ERP-HTML v1 | Tích hợp backend thật |
| CQ-02 | Xác nhận danh sách ngoại lệ bảo mật ở QĐ-03 | Hành vi đăng nhập, phân quyền |
| CQ-03 | Báo cáo `.rpx`: mua engine tương thích (ActiveReports.NET) hay chuyển mẫu sang engine miễn phí? | Chi phí giấy phép, khối lượng chuyển 776 mẫu |
| CQ-04 | Chạy `tools/metadata-export` trên DB pilot (cần tài khoản DB) | Dựng màn hình thật |
| ~~CQ-05~~ | ~~Duyệt đề xuất công nghệ frontend~~ — đã duyệt 2026-11-11 (QĐ-05) | — |
