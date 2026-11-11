# 60 — Bài học từ các dự án web trước (Medcom ERP → Web, Mak Nông Dân)

Ngày khảo sát: 2026-11-11. Chế độ: **chỉ đọc** — không build, không `npm install`, không `git fetch`, không kết nối DB hay mạng,
không chép mật khẩu, chuỗi kết nối, token hay appsettings bí mật. Nên đọc trước:
`D:\Data\Web-ERP\docs\legacy-analysis\00-nguon-du-lieu.md`.

Quy ước trong tài liệu:
- **ERP** = ERP.NET WinForms (`ERP.NET.exe` + `Tools.dll`, metadata `SY_*`).
- **Medcom-Web** = dự án chuyển ERP Medcom (DB `MedData`) lên web.
- **MN** = `D:\Data\Medcom\Medcom` (bản mới nhất, xem 1.1). **MW** = `D:\Data\Medcom\ERP_Medcom2026\work\Medcom`.
  Các đường dẫn con giống nhau ở hai bản, trừ khi ghi khác.
- Số liệu đếm bằng `git log`, `wc -l` và `find` trên bản sao cục bộ ngày 11/11/2026.

---

## 0. Tóm tắt — các bài học quan trọng nhất

1. **Quy trình "evidence" quá nặng là nguyên nhân chậm số 1 của Medcom-Web.** 3 ngày đầu (29/09–01/10) chỉ có tài liệu: hơn 110
   commit, kế hoạch 10 "lane" chạy theo lịch, cơ chế lease/fence/custody. Dòng mã đầu tiên có ngày 02/10, nhưng ghi dữ liệu thật thì
   đến 10/10 mới có. Khi chủ dự án ép "làm cho chạy", ngày 10/10 đã có 6–7 màn ghi thật, ngày 11/10 thêm 12 module. Tài liệu
   (351 file, ≈23.000 dòng md, cộng 15 MB inventory JSON) nhiều hơn cả mã backend (≈20.000 dòng C#).
2. **Medcom-Web không có renderer động.** Họ chụp metadata ERP thành JSON, **nhúng vào binary**, rồi viết tay từng module: điều kiện
   lọc danh sách, tên SP của từng nút, tiền tố số chứng từ, tiêu đề màn, nhóm trường chi tiết. Sau 5 tuần có **25 màn**, trong khi
   ERP Medcom có 482 menu và 287 form metadata. Cách làm này gắn chặt vào Medcom, không dùng lại được cho 18 khách hàng.
3. **Ghi dữ liệu phải đi qua đúng SP/hook mà ERP cấu hình.** Bản đầu tự `INSERT/UPDATE` nên lệch logic ERP: PO thiếu
   `SourceAmount/Amount/BaseTotal`, bỏ qua kiểm tra quyền và trạng thái. Đến 25/10 họ phải chuyển sang gọi đúng SP của ERP.
4. **Metadata và SQL của ERP thay đổi hằng tuần**, do chính đội triển khai sửa trên DB thật. Khóa cứng bằng fingerprint làm web không
   ghi được, nên đã bỏ ngày 15/10. Họ thay bằng **bộ theo dõi lệch cấu hình**: chỉ báo, không chặn.
5. **Mật khẩu ERP** là MD5 có muối ngẫu nhiên chèn vào chuỗi băm (`Tools/MD5.cs`). Medcom nạp `Tools.dll` bằng reflection, ghim theo
   SHA-256 từng bản build và dùng offset của chuỗi đã obfuscate, nên mỗi lần ERP build lại là hỏng. Web-ERP nên **viết lại hàm Verify**
   từ mã đã dịch ngược, có test bằng hash thật, và **không bao giờ** hỗ trợ "mật khẩu hệ thống" theo ngày.
6. **Phiên đăng nhập trên IIS**: phải lưu phiên và khóa Data Protection bền vững, và phân biệt lỗi tạm thời (503) với bị từ chối (401).
   Medcom mất 6 PR trong một ngày (UX-09a→f) mới giữ được đăng nhập qua các lần deploy hoặc khi IIS tự tái chế tiến trình.
7. **Hiệu năng**: mỗi request xác thực lại toàn bộ với DB, và mọi lần đọc đều trong transaction `SERIALIZABLE` + `HOLDLOCK`. Kết quả
   API trung vị 1,3–1,5 giây trên VPS. Cấp số chứng từ dùng `TABLOCKX` trên bảng header, có rủi ro chặn người dùng WinForms.
8. **UI bị dựng lại ít nhất 3 lần**: `src/frontend` → shell "classic" shadcn → `MedcomApp` theo Untitled UI. Sau đó lại 2 đợt thống
   nhất (ui-sync, P2). Hai shell và hai họ API tồn tại song song. Có cả chức năng giả do AI sinh (nút duyệt chỉ đổi state cục bộ,
   danh sách chi nhánh hardcode).
9. **Mak** là ví dụ tốt về vận hành đơn giản: tenant theo tên miền (`AsyncLocal`), mỗi công ty một DB, migration đánh số chạy lại
   được, script kiểm tra sẵn sàng chặn deploy khi thiếu migration, `CAP-NHAT.cmd` + CD bằng Task Scheduler. Nhưng Mak có một ngoại
   lệ không được sao chép: **ghi mật khẩu nguyên văn** vào bảng log.
10. **Nên tái dùng** từ Medcom-Web (viết lại cho gọn, không chép nguyên): bộ bind SQL dropdown an toàn, CTE quyền `SY_*`, quy tắc chi
    nhánh, token trạng thái + idempotency, mẹo `@@ROWCOUNT` khi có trigger, bộ theo dõi lệch cấu hình, các component UI mobile-first,
    và hàm định dạng tiền dạng chuỗi thập phân.

---

## 1. Nguồn đã đọc

| Nguồn | Đường dẫn | Ghi chú |
|---|---|---|
| Medcom-Web (bản mới nhất) | `D:\Data\Medcom\Medcom` | 725 commit, PR #1→#260, 29/09→03/11/2026 |
| Medcom-Web (bản làm việc) | `D:\Data\Medcom\ERP_Medcom2026\work\Medcom` | 707 commit, dừng ở PR #240 (30/10) + nhánh `codex/docs-*` |
| Tài liệu kỹ thuật ERP Medcom | `D:\Data\Medcom\TechnicalDocs` | 23 gói thay đổi / kiểm tra trên MedData |
| Sản phẩm bàn giao | `D:\Data\Medcom\outputs` | Báo cáo Word/Excel/PDF, sơ đồ quy trình |
| Mak Nông Dân (tách gọn) | `D:\Data\Mak\MakMain` | 27 commit, 05/11→10/11/2026 |
| Mak-Group (bản gốc) | `D:\Data\Mak\Mak-Group` | 952 commit, 30/09→05/11/2026 |
| CodeForge-AI | `D:\Data\Individual\CodeForge-AI\docs` | Không liên quan (mục 5) |
| SmartHome | `D:\Data\SmartHome\Tai lieu ky thuat.md` | Không liên quan (mục 5) |

### 1.1 Lưu ý phiên bản Medcom (sửa thông tin trong 00)

`00-nguon-du-lieu.md` ghi bản `ERP_Medcom2026\work\Medcom` là bản mới hơn. Điều này **không còn đúng**: bản `D:\Data\Medcom\Medcom`
vừa được fast-forward (`git reflog`: `merge origin/main: Fast-forward`, 2026-11-11 09:50 +07:00) từ #151 lên #260. Việc này do một
tiến trình khác thực hiện trong lúc khảo sát, không phải tác giả tài liệu này. Từ #241 đến #260 (30/10–03/11) có: sửa các bước đợt
điều chuyển, nén ảnh trước khi tải lên vì giới hạn 1 MB của IIS (#256–#257), manifest PWA (#258), khóa zoom trên iOS (#259–#260)
và help trong từng màn (#246).

---

## 2. Medcom ERP → Web

### 2.1 Quy mô và dòng thời gian

| Giai đoạn | Thời gian | Nội dung chính | Kết quả dùng được |
|---|---|---|---|
| Phase 1 "khảo cổ" | 29/09–01/10 | ≈114 commit chỉ tài liệu: inventory ERP/DB, UX contract, red-team, kế hoạch 10 lane và 31 issue | 0 dòng mã |
| Bật/tắt lịch tự động | 02/10 | Bật 10 lịch hằng giờ rồi tắt cả 10, chuyển sang một người ghi duy nhất (`docs/execution/DIRECT_EXECUTION_20261002.md`) | Nền .NET 10 (commit `f1b077b`) |
| Increment I01–I66 | 02/10–09/10 | Phiên làm việc, password worker, pilot chỉ đọc PR/nhập kho, TLS loopback, BFF, test "custody/fence"; ngày 06/10 có 95 commit | 2–3 màn chỉ đọc |
| Bứt tốc | 09/10–11/10 | Đủ trường, lệnh cho 6 màn, ghi SQL thật (#132), thêm 12 module (#143), thông báo, chuẩn response v3 | 19 module có CRUD/quy trình |
| Dev người làm form | 12/10–19/10 | Form PR/PO/đơn bán, sidebar, bảng; bỏ fingerprint (15/10); tối ưu đọc (16/10); ảnh đính kèm | Form dùng được |
| Help | 22/10–23/10 | `src\helps` (HDSD + TLKT tĩnh) | Trung tâm tài liệu |
| Thống nhất UI | 23/10–24/10 | ui-sync (chi tiết chứng từ theo config), P2 (bộ component chung) qua phiếu Codex | UI đồng bộ |
| Vận hành thật | 24/10–03/11 | Giữ phiên (UX-09), khớp quy trình với SP ERP, trigger, bộ theo dõi lệch, 6 màn nhập hàng, chứng từ chi phí, ảnh, PWA | 25 màn |

Quy mô mã (MN, 11/11):
- Backend ≈20.000 dòng C#: Api 5,4k, Application 2,3k, Contracts 1,8k, Infrastructure 10,5k, LegacyPasswordWorker 64 dòng.
- Test C# ≈25.000 dòng. Ngày 16/10 có 3.568 test pass. API công bố 276 operation và 1.209 schema
  (`D:\Data\Medcom\Medcom\docs\backend\medcom-openapi.json`).
- Frontend ≈30.000 dòng TS/TSX (`apps\medcom-sites`), khoảng 80 file test.
- Tài liệu: `docs\` có 351 file (≈23.000 dòng md); `inventories\` có 88 file (15 MB); `preparations\` có 124 file.
  Riêng `docs\execution\` có 171 file checkpoint.

Nhân sự: phần lớn commit là của một người (≈660) cùng agent (Codex, Antigravity, "Medcom Leader"). Hai dev frontend tham gia 12–19/10.

### 2.2 Kiến trúc và stack

Nguồn: `D:\Data\Medcom\Medcom\docs\architecture\PHASE2_TECH_STACK.md`, `D:\Data\Medcom\Medcom\src\backend\README.md`.

- **Backend**: ASP.NET Core .NET 10 (SDK 10.0.401 trong `global.json`), Minimal API, ADO.NET thuần qua `Microsoft.Data.SqlClient`
  (không EF, không Dapper), Swagger UI. Có 5 project:
  - `Medcom.Api`: endpoint, phiên, CSRF, Swagger.
  - `Medcom.Application`: quy tắc, interface `IErpScreenService`.
  - `Medcom.Contracts`: DTO, catalog JSON nhúng.
  - `Medcom.Infrastructure`: SQL.
  - `Medcom.LegacyPasswordWorker`: tiến trình riêng kiểm mật khẩu.
- **Họ API chung** `/api/erp/{module}/...` (`D:\Data\Medcom\Medcom\src\backend\Medcom.Api\ErpScreenEndpoints.cs`):
  - Đọc: `screen`, danh sách, `status-counts`, `detail`, `actions`, `contract-info`, `options` (dropdown).
  - Ghi: `selection`, `paste/validate`, `create`, `save`, `delete`, `sections/{x}/save`, `actions/{action}`, `qr/add|delete`,
    `commands/lookup` (tra lại kết quả lệnh), `item-price`, `attachments/*`.
  - Song song vẫn còn họ API cũ, viết riêng cho đề nghị mua và nhập kho (`PurchaseRequestEndpoints.cs`, `InboundDraftEndpoints.cs`,
    `/api/documents`). Hai họ API **đặt tên khóa JSON khác nhau**, gây lỗi lặp lại ở phiếu T-003/T-005
    (`D:\Data\Medcom\Medcom\docs\tasks\T-005.md`).
- **Frontend**: Next.js 16 (standalone), React 19, Tailwind 4, shadcn/Radix + `@base-ui`, TanStack Query/Table/Virtual, cmdk,
  react-hook-form + zod, sonner, jsqr (`D:\Data\Medcom\Medcom\apps\medcom-sites\package.json`).
  - Route `app\api\erp\[...path]\route.ts` là **BFF proxy** có allowlist endpoint (`lib\erp\proxy-policy.ts`, `lib\erp\proxy.ts`).
    BFF kiểm Origin/Sec-Fetch-Site, chuyển cookie/CSRF và chặn query lạ.
  - Toàn ứng dụng là một trang (`app\page.tsx`) với 2 shell: `MedcomApp` (mặc định) và `components\erp\workspace.tsx`
    (classic, mở bằng `?view=classic`).
- **Nguyên tắc tốt đã ghi** (`D:\Data\Medcom\Medcom\docs\WEB_MIGRATION_PRINCIPLES.md`):
  - Server là nơi quyết định quyền.
  - Không có API "CRUD bảng" chung.
  - SQL/công thức trong metadata không bao giờ gửi xuống trình duyệt.
  - Realtime theo nhu cầu, vì WinForms ghi DB không phát sự kiện. SignalR có trong kế hoạch nhưng chưa làm.

### 2.3 Triển khai (Windows / IIS)

Nguồn: `D:\Data\Medcom\Medcom\docs\deployment\SELF_HOSTED_IIS.md`, `WINDOWS_UPDATE_WORKFLOW.md`,
`D:\Data\Medcom\Medcom\deploy-production.ps1`, `docs\deploy\RAILWAY_*.md`.

- Ban đầu chạy staging trên Railway (container Linux). Sau chuyển sang **VPS Windows + IIS**, cùng máy với 5 site IIS có sẵn.
- Topology:
  - Trình duyệt → site IIS frontend (ARR + URL Rewrite) → Node 24 chạy Next standalone ở `127.0.0.1:<port>`, đăng ký thành Windows
    service.
  - BFF → site IIS API riêng, app pool riêng, ASP.NET Core Module V2 **in-process**.
  - BFF↔API bắt buộc HTTPS thật, kể cả khi hai bên cùng máy.
  - Phải giữ đúng giới hạn request 1 MB của IIS. Đây là lý do phải nén ảnh ở client (#256–#257).
- Tài liệu triển khai rất dài, có nhiều "cổng duyệt của operator". Thực tế `deploy-production.ps1` chỉ làm 6 bước: dừng app pool +
  service Node → chép bản build → giữ manifest → khởi động lại. Tài liệu không phản ánh cách triển khai thật.
- Bài học IIS:
  - App pool có thể không nạp profile, nên `%LOCALAPPDATA%` không ghi được.
  - IIS tắt tiến trình khi rảnh. Trong 20 phút đầu, lần gọi đầu tiên chậm (Mak đo được khoảng 3 giây).
  - Khóa Data Protection phải được lưu bền và mã hóa bằng DPAPI phạm vi máy (`D:\Data\Medcom\Medcom\docs\tasks\UX-09.md`).
- Trang help tĩnh được deploy thành 2 IIS Application (`/HDSD-ERP`, `/TLKT`) bằng một script PowerShell
  (`D:\Data\Medcom\TechnicalDocs\iis-help-deployment-20261022\HUONG-DAN-IIS.md`).

### 2.4 Xác thực với tài khoản ERP cũ

Nguồn:
- `D:\Data\Medcom\Medcom\src\backend\Medcom.LegacyPasswordWorker\Program.cs`
- `D:\Data\Medcom\Medcom\src\backend\Medcom.Infrastructure\LegacyPasswordVerifier.cs`, `LegacyIdentityAuthority.cs`,
  `SqlLegacyUserStore.cs`
- `D:\Data\Medcom\Medcom\docs\erp\TOOL_DLL_METADATA_EVIDENCE.md`

- Họ **có dùng `Tools.dll`, nhưng chỉ cho việc kiểm mật khẩu**:
  - Mỗi lần đăng nhập chạy một tiến trình con.
  - Tiến trình con đọc DLL, tính SHA-256 và so với danh sách 2 bản build được duyệt.
  - Nạp assembly bằng reflection, lấy chuỗi nối từ bộ giải mã chuỗi obfuscate theo **tên lớp/hàm ngẫu nhiên và offset riêng của từng
    build**, rồi gọi `Tools.MD5.Verify(USER + chuỗi_nối + pass, hash)`.
  - Kết quả trả về chỉ là `accepted/rejected/unavailable`.
  - Không gọi Connector, không gọi `VerifyUserPassSystem`.
- Thuật toán thật (mã đã dịch ngược `D:\Data\Web-ERP\.legacy\decompiled\Tools\Tools\MD5.cs`):
  - Lấy MD5 của `UPPER(user) + <hằng nối cố định> + pass + <4 chữ số muối>`, đổi ra hex.
  - Muối 4 chữ số được chèn vào vị trí ngẫu nhiên trong chuỗi hex; vị trí này được ghi thêm (2 chữ số) tại offset 3.
  - Đây là hàm thuần (≈30 dòng), **viết lại native được**. Không ghi hằng nối vào tài liệu này; xem file nguồn.
- `VerifyUserPassSystem` là "mật khẩu hệ thống" sinh theo ngày, cho tài khoản Admin và một số tên máy của nhà phát triển. Đây là
  **cửa hậu**: Medcom chủ động không hỗ trợ, Web-ERP cũng không được hỗ trợ.
- Sau khi đăng nhập:
  - Phiên do server giữ: cookie HttpOnly/Secure/SameSite, CSRF cho POST, 24 giờ không hoạt động, tối đa 7 ngày.
  - Mỗi request xác thực lại với `SY_User` qua "credential stamp" (hàm băm của bản ghi người dùng). Đổi mật khẩu, khóa tài khoản
    hoặc đổi nhóm thì bị đăng xuất ngay.
- Các bài học UX-09 (`D:\Data\Medcom\Medcom\docs\tasks\UX-09.md`):
  - (a) Bảng phiên chỉ nằm trong bộ nhớ nên deploy là mất. Đã chuyển sang file JSON chỉ chứa SHA-256 của token.
  - (c) Cookie tạm cộng với khóa Data Protection không bền làm cookie không đọc được sau khi khởi động lại.
  - (d) Bộ đếm `AuthorityVersion` khởi động lại từ 0 nên phiên được khôi phục bị coi là "cũ hơn".
  - (e) IIS không ghi được `%LOCALAPPDATA%`.
  - (f) **Một lần ERP/SQL chậm hoặc lỗi tạm làm xóa phiên.** Đã sửa: trả 503 `identity_unavailable` và giữ phiên; chỉ 401 mới
    đăng xuất.
- Đã bỏ việc lưu mật khẩu trong trình duyệt (#189, `fix(auth): stop storing passwords in the browser`).

### 2.5 Đa khách hàng / đa DB

- **Kế hoạch có, triển khai không.** `PHASE2_TECH_STACK.md` §11 và `plans\OWNER_WEB_IMPLEMENTATION_DIRECTIVES.md` §15 yêu cầu một
  backend một cổng phục vụ nhiều khách hàng, có `TenantResolver` → `CompanyDataSourceResolver` và cách ly cache/job/audit theo tenant.
- Thực tế:
  - `LegacyCompany(TenantId, CompanyId, CompanyName)` là **một singleton** cấu hình sẵn (`LegacyIdentityAuthority.cs`).
  - Frontend hardcode chi nhánh (`REAL_BRANCHES` trong `lib\erp\erp-client.ts`) và mã chi nhánh mặc định.
  - Catalog màn, form ID, tiền tố số chứng từ và điều kiện lọc đều là của Medcom.
- Kết luận: muốn phục vụ 18 khách hàng thì phần multi-tenant phải làm từ đầu. Xem mô hình của Mak (mục 4.2).

### 2.6 Cách dùng metadata ERP — có renderer động không?

**Không có renderer động lúc chạy. Đây là cách "lai": chụp metadata thành snapshot rồi viết tay từng module.**

- **Snapshot nhúng vào binary**, khai báo trong `D:\Data\Medcom\Medcom\src\backend\Medcom.Contracts\Medcom.Contracts.csproj`:
  - `inventories\erp\20261010\six-screen-catalog.json` (7 màn) và `inventories\erp\20261011\cud-workflow-catalog.json` (18 màn).
    Mỗi màn có `formId`, `menuId`, bảng header/line/history, khóa, cột ngày, `fields` (kiểu, null, ghi được), `lookups` (bản chụp
    `SY_FrmDrdwTbl`: `GridName, ColumnID, ValueColumn, DisplayColumn, ParaArr, ParaRequireArr, IsMultiSelect, LinkColumn`), `buttons`
    và `toolbar` (cờ ẩn nút `HBA/HBE/HBD`).
  - `captions.json` (tên màn/nút), `visible-fields.json` (trường ẩn theo layout ERP, để cắt bớt trước khi trả về) và
    `schema-evolution.json`.
  - Nạp tại `Medcom.Contracts\ErpScreenCatalog.cs`; SQL sinh từ catalog ở `Medcom.Infrastructure\Erp\ErpSql.cs`.
- **Phần viết tay theo module**:
  - `ErpSqlPlan.ScopePredicate`: chép tay điều kiện lọc của form ERP (`T0 TN3/FTR`, `SendTo`, lịch sử trạng thái…).
  - `SqlErpWorkflowEffects.cs`: tên SP và tham số của từng nút.
  - `SqlErpDocumentNumberAllocator.cs`: tiền tố số chứng từ (`PO`, `DMB`, `DCNB`, `DN`…).
  - Ở FE: `getModuleTitle`, `ERP_LIST_COLUMNS`, config chi tiết `lib\erp\document-detail\modules\*.ts`, danh sách tên trường tiền
    trong `lib\erp\money.ts`.
- **Đọc trực tiếp lúc chạy**: chỉ nguồn SQL của dropdown (`SY_FrmDrdwTbl.Source`). Trước khi chạy, backend so lại các cột cấu hình với
  snapshot; lệch thì từ chối (`Medcom.Infrastructure\Erp\ErpLookupSql.cs`).
- **Chuỗi SQL trong metadata** được xử lý bằng một binder có giới hạn (`ErpLookupSql.Bind`):
  - Thay `{User}`, `{BranchID}`, `{n}` và tên tham số bằng `@lookupValueN`. Có tham số hóa, nhưng chỉ cho giá trị nằm trong literal.
  - Bỏ comment, cấm từ khóa DML/DDL (`INSERT|UPDATE|DELETE|MERGE|EXEC|INTO|OPENROWSET|WAITFOR|…`).
  - Chỉ cho chạy `SELECT/DECLARE` hoặc 2 SP chọn hàng nằm trong whitelist.
  - Nguồn dropdown kiểu danh sách tĩnh `a;b;c` được nhận diện riêng.
  - **Không SQL nào gửi từ HTTP được chấp nhận.**
- **Theo dõi lệch cấu hình** (`D:\Data\Medcom\Medcom\docs\backend\ERP_CONFIG_DRIFT.md`, `Medcom.Infrastructure\Erp\ErpConfigDriftCheck.cs`,
  `ErpConfigSnapshot.sql`):
  - 20 giây sau khi khởi động, rồi cứ 6 giờ một lần, đọc chỉ-đọc `SY_FrmCfg` (nút/hook/control) của 25 form, định nghĩa SP/hàm liên
    quan và trigger trên các bảng web ghi.
  - So SHA-256 với bản mốc (730 mục ngày 26/10); báo qua `/health/ready` và `GET /api/platform/erp-config-drift`.
- **Fingerprint đã bỏ** (`docs\backend\ERP_WRITES_WITHOUT_FINGERPRINT_20261015.md`). Trước đó mọi thay đổi schema hay cấu hình form đều
  chặn ghi; sau 15/10 chỉ còn kiểm đúng các cột màn hình đang dùng.
- Trong kế hoạch có "ScreenDefinition" có version, publish/rollback và lớp override hệ thống/công ty/vai trò/người dùng
  (`docs\architecture\PHASE2_SCREEN_DEFINITION_CONTRACT.md`), nhưng **chưa triển khai**.
- Phân tích phía ERP (TechnicalDocs) cho thấy grammar `SY_FrmCfg` khá giàu:
  - Nút: `LYS1` với `BT/C4/CS4/LBEX`.
  - Hook: `EBE/EBD/EBS/ESS`.
  - Ẩn nút: `HBA/HBC/HBD/HBE/HBP`.
  - Control `ExecSQLWithParaButtonCtl_n`.
  - Đây là đầu vào để dựng renderer động (`D:\Data\Medcom\Medcom\docs\audits\WORKFLOW_PARITY_20261025.md`).

### 2.7 Ghi dữ liệu và gọi SP cũ

Nguồn: `D:\Data\Medcom\Medcom\docs\audits\WORKFLOW_PARITY_20261025.md`, `Medcom.Infrastructure\Erp\SqlErpScreenCommands.cs`,
`SqlErpScreenEffects.cs`, `SqlErpWorkflowEffects.cs`, `SqlErpDocumentNumberAllocator.cs`.

- **Bài học lớn nhất**: ban đầu web tự `INSERT PO` và tự `UPDATE` trạng thái/log, nên bỏ qua kiểm tra tỷ giá, số lượng, vai trò, khóa
  đồng thời và lý do bắt buộc. Ngày 25/10 đã chuyển sang gọi đúng SP ERP:
  - `AP_PurchaseRequest_CreatePOStp`
  - `IV_InboundRequest_ChangeWorkflowStatusStp` (`@Action` = `TM_SENDBLD`, `TM_SENDWH`…)
  - `AP_PurchaseRequest_ApproveOrRejectStp`
  - `AR_OrderTbl_UpdateStatusStp`
  - Họ `IV_InternalTransfer_*`
  - Hook EBS `AR_OrderDetail_WarningOverQuantityStp` (MsgType 1 = từ chối)
- Câu báo của `THROW` trong SP ERP được chuyển nguyên văn lên UI (`Conflict` + `native_action_rejected`).
- **Trigger ERP làm sai số dòng**: trigger `INSTEAD OF INSERT` chèn lại với `SET NOCOUNT OFF`, nên client nhận 2 thay vì 1 và giao dịch
  bị hủy. Cách sửa: đọc `SET @affected=@@ROWCOUNT` ngay sau câu lệnh (#201).
- **Cấp số chứng từ**:
  - Theo `SY_Setup.DocumentMask` (mặc định `{P}{MM}{YY}/{4}`, giống `Tools.Data.DefaultValueSQL`).
  - Lấy `MAX` số hiện có trên header với `WITH(TABLOCKX,HOLDLOCK)`, hợp với journal.
  - Tiền tố được hardcode theo module.
- **Đồng thời và idempotency**:
  - Mỗi lệnh có `idempotencyKey` và `expectedStateToken` (hàm băm của snapshot header + dòng). Bảng ERP không có rowversion nên dùng
    token này để chống ghi đè.
  - Biên nhận lệnh lưu ở bảng **`dbo.MedcomErpCommandJournal` thêm vào chính DB MedData**, có sự đồng ý của chủ hệ thống.
  - Tôn trọng cờ `isLock` của chứng từ ERP.
- Mọi đọc/ghi nằm trong transaction `SERIALIZABLE` (`ErpSqlPlan.Command` từ chối nếu isolation khác), mọi `SELECT` có `HOLDLOCK`.
  Đây là chủ ý vì sợ mất nhất quán, nhưng có rủi ro chặn WinForms và làm chậm.
- Bật ghi theo từng module bằng cấu hình server `ErpWrite:Modules`. Module thiếu trong danh sách thì UI báo "Hệ thống đang ở chế độ
  bảo vệ dữ liệu" (`erp_write_unqualified`).
- Phía ERP, các SP có `XACT_ABORT ON`, `sp_getapplock`, `UPDLOCK,HOLDLOCK`; riêng `CF_QRcodeStp` dùng `XACT_ABORT OFF`
  (`D:\Data\Medcom\Medcom\docs\db\LOCKING_TRANSACTION_HOTSPOTS.md`). Web phải gọi các SP này, không tự tái hiện cơ chế khóa.

### 2.8 Phân quyền

Nguồn: `Medcom.Infrastructure\SqlLegacyPolicy.cs`, `Medcom.Infrastructure\Erp\ErpSqlAuthority.cs`, `SqlLegacyBranchScope.cs`,
`Medcom.Infrastructure\Erp\SqlErpPermissionsReader.cs`, `docs\backend\BE_FE_PERMISSIONS_20261015.md`, `docs\backend\BRANCH_SELECTION_METADATA.md`.

- **Quyền gốc của ERP**:
  - Hợp 3 nguồn: `SY_UserGroupPermisstion` (theo nhóm), `SY_UserPermisstion` (theo người dùng), và quyền nhóm của user mà
    `SY_User.UserAuthority` trỏ tới. Có lọc `SY_User.Disable` và `SY_UserGroup.IsDisable`.
  - Cờ quyền: `IsRun/IsAdd/IsUpdate/IsDelete/isManager/isAdmin` theo `MenuID`.
  - Map `SY_Menu.MenuID ↔ FormName`; menu `isDisable` hoặc có `Para` khác rỗng thì không khớp.
- **Chi nhánh**: `SY_User.BranchID` rỗng hoặc NULL nghĩa là được mọi chi nhánh trong `CF_BranchTbl`. Ngoài ra có `SY_UserBranch`.
- API `/api/erp/permissions?branch=` trả `canView/canCreate/canEdit/canDelete` và trạng thái từng nút. FE dùng để ẩn tab/nút; BE vẫn
  kiểm lại khi thực thi.
- Mỗi lần đọc quyền, BE đọc "trước và sau" trong cùng transaction và so lại phiên. Cách này quá thận trọng, góp phần làm chậm
  (2.14).

### 2.9 Màn hình đã làm và mức hoàn thiện (MN @ #260)

Danh sách lấy từ `D:\Data\Medcom\Medcom\apps\medcom-sites\lib\erp\proxy-policy.ts` và `components\app\app-navigation.tsx`.
Form ERP lấy từ catalog (2.6).

| Nhóm menu web | Module | Form ERP | Mức |
|---|---|---|---|
| Mua hàng | `purchase-requests` Đề nghị mua hàng | `AP_PurposeRequestListFrm` | Thêm/Sửa/Xóa, gửi duyệt, gửi đặt mua, dán dòng |
| | `purchase-approvals` Duyệt đề nghị mua | `AP_ApprovePurchaseRequestListFrm` | Duyệt / Không duyệt |
| | `purchase-orders` Đặt mua hàng | `AP_OrderFrm` | Thêm/Sửa/Xóa, giá mặt hàng |
| Bán hàng | `sales-orders` Quản lý đơn hàng | `AR_OrderByContractFrm` | Thêm/Sửa/Xóa, gửi PM, thu hồi, ảnh |
| | `sales-order-pm`, `sales-order-sa` | `AR_OrderComfirmFrm`, `AR_OrderAproveFrm` | Nút quy trình |
| | `sales-qr` Xuất hàng theo PXK | `AR_Invoice_QRCodeFrm` | Quét QR thêm/xóa |
| Quản lý kho (nhập hàng) | `inbound-requests` Đề nghị nhập hàng | `IV_InboundRequestFrm` | Thêm/Sửa/Xóa, chi phí, hủy đợt nháp, ảnh |
| | `inbound-warehouse/-sa/-tech/-pm/-bld` | `IV_IncomingShipmentStatusFrm`, `IV_GoodsInfoControlFrm`, `IV_GoodsStatusConfirmFrm`, `IV_GoodsQualityControlConfirmFrm`, `IV_CargoHandlingPlanApprovalFrm` | Lưu một phần + nút quy trình |
| | `inbound-costs` Chứng từ chi phí | `IV_InboundRequestCTCPFrm` | Lưu phần chi phí |
| Điều chuyển nội bộ | `internal-transfer-requests` | `IV_InternalTransferRequestFrm` | Thêm/Sửa/Xóa, gửi PM, thu hồi |
| | `internal-transfer-pm/-batches/-tech/-sa/-accounting/-warehouse-out/-warehouse-in` | `IV_InternalTransfer*Frm` (7 form) | Đợt: CRUD; các bước: lưu + nút |
| Mã vạch & QR | `warehouse-qr` Quét QR xuất kho | `IV_Output_QRCodeFrm` | Quét QR |
| Thiết bị & bảo hành | `machine-movements`, `machine-repairs` | `FA_Move2026Frm`, `FA_Repair2026Frm` | Thêm/Sửa/Xóa |
| Hệ thống | Tổng quan (KPI, chờ tôi xử lý), Thông báo, Cài đặt, Help | — | Đọc |

**Chưa làm** (theo `WORKFLOW_PARITY_20261025.md`):
- Đơn bán sau bước SA (`AR_OrderConfirmConditionFrm`, `AR_OrderApproveShipBillFrm`, `AR_OrderShipFrm`).
- Trả hàng (`IV_ReturnRequest_*`), thu chi (`CS_PaymentPlan*`, `CS_ReceiptPlan*`).
- `AP_Purchase2Frm`, `AP_PurchaseNKFrm`, `AP_ServiceFrm`, `PeriodLockDataFrm`, quét QR Viettel Post.
- **Toàn bộ báo cáo/in**: đã bỏ có chủ ý ở #210, "ERP reports are printed in ERP"; nút in và RPX không có trên web.
- Kế toán, danh mục, import Excel, cấu hình hệ thống.
- Đến 11/10, `/health/ready` vẫn cố ý trả 503 cho "business release gate" (`src\backend\README.md`). Tài liệu không ghi nhận lần
  nghiệm thu nghiệp vụ toàn hệ thống nào; chỉ có các lần kiểm từng màn trên production.

Ước tính độ phủ: 25 trên khoảng 48 form có nút quy trình của ERP Medcom, tức **khoảng 5% số menu**.

### 2.10 Chức năng phụ trợ đã làm

- **Thông báo**: từ `SY_NotifyMsgTbl` (`ToUserID` = `SY_User.UserName`, đủ 22 cột). Bấm vào mở đúng chứng từ (9 form đích); đánh dấu đã
  đọc bằng SP gốc (`docs\backend\NOTIFICATIONS_FE_HANDOFF_20261010.md`). Có badge chưa đọc.
- **Ảnh đính kèm**:
  - Dùng bảng Attach có sẵn trong DB ERP: `AR_OrderAttachTbl`, `IV_InboundRequestAttachTbl`, `AP_POAttachTbl`. Ảnh lưu nhị phân
    trong DB.
  - Upload qua multipart; nén ảnh ở client cho vừa 1 MB (`docs\backend\BE_FE_ATTACHMENTS_20261016.md`).
- **Quét QR bằng camera**: `jsqr` (`components\erp\qr-scanner.tsx`, `lib\erp\qr-camera.ts`, `lib\erp\qr-decoder.ts`). Mã quét được
  chuyển thành lệnh `qr/add` hoặc dùng làm từ khóa tìm.
- **Help**:
  - `src\helps` là web tĩnh, chia hai khu vực: HDSD (người dùng) và TLKT (kỹ thuật: form, SP, view, trigger).
  - Help nhúng trong từng màn (#214, #246; `components\help\screen-help.tsx`, `lib\help\*.ts`).
  - `apps\medcom-devdocs` (Docusaurus) sinh 276 trang API từ OpenAPI.
- **Swagger UI** cho người đã đăng nhập (`docs\backend\SWAGGER_UI.md`).
- **Đo thời gian**: header `Server-Timing` (`auth/provider/references/be`); log `SlowBackendRequest` khi request ≥ 2 giây
  (`docs\backend\READ_PERFORMANCE_20261016.md`).
- **PWA**: manifest, icon màn hình chính, khóa zoom iOS (#258–#260).

### 2.11 Mẫu UI/UX đã chọn (có thể tái dùng ý tưởng)

Nguồn: `D:\Data\Medcom\Medcom\docs\architecture\APP_SCREEN_UNIFICATION_P2.md`, `DOCUMENT_DETAIL_UNIFICATION.md`,
`docs\web\PRODUCT_UX_FOUNDATION.md`, `docs\web\GRID_MOBILE_IMPLEMENTATION_CONTRACT.md`, mã trong `apps\medcom-sites\components\`.

**Shell "classic"** (`components\erp\workspace.tsx`):
- Sidebar shadcn có nhóm phân hệ, mục **Yêu thích** (sao cạnh tiêu đề màn) và **5 màn gần đây**.
- **Command palette `Ctrl/Cmd+K`** (cmdk) để tìm màn theo nhóm.
- Nút sáng/tối, **bảng màu** (palette) và **mật độ compact**, lưu vào `localStorage` key `medcom.preferences.v1`.
- Breadcrumb trên topbar, badge "Đã đăng nhập ERP", menu tài khoản (gia hạn phiên, đăng xuất).

**`ErpGrid`** (`components\erp\grid.tsx`, `lib\erp\presentation.ts`):
- TanStack Table + Virtual: đổi thứ tự, ẩn/hiện, đổi độ rộng, ghim cột; **lưu view theo `schemaVersion`** (cột không còn tồn tại thì
  bị bỏ, có thông báo).
- Chọn nhiều bằng Shift/Ctrl; điều hướng bằng bàn phím; nút thao tác ghim ở cuối dòng; mobile chuyển sang thẻ.

**`MedcomApp`** (mặc định, mobile-first; `components\untitledui\*`, `components\app\*`):
- Mobile: bottom nav (Tổng quan, Đề nghị PR, Nhập kho, Menu). Nút Menu mở **drawer** sidebar có ô **tìm phân hệ**, mục "Truy cập
  nhanh" và badge "chờ xử lý"; quét QR mở từ header hoặc màn chủ.
- Desktop: chọn header ngang ("top") hoặc sidebar dọc.
- Bộ component chung trong `components\app\`:
  - `ScreenHeader`: tiêu đề 24px đậm, vạch màu thương hiệu bên trái, dòng phụ "Chi nhánh X · N chứng từ".
  - `ScreenToolbar`: thứ tự cố định `[Tìm kiếm][Bộ lọc (số)][Làm mới]`, desktop thêm `[Tạo mới]`; debounce 300 ms, Enter tìm ngay.
  - `FilterChips`: chip trạng thái có đếm số, cuộn ngang. `FilterSheet`: bottom sheet trên mobile, popover trên desktop.
  - `RecordList`: mobile dùng `RecordCard` (dòng 1 mã + badge, dòng 2 đối tượng, dòng 3 meta nối bằng "·"), desktop dùng `RecordTable`.
  - `ListState`: skeleton / rỗng / lỗi kèm "Thử lại". `Pagination`: 20/50/100 dòng.
  - `FormSheet`: mobile toàn màn, footer sticky `[Hủy][Nút chính]`. `FormField`: nhãn trên ô, `*` cho bắt buộc.
  - `CreateFab` (nút tròn 56px), `StatusBadge` (màu lấy từ màu trạng thái ERP, `lib\erp\status-colors.ts`), `AppButton`
    (≥ 44px, ô nhập `text-base` để iOS không zoom).
- Mở màn vai trò thì mặc định ở tab **"Chờ tôi xử lý"** (#186).
- Tiêu đề màn lấy đúng nhãn menu người dùng đã bấm.
- Loading dùng hiệu ứng shimmer, tắt khi người dùng bật "giảm chuyển động".

**Chi tiết chứng từ theo config** (`components\erp\document-detail\*`, `lib\erp\document-detail\modules\*.ts`):
- Tách 4 lớp: shell / layout / controller / config.
- **Danh sách trắng**: chỉ hiện trường khai báo trong `groups`; trường lạ chỉ `console.warn` khi dev.
- Formatter: boolean → Có/Không, ngày `dd/MM/yyyy`, tiền, trạng thái, tham chiếu (tên kèm mã phụ).
- Tab "Chi tiết dòng | Lịch sử | section phụ"; thanh thao tác có nút chính và menu "Thao tác khác"; slot cố định cho editor dòng,
  đính kèm, quét QR.

**Ô chọn (lookup)** `components\untitledui\lookup-field.tsx`: tìm phía server, phân trang, hiện tên kèm mã, có chọn nhiều.

**Tiền tệ** `lib\erp\money.ts`: chuỗi thập phân **không bao giờ đi qua `Number`**. Hiển thị theo kiểu VN (`.` ngăn nghìn, `,` thập
phân). Ô nhập nhận cả kiểu invariant lẫn kiểu VN khi dán.

**Kết quả lệnh không rõ** (`PRODUCT_UX_FOUNDATION.md` §14): mất mạng sau khi gửi lệnh thì UI hiện "đang kiểm tra kết quả" và tra
`commands/lookup` theo `idempotencyKey`. Không báo "chưa lưu", không cho gửi lại mù.

### 2.12 Vì sao Medcom-Web chậm

1. **Quy trình evidence/gate áp đảo sản phẩm.**
   - `AGENTS.md` có **10 lần đổi "owner direction"** trong 01–23/10: chỉ-lập-kế-hoạch → bật lịch → tắt lịch → một người ghi →
     full-stack → 6 vai trò theo lịch → "schedule guard" → chỉ backend (FE do nhóm khác) → ui-sync.
     Nguồn: `D:\Data\Medcom\Medcom\AGENTS.md`, `docs\PROJECT_STATE.yaml` (517 dòng, đầy trạng thái `UNKNOWN/pending`).
   - Commit dạng `Admit I22 bounded parallel Medcom work; implementation NOT_RUN`, `Fence inbound sessions by frozen rights…`.
     Mỗi increment có "admission" + checkpoint + receipt.
2. **Lane song song bằng lịch tự động** (10 lane, 31 issue, lease/fence trên GitHub; `docs\plans\PHASE2_SCHEDULED_EXECUTION_PLAN.md`
   742 dòng) không chạy được. Bật rồi tắt trong cùng ngày 02/10.
3. **Đầu tư vào hạ tầng test/bảo mật trước khi có tính năng**: TLS loopback có kiểm soát, framing chunk, "custody" của phiên, quan sát
   đồng hồ trình duyệt. Ngày 06/10 có 95 commit mà gần như không thêm màn nào.
4. **Nguồn dữ liệu không đủ**: lần trích dump SQL đầu bị thiếu, nên kết luận sai rằng "không có SP/trigger"; phải sửa lại ngày 02/10.
5. **UI làm lại nhiều lần, dữ liệu giả tồn tại lâu**: `QuickCreateModal` giả, nút duyệt chỉ đổi state, "Kiểm tra kết nối" giả, chi
   nhánh hardcode (`APP_SCREEN_UNIFICATION_P2.md` §1). Hai shell và hai họ API phải bảo trì song song.
6. **Phối hợp agent tốn công**: Codex không ghi được `.git` nên leader phải commit thay; Antigravity hết quota giữa phiếu; phiếu bị trả
   lại vì sai quy ước khóa JSON (`docs\tasks\BOARD.md`).
7. **Mã khó đọc**: nhiều file TSX viết cả khối JSX trên một dòng. Ví dụ `apps\medcom-sites\components\erp\workspace.tsx` có các dòng
   404, 445, 450 dài 2.800–3.800 ký tự, rất khó review.
8. **ERP thay đổi trong lúc làm**: đội vẫn sửa SP, cấu hình và trigger trên MedData thật (mục 3) nên web liên tục phải đuổi theo.

### 2.13 Điều gì hiệu quả

- Khi ưu tiên "màn chạy được với DB thật", tốc độ tăng hẳn: các ngày 09–11/10 và chuỗi PR nhỏ 24/10–03/11. Mỗi PR một việc, tiêu đề
  viết theo kết quả người dùng thấy (vd. "Inbound 'Gửi PM' passes the status check").
- Đối chiếu trực tiếp với `SY_FrmCfg` và `sys.sql_modules` (chỉ đọc) để khớp từng nút với ERP (`WORKFLOW_PARITY_20261025.md`).
- Bộ theo dõi lệch cấu hình: rẻ, chỉ đọc, phát hiện sớm khi ERP đổi SP/nút/trigger.
- Bộ component dùng chung (P2) cộng với chi tiết chứng từ theo config: sau khi thống nhất, thêm 6 màn nhập hàng chỉ mất 2–3 ngày
  (#204–#209, 25–27/10).
- Phiếu việc cho agent có "Bài học bắt buộc" rút từ lần bị trả lại (`docs\tasks\T-005.md`).
- Test tĩnh kiểm config FE với catalog backend (khóa trường tồn tại, không chứa trường đã bị cắt).
- Help nhúng ngay trong màn; tách HDSD (cho khách) và TLKT (cho dev).

### 2.14 Rủi ro kỹ thuật đã gặp (bảng tra nhanh)

| Rủi ro | Biểu hiện ở Medcom | Cách họ xử lý | Áp dụng cho Web-ERP |
|---|---|---|---|
| Mật khẩu legacy | MD5 + muối chèn; obfuscate làm đổi tên hàm theo build | Tiến trình con nạp Tools.dll, ghim SHA-256 | Viết lại `Verify` native; test với hash thật của từng khách; không có mật khẩu hệ thống |
| Phụ thuộc `Tools.dll` | .NET Framework 4.6.2, Janus/ActiveReports | Chỉ dùng phần thuần MD5 | Không nạp Tools.dll trên server web |
| SQL trong metadata | `SY_FrmDrdwTbl.Source`, nút `ExecSQLWithPara…`, filter `.dat` | Binder chỉ-đọc + whitelist SP | Dùng lại binder; quarantine chuỗi không parse được |
| Ghi lệch ERP | PO thiếu thành tiền, bỏ qua kiểm tra | Gọi đúng SP và hook ERP | Chỉ ghi qua SP/hook cấu hình; không có đường INSERT tự viết |
| Trigger đổi số dòng | `NOCOUNT OFF` trong trigger `INSTEAD OF` | `@@ROWCOUNT` ngay sau lệnh | Áp dụng mặc định |
| Khóa và đồng thời | `SERIALIZABLE`+`HOLDLOCK` mọi đọc, `TABLOCKX` khi cấp số | Giữ nguyên, chấp nhận chậm | Đọc ở `READ COMMITTED` (hoặc snapshot nếu DB bật); cấp số bằng `sp_getapplock` hoặc SP ERP |
| Concurrency không rowversion | Bảng ERP không có cột version | `expectedStateToken` = hash snapshot | Dùng lại ý tưởng |
| Lặp lệnh | Mất mạng sau khi gửi | `idempotencyKey` + journal + `commands/lookup` | Dùng lại; đặt journal ở schema/DB riêng của web |
| Thời gian | `datetime` không có múi giờ (`sql-datetime-without-timezone`) | Trả chuỗi `yyyy-MM-ddTHH:mm:ss.fff`, FE format VN | Coi mọi `datetime` ERP là giờ VN; server IIS đặt múi giờ VN; không `new Date()` chuỗi không có offset |
| Số thập phân | `decimal/money` | Trả chuỗi invariant; FE không qua `Number` | Dùng lại `money.ts`; định dạng lấy theo metadata, không đoán theo tên trường |
| Độ dài cột thay đổi | `AR_OrderTbl.AddressA` từ `nvarchar(200)` thành `max` | Chấp nhận nới rộng, từ chối thu hẹp | Kiểm schema lúc chạy, cho phép nới rộng |
| Cache WinForms | Đổi cấu hình phải khởi động lại ERP mới thấy | Ghi chú cho người dùng | Web đọc metadata có TTL ngắn; nút "nạp lại cấu hình" cho admin |
| Phiên trên IIS | Mất đăng nhập sau deploy hoặc khi tái chế | UX-09a–f | Lưu phiên bền ngay từ đầu |
| Hiệu năng | 1,3–1,5 giây mỗi API, xác thực ≈590 ms | Gộp batch SQL, đánh dấu POST chỉ-đọc | Cache quyền 30–60 giây theo (DB, user, version); một lượt SQL cho quyền + chi nhánh |
| Giới hạn upload IIS | 1 MB | Nén ảnh ở client | Cấu hình `maxAllowedContentLength` hợp lý; nén ở client |
| Thay đổi DB ERP | Thêm `MedcomErpCommandJournal` vào MedData | Có sự đồng ý của chủ hệ thống | Bảng của web để riêng (schema `web` hoặc DB riêng), có migration đánh số |

---

## 3. `D:\Data\Medcom\TechnicalDocs` và `D:\Data\Medcom\outputs`

### 3.1 TechnicalDocs — các gói thay đổi trên DB ERP (MedData thật)

Mỗi gói (thư mục `<chủ-đề>-<ngày>`) đi theo cùng một mẫu:
- Script `Start-*.ps1` và `build_migration.py`, kèm `build_rollback.py` / `rollback.sql`.
- Test **trước khi deploy** chạy trong transaction rồi rollback; deploy; test **sau khi deploy**; đọc lại sau commit.
- Kiểm "phần không liên quan không đổi": cấu hình form, quyền, SP khác, dữ liệu nghiệp vụ.
- Tóm tắt kết quả ở `verification-summary.json`.

| Chủ đề | Thư mục | Bài học |
|---|---|---|
| Sửa quy trình (tạo PO, nhập hàng, từ chối) | `workflow-repair\`, `workflow-review\` | Rà 343 module; 13 phát hiện (7 cao). Có báo cáo Excel |
| Đổi tên đối tượng SQL | `sql-naming-20261021\` | Đổi tên 43 đối tượng, giữ 26 alias tương thích, cập nhật 29 dòng cấu hình |
| Thứ tự quy trình nhập hàng | `inbound-workflow-reorder-20261023\` | SA → Kỹ thuật (chỉ thiết bị) → PM → Kế toán |
| Nút "Gửi TP SA" | `internal-transfer-send-sa-20261022\` | Thêm control `ExecSQLWithParaButtonCtl_2`; **client WinForms giữ layout cũ đến khi khởi động lại** |
| Kiểm tra đồng bộ đề nghị | `internal-transfer-sync-required-20261022\` | Chuỗi chỉ có khoảng trắng / tab / NBSP phải bị từ chối |
| Khởi tạo khi đăng nhập | `login-initialization-20261022\` | `SY_SetupStp` tự khóa chứng từ khi đăng nhập làm lỗi đăng nhập |
| Tách lô, sao chép dòng, lưu một lần | `inbound-lot-split-20261023\`, `inbound-copy-20261023\`, `inbound-save-once-20261023\` | Macro client lỗi 102; giữ khóa ẩn `OrderDetailID` khi sao chép |
| Hãng sản xuất trên dòng | `inbound-manufacturer-20261021\` | View chọn dòng PO thiếu cột `HangSX` |
| Xóa đề nghị mua nháp | `purchase-request-delete-20261029\` | Trigger xóa con, kiểm tính nguyên tử |
| Tỷ giá đề nghị mua | `purchase-request-price-rate-20261029\` | 138 dòng cấu hình trên 41 form tài chính |
| Trả hàng kế toán bán | `sales-accounting-return-20261030\` | Chỉ đổi 2 dòng `CS4` và một SP |
| Chính sách khấu hao | `asset-depreciation-policy-20261030\` | Thêm bảng/cột mới; 387 tài sản chờ kế toán xác nhận |
| Kiểm lô tồn kho | `stock-lot-260821-20261022\` | Điều tra chỉ đọc |
| Audit DB | `db-audit\` | Catalog schema, 1.038 file SP, decompiler (`00` §3) |
| Help trên IIS | `iis-help-deployment-20261022\HUONG-DAN-IIS.md` | Một script tạo 2 IIS Application |

**Bài học**:
- ERP đang được sửa liên tục ở tầng DB, nên Web-ERP phải coi metadata/SP là thứ thay đổi được: đọc lúc chạy và có bộ theo dõi lệch.
- Mẫu "preflight + rollback + test trước/sau trong transaction + summary JSON" rất đáng giữ cho mọi thay đổi DB của dự án mới
  (khớp `D:\Data\Skills\SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md`).

### 3.2 outputs — sản phẩm bàn giao

- Tài liệu kỹ thuật quy trình ERP Medcom v1→v4 (Word/PDF + bộ sơ đồ ZIP; `erp-workflows-*`), bản "hai đối tượng đọc"
  (người dùng / kỹ thuật).
- Excel rà soát logic và quy trình (`workflow-logic-20261020\`, `workflow-review-20261020\`, có `formula-errors.json`).
- So sánh quy trình với khách hàng (`customer-workflow-compare-20261023\`), đối chiếu tài sản, xác nhận tài sản.
- Báo cáo khối lượng hỗ trợ ERP (`medcom-workload-20261030\source\work-items.json`, 59 mục từ 05/2026). Nhiều mục là "tắt mở lại để
  nạp cấu hình", cho thấy **cache cấu hình WinForms là điểm đau thường gặp**.
- Help: bố cục theo đối tượng đọc, mua hàng, nhập hàng, sao chép/lưu một lần.

---

## 4. Mak (MakMain, Mak-Group)

### 4.1 Tổng quan

Nguồn: `D:\Data\Mak\MakMain\README.md`, `D:\Data\Mak\MakMain\AGENTS.md`.

- Ứng dụng tích điểm và đổi mã dự thưởng cho nông dân, đại lý và quản trị của 3 công ty (MAK, MEPES, ATC). **Không phải bản web của
  ERP.**
- DB riêng của ứng dụng: `CT04MAKApp`, `CT04MAKApp2`, `CT04MAKApp3`. Có schema `erp.*` chứa bản chụp khách hàng và nhân viên từ ERP;
  SP `dbo.usp_DongBo_ERP` đồng bộ, worker nền chạy mỗi 15 phút (`src\Web\Infrastructure\ErpSyncWorker.cs`,
  `src\Core\Services\ErpFullSyncService.vb`).
- Stack: ASP.NET Core **MVC + Razor** (.NET 10) trong `src\Web` (C#, ≈9.700 dòng, 117 view). Nghiệp vụ nằm ở thư viện **VB.NET**
  `src\Core` (≈15.500 dòng), truy cập DB qua SP (`StoredProcedureCommand.Create`). JavaScript chỉ để tăng cường tương tác
  (giỏ hàng, camera, PWA).

### 4.2 Các mẫu đáng học

- **Tenant theo tên miền** (`src\Web\Infrastructure\DomainTenantMiddleware.cs`):
  - Ánh xạ host → mã công ty → chuỗi kết nối riêng (`ConnectionStrings:<CÔNG TY>`). Thiếu cấu hình thì ném lỗi, **không rơi về DB của
    công ty khác**.
  - Chỉ cho chọn công ty qua `?company=` khi chạy localhost ở môi trường Development.
  - Ngữ cảnh công ty giữ bằng `AsyncLocal` (`src\Core\Config\CompanyContext.vb`) và được khôi phục trong `finally`.
- **Job nền theo tenant**: `DeploymentTenants.RunForAsync(company, work)` đặt ngữ cảnh rõ ràng cho công việc không có HTTP
  (`src\Web\Infrastructure\DeploymentTenants.cs`).
- **Hai cookie scheme** Admin/Member (`AuthSchemes.cs`), HttpOnly + SameSite=Lax; cookie kiểm lại công ty
  (`ValidateCompanyAsync`). `SameOriginWriteFilter` và antiforgery cho form POST.
- **Bảo vệ tải** (`RequestProtection.cs`, `docs\deploy\SECURITY-AND-CAPACITY.md`):
  - Tối đa 128 request đồng thời, hàng đợi 256, 3.000 request/phút/IP (đã nâng vì CGNAT di động), auth 300/phút.
  - Timeout SQL theo từng command; **không retry ghi mù**.
  - SQL timeout hoặc deadlock thì trả 503 kèm `Retry-After`.
- **Mật khẩu của ứng dụng**: PBKDF2-SHA256 (`src\Core\Security\PasswordHasher.vb`).
- **Bảng quyền sinh từ một nguồn**: `scripts\gen_level_permissions.py` sinh cả `PermissionRegistry.vb` và migration.
- **Lớp thương hiệu theo công ty**: `src\Web\companies\<CÔNG TY>\brand-patches.json`. Ứng dụng **dừng ngay khi khởi động** nếu quy tắc
  thay CSS không còn khớp (`CompanyBrandingFiles.cs`).
- **Migration** (`D:\Data\Mak\MakMain\sql\README.md`):
  - Đánh số `NNN_*.sql` (002→089), chạy lại được, có transaction, in `PASS`.
  - **Chủ dự án tự chạy tay** trên từng DB; agent không chạy lên DB thật.
  - Nguồn SP mỗi đối tượng một file, sinh migration bằng script.
  - `deploy\MvcReadiness.ps1` **dừng deploy nếu DB thiếu migration**.
  - `scripts\check-inline-sql.py` chặn SQL viết thẳng ngoài allowlist. Có kế hoạch chuyển 493 chuỗi SQL sang SP theo đợt
    (`docs\database\KE-HOACH-CHUYEN-SQL-SANG-STORED-PROCEDURE.md`).
- **Deploy IIS** (`D:\Data\Mak\MakMain\deploy\README.md`):
  - Server giữ một bản clone. `CAP-NHAT.cmd` chạy các bước:
    1. Dừng nếu có sửa đổi cục bộ.
    2. `git pull --ff-only`.
    3. Publish ra thư mục tạm.
    4. Chép appsettings của server sang bản build và kiểm tra DB.
    5. Kiểm tài nguyên tĩnh.
    6. Bật `app_offline.htm`, chép file, gỡ bảo trì; **không restart IIS**, giữ `App_Data`.
  - CD bằng Task Scheduler mỗi 5 phút: `git fetch`; có commit mới trên `main` thì cập nhật, không cần runner.
  - Lỗi ở bất kỳ bước nào trước khi chép thì site đang chạy không bị đụng tới.
- **Test**: chỉ chạy trên DB `ALOGSMAK_TEST` local. Test tooling tạo DB tạm có tiền tố riêng rồi xóa. Có smoke cho 9 cổng công khai mà
  không cần SQL.

### 4.3 Bài học và rủi ro

- **Chuyển kiến trúc giữa chừng**: từ SPA (index.html/app.js/env.js) + API sang MVC Razor trong 01–02/11 (sau 1 tháng). Bỏ RLS và
  `sp_set_session_context` (01–03/11) vì phức tạp và chậm, thay bằng DB vật lý riêng cho từng công ty cộng `@CompanyCode` trong SP.
- **Lỗi số thập phân**: màn chuyển điểm đọc sai số dư kiểu thập phân (commit `45b8315`, 06/11).
- **Khởi động nguội trên IIS**: app pool tắt sau 20 phút rảnh và tái chế mỗi 29 giờ, lần gọi đầu mất khoảng 3 giây. Đã chỉnh bằng script
  `deploy\TANG-CHIU-TAI.ps1`.
- **Deadlock khi nhiều người đăng ký cùng lúc**: retry riêng cho lệnh đăng ký, không retry chung cho mọi lệnh ghi.
- **KHÔNG sao chép**: `AGENTS.md` có ngoại lệ do chủ dự án cho phép, **ghi mật khẩu nguyên văn** vào `dbo.SY_PasswordLogTbl` sau mỗi lần
  đăng nhập/đặt lại (commit `d8be66a`, 06/11). Đây là rủi ro bảo mật nghiêm trọng; Web-ERP không được làm như vậy.

### 4.4 So sánh nhanh `D:\Data\Mak\Mak-Group` (bản gốc trước khi tách)

| Khía cạnh | Mak-Group | MakMain |
|---|---|---|
| Lịch sử | 952 commit (30/09–05/11), nhánh `main/develop/backup-main-before-merge`, tag `archive/2026-11-02/*` | 27 commit từ 05/11 |
| Cấu trúc | Phẳng ở gốc repo: `Controllers/`, `Core/`, `Views/` cùng SPA cũ (`index.html`, `app.js`, `env.js`, `pwa/`, `quan-tri/`, `portal-quan-tri/`, `quay-so/`), `release/` nằm trong git | `src\Web`, `src\Core`, `tests\`, `sql\`, `deploy\`, `docs\`; bỏ SPA, bộ cài cũ, file trùng |
| Quy ước | Ghi chú dồn trong README rất dài | README ngắn, quy tắc "đặt file ở đâu", cấm tạo lại thư mục đã bỏ |
| Nghiệp vụ, DB, deploy | — | Giữ nguyên như Mak-Group |

---

## 5. Nguồn khác

- `D:\Data\Individual\CodeForge-AI\docs`: dự án cá nhân về sản phẩm "lab học dùng coding agent" (business model, MVP, red-team…).
  **Không liên quan** đến ERP. Chỉ đáng chú ý là nó dùng cùng phong cách tài liệu nặng (`PROJECT_STATE.yaml`, `QUALITY_GATE.md`,
  `RED_TEAM.md`) như Medcom.
- `D:\Data\SmartHome\Tai lieu ky thuat.md`: kế hoạch hệ thống camera AI cho khu dân cư (WinForms core .NET 10 + web React). **Không
  liên quan.**

---

## 6. Đề xuất cho dự án Web-ERP mới

### 6.1 Tái dùng được gì

**Code / logic** (đọc rồi viết lại sạch, không chép nguyên vì mã rất đặc và gắn với Medcom):

| Thành phần | Nguồn | Ghi chú khi dùng lại |
|---|---|---|
| Binder SQL dropdown an toàn | `D:\Data\Medcom\Medcom\src\backend\Medcom.Infrastructure\Erp\ErpLookupSql.cs` | Thay deny-list bằng parser T-SQL (vd. ScriptDom) nếu được; whitelist SP lấy từ cấu hình từng khách hàng |
| CTE quyền `SY_*` + map menu↔form | `...\Medcom.Infrastructure\SqlLegacyPolicy.cs`, `...\Erp\ErpSqlAuthority.cs` | Kiểm lại tên cột trên DB từng khách hàng |
| Quy tắc chi nhánh | `...\Medcom.Infrastructure\SqlLegacyBranchScope.cs`, `docs\backend\BRANCH_SELECTION_METADATA.md` | `BranchID` rỗng = mọi chi nhánh |
| Cấp số theo `SY_Setup.DocumentMask` | `...\Erp\SqlErpDocumentNumberAllocator.cs` | Đọc mask và tiền tố từ metadata; khóa bằng `sp_getapplock` thay `TABLOCKX`; đối chiếu `Tools.Data.DefaultValueSQL` |
| Token trạng thái + idempotency + tra kết quả lệnh | `...\Erp\SqlErpScreenCommands.cs`, `docs\web\PRODUCT_UX_FOUNDATION.md` §14 | Journal đặt ngoài bảng nghiệp vụ |
| Đếm dòng khi có trigger | `docs\audits\WORKFLOW_PARITY_20261025.md` (mục 26/10) | Áp dụng cho mọi lệnh ghi |
| Theo dõi lệch cấu hình ERP | `...\Erp\ErpConfigDriftCheck.cs`, `ErpConfigSnapshot.sql`, `docs\backend\ERP_CONFIG_DRIFT.md` | Chạy theo từng khách hàng; báo trên trang admin |
| Kiểm schema cột lúc chạy (cho phép nới rộng) | `docs\backend\READ_PERFORMANCE_20261016.md`, `ERP_WRITES_WITHOUT_FINGERPRINT_20261015.md` | Không khóa ghi vì thay đổi không liên quan |
| Phiên + Data Protection trên IIS | `docs\tasks\UX-09.md`, `...\Medcom.Infrastructure\WebSessionFileStore.cs`, `LocalWebSessions.cs` | Nên lưu phiên trong DB của web; tách 401/503 |
| Hàm Verify mật khẩu | Viết mới theo `D:\Data\Web-ERP\.legacy\decompiled\Tools\Tools\MD5.cs` | Bỏ `VerifyUserPassSystem`; cân nhắc nâng cấp hash khi người dùng đổi mật khẩu (nếu ERP chấp nhận) |
| Tiền / định dạng | `D:\Data\Medcom\Medcom\apps\medcom-sites\lib\erp\money.ts`, `lib\erp\document-detail\format.ts`, `lib\erp\status-colors.ts` | Định dạng lấy từ metadata cột |
| Tenant theo domain + `AsyncLocal` + job theo tenant | `D:\Data\Mak\MakMain\src\Web\Infrastructure\DomainTenantMiddleware.cs`, `DeploymentTenants.cs`, `src\Core\Config\CompanyContext.vb` | Mở rộng thành host/đăng nhập → khách hàng → DB; nên dùng DI scoped thay biến static |
| Bảo vệ tải | `D:\Data\Mak\MakMain\src\Web\Infrastructure\RequestProtection.cs`, `docs\deploy\SECURITY-AND-CAPACITY.md` | Giữ "không retry ghi mù" |

**Component / UI** (ý tưởng và cấu trúc; viết lại cho dễ đọc):
- Bộ `components\app\*` của Medcom (ScreenHeader, ScreenToolbar, FilterChips/FilterSheet, RecordList/Card/Table, FormSheet/FormField,
  CreateFab, StatusBadge, ListState, Pagination, AppButton) cùng quy tắc ≥ 44px và mobile-first.
- `ErpGrid` (TanStack Table + Virtual, view lưu theo `schemaVersion`), command palette `Ctrl+K`, Yêu thích / Gần đây, theme / palette /
  density (`components\erp\workspace.tsx`, `components\erp\grid.tsx`).
- Chi tiết chứng từ theo config và danh sách trắng (`DOCUMENT_DETAIL_UNIFICATION.md`). Ở Web-ERP, **config này nên sinh từ metadata
  ERP** (`SY_FrmCfg` / layout), không viết tay cho từng module.
- Màn vai trò mặc định "Chờ tôi xử lý"; badge đếm việc chờ; thông báo bấm vào mở đúng chứng từ.
- Help nhúng trong màn; HDSD và TLKT tách riêng.

**Quy tắc an toàn DB**:
- Mẫu gói thay đổi của TechnicalDocs: preflight, rollback, test trước/sau trong transaction, summary JSON.
- Quy trình migration của Mak: đánh số, chạy lại được, `PASS`, kiểm readiness trước khi deploy, chủ dự án tự chạy.
- `D:\Data\Skills\SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md`.
- Test chỉ trên DB tạm hoặc DB test local (`tools\legacy\README.md` của Medcom, `tests\README.md` của Mak).

### 6.2 Cần tránh

1. **Quy trình nặng**: không lane theo lịch, không lease/fence/custody, không `PROJECT_STATE.yaml` hàng trăm dòng `UNKNOWN`.
   Quyết định ghi một trang; bằng chứng là màn chạy được trên DB thật (chỉ đọc trước) cùng test tự động.
2. **Snapshot metadata nhúng vào binary**, và viết tay theo module: điều kiện lọc, tên SP nút, tiền tố số chứng từ, tiêu đề màn, danh
   sách tên trường tiền, chi nhánh hardcode.
3. **Tự viết INSERT/UPDATE nghiệp vụ** thay vì gọi SP/hook ERP.
4. **Khóa ghi bằng fingerprint** toàn cục; khóa nặng khi đọc (`SERIALIZABLE`/`HOLDLOCK`); `TABLOCKX`; xác thực DB đầy đủ ở mọi request.
5. **Nạp `Tools.dll` obfuscate** bằng reflection và offset theo từng build; hỗ trợ mật khẩu hệ thống; lưu mật khẩu ở trình duyệt hoặc
   ghi mật khẩu nguyên văn (Mak).
6. **Hai shell, hai họ API, UI làm lại nhiều lần**; chức năng giả hoặc dữ liệu mock trong mã sản phẩm.
7. **Mã JSX/C# viết dồn trên một dòng**; quy ước đặt tên khóa JSON không thống nhất giữa các route.
8. **Topology deploy quá nhiều tầng** (IIS ARR → Node service → IIS API, TLS nội bộ) cho một ứng dụng nội bộ: dễ hỏng và khó vận hành
   trên Windows.
9. **Bảng của web đặt lẫn vào DB ERP mà không có migration và tài liệu** (journal của Medcom).

### 6.3 Gợi ý định hướng (ngắn, để thảo luận ở tài liệu kiến trúc)

- **Renderer động theo metadata lúc chạy**:
  - Đọc `SY_Menu`, `SY_FrmLstTbl`, `SY_FrmCfg`, `SY_FrmDrdwTbl` của DB từng khách hàng, cache có TTL và cho admin "nạp lại".
  - Dựng danh sách / chi tiết / sửa / dropdown / nút. Nút chạy đúng SP hoặc hook cấu hình qua binder có whitelist.
  - Màn viết tay chỉ dành cho khoảng 240 form hardcode của `ERP.NET.exe` khi thật sự cần.
  - Đây là khác biệt cốt lõi so với Medcom, và là điều kiện để phục vụ 18 khách hàng.
- **Một ứng dụng, nhiều DB**: chọn khách hàng theo tên miền hoặc mã khách hàng lúc đăng nhập, theo mô hình Mak. Mỗi khách hàng một
  chuỗi kết nối phía server; cache, job và log đều mang mã khách hàng.
- **Deploy tối giản trên IIS**: một site ASP.NET Core phục vụ cả API lẫn frontend đã build tĩnh, tránh phải chạy Node như một Windows
  service. Cập nhật bằng script kiểu `CAP-NHAT.cmd` (build tạm → kiểm tra → `app_offline` → chép).
- **Bảng riêng của web** (phiên, journal lệnh, view đã lưu, yêu thích): đặt ở schema `web` trong DB khách hàng hoặc ở một DB riêng, có
  migration đánh số và kiểm readiness.
- **Lát cắt dọc mỗi tuần**: chọn 1 phân hệ, chạy được trên DB thật ở chế độ chỉ đọc, rồi mới bật ghi qua SP. Bộ theo dõi lệch cấu
  hình bật từ ngày đầu.

### 6.4 Câu hỏi mở cho chủ dự án

1. Có được tạo bảng hoặc schema mới trong DB của từng khách hàng không, hay bắt buộc dùng DB riêng cho web?
2. Có chấp nhận việc web không in báo cáo RPX ở giai đoạn đầu không (Medcom đã chọn bỏ)?
3. Khách hàng nào làm pilot? Có cấp tài khoản SQL **chỉ đọc** để khảo sát metadata không?
4. Có cần realtime giữa web và WinForms không? Nếu có thì cần cơ chế khác ngoài SignalR, vì WinForms ghi DB không phát sự kiện.

---

## Phụ lục A — Lệnh đã dùng để đếm (tái lập được)

```bash
git -C /d/Data/Medcom/Medcom log --oneline | wc -l                      # 725
git -C /d/Data/Medcom/ERP_Medcom2026/work/Medcom log --format='%ad' --date=short | sort | uniq -c
find /d/Data/Medcom/Medcom/docs -name '*.md' -exec cat {} + | wc -l     # ~23k
find /d/Data/Medcom/Medcom/src/backend/Medcom.Infrastructure -name '*.cs' -exec cat {} + | wc -l
git -C /d/Data/Mak/Mak-Group log --oneline | wc -l                      # 952
```
