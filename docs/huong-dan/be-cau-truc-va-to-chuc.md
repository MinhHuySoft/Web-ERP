# Cấu trúc và tổ chức Backend Web-ERP (cho kỹ thuật và agent)

> **Đọc nhanh:** BE là ASP.NET Core **.NET 10**, viết **C#**, chạy trên IIS của **một VPS Windows** (QĐ-07).
>
> BE làm bốn việc:
> 1. Đọc metadata `SY_*` của từng công ty lúc chạy.
> 2. Chạy nghiệp vụ qua SP / hook ERP hiện có.
> 3. Trả **HTML thô theo chuẩn ERP-HTML** cho FE.
> 4. Không giữ trạng thái form trong RAM.
>
> Tài liệu này là **bản thiết kế thư mục** trước khi viết mã, đã chốt ở **QĐ-08**.
> Repo BE: [`MinhHuySoft/Web-ERP-BE`](https://github.com/MinhHuySoft/Web-ERP-BE). Khi bắt đầu, chép tài liệu này vào repo đó làm
> `docs/cau-truc.md` và rút gọn thành `AGENTS.md`.
>
> - BE trả HTML thế nào: [`be-tra-html-cho-fe.md`](be-tra-html-cho-fe.md). Đặc tả: [`02-chuan-html-erp.md`](../kien-truc/02-chuan-html-erp.md).
> - Quyết định ràng buộc ([`QUYET-DINH.md`](../QUYET-DINH.md)); riêng QĐ-08 chốt chính tài liệu này:
>   - QĐ-01: song song WinForms, ghi giống hệt;
>   - QĐ-02: schema `web`;
>   - QĐ-03: giữ hành vi;
>   - QĐ-06: BE trả HTML;
>   - QĐ-07: 1 VPS, SQLite, cookie.
> - Đường nâng cấp sau này: [`05-phuong-an-du-phong-va-nang-cap.md`](../kien-truc/05-phuong-an-du-phong-va-nang-cap.md). Mục 1 của
>   tài liệu đó liệt kê những việc phải làm ngay từ đầu.
> - Bài học từ BE tham khảo và dự án web trước: [`04-danh-gia-be-tham-khao.md`](../kien-truc/04-danh-gia-be-tham-khao.md),
>   [`60-bai-hoc-du-an-web-truoc.md`](../legacy-analysis/60-bai-hoc-du-an-web-truoc.md).

---

## 1. Nguyên tắc

1. **Repo riêng cho BE:** `MinhHuySoft/Web-ERP-BE` (QĐ-08).
   - Repo này giữ FE, chuẩn ERP-HTML, validator và tài liệu phân tích hệ cũ (QĐ-06).
   - BE lấy FE theo một **tag ghim phiên bản** khi triển khai (mục 7).
2. **Phụ thuộc một chiều, khóa bằng tham chiếu project:**

   ```text
   Host / Admin  ──►  Html, Erp, Config  ──►  Core
   ```

   - `Core` không phụ thuộc gì.
   - `Html` (renderer) **không** được truy cập DB.
   - `Erp` **không** được sinh HTML.
3. **Một công ty = một ngữ cảnh** (`TenantContext`). Mọi cache, truy vấn, job, nhật ký đều mang mã công ty. Thiếu ngữ cảnh thì
   ném lỗi, không tự rơi sang công ty khác.
4. **Không nối chuỗi giá trị vào SQL:**
   - mọi giá trị là tham số (Dapper);
   - SQL lấy từ metadata ERP (lookup, lọc, nút) đi qua `SqlTemplateBinder`, đổi `{Field}` / `'{0}'` thành `@p…`.
5. **Ghi theo đúng hợp đồng WinForms** (QĐ-01.2), qua một đường duy nhất là `SavePipeline`:
   - `UserAutoID`, số chứng từ, cột audit;
   - payload XML cho hook;
   - thứ tự hook, `Msg/MsgType`;
   - `isLock`, `DateUpdate`.

   Không endpoint nào tự `INSERT`/`UPDATE` bảng ERP.
6. **Không trạng thái trong RAM:**
   - phiên là cookie tự chứa;
   - trạng thái form đi trong HTML (`__version`, input ẩn);
   - cache chỉ để tăng tốc, mất cache không sai kết quả.
7. **Bí mật không nằm trong repo hay thư mục site:**
   - chuỗi kết nối của khách ở SQLite (mã hóa);
   - khóa Data Protection và tệp dữ liệu ở thư mục dữ liệu ngoài site (mục 6).
8. **Bất đồng bộ từ đầu đến cuối** (`async`, `CancellationToken`). Có timeout theo từng công ty, để một khách chậm không kéo
   chậm khách khác.

## 2. Bản đồ repo

```text
Web-ERP-BE/
  AGENTS.md                     điểm vào cho agent: đọc gì, lệnh, quy tắc bắt buộc (rút từ tài liệu này)
  README.md                     chạy thử, cấu trúc, liên kết sang repo FE và chuẩn ERP-HTML
  global.json                   ghim SDK .NET 10
  Directory.Build.props         Nullable, ImplicitUsings, TreatWarningsAsErrors, analyzer, phiên bản C#
  Directory.Packages.props      phiên bản NuGet tập trung, mọi project dùng chung
  .editorconfig                 quy ước định dạng C#
  .gitignore                    bin/ obj/ .vs/ *.user, *.db, keys/, files/, appsettings.*.Local.json
  WebErp.slnx

  src/
    WebErp.Core/                lõi thuần C#: mô hình, quy tắc, interface (mục 3.1)
    WebErp.Html/                renderer ERP-HTML (mục 3.2)
    WebErp.Erp/                 truy cập DB ERP của từng công ty: metadata, quyền, truy vấn, lưu, báo cáo (mục 3.3)
    WebErp.Config/              SQLite cấu hình: công ty, domain, chuỗi kết nối, tài khoản quản trị (mục 3.4)
    WebErp.Host/                site cho người dùng ERP: endpoint, middleware, Program.cs (mục 3.5)
    WebErp.Admin/               site quản trị, host riêng (mục 3.6)

  db/
    web/                        migration schema `web` trong DB từng công ty
      001_create_schema_web.sql
      002_command_journal.sql
      003_auth_token_revocation.sql
      …
    config/                     migration SQLite cấu hình
      001_tenants.sql
      …

  tests/
    WebErp.Tests/               unit: Core, Html (snapshot), binder SQL, mật khẩu cũ, UserAutoID, số chứng từ
    WebErp.ContractTests/       HTML do renderer sinh ra phải qua validator ERP-HTML: 0 lỗi (mục 8)
    WebErp.IntegrationTests/    chạy trên DB test (không phải DB khách): lưu / xóa / hook, đối chiếu kết quả với WinForms

  deploy/
    publish.ps1                 dotnet publish → thư mục tạm, kèm FE theo tag
    deploy.ps1                  app_offline.htm → chép → bỏ app_offline.htm → gọi /health
    backup.ps1                  VACUUM INTO bản chụp SQLite + khóa → chép ra ngoài VPS (chạy bằng Task Scheduler)
    web.config.template         cấu hình IIS (giới hạn request, header bảo mật)
    README.md                   cài IIS, app pool, quyền NTFS, chứng chỉ, Task Scheduler

  docs/
    cau-truc.md                 bản chép của tài liệu này, cập nhật theo mã thật
    van-hanh.md                 runbook: cập nhật, sao lưu, khôi phục, đổi khóa, thêm khách hàng
    doi-chieu-winforms.md       danh sách hành vi đã đối chiếu, có test tương ứng
```

## 3. Từng project

### 3.1 `WebErp.Core`: lõi, không phụ thuộc ASP.NET hay SQL

```text
WebErp.Core/
  Tenancy/        TenantId, TenantContext, ITenantStore (đọc cấu hình), TenantNotFoundException
  Auth/           ErpUser, LegacyPasswordVerifier (MD5 + muối, viết lại từ mã dịch ngược), IRevocationStore
  Metadata/       mô hình đã biên dịch: ScreenMeta, FieldMeta, GridMeta, ToolbarMeta, LookupMeta, ReportMeta
  Messages/       ErpMessage, MsgType (giao thức Msg/MsgType), SaveOutcome (Saved / Blocked / Confirm / Conflict)
  Numbering/      UserAutoId (yyMMddHHmmss + ms×2 + ngẫu nhiên), DocumentMask (DPR/DMK/DFP/DW2/DW3)
  Formula/        bộ đánh giá công thức cột (cùng bộ test với FE nếu FE có)
  Formatting/     InvariantValue: số dấu chấm, ngày ISO, true/false (chuẩn mục 2.5)
  Abstractions/   IClock, ICommandJournal, IJobLease
```

- **Quy tắc:** chỉ có mô hình và hàm thuần. Không `HttpContext`, không `SqlConnection`.
- Đây là nơi viết test kỹ nhất, vì sai ở đây là ghi lệch so với WinForms.

### 3.2 `WebErp.Html`: renderer ERP-HTML

```text
WebErp.Html/
  HtmlWriter.cs           ghi thẻ; mọi giá trị động tự encode; không có API ghi `class`, `style`, `on*`
  Roles/                  mỗi vai trò data-erp một renderer, tên file = <Vai trò>Renderer.cs
    LoginRenderer.cs        form[data-erp=login] (ô chọn công ty khi domain có nhiều công ty)
    SessionRenderer.cs      section[data-erp=session]
    MenuRenderer.cs         nav[data-erp=menu]
    ScreenRenderer.cs       section[data-erp=screen]
    ToolbarRenderer.cs      menu[data-erp=toolbar]
    FilterRenderer.cs       form[data-erp=filter]
    RecordRenderer.cs       form[data-erp=record] + fieldset[data-erp=tab]
    FieldRenderer.cs        div[data-erp=field] theo data-control
    GridRenderer.cs         table[data-erp=grid], template[data-erp=row-template]
    PagerRenderer.cs        nav[data-erp=pager]
    TabsRenderer.cs         section[data-erp=tabs] / tab-panel
    MessagesRenderer.cs     div[data-erp=messages]
    ConfirmRenderer.cs      form[data-erp=confirm]
    DialogRenderer.cs       section[data-erp=dialog]
    LookupResultRenderer.cs table[data-erp=lookup-result]
    AttachmentsRenderer.cs  section[data-erp=attachments]
    ReportRenderer.cs       section[data-erp=report-result]
  Screens/                ghép vai trò thành màn: ListScreen, EditScreen, ReportScreen, DashboardScreen
  Antiforgery/            IAntiforgeryField: input ẩn token, do Host cung cấp
```

- **Quy tắc:** đầu vào là metadata đã biên dịch, dữ liệu và quyền đã tính; đầu ra là chuỗi HTML.
- Renderer không truy vấn DB và không quyết quyền.
- Cột bị ẩn vì quyền (`HideAmount`) đã bị loại ở `Erp` trước khi tới đây.
- Tên file và tên lớp theo vai trò `data-erp`. Đọc đặc tả mục nào thì mở đúng renderer đó.

### 3.3 `WebErp.Erp`: DB ERP của từng công ty

```text
WebErp.Erp/
  Connection/     ErpConnectionFactory: mở kết nối theo TenantContext, timeout theo công ty, async
  Metadata/       đọc SY_Menu, SY_FrmLstTbl, SY_FrmCfg (LYT, GD2, HDE…), SY_FrmDrdwTbl, SY_FrmOptBtnTbl
                  MetadataCompiler: SY_* → ScreenMeta
                  MetadataCache: theo công ty, nạp lại theo VDate
                  Overrides/: JSON bổ sung cho những gì WinForms làm trong code mà metadata không có
  Security/       PermissionReader (SY_UserGroupPermisstion, SY_UserPermisstion, ủy quyền), BranchScope, HideAmount
  Query/          ListQuery, LookupQuery, SqlTemplateBinder ({Field} → @p), tổng nhóm / footer
  Save/           SavePipeline: một transaction
                    ConflictCheck: DateUpdate → 409
                    LockCheck: isLock, khóa sổ
                    DocumentNumberer: GetDocumentID + SY_DocSetup, thử lại khi trùng
                    XmlPayloadBuilder: định dạng Db.GetXMLString
                    HookRunner: thứ tự hook, đọc Msg/MsgType, @@ROWCOUNT ngay sau lệnh (trigger)
                    CommandJournal: web.CommandJournal, khóa __idem, cùng transaction
  Actions/        nút tùy biến (SY_FrmOptBtnTbl / *ButtonCtl), tham số người dùng nhập
  Reports/        ReportRunner: *ReportStp → dữ liệu cho ReportRenderer / Excel
  Logging/        UserLogWriter: SY_UserLog / SY_UserLogDetail, ComputerName = 'WEB (<ip>)'
  WebSchema/      Migrator: chạy db/web/*.sql, ghi web.MigrationHistory; RevocationStore, AuthTokenStore
  Jobs/           JobLease: sp_getapplock trong DB công ty
  Sql/            các câu SQL dài để thành tệp .sql (embedded resource) cạnh lớp dùng nó
```

- **Quy tắc:** mọi thứ ghi vào bảng ERP đi qua `Save/` hoặc `Actions/`, và các đường này đều gọi SP / hook ERP.
- Thư mục `Save/` là nơi cần review kỹ nhất. Mỗi quy tắc ở đây phải có test đối chiếu trong `WebErp.IntegrationTests` và một
  dòng trong `docs/doi-chieu-winforms.md`.

### 3.4 `WebErp.Config`: SQLite cấu hình

```text
WebErp.Config/
  SqliteTenantStore.cs    ITenantStore: domain → công ty → chuỗi kết nối; cache trong bộ nhớ, nạp lại khi đổi
  SecretProtector.cs      mã hóa / giải mã chuỗi kết nối bằng Data Protection
  AdminAccountStore.cs    tài khoản quản trị: PBKDF2/Argon2, khóa TOTP
  AdminAuditLog.cs        nhật ký thao tác quản trị: trước/sau, che mật khẩu
  CompanyLogoutMark.cs    mốc "đăng xuất cả công ty"
  Migrations/             chạy db/config/*.sql
```

- **Quy tắc:**
  - journal kiểu DELETE (không WAL, để Host chỉ cần quyền đọc tệp), `busy_timeout`;
  - lúc chạy gần như chỉ đọc;
  - SQL đơn giản để sau này chuyển sang SQL Server (tài liệu 05, bậc 3) chỉ phải viết lại project này.

### 3.5 `WebErp.Host`: site cho người dùng ERP

```text
WebErp.Host/
  Program.cs              ghép DI, middleware, endpoint. Mỏng: không có nghiệp vụ
  Endpoints/              mỗi nhóm URL một tệp, khớp bảng endpoint của be-tra-html-cho-fe.md mục 3
    AuthEndpoints.cs        /erp/login, /erp/logout
    SessionEndpoints.cs     /erp/session
    MenuEndpoints.cs        /erp/menu
    HomeEndpoints.cs        /erp/home
    ScreenEndpoints.cs      /erp/screens/{FormName}[/{key}[/edit|/save|/delete|/actions/{tên}|/tabs/{id}]]
    LookupEndpoints.cs      /erp/lookups/{nguồn}
    ReportEndpoints.cs      /erp/reports/{FormName}
    FileEndpoints.cs        tải đính kèm có kiểm quyền (không phục vụ tệp tĩnh công khai)
    HealthEndpoints.cs      /health
  Middleware/
    TenantResolution.cs     Host → TenantContext. Không có cấu hình thì trả lỗi, không rơi sang công ty khác
    ContractHeaders.cs      đọc X-ERP-Request / X-ERP-Contract, ghi X-ERP-Title
    ErrorToErpHtml.cs       exception → mã 4xx/5xx + div[data-erp=messages]; không lộ chi tiết nội bộ
    ConcurrencyLimit.cs     giới hạn request đồng thời theo công ty
  Auth/                   cookie tự chứa, kiểm thu hồi (cache 30–60 giây), mốc đăng xuất công ty, khóa nhập sai
  Binding/                đọc form ERP-HTML: T1[i].__key/__state/<cột>, __selected, __confirm/__answer, __idem
  appsettings.json        chỉ đường dẫn, timeout, giới hạn. Không có bí mật
```

- **Quy tắc:** một endpoint chỉ làm 4 bước:
  1. lấy ngữ cảnh;
  2. gọi `Erp`;
  3. gọi `Html`;
  4. trả kết quả (`200` / `303` / `409` / `422`).

  Thấy endpoint dài quá khoảng 40 dòng là dấu hiệu nghiệp vụ đang lọt vào `Host`.

### 3.6 `WebErp.Admin`: site quản trị

```text
WebErp.Admin/
  Program.cs              chỉ nhận host quản trị (admin.<domain>)
  Endpoints/              công ty, domain, chuỗi kết nối (chỉ ghi), "Thử kết nối" (kèm ms), bảo trì theo công ty,
                          đăng xuất cả công ty, nhật ký
  Auth/                   tài khoản riêng (không dùng SY_User), TOTP, khóa nhập sai, phiên ngắn, SameSite=Strict
```

- Trả ERP-HTML qua `WebErp.Html`, nên dùng lại FE của dự án, kể cả giao diện điện thoại.
- **Chạy thành site IIS riêng, app pool riêng.** Chỉ app pool của Admin được ghi tệp SQLite. App pool của Host chỉ đọc. Như vậy
  site người dùng có bị chiếm thì cũng không sửa được chuỗi kết nối.
- Tài khoản quản trị đầu tiên tạo bằng dòng lệnh trên VPS, không tạo qua web.

## 4. Luồng một request

**Mở màn danh sách** `GET /erp/screens/AR_InvoiceFrm?DocumentDate=…`:

```text
TenantResolution (host → công ty)
  → Auth (cookie: user, công ty khớp; thu hồi)
  → ScreenEndpoints.List
      → Erp.MetadataCache.Get(công ty, "AR_InvoiceFrm")
      → Erp.Security: quyền xem, chi nhánh, cột ẩn
      → Erp.Query.ListQuery (Dapper, tham số)
      → Html.Screens.ListScreen(meta, dòng, quyền)
  → 200 text/html
```

**Lưu chứng từ** `POST /erp/screens/AR_InvoiceFrm/{key}/save`:

```text
Antiforgery
  → Binding (header, T1[i]…, __version, __idem)
  → Erp.Save.SavePipeline, trong một transaction:
      CommandJournal (__idem đã có → trả kết quả cũ)
      → LockCheck → ConflictCheck → DocumentNumberer / UserAutoID
      → XmlPayloadBuilder → HookRunner (Msg/MsgType)
      → UserLogWriter
  → Saved:    303 về GET bản ghi
    Blocked:  422 + screen + messages
    Confirm:  200 + form[data-erp=confirm]
    Conflict: 409 + messages
```

## 5. Quy ước đặt tên

| Thứ | Quy ước | Ví dụ |
|---|---|---|
| Namespace | Trùng đường dẫn thư mục | `WebErp.Erp.Save` |
| Tệp | Một lớp public một tệp, tên tệp = tên lớp | `SavePipeline.cs` |
| Renderer | `<Vai trò data-erp>Renderer` | `GridRenderer` |
| Endpoint | `<Nhóm URL>Endpoints`, dùng `MapGroup` | `ScreenEndpoints` |
| Lớp đọc bảng ERP | `<Bảng không tiền tố>Reader` | `FrmCfgReader` cho `SY_FrmCfg` |
| Tên trường, mã màn | Giữ đúng tên cột / `FormName` ERP, không dịch, không đổi kiểu chữ | `ObjectID`, `CS_ReceiptFrm` |
| SQL dài | Tệp `.sql` cạnh lớp, nhúng làm resource | `Metadata/Sql/ReadFrmCfg.sql` |
| Migration | Số 3 chữ số + mô tả, chỉ thêm, không sửa tệp đã chạy | `004_saved_filter.sql` |
| Test | `<Lớp>Tests`, tên hàm mô tả hành vi | `SavePipelineTests.Conflict_when_DateUpdate_changed` |
| Chú thích, thông điệp | Tiếng Việt; tên trong mã là tiếng Anh, trừ tên ERP | `// Giữ lỗi làm tròn như WinForms (QĐ-03)` |

## 6. Bố cục trên VPS

Thư mục site bị thay mỗi lần triển khai, nên **dữ liệu không bao giờ nằm trong thư mục site**.

```text
D:\WebErp\
  sites\
    app\          bản publish của WebErp.Host + wwwroot\ (FE theo tag)  → site IIS "WebErp", host *.domain khách
    admin\        bản publish của WebErp.Admin                         → site IIS "WebErpAdmin", host admin.<domain>
  data\
    config.db     SQLite cấu hình (Admin: đọc/ghi; Host: chỉ đọc)
  keys\           khóa Data Protection (bọc bằng chứng chỉ .pfx; bản .pfx cất ngoài VPS)
  files\          tệp đính kèm, ảnh: theo công ty, tên GUID; chỉ tải qua FileEndpoints
  logs\
  backup\         bản chụp chờ chép ra ngoài VPS
  staging\        gói cài chờ triển khai
```

- Quyền NTFS: mỗi app pool chỉ có quyền trên thư mục nó cần.
- DB của công ty phát triển nằm trên VPS này, BE nối bằng Windows Authentication (QĐ-07, bổ sung 2026-11-11).

## 7. FE đi kèm BE thế nào

- FE (`web/` của repo này) được phục vụ **cùng origin** với BE:
  - FE ở `/`;
  - endpoint BE ở `/erp/…`;
  - cookie và CSRF không phải xử lý khác origin.
- Lúc publish, script chép `web/` từ **một tag của repo FE** vào `wwwroot\`, rồi ghi `config.js` cho môi trường thật
  (4 điểm vào: `/erp/login`, `/erp/session`, `/erp/menu`, `/erp/home`).
- `web/mock/` và `web/tools/` không đưa lên máy thật.
- Đổi cách FE và BE trao đổi thì sửa ở repo FE trước (đặc tả + hướng dẫn BE + validator, theo `AGENTS.md`), gắn tag mới, rồi BE
  mới làm theo.

## 8. Kiểm tra

| Lớp | Kiểm gì | Khi nào |
|---|---|---|
| `WebErp.Tests` | Hàm thuần ở `Core`; renderer so với snapshot HTML; `SqlTemplateBinder` không để lọt giá trị vào SQL | Mỗi lần build |
| `WebErp.ContractTests` | Mọi loại màn do renderer sinh ra phải qua `validate.js` của repo FE (cùng tag): **0 lỗi**. Chạy bằng trình duyệt không giao diện (ví dụ Playwright cho .NET), vì validator nhận một `Document` | Mỗi lần build |
| `WebErp.IntegrationTests` | Lưu / xóa / nút / hook trên DB test. So dữ liệu web ghi với dữ liệu WinForms ghi cho cùng thao tác | Trước khi merge phần `Erp/Save`, `Erp/Actions` |
| Thủ công | Mở màn trong FE thật, so với mock tương ứng (`be-tra-html-cho-fe.md` mục 11) | Mỗi màn mới |

**Không bao giờ** chạy test trên DB khách hàng (`AGENTS.md`, `SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md`).

## 9. Muốn làm X thì sửa ở đâu

| Việc | Sửa ở |
|---|---|
| Thêm vai trò / thuộc tính ERP-HTML | Repo FE (đặc tả, hướng dẫn, validator) → `Html/Roles/<Vai trò>Renderer.cs` → snapshot |
| Màn hiển thị sai bố cục / thiếu ô | `Erp/Metadata/MetadataCompiler` (đọc LYT, GD2…) rồi `Html/Roles/FieldRenderer` |
| Lưu ra dữ liệu khác WinForms | `Erp/Save/*`, kèm test đối chiếu và một dòng trong `docs/doi-chieu-winforms.md` |
| Thêm nút tùy biến | `Erp/Actions` + `ScreenEndpoints` (URL `…/actions/{tên}`) |
| Thêm khách hàng | Trang quản trị, không sửa mã. Kết nối theo QĐ-07 bổ sung 2026-11-11, mục 3 |
| Thêm bảng cho web | `db/web/NNN_*.sql` (schema `web`, không trigger, không FK sang `dbo`) |
| Đổi hành vi riêng một màn | `Erp/Metadata/Overrides/<FormName>.json`. Không rẽ nhánh theo tên màn trong renderer |

## 10. Bắt đầu từ đâu (lát cắt đầu tiên)

1. Tạo solution theo mục 2. Có `Core`, `Html`, `Host`; có `/health`, `TenantResolution` đọc SQLite.
2. Đăng nhập (`LoginRenderer`, `LegacyPasswordVerifier`, cookie), rồi `/erp/session` và `/erp/menu` từ `SY_Menu`.
3. Một màn danh sách và một chứng từ: `CS_ReceiptFrm` (Phiếu thu). Màn này có sẵn trong mock FE để so.
   - Xem và lọc trước.
   - Lưu qua `SavePipeline` sau, kèm test đối chiếu.
4. `WebErp.ContractTests` chạy được trước khi làm màn thứ hai.
5. `WebErp.Admin` tối thiểu: thêm công ty, domain, chuỗi kết nối, "Thử kết nối".
