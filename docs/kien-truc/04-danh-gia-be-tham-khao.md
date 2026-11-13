# 04 — Đánh giá BE tham khảo (`Test222.zip`)

> Tài liệu phân tích, **không kèm mã**. Ngày đánh giá: 2026-11-11.
> Đối chiếu với: chuẩn [ERP-HTML v1.0](02-chuan-html-erp.md), [QUYET-DINH.md](../QUYET-DINH.md) (QĐ-01…QĐ-06),
> bài học dự án web trước [60-bai-hoc-du-an-web-truoc.md](../legacy-analysis/60-bai-hoc-du-an-web-truoc.md).

## 0. Kết luận nhanh

1. **Đây là một ứng dụng web hoàn chỉnh, không phải BE trả HTML thô.** Server tự dựng cả trang:
   - khung trang;
   - Bootstrap, Font Awesome, SweetAlert2, jQuery (tải từ CDN);
   - JS và CSS riêng.

   Mọi tương tác đi qua `POST /Api/*.ashx?action=…`, nhận về JSON kèm mảnh HTML có class Bootstrap. **Không cắm thẳng
   vào FE của dự án được:**
   - FE bỏ `class`, `script`, `style` khi nhận (chuẩn mục 18);
   - HTML không có vai trò `data-erp`, nên FE không tách được màn hình, lưới hay bản ghi.
2. **Phần đáng giá là lõi.** Đường đi metadata → lệnh → stored procedure, đăng nhập và phân quyền đọc thẳng `SY_*`, nhập
   và xuất Excel, đính kèm, lịch sử sửa. Các phần này dùng lại được nếu **thay toàn bộ lớp render** bằng ERP-HTML.
3. **Có 5 điểm trái quyết định đã chốt.** Phải xử lý trước khi áp dụng:

   | Mã | Vấn đề | Trái |
   |---|---|---|
   | N2 | Metadata là 102 tệp JSON viết tay, không đọc `SY_FrmCfg`/`SY_FrmLstTbl` | QĐ-01.4 |
   | N3 | Nghiệp vụ dồn vào **179 SP mới `Sys_Web_*`**, không có trong gói. Payload là JSON thay vì XML hook | QĐ-01.2, QĐ-03 |
   | N4 | Kiểm duyệt chặn hạch toán khi chưa duyệt. Khóa sửa chỉ có hiệu lực trên web | QĐ-03 |
   | N5 | 12 bảng mới đặt ở `dbo`, không có migration | QĐ-02 |
   | N1 | Đầu ra là trang Bootstrap + JSON, không phải HTML thô | QĐ-06 |

4. **Khuyến nghị: phương án B** (mục 6), tức giữ lõi engine và viết lại lớp trình bày theo ERP-HTML. Kèm 4 điều kiện bắt buộc
   ở mục 6.2. **Không dùng nguyên** gói này (phương án A).
5. **Việc làm ngay, không đợi:** gói đã chia sẻ chứa khóa Data Protection và chuỗi kết nối có mật khẩu SQL. Cần **đổi
   mật khẩu SQL và thay khóa** (mục 7).

## 1. Phạm vi và cách đánh giá

- Gói nặng 81,7 MB, 915 tệp (312,8 MB khi giải nén). Gồm cả `bin/`, `obj/`, `.vs/`, `packages/` và `Uploads/` (36 ảnh/tệp
  đính kèm).
- Chỉ giải nén **mã nguồn và metadata** (192 tệp) vào thư mục tạm riêng. **Không build, không chạy**, không mở tệp trong
  `Uploads/`. Không chép bí mật nào vào tài liệu này.
- Đọc toàn bộ lớp:
  - hosting và định tuyến;
  - render, API, metadata, command, dữ liệu;
  - bảo mật, kiểm duyệt;
  - script phía client.

## 2. BE tham khảo làm như thế nào

### 2.1 Công nghệ và quy mô

| Mục | Giá trị |
|---|---|
| Ngôn ngữ | **VB.NET**, `Option Strict Off` (kiểu lỏng), `Option Infer On` |
| Nền | ASP.NET Core **net10.0**, SDK 10.0.100. Định tuyến bằng `MapMethods` (kiểu Minimal API) |
| Gói NuGet | Microsoft.Data.SqlClient 6.1.6, Newtonsoft.Json 13, ClosedXML 0.105, System.Runtime.Caching |
| Mã | ≈12.800 dòng VB / 69 tệp; ≈1.900 dòng JS; ≈1.100 dòng CSS |
| Metadata | 102 tệp JSON: 33 Edit, 19 List, 1 Kanban, 49 tra cứu/khác, 1 `_MENU.json` |
| Client | Bootstrap 5.3.3, Font Awesome 6.5.1, SweetAlert2 `@11`, jQuery 3.7.1. Tất cả từ CDN |

Đây là bản **chuyển từ ASP.NET WebForms** sang ASP.NET Core:

- Vẫn giữ route `.aspx` và `.ashx`.
- Lớp `WebContext` giả lập `Request/Response/Session` của `System.Web`.
- Renderer chạy đồng bộ.

### 2.2 Luồng xử lý

```text
Trình duyệt ──GET /FormList/{formid} ──────────► Trang HTML đầy đủ
                                                 (LayoutRenderer + ListFormRenderer, có <script>, CDN)
            ──POST /Api/ListApi.ashx ──────────► JSON {success, message, html, …}
              action=search|sort|paging|…        jQuery chèn html vào trang
              header X-ERP-CSRF
                     │
                     ▼
         FormContext (instanceId) trong MemoryCache, 30 phút
                     │
                     ▼
         CommandEngine ── metadata JSON: commands.<Tên>.storedProcedure + parameters
                     │
                     ▼
         DataAccessHelper (ADO.NET đồng bộ) ── EXEC Sys_Web_*_Search / _Load / _Save / _Delete …
```

- **Trang:**
  - `/` (Dashboard), `/Login`, `/Account`;
  - `/FormList/{formid}`, `/FormEdit/{formid}`, `/FormKanban/{formid}`.
- **API JSON** gồm 6 handler, mỗi handler rẽ nhánh theo tham số `action`:

  | Handler | Các `action` |
  |---|---|
  | ListApi | search, sort, paging, tìm nâng cao, cấu hình cột, lịch sử, xuất Excel, nhập Excel 6 bước, lệnh danh sách, đính kèm |
  | EditApi | calculatedraft, savedocument, deletedocument, lệnh, sao chép, trình/duyệt/hủy duyệt, ảnh, đính kèm, thêm dòng chi tiết |
  | LookupApi | modal, search |
  | KanbanApi | loadboard, movecard, … |
  | SystemApi | lưu tùy chọn người dùng, thông báo |
  | ChatApi | chat |

- **Trạng thái ở server:**
  - mỗi form đang mở là một `FormContext` (dữ liệu, trang, sắp xếp, tiêu chí, dữ liệu import), giữ trong `MemoryCache`
    30 phút trượt;
  - giá trị phiên giữ trong `IMemoryCache` của tiến trình.
- **Metadata** (`App_Data/Metadata/*.json`). Mỗi form khai báo:
  - `list`: cột, ô lọc, toolbar;
  - `edit`: field, toolbar, lưới chi tiết;
  - `commands`: tên SP, tham số, nguồn tham số;
  - `permissions`: dạng `legacy:<FormKey>:view|add|edit|delete`.

  Mã form trùng `FormName` của ERP (ví dụ `CS_ReceiptFrm`).
- **Command:**
  - Tham số lấy từ `field`, `system` hoặc `prompt`. Nguồn `system` gồm `userid`, `recordid`, `isnew`, `selectedkeys`, `formjson`.
  - Riêng `formjson` gói cả phiếu thành JSON `{header, details}` để SP đọc bằng `OPENJSON`.
  - Có chế độ `table`: SELECT/DELETE sinh từ metadata, giá trị luôn tham số hóa.
- **Bảo mật:**
  - Đăng nhập bằng `SY_User`, kiểm hash MD5 + muối theo định dạng cũ.
  - Quyền đọc từ `SY_UserGroup`, `SY_UserGroupPermisstion`, `SY_UserPermisstion`, `SY_Menu`:
    - giữ phép OR giữa nhóm, user và ủy quyền (`UserAuthority`);
    - đọc lại mỗi request;
    - lỗi thì từ chối (fail-closed).
  - API dùng CSRF qua header `X-ERP-CSRF`, so sánh thời gian hằng.
  - "Nhớ đăng nhập" theo mẫu selector/validator, lưu SHA-256.
  - `returnUrl` chỉ nhận đường dẫn nội bộ.
  - Khóa Data Protection lưu ra tệp.
  - Chỉ mở 5 thư mục tĩnh được chỉ định. Trong đó có thư mục đính kèm, xem C6.
- **Tính năng phụ:**
  - tìm nâng cao; cấu hình cột theo user;
  - nhập Excel nhiều bước: phân tích → ánh xạ → xem trước → kiểm tra → ghi;
  - đính kèm, thư viện ảnh, lịch sử sửa;
  - kiểm duyệt nhiều cấp, có ủy quyền và nhắc quá hạn;
  - thông báo, chat, Kanban;
  - job nền chạy 10 phút một lần (dọn cache, dọn token, nhắc duyệt).

### 2.3 Bảng mới mà BE tạo hoặc dùng

Tất cả nằm ở `dbo`. Gói **không có** script tạo bảng hay migration.

`Sys_SearchCache`, `Sys_AuditLog`, `Sys_AuthToken`, `Sys_UserPreference`, `Sys_UserGridConfig`, `Sys_DocumentChangeLog`,
`Sys_ApprovalInstance`, `Sys_ApprovalHistory`, `Sys_ApprovalDelegation`, `Sys_Notification`,
`Sys_NotificationRead`, `Sys_ChatMessage`.

### 2.4 Stored procedure được gọi

| Nhóm | Số tham chiếu | Ghi chú |
|---|---|---|
| `Sys_Web_*` | 217 (179 tên khác nhau) | SP mới viết cho web. **Không có mã SQL trong gói** |
| `sp_AR_*`, `sp_AP_*`, `sp_PM_*` | ≈21 | Ví dụ `sp_AR_Invoice_Save`. Chưa xác minh đây là SP gốc của ERP hay SP mới |
| `Sys_Pilot_*` | 8 | SP thử nghiệm |

## 3. Ưu điểm

1. **Một engine cho mọi form, đúng hướng metadata-driven.** Không phải viết tay từng màn hình.
   - Thêm form chỉ cần thêm JSON và SP.
   - Có `IMetadataProvider` để đổi nguồn metadata. Đây là điểm cắm tốt để chuyển sang đọc `SY_*` (mục 6.2).
2. **Ý thức bảo mật tốt:**
   - mọi giá trị động qua `Html.E` / `Html.Attr`;
   - SQL tham số hóa;
   - quyền fail-closed và kiểm lại mỗi request (thu hồi quyền có hiệu lực ngay);
   - không trả hash mật khẩu (chỉ đọc cột `Password` lúc kiểm tra);
   - remember-me đúng mẫu;
   - chống open redirect;
   - không lộ `App_Data`;
   - `appsettings.Local.json` không đưa vào bản publish.
3. **Tương thích DB cũ ở đăng nhập và phân quyền.** Giữ đúng định dạng mật khẩu (QĐ-01.3). Đọc đủ 4 nguồn quyền. Bỏ đường
   "lỗi thì cho đăng nhập" (khớp danh sách ngoại lệ bảo mật ở QĐ-03).
4. **Khớp công nghệ đã chọn:** .NET 10 và ClosedXML (QĐ-05). Mã form dùng đúng `FormName` (chuẩn mục 2.7).
5. **Chú thích kỹ trong mã.** Ghi rõ lý do của từng quyết định. Đáng giá nhất là các bẫy định dạng số và ngày theo culture
   (`TryNumber`/`TryDate`). Đây là kiến thức dùng lại được.
6. **Tính năng phong phú.** Một số phần FE và chuẩn ERP-HTML **chưa có**:
   - nhập Excel nhiều bước có xem trước và kiểm tra;
   - tổng cột tính trên toàn bộ kết quả;
   - lịch sử sửa;
   - kiểm duyệt có ủy quyền;
   - Kanban, thông báo.
7. **Renderer không dùng `on*`.** Hành vi gắn qua `data-action` / `data-field`, gần tinh thần chuẩn ERP-HTML. Chuyển sang
   `data-erp` không khó về mặt khái niệm.
8. **Có tính đến vận hành:**
   - giới hạn kích thước request;
   - `PathBase` cho IIS ứng dụng con;
   - `/health`;
   - job nền có bắt lỗi;
   - khóa Data Protection bền vững (bài học 60 §0.6).

## 4. Nhược điểm và rủi ro

Xếp theo mức: **N** = chặn áp dụng, **C** = cao, **T** = trung bình.

### 4.1 Chặn áp dụng

- **N1. Đầu ra không phải ERP-HTML.** BE trả trang đầy đủ, có `<script>` inline, CDN, class Bootstrap/Font Awesome, và bọc
  JSON cho mọi tương tác.
  - Đưa vào FE: sanitize bỏ class và script nên mất bố cục. Không có `data-erp` nên FE không nhận ra gì.
  - Đổi sang JSON trái QĐ-06: "Frontend không gọi API JSON, không biết bảng/SP".
- **N2. Metadata viết tay, không đọc `SY_*` lúc chạy.**
  - 102 tệp JSON. Menu cũng là JSON (`_MENU.json`).
  - `SY_Menu` chỉ được dùng để tra quyền.
  - Trái QĐ-01.4: admin sửa form/menu bằng WinForms thì web không thấy.
  - Lặp đúng bài học 60 §0.2. Medcom-Web làm 25 màn trong 5 tuần và không dùng lại được cho 18 khách hàng.
- **N3. Nghiệp vụ nằm trong 179 SP mới, không có trong gói.**
  - Framework **không** làm các việc mà QĐ-01.2/QĐ-03 yêu cầu:
    - sinh `UserAutoID`;
    - cấp số `GetDocumentID`/`SY_DocSetup`;
    - so `DateUpdate` để báo xung đột 409;
    - kiểm `isLock` ở server (chỉ hiển thị ở `FieldRenderer`);
    - ghi `SY_UserLog`;
    - giao thức `Msg/MsgType`;
    - loại cột `HideAmount`.
  - Các việc này hoặc nằm trong `Sys_Web_*` (không kiểm được), hoặc chưa có.
  - Payload ghi là JSON `OPENJSON`, không phải XML `Db.GetXMLString` của các SP hook ERP. Nghĩa là `Sys_Web_*_Save` phải tự
    tái hiện logic `Storer`.
  - Đây đúng là bài học lớn nhất của 60 §0.3: tự ghi thì lệch logic ERP.
- **N4. Kiểm duyệt trái QĐ-03.**
  - `kiemduyet.md` yêu cầu "chỉ cho phép hạch toán … khi trạng thái là Đã duyệt".
  - QĐ-03 chốt "chứng từ chưa duyệt vẫn lên sổ".
  - Khóa sửa theo trạng thái duyệt (`WorkflowEngine.CheckEditable`) chỉ chạy trên web. WinForms vẫn sửa/xóa được chứng từ đã
    duyệt, vì `Sys_ApprovalInstance` là bảng WinForms không biết, nên hai bên lệch nhau.
- **N5. Bảng mới ở `dbo`, không có migration.** Trái QĐ-02: schema riêng `web`, migration đánh số chạy lại được,
  `web.MigrationHistory`.

### 4.2 Mức cao

- **C1. Trạng thái nằm trong bộ nhớ của một tiến trình.**
  - `FormContext` (cả dữ liệu Excel đang nhập) và giá trị phiên nằm trong `MemoryCache`.
  - IIS tái chế tiến trình hoặc deploy thì người đang sửa phiếu nhận "Phiên form hết hạn, vui lòng tải lại trang" và mất dữ
    liệu chưa lưu.
  - Không chạy được nhiều máy chủ hoặc web garden. Chính mã ghi rõ là "single-worker/single-server".
- **C2. `Sys_SearchCache` chép kết quả tìm kiếm vào DB khách hàng.**
  - Mỗi lần tìm (ở form bật cache), mỗi dòng ghi một bản JSON.
  - Hệ quả:
    - tăng ghi và log giao dịch trên DB dùng chung với WinForms;
    - dữ liệu nghiệp vụ bị nhân bản ra bảng khác;
    - kết quả có thể cũ tới 30 phút so với WinForms.
- **C3. Phụ thuộc CDN.** jsDelivr/cdnjs, `sweetalert2@11` không ghim bản, không SRI, không CSP.
  - Máy chủ LAN không có Internet thì giao diện hỏng.
  - Có rủi ro chuỗi cung ứng.
  - Trái hướng "thư viện chép sẵn" của QĐ-05.
- **C4. Cách trả lỗi.**
  - Mọi lỗi trả HTTP 200 kèm `success:false`, khác bảng mã ở chuẩn mục 3.2: 401/403/409/422.
  - `ex.Message` được gửi nguyên cho client, nên lộ chi tiết nội bộ hoặc SQL.
  - SweetAlert2 hiển thị `title` dạng HTML. Thông điệp nào chứa dữ liệu người dùng mà chưa encode là có nguy cơ XSS. Cần
    kiểm từng nơi.
- **C5. Gói chia sẻ chứa thứ không được chia sẻ:**
  - khóa Data Protection (`App_Data/Keys/*.xml`);
  - `appsettings.Local.json` có chuỗi kết nối kèm mật khẩu SQL;
  - `Uploads/` có ảnh và tệp đính kèm;
  - `bin/`, `obj/`, `.vs/`.

  Xem mục 7.
- **C6. Tệp đính kèm và ảnh phục vụ như tệp tĩnh công khai.**
  - `/Uploads/FormFiles/…` và `/Uploads/FormImages/…` được mở bằng `UseStaticFiles`. Không kiểm đăng nhập, không kiểm quyền.
  - Ai có URL là tải được, kể cả khi chưa đăng nhập hoặc đã bị thu hồi quyền form.
  - Tên tệp là GUID nên khó đoán. Nhưng URL vẫn lộ qua lịch sử trình duyệt, log hoặc khi chia sẻ.
  - Nên phục vụ qua endpoint có kiểm quyền theo form và bản ghi.

### 4.3 Mức trung bình

- **T1. VB.NET với `Option Strict Off`.** Chuyển kiểu ngầm, lỗi chỉ lộ lúc chạy. Ít người tuyển và review được hơn C#.
  Tài liệu dự án và hệ ERP (`Tools.Utils`) đều theo C#.
- **T2. ADO.NET đồng bộ, dùng `DataTable`.**
  - Không đặt `CommandTimeout` (trừ chat). Không có transaction phía ứng dụng, phụ thuộc hoàn toàn vào SP.
  - Mỗi request khóa một luồng trong suốt thời gian chờ SQL. Tải cao sẽ cạn thread pool.
- **T3. Màu badge trạng thái tính bằng `String.GetHashCode()`.** Trên .NET Core giá trị này ngẫu nhiên theo từng tiến trình.
  Sau mỗi lần khởi động lại, cùng một trạng thái đổi màu.
- **T4. Đăng nhập chưa đủ cứng:**
  - form đăng nhập không có token CSRF;
  - không giới hạn số lần nhập sai;
  - `Session.Clear()` giữ nguyên mã phiên sau đăng nhập. Cần kiểm thêm nguy cơ cố định phiên (session fixation).
- **T5. Định dạng sẵn ở server** (`dd/MM/yyyy`, `#,##0.##`) và không kèm giá trị máy. Trái chuẩn mục 2.5. FE không định dạng
  lại theo cài đặt người dùng được.
- **T6.** Không có test tự động trong gói.

## 5. Tương thích

### 5.1 Với chuẩn ERP-HTML v1.0

**Đạt** = dùng được ngay. **Một phần** = đã có khái niệm, phải đổi định dạng. **Không** = phải làm mới.

| Mục chuẩn | BE tham khảo đang làm | Mức | Cần đổi |
|---|---|---|---|
| 2.2 Không gửi trình bày | Class Bootstrap/FA, `<script>` trong shell | Không | Bỏ hết class, script, CDN |
| 2.5 Giá trị máy | Chỉ có chữ đã định dạng | Không | Thêm `value` / `data-value` bất biến (số chấm thập phân, ngày ISO) |
| 2.6 Quyền do BE quyết | Server chặn khi bấm. Renderer vẫn vẽ nút cho cả người không có quyền | Một phần | Không gửi nút (hoặc gửi `disabled`) khi thiếu quyền. Bỏ dữ liệu cột `HideAmount` |
| 2.7 Định danh | `formId` = `FormName`, `data-field` = tên cột | Đạt | — |
| 3.1–3.2 HTTP | JSON, luôn trả 200 | Không | Trả HTML. Dùng mã 303 / 401 / 403 / 404 / 409 / 422 |
| 3.3 CSRF | Header `X-ERP-CSRF` lấy từ `<meta>` | Một phần | Input ẩn trong mỗi `form[method=post]` (antiforgery ASP.NET Core) |
| 3.4 Điểm vào | `/Login` có. Phiên và menu nằm trong shell | Một phần | Tách `sessionUrl`, `menuUrl`, `homeUrl` |
| 5.3 Menu | `_MENU.json` → HTML Bootstrap | Không | `nav[data-erp=menu]` dựng từ `SY_Menu` theo quyền |
| 6 Màn hình | Không có `section[data-erp=screen]` | Không | Bọc mỗi màn |
| 7 Toolbar | Metadata có `buttonId/label/icon/action` | Một phần | `menu[data-erp=toolbar]`, nút `formaction`, `data-icon` |
| 8 Lọc | `searchFields` + AJAX | Một phần | `form[data-erp=filter]` method GET, URL trong `action` |
| 9 Bản ghi | EditForm + AJAX JSON | Một phần | `form[data-erp=record]` POST thường, `__version` |
| 10 Tra cứu | `LookupApi` trả modal | Một phần | `data-lookup-src` + `table[data-erp=lookup-result]` |
| 11 Lưới | `<table>` + tổng cột + phân trang | Một phần | `data-erp=grid`, `th[data-field][data-type]`, `nav[data-erp=pager]` |
| 11.6 Lưới sửa | JSON `DetailLines` | Không | Gửi `T1[i].__key/__state/<cột>`, `template[data-erp=row-template]` |
| 12 Tab chi tiết | `detailLayout: "tabs"` | Một phần | `section[data-erp=tabs]` / `tab-panel` |
| 13 Thông điệp / xác nhận | JSON `message` + SweetAlert | Không | `div[data-erp=messages]`, `form[data-erp=confirm]` (`__confirm`/`__answer`) |
| 14.2 Hộp thoại | Modal Bootstrap, HTML qua JSON | Không | `section[data-erp=dialog]` |
| 15 Báo cáo | Không có (chỉ xuất Excel) | Không | Theo CQ-03 |
| 16 Đính kèm / trạng thái | Có đính kèm, ảnh, trạng thái duyệt | Một phần | `section[data-erp=attachments]`, `data[data-erp=status]` |
| 19 `__version` / 409 | Không có | Không | Bắt buộc theo QĐ-01.5 |

### 5.2 Với các quyết định đã chốt

| Quyết định | Mức | Ghi chú |
|---|---|---|
| QĐ-01.1 Không đổi schema bảng cũ | Có vẻ đạt | Framework không ALTER. Chưa kiểm được trong 179 SP |
| QĐ-01.2 Ghi giống WinForms | Không kiểm được | Nằm trong SP mới (N3) |
| QĐ-01.3 Mật khẩu định dạng cũ | Đạt phần kiểm tra | Chưa kiểm đường đổi mật khẩu |
| QĐ-01.4 Metadata `SY_*` lúc chạy | Không đạt | N2 |
| QĐ-01.5 So `DateUpdate` | Không có | — |
| QĐ-01.7 `SY_UserLog` | Không có | Dùng `Sys_AuditLog` riêng |
| QĐ-02 Schema `web` + migration | Không đạt | N5 |
| QĐ-03 Gọi SP cũ, giữ hành vi | Không đạt | N3, N4 |
| QĐ-03 Ngoại lệ bảo mật (mục 1, 2, 3, 6) | Đạt phần lớn | Thiếu `isLock` server (3) và `HideAmount` (5) |
| QĐ-05 .NET 10, ClosedXML | Đạt | Không dùng Dapper (không quan trọng). Thư viện client từ CDN (C3) |
| QĐ-06 BE trả HTML thô | Không đạt | N1 |

## 6. Phương án

| | A. Dùng nguyên | **B. Giữ lõi, thay lớp trình bày** | C. Chỉ tham khảo, viết mới (C#) |
|---|---|---|---|
| Làm gì | Bỏ FE của dự án, dùng giao diện Bootstrap của gói | Giữ engine, viết bộ renderer ERP-HTML mới, bỏ JS/CSS/JSON API | Đội BE viết mới theo chuẩn, lấy ý tưởng và bẫy đã ghi từ gói |
| Hợp QĐ-06 | Không | Có | Có |
| Giữ Ribbon/theme/tab của FE | Không | Có | Có |
| Công sức | Thấp nhất ban đầu | Trung bình | Cao nhất |
| Rủi ro còn lại | Mang theo cả N1–N5, C1–C6 | Còn N2–N5 nếu không làm 6.2 | Thấp nhất. Mất phần đã viết |
| Khi nào chọn | Không khuyến nghị | **Khi đội BE chính là đội viết gói này** và chấp nhận 6.2 | Khi đội BE dùng C#, hoặc 6.2 tốn công gần bằng viết lại |

### 6.1 Phương án B: giữ gì, bỏ gì, viết gì

| Thành phần của gói | Xử lý |
|---|---|
| `Framework/Security/*` (đăng nhập, quyền, nhớ đăng nhập) | **Giữ**. Thêm CSRF cho form đăng nhập, giới hạn nhập sai, đổi mã phiên sau đăng nhập |
| `Framework/Command/*`, `Framework/Data/*` | **Giữ khung**. Thêm transaction, `CommandTimeout`, chuyển dần sang async. Thêm nguồn tham số dạng XML cho hook ERP |
| `Framework/Metadata/*` | **Giữ interface**. Viết provider mới đọc `SY_*` (6.2) |
| `Framework/Import`, `Export`, `Attachment`, `Search` | **Giữ logic**. Phần hiển thị chuyển sang ERP-HTML. Tệp đính kèm tải qua endpoint có kiểm quyền (C6) |
| `Framework/Workflow/*` | **Đóng băng**: tắt mặc định, chờ quyết định (6.2) |
| `Framework/Render/*` | **Viết lại** thành renderer ERP-HTML (bảng dưới) |
| `Api/*.ashx` JSON, `Pages/*` | **Thay** bằng endpoint trả HTML: GET màn hình, POST form → 303 / 409 / 422 |
| `Scripts/*`, `Styles/erp.css`, Bootstrap/FA/SweetAlert/jQuery, cache shell bằng localStorage | **Bỏ**. FE của dự án đã làm phần này |
| `FormContext` trong bộ nhớ | **Bỏ phần lớn**: trạng thái đi trong HTML (input ẩn, `__version`, URL). Riêng nhập Excel nhiều bước cần nơi lưu bền, ví dụ bảng `web.ImportSession` |
| `Sys_SearchCache` | **Bỏ**, hoặc chỉ bật cho vài view rất chậm, và đặt ở `web.` |
| Chat, Kanban | Ngoài phạm vi giai đoạn đầu |

Ánh xạ renderer cũ sang vai trò ERP-HTML:

| Renderer cũ | Vai trò ERP-HTML |
|---|---|
| `LayoutRenderer` | `section[data-erp=session]` (5.2) + `nav[data-erp=menu]` (5.3). Phần khung trang bỏ |
| `ListFormRenderer` | `section[data-erp=screen]` + `form[data-erp=filter]` + `menu[data-erp=toolbar]` + lưới + `nav[data-erp=pager]` |
| `GridRenderer` | `table[data-erp=grid]` với `th[data-field][data-type]`, giá trị máy, `tfoot` tổng |
| `EditFormRenderer`, `FieldRenderer` | `form[data-erp=record]` + `fieldset[data-erp=tab]` + `div[data-erp=field]` |
| `DetailGridRenderer` | `section[data-erp=tabs]` + lưới sửa trực tiếp + `template[data-erp=row-template]` |
| `ToolbarRenderer` | `menu[data-erp=toolbar]` |
| `CommandPromptRenderer`, `CommandResultRenderer` | `form[data-erp=confirm]` / `section[data-erp=dialog]`, `div[data-erp=messages]` |
| `AdvancedSearchRenderer`, `ColumnConfigRenderer`, `AuditHistoryRenderer` | `section[data-erp=dialog]` chứa form / lưới |
| `AttachmentRenderer`, `ImageGalleryRenderer` | `section[data-erp=attachments]` |
| `ImportExcelRenderer` | Chuỗi `section[data-erp=dialog]`, form `multipart/form-data` |
| `WorkflowPanelRenderer` | `data[data-erp=status]` + nút toolbar + dialog (khi được bật) |
| `NotificationRenderer`, `KanbanFormRenderer` | **Chuẩn chưa có**. Đề xuất bổ sung ở ERP-HTML v1.1 nếu cần |

Tiêu chí nghiệm thu: mọi HTML của BE qua `tools/validate.html` với **0 lỗi**, và hiển thị đúng trong FE như mock.

### 6.2 Bốn điều kiện bắt buộc (cho cả B và C)

1. **Metadata đọc `SY_*` lúc chạy.**
   - Viết `IMetadataProvider` đọc `SY_FrmCfg` / `SY_FrmLstTbl` / `SY_Menu` (xem
     [10-engine-form-dong.md](../legacy-analysis/10-engine-form-dong.md), [30-metadata-menu-form-db.md](../legacy-analysis/30-metadata-menu-form-db.md)).
   - Cache có hạn, nạp lại theo `VDate`.
   - JSON chỉ dùng làm **lớp bổ sung**: những gì WinForms làm trong code mà metadata không có.
2. **Ghi qua SP / hook ERP hiện có.**
   - Payload XML đúng `Db.GetXMLString`.
   - Sinh `UserAutoID`, cấp số chứng từ, cột audit đúng quy tắc.
   - So `DateUpdate` → 409. Kiểm `isLock` ở server.
   - Chỉ giữ một SP `Sys_Web_*` khi có bộ test đối chiếu kết quả với WinForms trên dữ liệu thật.
   - **Đội BE cần gửi mã SQL của cả 179 SP** để thẩm định. Hiện chưa đánh giá được phần quan trọng nhất.
3. **Bảng của web ở schema `web`:**
   - migration đánh số, chạy lại được, có `web.MigrationHistory`;
   - không trigger, không FK sang `dbo`;
   - đổi tên theo QĐ-02, ví dụ `web.UserSetting`, `web.GridLayout`, `web.AuthToken`, `web.AuditLog`.
4. **Kiểm duyệt là quyết định nghiệp vụ mới.**
   - Mặc định **tắt**, để giữ đúng QĐ-03.
   - Muốn bật thì chủ dự án phải ra QĐ mới thay một phần QĐ-03, kèm giải pháp cho phía WinForms. Hiện WinForms không biết
     trạng thái duyệt nên vẫn sửa / hạch toán được.

## 7. Việc cần làm ngay (không phải viết mã)

1. **Đổi mật khẩu SQL** trong `appsettings.Local.json` và **thay khóa Data Protection**:
   - xóa khóa cũ, để hệ thống sinh khóa mới;
   - thu hồi toàn bộ token "nhớ đăng nhập".

   Lý do: gói đã được chia sẻ ra ngoài máy của đội BE.
2. **Đề nghị đội BE gửi gói sạch.** Chỉ mã nguồn, không kèm `bin/`, `obj/`, `.vs/`, `packages/`, `Uploads/`, `App_Data/Keys/`,
   `appsettings.Local.json`. Gửi kèm **mã SQL** của SP `Sys_Web_*` và bảng `Sys_*`.
3. **Họp chốt CQ-06** (đội BE duyệt chuẩn ERP-HTML v1). Dùng bảng 5.1 và bảng ánh xạ 6.1 làm chương trình họp.
4. **Chủ dự án quyết** về kiểm duyệt chứng từ (6.2 mục 4) và chọn phương án B hay C.
5. **Làm thử một màn**: `CS_ReceiptFrm` (Phiếu thu).
   - Màn này có cả trong mock FE và trong metadata của gói, nên so sánh được trực tiếp.
   - Nghiệm thu: validator 0 lỗi, lưu được, WinForms mở lại phiếu vừa lưu thấy đúng.

## 8. Những điều nên học lại từ gói này

- Bẫy culture khi đọc số và ngày (`RenderBase.TryNumber` / `TryDate`): giá trị đã là số thì không `ToString()` rồi parse lại.
- Kiểm quyền mỗi request, không cache chéo request, lỗi thì từ chối.
- Remember-me dạng selector/validator, chỉ lưu hash của validator.
- Nhập Excel nhiều bước, giữ ánh xạ cột khi quay lại bước trước. Nên đưa vào ERP-HTML v1.1 dưới dạng chuỗi dialog.
- Tổng cột tính một lần trên toàn bộ kết quả, không cộng lại theo trang.
- Sau khi thêm hoặc sửa, mở đúng trang chứa bản ghi và bỏ lọc nếu lọc che mất bản ghi vừa tạo (`ListApi.ExecuteSearchAndRender`).
  Đây là trải nghiệm tốt, FE và BE nên giữ.
