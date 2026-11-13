# Nhật ký quyết định

Mỗi quyết định ghi: ngày, người quyết, nội dung, hệ quả kỹ thuật. Quyết định mới không xóa quyết định cũ; nếu thay đổi
thì thêm dòng mới và ghi "thay thế QĐ-xx".

| Mã | Ngày | Người quyết | Trạng thái |
|---|---|---|---|
| QĐ-01 | 2026-11-11 | Chủ dự án | Đã chốt |
| QĐ-02 | 2026-11-11 | Chủ dự án | Đã chốt; không dùng `web.Session`, phiên là cookie tự chứa theo QĐ-07 |
| QĐ-03 | 2026-11-11 | Chủ dự án | Đã chốt |
| QĐ-04 | 2026-11-11 | Chủ dự án | Đã chốt |
| QĐ-05 | 2026-11-11 | Chủ dự án | Đã chốt; phần backend được QĐ-06 thay thế |
| QĐ-06 | 2026-11-11 | Chủ dự án | Đã chốt |
| QĐ-07 | 2026-11-11 | Chủ dự án | Đã chốt: giai đoạn đầu 1 BE trên 1 VPS. Đường lui / nâng cấp ở `kien-truc/05` (chưa áp dụng) |
| QĐ-08 | 2026-11-12 | Chủ dự án | Đã chốt: BE viết C#, repo riêng `Web-ERP-BE`, cấu trúc theo `huong-dan/be-cau-truc-va-to-chuc.md` |

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
- Bổ sung 2026-11-11, theo yêu cầu chủ dự án — **người dùng tự chọn màu**:
  - Chọn một màu chủ đạo (mẫu sẵn hoặc màu bất kỳ); mọi theme đổi màu nhuốm theo.
  - Chọn gradient 2–3 màu, có chỉnh góc, cho thanh tiêu đề và/hoặc nền.
  - Hoặc dùng màu mặc định của theme.
  - Màu được tự chỉnh cho đủ tương phản. Theme Tương phản cao giữ màu cố định.
  - Chi tiết: `docs/kien-truc/03-chuan-giao-dien.md` mục 2b.
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

## QĐ-07 — Giai đoạn đầu: 1 BE trên 1 VPS, cấu hình công ty lưu trong SQLite

Bổ sung QĐ-06 (cách triển khai backend) và QĐ-02 (nơi lưu phiên).

**Nội dung:**

- Giai đoạn đầu chạy **một** BE trên **một** VPS.
- Mỗi công ty dùng một domain riêng, hoặc nhiều công ty dùng chung một domain.
- BE giữ một tệp **SQLite** trên VPS, lưu:
  - domain nào thuộc công ty nào. Một domain có nhiều công ty thì mỗi công ty có một mã riêng;
  - chuỗi kết nối tới DB của từng công ty;
  - ~~phiên đăng nhập~~. Đổi 2026-11-12: phiên dùng cookie tự chứa, không lưu trong SQLite (hệ quả 2).
- **Trang quản trị** gọi chính BE đó, và BE đọc/ghi thẳng tệp SQLite. Trang dùng được trên điện thoại.
- **Đăng nhập:** BE trả danh sách công ty của domain.
  - Chỉ có 1 công ty: không cho đổi.
  - Có nhiều công ty: người dùng chọn công ty rồi mới đăng nhập.
  - FE nhớ lựa chọn trong `localStorage` để lần sau chọn sẵn.
- Cân bằng tải, BE dự phòng và DB cấu hình dùng chung **chưa làm**. Chúng là đường lui / nâng cấp, ghi ở
  [kien-truc/05-phuong-an-du-phong-va-nang-cap.md](kien-truc/05-phuong-an-du-phong-va-nang-cap.md).

**Hệ quả (bắt buộc):**

1. **Cách ly công ty.**
   - FE chỉ nhận mã và tên công ty, không bao giờ nhận chuỗi kết nối.
   - Sau khi đăng nhập, công ty gắn vào phiên ở server. Mọi request lấy công ty từ phiên, không lấy từ tham số FE gửi lên.
   - Domain không có cấu hình thì báo lỗi, không rơi sang DB của công ty khác.
   - Domain có nhiều công ty: BE đặt mã công ty vào URL hoặc vào input ẩn của mọi form. Server so với phiên, lệch thì trả
     `409`. Mục đích là không lưu nhầm công ty khi người dùng mở nhiều tab.
   - Cache metadata, quyền, menu theo mã công ty. Job nền chạy lần lượt từng công ty, đặt rõ ngữ cảnh công ty.
2. **Khởi động lại hay cập nhật BE không làm mất đăng nhập:**
   - **phiên là cookie đăng nhập tự chứa** (chủ dự án duyệt 2026-11-12). Đây là cách mặc định của ASP.NET Core:
     - cookie chứa user, mã công ty, thời điểm cấp, mã kiểm tra thu hồi;
     - cookie được mã hóa bằng khóa Data Protection;
     - server không cần nơi lưu phiên;
     - **không** đặt quyền vào cookie: quyền vẫn đọc từ DB mỗi request, có cache ngắn (QĐ-03);
     - hết hạn trượt theo thời gian rảnh, có hạn tối đa tuyệt đối.
   - **Đăng xuất bắt buộc:**
     - khóa một user, hoặc đăng xuất một user: ghi vào danh sách thu hồi ở schema `web` của DB công ty;
     - đăng xuất cả công ty: ghi một mốc thời gian vào cấu hình SQLite. Cookie cấp trước mốc đó bị từ chối.
     - BE kiểm thu hồi và trạng thái `SY_User` có cache 30–60 giây.
   - **Token "nhớ đăng nhập"** (chỉ lưu hash) nằm ở schema `web` của DB công ty.
   - khóa Data Protection lưu bền trên đĩa: mất khóa thì mọi cookie đang dùng hết hiệu lực;
   - trạng thái form nằm trong HTML (input ẩn, `__version`), BE không giữ trạng thái form trong RAM.
3. **Trong vài giây BE khởi động lại, FE:**
   - tự thử lại `GET`;
   - chỉ gửi lại `POST` khi form có khóa chống lặp `__idem`;
   - giữ bản nháp ở máy người dùng.

   Khi bảo trì, BE trả `503` kèm `Retry-After`. Các thay đổi này của chuẩn ERP-HTML làm theo quy tắc ở `AGENTS.md`: sửa đặc tả,
   hướng dẫn BE và validator cùng lúc.
4. **SQLite:**
   - journal kiểu DELETE (không dùng WAL: ở WAL, người chỉ đọc vẫn cần quyền ghi tệp `-shm`, như vậy không tách được quyền
     "Host chỉ đọc"), có `busy_timeout`;
   - lúc chạy gần như chỉ đọc; chỉ ghi khi sửa ở trang quản trị;
   - tệp nằm ngoài thư mục web, chỉ tài khoản chạy BE đọc được.
5. **Bí mật:**
   - mật khẩu trong chuỗi kết nối được mã hóa;
   - trang quản trị không hiện lại mật khẩu: ô chỉ cho nhập mới, có nút "Thử kết nối".
   - Khóa giải mã sao lưu riêng. Mất khóa là mất toàn bộ chuỗi kết nối và mọi phiên đăng nhập.
6. **Sao lưu:**
   - SQLite sao lưu định kỳ ra ngoài VPS bằng `VACUUM INTO` hoặc API backup của SQLite, không chép tệp đang mở;
   - sao lưu kèm khóa Data Protection, có mã hóa.
7. **Trang quản trị** là trang quyền cao nhất của hệ thống:
   - dùng host riêng (ví dụ `admin.<domain>`) và tài khoản riêng, không dùng `SY_User`;
   - mật khẩu băm PBKDF2/Argon2, có xác thực 2 lớp (TOTP);
   - giới hạn số lần nhập sai; phiên ngắn; cookie `Secure` + `SameSite=Strict`;
   - thao tác nguy hiểm (sửa chuỗi kết nối, xóa công ty, đăng xuất hàng loạt) phải xác nhận lại;
   - ghi nhật ký mọi thay đổi (ai, lúc nào, trước/sau, che mật khẩu);
   - giao diện dùng FE của dự án: BE quản trị trả ERP-HTML.
8. **Chừa đường nâng cấp** (tài liệu 05):
   - BE đọc/ghi cấu hình và danh sách thu hồi qua một lớp riêng (ví dụ `ITenantStore`, `IRevocationStore`);
   - SQL đơn giản, chạy được trên cả SQLite và SQL Server;
   - migration đánh số.

   Khi chuyển chỉ cần đổi lớp lưu trữ.
9. Bảng `web.*` khác trong DB công ty vẫn giữ theo QĐ-02, ví dụ `web.CommandJournal`, `web.UserSetting`, `web.GridLayout`.
   Riêng `web.Session` không dùng.

**Bổ sung 2026-11-11 — vị trí DB và hệ điều hành (trả lời CQ-07, CQ-08):**

- **VPS chạy Windows**, BE chạy trên IIS.
- ~~**DB của chính công ty phát triển ERP** đặt trên cùng VPS.~~ **Sửa 2026-11-12 (chủ dự án xác nhận):** VPS không có SQL
  Server. DB của công ty phát triển nằm trên **máy chủ SQL khác**, BE nối qua Internet bằng SQL login, giống DB khách hàng (mục 2–3
  dưới). Hệ quả 1 chỉ áp dụng nếu sau này đặt DB trên VPS.
- **DB của mỗi khách hàng** đặt trên máy chủ riêng của khách, mỗi khách một nơi. BE kết nối tới chúng qua Internet.

Hệ quả:

1. **DB trên cùng VPS** (hiện chưa có, xem sửa 2026-11-12 ở trên):
   - kết nối bằng Windows Authentication: login SQL gắn với tài khoản app pool (`IIS APPPOOL\<tên>`), không lưu mật khẩu;
   - giới hạn `max server memory` của SQL Server, chừa RAM cho BE và IIS.
2. **DB của khách hàng:**
   - Bắt buộc dùng SQL login có mật khẩu, mã hóa trong SQLite theo hệ quả 5. Windows Authentication không dùng được vì khác
     miền.
   - Mỗi khách một login riêng, quyền như QĐ-02: đọc/ghi bảng ERP, EXEC SP ERP, DDL trên schema `web`. **Không `db_owner`.**
3. **Đường kết nối tới DB khách hàng.** Chọn cho từng khách lúc đưa vào hệ thống, ghi trong cấu hình của khách:
   - **Ưu tiên VPN** site-to-site (WireGuard hoặc IPsec) giữa VPS và mạng của khách. Cổng SQL không ra Internet.
   - **Nếu không làm được VPN:** khách chỉ mở cổng SQL cho đúng IP của VPS.
     - Bắt buộc `Encrypt=True`, `TrustServerCertificate=False`, với chứng chỉ hợp lệ trên SQL Server của khách.
     - BE tự bật `Encrypt=True` khi máy chủ SQL ở xa (repo BE, `ErpConnectionStrings`). Máy chủ chưa có chứng chỉ hợp lệ thì tạm
       để `TrustServerCertificate=True`: dữ liệu vẫn được mã hóa, nhưng chưa chống được giả mạo máy chủ.
     - Đổi cổng mặc định 1433 và tắt login `sa`.
   - **Không bao giờ** mở cổng SQL công khai không giới hạn IP.
4. **Độ trễ:**
   - Mỗi lần gọi SQL qua Internet mất hàng chục ms, và một màn hình gọi nhiều lần.
   - BE phải gom truy vấn (một SP trả nhiều result set) và cache metadata `SY_*` theo công ty.
   - Nút "Thử kết nối" ở trang quản trị hiện cả thời gian khứ hồi (ms), để đo trước khi đưa khách vào dùng.
5. **Khách này chậm không được kéo chậm khách khác** (cùng một BE):
   - gọi SQL bất đồng bộ (`async`);
   - đặt `CommandTimeout` và timeout kết nối theo từng khách;
   - giới hạn số request đồng thời theo từng khách.
6. **Mất kết nối tới DB của một khách:**
   - BE trả `503` kèm thông báo "Không kết nối được máy chủ dữ liệu của công ty" và `Retry-After`. Các khách khác vẫn chạy.
   - WinForms của khách trong mạng nội bộ không bị ảnh hưởng.
7. **Khóa Data Protection:** bọc bằng **chứng chỉ** (`ProtectKeysWithCertificate`), không dùng DPAPI theo máy.
   - Tệp `.pfx` có mật khẩu, cất ngoài VPS.
   - Nhờ vậy khôi phục được lên VPS mới. Bản sao lưu bọc bằng DPAPI thì máy khác không giải mã được.
8. **Tệp SQLite và khóa:** phân quyền NTFS chỉ cho tài khoản app pool. Sao lưu định kỳ bằng Task Scheduler, chép ra ngoài
   VPS (hệ quả 6).
9. **Cập nhật BE trên IIS** có vài giây gián đoạn (`app_offline.htm` / tái chế app pool). FE xử lý theo hệ quả 3.
10. **Dữ liệu khách hàng đi qua VPS của công ty phát triển.** Cần thỏa thuận với từng khách: phạm vi truy cập, nơi đặt máy
    chủ, nhật ký truy cập.

**Bổ sung 2026-11-12 — domain của công ty (trả lời CQ-11):**

- Mỗi khách (công ty) dùng một trong ba dạng domain:
  - `<tên công ty>.bms79.com`: domain chính thức do công ty phát triển cấp;
  - `<tên công ty>.bms7.net`: domain **thử**. Công ty đầu tiên chạy thử trên dạng này trước;
  - domain do khách tự mua.
- Hệ quả:
  1. Hai dạng `bms79.com` và `bms7.net`: công ty phát triển tự quản DNS. Nên có bản ghi DNS wildcard (`*.bms7.net`, `*.bms79.com`)
     trỏ về IP của VPS, cùng chứng chỉ TLS wildcard và binding HTTPS wildcard trên IIS. Thêm khách mới khi đó chỉ cần
     `WebErp.Admin tenant add … --host <tên>.bms7.net`, không phải sửa DNS hay IIS.
  2. IIS ưu tiên binding đúng tên trước binding wildcard. Vì vậy các site khác trên cùng VPS có tên cụ thể dưới `bms79.com` vẫn
     chạy bình thường.
  3. Domain khách tự mua: khách tạo bản ghi CNAME (hoặc A) trỏ về VPS. Mỗi domain cần một chứng chỉ và một binding riêng.
  4. Cookie đăng nhập gắn đúng tên miền con (không đặt thuộc tính `Domain`), nên khách này không nhận cookie của khách khác dù
     chung `bms7.net`.

**Bổ sung 2026-11-12 — đường lui và nâng cấp (chưa áp dụng):**

- Chủ dự án đã xem xét: 2 VPS (một chính, một chờ, đồng bộ bằng Syncthing), 2 VPS chạy song song sau load balancer, và nhiều
  BE dùng chung DB cấu hình SQL Server.
- **Chốt cùng ngày:** giai đoạn đầu **chỉ 1 VPS**, chưa làm cân bằng tải hay BE dự phòng. Các mô hình trên chỉ là đường lui và
  đường nâng cấp khi cần, ghi ở [kien-truc/05-phuong-an-du-phong-va-nang-cap.md](kien-truc/05-phuong-an-du-phong-va-nang-cap.md).
- Muốn áp dụng bậc nào thì ra quyết định mới.
- Tài liệu 05 mục 1 liệt kê các việc rẻ nên làm ngay ở bậc 0 để sau không phải làm lại.
- Việc dùng cookie đăng nhập tự chứa thay cho phiên lưu SQLite: chủ dự án đã duyệt cùng ngày, ghi vào hệ quả 2.

## QĐ-08 — Backend: C#, repo riêng, cấu trúc theo hướng dẫn BE

Bổ sung QĐ-05 / QĐ-06 (công nghệ và phạm vi backend).

**Nội dung:**

- **Ngôn ngữ BE là C#** trên ASP.NET Core .NET 10. Không dùng VB.NET như BE tham khảo
  ([kien-truc/04-danh-gia-be-tham-khao.md](kien-truc/04-danh-gia-be-tham-khao.md)).
- **BE ở repo riêng:** [`MinhHuySoft/Web-ERP-BE`](https://github.com/MinhHuySoft/Web-ERP-BE). Repo này (`Web-ERP`) vẫn
  giữ FE, chuẩn ERP-HTML, validator và tài liệu phân tích hệ cũ (QĐ-06 giữ nguyên).
- **Cấu trúc repo BE** theo [huong-dan/be-cau-truc-va-to-chuc.md](huong-dan/be-cau-truc-va-to-chuc.md):
  - 6 project: `Core`, `Html`, `Erp`, `Config`, `Host`, `Admin`;
  - các thư mục `db/`, `tests/`, `deploy/`, `docs/`.

  Thay phần server ở mục 4 của [kien-truc/01-de-xuat-cong-nghe.md](kien-truc/01-de-xuat-cong-nghe.md), mục đó được viết trước
  QĐ-06.

**Hệ quả:**

1. **Phụ thuộc một chiều, khóa bằng tham chiếu project:** `Host`/`Admin` → `Html`, `Erp`, `Config` → `Core`.
   - `Html` không truy cập DB.
   - `Erp` không sinh HTML.
   - Mọi lệnh ghi bảng ERP đi qua `Erp/Save` hoặc `Erp/Actions`.
2. **Hai repo phối hợp:**
   - FE gắn tag khi phát hành;
   - BE lấy `web/` và `validate.js` theo đúng tag đó, để chép vào `wwwroot` và để chạy contract test.
   - Đổi cách FE và BE trao đổi thì sửa ở repo FE trước (đặc tả + hướng dẫn BE + validator), gắn tag, rồi BE làm theo.
3. **`AGENTS.md` của repo BE** rút từ hướng dẫn cấu trúc BE và nhắc lại các quy tắc bắt buộc của repo này:
   - không bí mật, không dữ liệu khách, không mã dịch ngược;
   - không nối DB khách;
   - an toàn DB theo `SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md`.
4. **Repo BE đang ở chế độ công khai** (kiểm 2026-11-12), giống repo FE. Repo BE sẽ chứa SQL chạy trên schema ERP, quy tắc lưu
   chứng từ và hàm kiểm mật khẩu tương thích hệ cũ. Vì vậy:
   - **Chủ dự án quyết (2026-11-12, trả lời CQ-12):** giữ **công khai** trong lúc phát triển. Chuyển sang **riêng tư** khi
     triển khai và chạy thật.
   - Chuyển sang riêng tư **không xóa** những gì đã công khai: bản fork, bản clone, bộ nhớ đệm vẫn còn. Vì vậy trong lúc còn
     công khai, quy tắc "không commit" bên dưới càng phải giữ chặt.
   - Bật **secret scanning** và **push protection** của GitHub cho repo BE (repo công khai được dùng miễn phí), để chặn lỡ đẩy
     bí mật lên.
   - Trước khi chạy thật:
     - rà toàn bộ lịch sử commit tìm bí mật;
     - có thì **đổi bí mật đó**, không chỉ xóa commit;
     - rồi mới chuyển sang riêng tư.
   - Dù để chế độ nào cũng **không bao giờ** commit:
     - chuỗi kết nối, khóa Data Protection, chứng chỉ, `config.db`;
     - `appsettings.*.Local.json`;
     - dữ liệu hay tệp đính kèm thật của khách;
     - mã dịch ngược `Tools.dll` / `ERP.NET`.
   - `.gitignore` chặn các thứ này ngay từ commit đầu tiên.

---

## Còn chờ quyết định

| Mã | Câu hỏi | Ảnh hưởng |
|---|---|---|
| CQ-01 | Khách hàng / DB nào làm pilot khi nối backend thật? (Demo FE dùng mock Medcom) | Metadata cần export, màn hình ưu tiên |
| CQ-06 | Đội backend duyệt chuẩn ERP-HTML v1 | Tích hợp backend thật |
| CQ-02 | Xác nhận danh sách ngoại lệ bảo mật ở QĐ-03 | Hành vi đăng nhập, phân quyền |
| CQ-03 | Báo cáo `.rpx`: mua engine tương thích (ActiveReports.NET) hay chuyển mẫu sang engine miễn phí? | Chi phí giấy phép, khối lượng chuyển 776 mẫu |
| CQ-04 | Chạy `tools/metadata-export` trên DB pilot (cần tài khoản DB) | Dựng màn hình thật |
| ~~CQ-07~~ | ~~DB công ty nằm ở đâu so với VPS~~ — đã trả lời 2026-11-11: DB của công ty phát triển cùng VPS, DB khách hàng ở máy chủ riêng của từng khách (QĐ-07, phần bổ sung) | — |
| ~~CQ-08~~ | ~~VPS chạy Windows hay Linux~~ — đã trả lời 2026-11-11: Windows, BE chạy trên IIS (QĐ-07, phần bổ sung) | — |
| ~~CQ-09~~ | ~~Chuyển sang VPS dự phòng bằng tay hay tự động~~ — chưa cần, vì giai đoạn đầu chỉ 1 VPS. Chuyển vào tài liệu 05 mục 6 | — |
| CQ-10 | SQL Server trên VPS là bản Express hay Standard? | Cách lên lịch sao lưu DB của công ty phát triển (SQL Agent hay Task Scheduler); sau này là cách đưa DB sang VPS khác |
| ~~CQ-11~~ | ~~Domain của khách là tên miền con hay tên miền riêng~~ — đã trả lời 2026-11-12: `<tên>.bms79.com` (chính thức), `<tên>.bms7.net` (thử) hoặc domain khách tự mua (QĐ-07, bổ sung "domain của công ty") | — |
| ~~CQ-12~~ | ~~Repo `Web-ERP-BE` có chuyển sang riêng tư không~~ — đã trả lời 2026-11-12: giữ công khai lúc phát triển, chuyển riêng tư khi chạy thật (QĐ-08 hệ quả 4) | — |
| ~~CQ-05~~ | ~~Duyệt đề xuất công nghệ frontend~~ — đã duyệt 2026-11-11 (QĐ-05) | — |
