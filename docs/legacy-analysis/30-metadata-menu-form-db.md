# 30 — Metadata menu / form / DB của ERP.NET (khách Medcom, đối chiếu TinPhong)

Ngày phân tích: 2026-11-11. Giai đoạn: **chỉ đọc**. Đọc trước: `00-nguon-du-lieu.md`. Tham khảo chéo:

- `02-trien-khai-khach-hang.md`: danh mục `.rpx`, layout `.dat` theo khách hàng;
- `10-engine-form-dong.md`: chi tiết engine form động, góc nhìn từ mã nguồn;
- `12-vo-ung-dung-dang-nhap-phan-quyen.md`: vỏ ứng dụng, menu, phân quyền.

Tài liệu này đi **từ dữ liệu metadata thật của Medcom**.

**Nguồn dùng trong tài liệu này**

| Nguồn | Nội dung | Ghi chú độ đầy đủ |
|---|---|---|
| `D:\Data\Medcom\TechnicalDocs\db-audit\workflow-config-20261019\` | Snapshot metadata DB **MedData** lúc 2026-10-19 07:41 UTC | `menus` 482/482, `forms` 287/287 dòng nhưng chỉ lấy 7/19 cột `SY_Menu`, 16/23 cột `SY_FrmLstTbl`. `form_config` chỉ có **3.419 dòng / 51 FID**, trong khi `row_counts` ghi `SY_FrmCfg` ≈ 10.687 dòng (≈ 32 %). `form_filters` 18 so với ≈ 244 (`provenance.json`: "filtered through registered TableName; native forms can be omitted") |
| `D:\Data\Medcom\TechnicalDocs\db-audit\run-20261019\` | Catalog schema MedData: 3.682 object, 12.440 cột, 574 bảng có số dòng | Chỉ có metadata, không có dữ liệu nghiệp vụ |
| `D:\Data\Medcom\TechnicalDocs\db-audit\analysis\workflow-trace\` | `menu_availability.json`… do lần phân tích trước tạo | Trạng thái bật/tắt menu tôi tính lại **khớp 482/482** |
| `D:\Data\TinPhong\Tools\BeeCMigration\audit-20261019-01\results\` | `ui-SY_*.json` của DB TinPhong | **Đã lọc theo `%BeeC%`** (chỉ 2 form, 103 dòng `SY_FrmCfg`) nên không so sánh được toàn bộ |
| `D:\Data\Web-ERP\.legacy\decompiled\ERP.NET\`, `...\Tools\` | Mã dịch ngược ERP.NET.exe / Tools.dll (bản 2026-11-09, Meracine-HN) | Medcom đang chạy bản 2026-10-09 (7.732.737 byte), nên danh sách lớp có thể lệch nhẹ |
| `D:\Data\Medcom\Medcom\inventories\erp\WINFORMS_PROPERTY_KEY_INDEX.json` | 293 cặp thuộc tính ↔ khóa, mức bằng chứng "INFERRED" | Tôi đã đối chiếu với mã dịch ngược: **293/293 khớp** (cùng tên thuộc tính, chỉ khác 2 tên lớp: `PropertiesX`→`PropertyX`, `AutoNumberSetting`→`AutoDocNumberSetting`) |

**File dữ liệu đi kèm** (thư mục `data\`, CSV đều là UTF-8 BOM):

| File | Nội dung |
|---|---|
| `menu-medcom.csv` | 482 menu: cấp, đường dẫn caption, FormName, Para/Filter, isDisable, trạng thái hiệu lực, loại form, cách được resolve, FormType, bảng, file lớp, báo cáo (SP/.rpx), số dòng `SY_FrmCfg`, số nhóm có IsRun |
| `menu-medcom-tree.md` | Cây menu **đang bật** (338 mục), thụt lề theo cấp, có ký hiệu loại form |
| `forms-medcom.csv` | 287 form động `SY_FrmLstTbl` + tiền tố, bảng có tồn tại không, số dòng cấu hình, số nút/hành động, menu trỏ tới, có bị lớp viết tay che không |
| `frmcfg-keys-medcom.csv` | 215 khóa `SY_FrmCfg` (theo họ / lớp / khóa): số dòng, số form, thuộc tính và mô tả lấy từ mã nguồn, đối chiếu index |
| `winforms-property-keys-source.csv` | **Từ điển 1.541 khóa thuộc tính** trích từ mã dịch ngược Tools (80 lớp: LayoutX, TableInfoX, các `*PropertyX`…) kèm mô tả `[Description]` tiếng Việt |
| `form-actions-medcom.csv` | 192 nút/hành động/ô lọc gộp từ 4 bảng (SQL chỉ trích ≤ 100 ký tự) |
| `group-permissions-summary-medcom.csv` | 28 nhóm × số quyền theo từng cờ |
| `db-tables-medcom.csv` | 574 bảng: tiền tố, ý nghĩa, loại (danh mục/chứng từ/hệ thống...), số cột, PK, identity, số dòng, FK vào/ra, trigger, cờ có cột chuẩn |
| `sy-tables-columns.md` | Cột của toàn bộ 61 bảng `SY_*` |
| `tinphong-vs-medcom.csv` | Các tên form/menu quan sát được ở TinPhong và trạng thái tương ứng ở Medcom |

Không chép mật khẩu, chuỗi kết nối, tên đăng nhập hay họ tên người dùng. Nhóm người dùng (`SY_UserGroup`) chỉ là tên vai trò.

---

## 1. Tóm tắt nhanh

- **Menu Medcom (`SY_Menu`)**: 482 mục, sâu tối đa 3 cấp (15 gốc · 279 cấp 2 · 188 cấp 3). Đang bật 338; 144 bị tắt
  (101 tự tắt; 43 vừa tự tắt vừa có cha tắt). Không có mục nào "bật nhưng cha tắt". 3 phân hệ gốc tắt: `04` eOffice, `10` Quỹ thực tế, `14` Giá thành.
- **427 mục có FormName**, resolve được như sau: **181 báo cáo** (`*Report` → `ReportViewerFrm` + SP `<FormName>Stp`), **163 form động**
  (`SY_FrmLstTbl`), **75 form viết tay** (lớp C#), 2 lệnh hệ thống (`Logoff`, `Exit`), **6 không tìm thấy** (đều đang tắt).
  Tính riêng **301 mục đang bật**: 128 báo cáo, 122 form động (EDIT 65, LIST 52, LISTEDIT 4, LISTEDIT2 1), 49 form viết tay, 2 lệnh hệ thống.
- **Form động (`SY_FrmLstTbl`)**: 287 form (LIST 149, EDIT 122, LISTEDIT 12, LISTEDIT2 4). 167 form có menu trỏ tới, trong đó 126 qua menu đang bật.
  120 form không có menu nào: mở bằng nút, tra cứu combobox, hoặc không còn dùng.
  88 form trỏ tới bảng không tồn tại (70 `HR_dm*`, ER/EM...), là phần sót lại của DB mẫu. Các cột `TableDetail*` đều rỗng:
  quan hệ master-detail nay nằm trong `SY_FrmCfg` (slot `T1..T9`).
- **`SY_FrmCfg`**: bảng key-value 8 cột, dùng chung cho mọi loại layout. Theo snapshot, 38 % số dòng là thuộc tính control (`LYS*`),
  29 % thuộc tính bảng/lưới (`T0..T9`), 21 % bố cục ô nhập (`LYT*`), phần còn lại là thiết lập cấp form (toolbar, đánh số chứng từ, SQL hook).
  Mọi khóa đều giải mã được bằng mã nguồn Tools (`[Description]` tiếng Việt), trừ 2 khóa tàn dư.
- **Phân quyền**: 28 nhóm × 427 menu, tổng 11.961 dòng (ma trận gần như đầy đủ). Quyền hiệu lực = MAX(quyền nhóm, quyền nhóm của người ủy quyền,
  quyền riêng `SY_UserPermisstion`) theo khóa `FormName[_Para]`. Khi không có dòng quyền nào khớp, engine **mặc định cho phép**.
- **Schema MedData**: 574 bảng, 231 view, 647 SP, 110 function, 50 trigger. Tiền tố phân hệ chiếm đa số (AR 318 object, IV 175, AP 167, SY 147,
  GJ 130, FA 105, CF 86…). Quy ước hậu tố khá đều (`Tbl` 502/574 bảng, `Stp` 600/647 SP, trong đó `ReportStp` 316; `Fnc` 105/110; view `View`/`v*` 205/231).
- **So với TinPhong**: lược đồ các bảng `SY_*` cốt lõi và bộ khóa `SY_FrmCfg` **giống hệt nhau**, nên engine đã chuẩn hóa. Nội dung metadata
  (menu, form nghiệp vụ) thì **phân nhánh theo khách**: có 26 cặp MenuID↔FormName quan sát được, chỉ 9 cặp trùng. Có form riêng (BeeC/GDP ở TinPhong,
  BPTM/Inbound/InternalTransfer ở Medcom) và có lớp viết tay mang tên khách hàng ngay trong mã chung.

## 2. Cơ chế: từ menu đến màn hình (đọc từ mã dịch ngược)

### 2.1 Nạp menu

`Tools.Utils/Menus.cs` (khoảng dòng 688) đọc `SELECT * FROM <ModuleID>_GetUserMenuFnc('<user>') ORDER BY MenuID`.
Nếu hàm này lỗi thì đọc `SY_Menu WHERE isDisable = 0`. Cây menu dựng theo cột `Parent`, nạp theo thứ tự `MenuID`. Cột dùng thêm:
`MenuType` (1 = popup), `IconIndex`, `isBeginGroup` (vạch ngăn), `isBold`, `ShowDialog`. Mục không có FormName nhưng có MenuID dài
hơn 2 ký tự thì hiển thị thêm dấu " .".

`SY_GetUserMenuFnc` (MedData) hoạt động như sau:

- User `Admin`: lấy mọi menu có `isDisable = 0`.
- User khác: lấy UNION của
  1. menu mà nhóm của user có `IsRun = 1` (`SY_UserGroupPermisstion`),
  2. menu có quyền riêng của user (`SY_UserPermisstion`),
  3. hai nguồn trên của user ủy quyền (`SY_User.UserAuthority`),
  4. menu `isNotCheckPermission = 1` (Đăng xuất, Thoát...).

  Sau đó hàm tự thêm menu cha (tối đa 4 cấp) **mà không kiểm tra `isDisable` của cha**. Ở Medcom điều này không gây hệ quả,
  vì không có mục bật nằm dưới cha tắt.
- `ModuleID` quyết định bộ bảng: MedData có 3 bộ menu/quyền song song:
  - `SY_Menu` (482 dòng, ERP desktop),
  - `WA_Menu` (58) + `WA_UserGroupPermisstion`: "Web App"; form quản lý là `NguoiDungPhanQuyenWAFrm`, menu `010106`,
  - `KD_Menu` (93) + `KD_UserGroupPermisstion`: phân hệ "Kinh doanh".

### 2.2 Mở form khi bấm menu (`ERP/MainFrm.cs` · `MenuClick`, khoảng dòng 1231)

1. Ghi `Para` vào SharePara; nếu `Filter` khác rỗng thì gán `App.Cn.Filter`. Tên runtime của form là `FormName` hoặc `FormName_Para`.
   Tên runtime được dùng làm khóa cửa sổ, làm khóa phân quyền, và làm `FID` cấu hình riêng nếu có.
2. `GetFormAcc(FormName)`: **18 form chứng từ lõi khởi tạo cứng**: `AP_PurchaseFrm, AP_ReturnFrm, AP_ServiceFrm, AR_InvoiceFrm,
   AR_Invoice2017Frm, AR_ServiceFrm, AR_ReturnFrm, CS_PaymentFrm, CS_ReceiptFrm, IV_InOutFrm, IV_StockAdjustFrm, IV_StockInputFrm,
   IV_StockOutputFrm, IV_StockTranferFrm, IV_UnitCostProcessFrm, SetupFrm, PeriodSetupFrm, GJ_EntryFrm`.
3. `App.GetFormByName` (`Tools/App.cs`, dòng 490): trước tiên kiểm tra hạn hosting/bản quyền (theo số bản ghi), rồi theo thứ tự:
   1. **reflection** `SysObject.GetFormByNameEx`: tìm lớp kế thừa `Form` trùng tên (không phân biệt hoa thường, bỏ qua namespace)
      trong ERP.NET.exe hoặc Tools.dll;
   2. **`GetFormFromSQL`**: đọc `SY_FrmLstTbl WHERE FormID = ...` rồi chọn lớp theo `FormType`:
      `LIST`→`FrmFormList`, `LISTEDIT`/`LISTEDIT2`→`FrmFormListEdit`, `EDIT`→`FrmMasterDetail`, `EDITTOP`→`FrmMasterEditTop`,
      `POS`→`POSTableFrm`, `CALENDAR`→`FormCalendarFrm`, `TIMELINE`→`FormTimeLineFrm`, `TREE`→`FormTreeViewFrm`;
   3. **`GetFormForReport`**: nếu tên dài ≥ 8 ký tự và kết thúc bằng `Report`, đọc tham số của SP `<FormName>Stp`
      rồi mở `ReportViewerFrm` với file `Reports\<FormName>.rpx`;
   4. nếu không có kết quả: ghi log "Form not found". Riêng Admin được Ctrl+Click để tạo nhanh một dòng `SY_FrmLstTbl`.

   Hệ quả: **lớp viết tay luôn che** dòng `SY_FrmLstTbl` cùng tên. Ở Medcom có 4 menu như vậy: `AR_ServiceFrm` (0604; SY_FrmLstTbl EDIT), `AR_ReturnFrm` (0605; SY_FrmLstTbl EDIT), `EQ_EquipFrm` (1103; SY_FrmLstTbl LIST), `FA_AssetListFrm` (1205; SY_FrmLstTbl LISTEDIT).
4. Phân quyền khi mở/thao tác: `Functions.GetPermission(FormName)` (`Tools.Utils/Functions.cs`, dòng 1476), xem §7.
5. Lệnh đặc biệt không mở form: `Exit`, `LogOff`/`Logoff`, `WindowList`, cùng các TagString xử lý trong `Menus.SystemMenu_Action`
   (`RefreshSystem`, `SearchMenu`, `help`, `about`, đổi ngôn ngữ, đổi skin, `anydesk`/`UltraViewer`/`rustdesk`...).

Trong form động, combobox và nút "Thêm mới" của một field `X` tìm danh mục theo quy ước `SY_FrmLstTbl.PrimaryKey = 'X'`
(`Tools.Data/Connector.cs`, khoảng dòng 940–1110; có ưu tiên `SY_StTbl` `<Module>_AddNewKey_X`). Nguồn dropdown chi tiết nằm ở
`SY_FrmDrdwTbl` (2.361 dòng; snapshot không có).

## 3. Cây menu Medcom

Chi tiết từng mục: `data/menu-medcom.csv`. Cây các mục đang bật: `data/menu-medcom-tree.md`.

### 3.1 Theo phân hệ gốc

Các cột "Động / Viết tay / Báo cáo / Không thấy / Lệnh HT" chỉ đếm những mục có FormName **đang bật**.

| MenuID | Phân hệ (VN) | Trạng thái | Số mục con (mọi cấp) | Mục có FormName | Đang bật | Động | Viết tay | Báo cáo | Không thấy | Lệnh HT |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 01 | Hệ thống | bật | 28 | 25 | 20 | 2 | 16 | 0 | 0 | 2 |
| 02 | Danh mục | bật | 44 | 41 | 33 | 33 | 0 | 0 | 0 | 0 |
| 04 | eOffice | tắt (tự tắt) | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| 05 | Mua hàng | bật | 40 | 36 | 32 | 13 | 4 | 15 | 0 | 0 |
| 06 | Bán hàng | bật | 72 | 65 | 42 | 15 | 3 | 24 | 0 | 0 |
| 07 | Quản lý kho | bật | 57 | 53 | 40 | 18 | 6 | 16 | 0 | 0 |
| 08 | Kho thực tế | bật | 23 | 22 | 17 | 6 | 2 | 9 | 0 | 0 |
| 09 | Thu chi | bật | 13 | 13 | 10 | 1 | 4 | 5 | 0 | 0 |
| 10 | Quỹ thực tế | tắt (tự tắt) | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| 11 | Quản lý dụng cụ | bật | 12 | 12 | 8 | 1 | 3 | 4 | 0 | 0 |
| 12 | Tài sản | bật | 29 | 26 | 23 | 7 | 3 | 13 | 0 | 0 |
| 14 | Giá thành | tắt (tự tắt) | 11 | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| 16 | Tổng hợp | bật | 65 | 58 | 40 | 7 | 8 | 25 | 0 | 0 |
| 40 | Kinh doanh | bật | 44 | 38 | 23 | 12 | 0 | 11 | 0 | 0 |
| 60 | Nhân sự | bật | 23 | 21 | 13 | 7 | 0 | 6 | 0 | 0 |

### 3.2 Nhận xét

- **Báo cáo chiếm 42 % mục đang bật** (128/301). Chỉ 1/181 menu báo cáo thiếu SP `<FormName>Stp`. 124/181 có file `.rpx` cùng tên trong
  `D:\Data\Medcom\ERP_Medcom2026\Reports\`; 45 báo cáo đang bật chưa thấy file `.rpx` (có thể mẫu nằm trong `SY_RpFTbl`
  (2.441 dòng, có cột `FileContent`; `DesignerForm` lưu file báo cáo vào đây), hoặc mẫu được chọn qua tham số `@Template` (giá trị mặc định
  ở `SY_RpDTbl.PName = 'Template'`), hoặc báo cáo chỉ xuất lưới. Xem câu hỏi mở.
- **Form viết tay đang bật (49)**. Đây là phần **phải viết lại bằng code** cho bản web. Mọi lớp đều kế thừa trực tiếp `Form`;
  riêng `FA_AssetListFrm` vẫn đọc `SY_FrmCfg` (73 dòng):
  - **GetFormAcc trong MainFrm** (18): `AP_PurchaseFrm`, `AP_ReturnFrm`, `AP_ServiceFrm`, `AR_InvoiceFrm`, `AR_ReturnFrm`, `AR_ServiceFrm`, `CS_PaymentFrm`, `CS_PaymentFrm` (Para `Bank`), `CS_ReceiptFrm`, `CS_ReceiptFrm` (Para `Bank`), `GJ_Entryfrm`, `IV_StockAdjustFrm`, `IV_StockInputFrm`, `IV_StockOutputFrm`, `IV_StockTranferFrm`, `IV_UnitCostProcessFrm`, `PeriodSetupFrm`, `SetupFrm`
  - **lớp trong ERP.NET.exe** (21): `AP_PurchaseAllocateFrm`, `AR_StockInputFrm`, `AR_StockOutFrm`, `EQ_AllocateFrm`, `EQ_EquipFrm`, `EQ_LiquidateFrm`, `FA_AssetListFrm`, `FA_DepreciateFrm`, `FA_LiquidateFrm`, `GJ_AllocateFrm`, `GJ_AllocateSetupFrm`, `GJ_BalanceAccountFrm`, `GJ_BalanceItemFrm`, `GJ_BalanceObjectFrm`, `GJ_BalanceSheetSetupFrm`, `GJ_CashFlowSetupFrm`, `GJ_ProfitLossSetupFrm`, `GJ_RefDocumentSetupfrm`, `IV_CheckStockFrm`, `SY_LockDocumentFrm`, `ePostSettingViettelFrm`
  - **lớp trong Tools.dll** (10): `BackupDataFrm`, `ChangePasswordFrm`, `FiscalFrm`, `NguoiDungFrm`, `NguoiDungNhomFrm`, `NguoiDungPhanQuyenFrm`, `NguoiDungPhanQuyenWAFrm`, `RestoreDataFrm`, `SystemLangSetupFrm`, `UserLogFrm`
- **Para**: chỉ 3 menu dùng Para: `0504 AP_PurchaseFrm|Import` (đang tắt), `0920 CS_ReceiptFrm|Bank`, `0926 CS_PaymentFrm|Bank`.
  Chúng tương ứng với chứng từ `PII`, `CRB`, `CPB` trong `SY_DocSetup` (FormID `AP_PurchaseFrm_IMPORT`, `CS_ReceiptFrm_Bank`,
  `CS_PaymentFrm_Bank`). **Không menu nào dùng `Filter`.**
- **Không tìm thấy (6, đều tắt)**: `PropertyListFrm` (021206, tắt (tự tắt)), `Property2ListFrm` (021207, tắt (tự tắt)), `AP_InputRequestFrm` (0502, tắt (tự tắt)), `FA_Move2Frm` (1206, tắt (tự tắt)), `FA_Repair2Frm` (1208, tắt (tự tắt)), `PC_SteelCostFrm` (1460, tắt (tự tắt + cha tắt)).
- Mỗi FormName chỉ có 1 menu, trừ `AP_PurchaseFrm`, `CS_ReceiptFrm`, `CS_PaymentFrm` (mỗi cái 2 menu, khác nhau ở Para).

## 4. Danh mục form động (`SY_FrmLstTbl`)

File `data/forms-medcom.csv`. Cột chính lấy từ snapshot: `FormID, FormType, CaptionVN, TableName, PrimaryKey, TableDetail,
TableDetailLeftJoinField, TableDetailSelectFrom, TableDetail2…, Filter, FilterEx, AddNewColumnArr, DefaultColumnArr, LockColumnArr`.
Cột tôi tính thêm: `Prefix`, `TableObjectType`, `TableRows`, `FrmCfgRows`, `FrmCfgRowsVariants` (FID dạng `FormID_xxx`),
`OptionButtons`, `GridActions`, `FormActions`, `FormFilters`, `MenuCount`, `MenuIDs`, `MenuEnabled`, `ShadowedByClass`.
Có 7 cột trong DB mà snapshot không lấy: `CaptionEN, CaptionCH, HideColumnArr, SummaryColumnArr, PrimaryKeyFormat, PrimaryKeyLen, EditorColumnArr`.

### 4.1 Theo FormType

| FormType | Lớp engine | Ý nghĩa (`Functions.GetFormTypeList`) | Số form | Có menu bật |
|---|---|---|---:|---:|
| LIST | `FrmFormList` | Danh mục, sửa nhiều dòng trực tiếp trên lưới | 149 | 52 |
| EDIT | `FrmMasterDetail` | Chứng từ master-detail (nhập, xuất, thu, chi...) | 122 | 65 |
| LISTEDIT | `FrmFormListEdit` | Danh sách, sửa từng dòng như chứng từ | 12 | 4 |
| LISTEDIT2 | `FrmFormListEdit` (`ListFormType=LISTEDIT2`) | Biến thể của LISTEDIT | 4 | 1 |
| EDITTOP / POS / TIMELINE / CALENDAR / TREE | `FrmMasterEditTop` / `POSTableFrm` / `FormTimeLineFrm` / `FormCalendarFrm` / `FormTreeViewFrm` | Ô nhập phía trên lưới / ô vuông POS / tiến độ / lịch 30 ngày / cây | 0 | 0 |

### 4.2 Theo tiền tố phân hệ

| Tiền tố | Tổng | LIST | LISTEDIT | EDIT | LISTEDIT2 | Có menu | Menu đang bật | Có SY_FrmCfg |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| HR | 80 | 65 | 6 | 8 | 1 | 10 | 7 | 0 |
| AR | 50 | 7 | 0 | 43 | 0 | 42 | 27 | 7 |
| (không tiền tố) | 36 | 28 | 3 | 3 | 2 | 26 | 23 | 1 |
| IV | 22 | 1 | 0 | 21 | 0 | 22 | 17 | 21 |
| AP | 17 | 6 | 1 | 10 | 0 | 13 | 13 | 11 |
| CF | 17 | 11 | 1 | 4 | 1 | 17 | 11 | 0 |
| WA | 16 | 0 | 0 | 16 | 0 | 1 | 0 | 0 |
| GJ | 9 | 6 | 0 | 3 | 0 | 7 | 7 | 3 |
| FA | 8 | 4 | 1 | 3 | 0 | 8 | 8 | 6 |
| CS | 7 | 3 | 0 | 4 | 0 | 7 | 4 | 0 |
| ER | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| AG | 6 | 2 | 0 | 4 | 0 | 6 | 6 | 0 |
| EM | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| EI | 2 | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| EQ | 2 | 2 | 0 | 0 | 0 | 2 | 2 | 0 |
| PC | 2 | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| SY | 2 | 0 | 0 | 2 | 0 | 2 | 1 | 0 |
| WB | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |

Nhận xét:

- `HR` có 80 form (70 danh mục `HR_dm*`) nhưng chỉ 10 có menu: phần nhân sự trong DB mẫu chưa triển khai ở Medcom (bảng không tồn tại).
- `WA` có 16 form EDIT, chỉ `WA_OrderByContractFrm` có menu trong `SY_Menu` (`060020`, đang tắt). Các form này thuộc module Web App (`WA_Menu`).
- Form EDIT thường để trống `TableName` (87/122), vì bảng master khai báo ở `SY_FrmCfg` (`T0/TN`).
- `FilterEx` dùng cho các "danh mục con" của `CF_ObjectTbl` (`CustomerListFrm: isCustomer = 1`, `VendorListFrm: isVendor = 1`,
  `EmployeeListFrm: IsEmployee = 1`) và các form số dư (`isBalance = 1`). Đây là quy ước **một bảng đối tượng dùng chung, lọc theo cờ**.
- Có form mang tên khách khác ngay trong DB Medcom:
  - form động `AR_OrderVietDucFrm` (menu `06022`, đang bật, là "Quản lý đơn đặt hàng" chính);
  - form động `AR_HoSoKhachHangThanhTamFrm` (menu `4028`, tắt);
  - menu `4038` trỏ lớp viết tay `AR_OrderThanhTam2Frm` (tắt).

  Như vậy DB Medcom được nhân bản từ DB của khách khác hoặc DB mẫu.

## 5. `SY_FrmCfg`: cấu hình layout dạng key-value

### 5.1 Cấu trúc

Cột: `UserAutoID` (PK chuỗi tự sinh), `FID` (tên form/biến thể), `KeyID`, `SubID`, `KeyValue`, `SubValue`, `VDate`, `PFID`
(form cha, khi layout thuộc một user control). `LayoutX.LoadLayoutDB(FID)` (`Tools.Layout/LayoutX.cs`, dòng 1286) nạp mọi dòng của FID,
cache một ngày khi chỉ đọc, rồi chia cho các đối tượng con. Khi Admin lưu layout, engine **xóa toàn bộ dòng của FID rồi insert lại**.
Vì vậy `UserAutoID` thay đổi sau mỗi lần lưu, và `sys.partitions` dễ lệch.

Có 5 kiểu đánh địa chỉ:

| Kiểu | KeyID | SubID | KeyValue | SubValue | Lớp đọc |
|---|---|---|---|---|---|
| Cấp form | mã thuộc tính (`HBA`, `DPR`, `DMK`, `SP`, `EBE`...) | rỗng | giá trị | rỗng | `LayoutX`, `ToolBarSetting`, `CommonDocumentSetting`, `ExecSQLCommand`, `SearchAndSumSetting`, `TabMaster/TabDetail` |
| Đánh số chứng từ phụ | `DPR-1`, `DPR-2` (mã + `-ID`) | rỗng | giá trị | | `AutoDocNumberSetting` |
| Bảng / lưới | `T0` (master), `T1..T9`, `TA..TJ` (detail 1..19) | mã thuộc tính (`TN`, `PK`, `GD2`, `HDE`, `LCK`, `FKA1`...) | giá trị | rỗng | `TableInfoX` (142 thuộc tính) |
| Bố cục ô nhập | `LYT<tab>` (`LYT1..3`, `LYTX` cho user control) | tên field/control | chuỗi 21 trường `;` | thứ tự `001..` | `LayoutItemX.GetConfig/SetConfig` |
| Thuộc tính control | `LYS<tab>` / `LYSX` | tên field/control (`ObjectID`, `ExecSQLWithParaButtonCtl_1`...) | giá trị | **mã thuộc tính** | `PropertyX` + lớp `*PropertyX` của control |
| Phụ của bảng | `T{n}CS`, `T{n}C{k}`, `T{n}F{k}`, `T{n}V` | mã con | giá trị | | `ColumnSets` (nhóm tiêu đề cột), `GridDynamicColorFormat`, `GridConditionFormat`, `TabMaster` (tiêu đề tab) |

Chuỗi `LYT` gồm 21 trường, phân cách bằng `;`, theo thứ tự trong `LayoutItemX.GetConfig`:
`ControlType; SizeX; SizeY; isFirstPos; isReadOnly; CaptionWidth(85 = để trống); (bỏ trống); CaptionText; EditPermiss; VisiblePermiss;
DefaultValue; ComboWidth2; ToolTipDataCheck; ToolTipDataHint; EnableType; DefaultValueSQL; AnchorType; RequireValue; isDisableOrHidden; SizeP; SizeWebM`.

- `ControlType`: 1 EditX, 2 ComboX, 3 ComboCheckX, 4 DateX, 5 NumberX, 6 CheckX, 7 ColorPicker, 20 RadioX, 22 UserControl, 23 GroupBox,
  24 ButtonMenuX, 26 ButtonX, 28 LabelCaption, 30 HTML.
- `SizeX`/`SizeY`: đơn vị ô. 1X = 40 px, 1Y = 20 px ở font 8; 99 = full.
- Quyền (`Permission`): 0 AllUser, 2/3 khóa nếu có giá trị mặc định, 4/5 ẩn nếu có mặc định, 7 Manager, 9 Admin.
- `EnableType`: 1 Normal, 2 EditOrNew, 3 AddNewOnly, 4 EditOnly, 7 Manager, 9 Admin.

Trong snapshot, `LYT` có 294 EditX, 133 UserControl, 123 ComboX, 85 NumberX, 74 DateX, 16 CheckX, 2 ComboCheckX.
337 ô chỉ đọc, 19 ô bắt buộc nhập, 142 ô ghi đè nhãn.

### 5.2 Thống kê trong snapshot (3.419 dòng, 51 FID, 215 khóa phân biệt)

| Họ KeyID | Số dòng | Số form |
|---|---:|---:|
| LYS (thuộc tính control) | 1307 | 26 |
| LYT (bố cục control trên tab master) | 727 | 35 |
| TableInfoX (slot T0) | 408 | 50 |
| TableInfoX (slot T1) | 265 | 28 |
| TableInfoX (slot T2) | 154 | 21 |
| Form-level (ToolBarSetting) | 126 | 30 |
| TableInfoX (slot T4) | 84 | 7 |
| TableInfoX (slot T3) | 68 | 9 |
| Form-level (LayoutX) | 59 | 24 |
| GridConditionFormat (định dạng có điều kiện) | 55 | 9 |
| ColumnSets (nhóm cột lưới) | 48 | 6 |
| GridDynamicColorFormat (tô màu theo cột màu) | 46 | 15 |
| Form-level (ExecSQLCommand) | 39 | 19 |
| TabMaster/Tab caption | 19 | 7 |
| Form-level (CommonDocumentSetting) | 11 | 11 |
| Form-level (SearchAndSumSetting) | 2 | 2 |
| rác (dòng chú thích export lọt vào bảng) | 1 | 1 |

Ba mươi khóa phổ biến nhất. Bảng đầy đủ: `data/frmcfg-keys-medcom.csv`. Từ điển mọi khóa có trong mã nguồn: `data/winforms-property-keys-source.csv`.

| Họ | Khóa | Số dòng | Lớp.Thuộc tính (mã nguồn Tools) | Ý nghĩa (rút gọn từ `[Description]`) |
|---|---|---:|---|---|
| LYT | `LYT` | 727 | LayoutItemX.GetConfig/SetConfig (21 trường ;) | Vị trí/kích thước/loại control; SubValue = thứ tự hiển thị |
| TableInfoX (T0..TJ) | `PK` | 113 | TableInfoX.PrimaryKey | PrimaryKey on table |
| TableInfoX (T0..TJ) | `TN` | 113 | TableInfoX.TableName | Schema table, Insert, Update, Delete dữ liệu trên Table này |
| TableInfoX (T0..TJ) | `GD2` | 81 | TableInfoX.GridColumnOrdersFix | Grid Column Orders . Thứ tự các cột : ItemID;ItemName;Unit;Quantity... Có thể dùng Admin tools để lấy ds cột hiện tại |
| TableInfoX (T0..TJ) | `HDE` | 73 | TableInfoX.HideColumnArr | Ẩn cột trên lưới, Hide Column on grid |
| TableInfoX (T0..TJ) | `FKA1` | 61 | TableInfoX.Foreign_KeyAMain | Foreign_Key on master table A --> : A.DocumentID = B.DocID  |
| TableInfoX (T0..TJ) | `FKB1` | 61 | TableInfoX.Foreign_KeyB1 | Foreign_Key on join table B --> : A.DocumentID = B.DocID |
| TableInfoX (T0..TJ) | `TN1` | 61 | TableInfoX.TableName1 | Join table |
| TableInfoX (T0..TJ) | `SE1` | 61 | TableInfoX.SelectFields1 | Join field list : ObjectName, Address ...  |
| TableInfoX (T0..TJ) | `DCP` | 54 | TableInfoX.TabCaption | Tiêu đề của Tab detail chứa  grid detail. vd: chi tiết hàng hóa |
| LYS | `BTA` | 53 | AttachWebcamImagePropertyX.TitleText | Tiêu đề của hình ảnh, Mặc định là chữ : Hình ảnh |
| LYS | `STT` | 53 | AttachWebcamImagePropertyX.STT | Số thứ tự file hình trong Table, Thường là số chẵn : 2,4,6,8,10...18 |
| TableInfoX (T0..TJ) | `LCK` | 51 | TableInfoX.LockColumnArr | Readonly / LockColumn Column list on grid, khóa các cột này lại |
| LYS | `C3` | 50 | ExecSQLWithParaButtonPropertyX.ActionAfter | Chọn Action thực hiện sau khi bấm Command, vd : SaveContinue, SaveSkipErr, Edit, Save.. |
| LYS | `C4` | 50 | ExecSQLWithParaButtonPropertyX.SourceSQL | Lệnh SQL Command : SP_UpdateDataStp '{P}', N'{JSON}', N'{XML}',  {0}, '{1}', {2} ... / '{P}' là khóa chính nếu có  |
| LYS | `BT` | 49 | ExecSQLWithParaButtonPropertyX.ButtonText | Tiêu đề, Caption của Command |
| LYS | `BI` | 49 | ExecSQLWithParaButtonPropertyX.IconResource | Chon Icon cho button |
| LYS | `C2` | 49 | ExecSQLWithParaButtonPropertyX.ActionBefore | Chọn Action thực hiện trước khi bấm Command, vd : SaveContinue, SaveSkipErr, Edit, Save.. |
| LYS | `CS4` | 49 | ExecSQLWithParaButtonPropertyX.SQLCheckBeforeDoAction | MsgAction : Thực hiện SQL kiểm tra hợp lệ trước khi bấm nút. vd : kiểm tra không được duyệt nếu phiếu này đã xong rồi |
| LYS | `CS5` | 49 | ExecSQLWithParaButtonPropertyX.SQLCheckBeforeDoActionPara | Param cho SQL command, vd du : DocumentID;ObjectID |
| LYS | `02` | 49 | ExecSQLWithParaButtonPropertyX.Name1 | Tên Para |
| LYS | `05` | 47 | ExecSQLWithParaButtonPropertyX.DefaultValueFromMaster1 | Giá trị mặc định lấy từ Master data, vd : ObjectID |
| LYS | `LBEX` | 47 | ExecSQLWithParaButtonPropertyX.LockUnlockByExpression | Expression = True là lock, false là Unlock, vd : isDisable > 0 or StatusID = 7 |
| LYS | `03` | 47 | ExecSQLWithParaButtonPropertyX.ReadonlyParam1 | Readonly |
| LYS | `0A` | 47 | ExecSQLWithParaButtonPropertyX.RequireParam1 | Bắt buộc phải chọn |
| LYS | `2A` | 47 | ExecSQLWithParaButtonPropertyX.RequireParam2 | Bắt buộc phải chọn |
| LYS | `BC` | 46 | ExecSQLWithParaButtonPropertyX.BackColor | BackColor, Chọn màu nền, Muốn bỏ màu nền thì chọn Tranparent (Trong Tab Web Color) |
| LYS | `22` | 45 | ExecSQLWithParaButtonPropertyX.Name2 | Tên para |
| TableInfoX (T0..TJ) | `SO` | 45 | TableInfoX.SortByFields | Order by / Sort by Fields in Select command |
| LYS | `C1` | 41 | ExecSQLWithParaButtonPropertyX (không có thuộc tính đọc khóa này) |  |

User control xuất hiện trong `LYS`: `ExecSQLWithParaButtonCtl` (887 dòng / 50 instance), `StatusButtonCtl` (141 / 21),
`AttachWebcamImageControlCtl` (106 / 30), `PrintButtonCtl` (96 / 24), `WebLinkViewerCtl` (42 / 9), `CommandButtonCtl` (35 / 4).
Nghĩa là các form workflow 2026 của Medcom **đưa nút nghiệp vụ vào layout**: nút "Gửi/Duyệt/Từ chối" có form nhập tham số (`01..9C`),
SQL kiểm tra (`CS4`), SQL thực thi (`C4`), action trước/sau (`C2`/`C3`), khóa theo biểu thức (`LBEX`). Cách cũ dùng bảng `SY_FrmOptBtnTbl` thì ít hơn.

Dòng chưa giải mã:

- `C1` (41 dòng) và `P1` (12 dòng) gắn với `ExecSQLWithParaButtonCtl`. Lớp property hiện tại không đọc hai khóa này;
  có thể là tàn dư khi control được đổi từ `CommandButtonCtl`, vì ở lớp đó `C1` = ActionType và `P1` = Para.
- 1 dòng rác `KeyID = "-- Export SY_FrmCfg , Rows"` (FID `AR_OrderComfirmFrm`), do script export bị import nhầm.

### 5.3 Ví dụ 1: form LIST `AP_BPTMShipmentsFrm` ("BPTM - Theo dõi đợt hàng")

**Form `AP_BPTMShipmentsFrm`** — FormType `LIST`, tiêu đề "BPTM - Theo dõi đợt hàng"; menu: `059901` Mua hàng > Theo dõi đợt hàng (bật); 9 dòng `SY_FrmCfg`.


Thiết lập cấp form:

| KeyID | Giá trị | Thuộc tính | Ý nghĩa |
|---|---|---|---|
| `HBA` | `1` | ToolBarSetting.HideAddNewButton | Hide Addnew button on toolbar, Ẩn nút Thêm mới trên thanh toolbar |
| `HBC` | `1` | ToolBarSetting.HideCopyButton | Hide Copy button on toolbar, Ẩn nút Copy trên thanh toolbar |
| `HBD` | `1` | ToolBarSetting.HideDeleteButton | Hide Delete button on toolbar, Ẩn nút Xóa trên thanh toolbar |
| `HBE` | `1` | ToolBarSetting.HideEditButton | Hide Edit button on toolbar, Ẩn nút Sửa trên thanh toolbar |

Bảng slot `T0` (Master): `TN`=`AP_BPTMShipmentsListView`, khóa `PK`=`ShipmentKey`.

| SubID | Giá trị | Thuộc tính TableInfoX | Ý nghĩa |
|---|---|---|---|
| `GD2` | `OrderDocumentID;ShipmentNo;PurchaseTypeName;SupplierObjectName;PICUser;OrderDate;InboundRe…` | GridColumnOrdersFix | Grid Column Orders . Thứ tự các cột : ItemID;ItemName;Unit;Quantity... Có thể dùng Admin t |
| `GD2A` | `OrderDocumentID;ShipmentNo;PurchaseTypeName;SupplierObjectName;PICUser;OrderDate;InboundRe…` | GridColumnOrdersDefault | Thứ tự các cột mặc định khi bấm reset : ItemID;ItemName;Unit;Quantity... Có thể dùng Admin |
| `HDE` | `ShipmentKey;ShipmentID;POStatusCode;POObjectID;SupplierObjectID;InboundOrderTypeID;Receipt…` | HideColumnArr | Ẩn cột trên lưới, Hide Column on grid |
| `PK` | `ShipmentKey` | PrimaryKey | PrimaryKey on table |
| `TN` | `AP_BPTMShipmentsListView` | TableName | Schema table, Insert, Update, Delete dữ liệu trên Table này |

Cột lưới `T0` theo thứ tự `GD2` (25 cột hiển thị cố định; bảng có 46 cột):

| # | Cột | Kiểu (columns.json) | Ghi chú |
|---:|---|---|---|
| 1 | `OrderDocumentID` | varchar(30) NOT NULL |  |
| 2 | `ShipmentNo` | int NOT NULL |  |
| 3 | `PurchaseTypeName` | nvarchar(30) |  |
| 4 | `SupplierObjectName` | nvarchar(300) |  |
| 5 | `PICUser` | varchar(50) |  |
| 6 | `OrderDate` | datetime |  |
| 7 | `InboundRequestDocumentID` | varchar(50) |  |
| 8 | `POStatusName` | nvarchar(100) |  |
| 9 | `PlannedQuantity` | decimal(38,4) |  |
| 10 | `ReceivedQuantity` | decimal(38,4) |  |
| 11 | `RemainingToReceiveQuantity` | decimal(38,4) |  |
| 12 | `SupplierDeliveryDocNo` | nvarchar(100) |  |
| 13 | `SupplierDeliveryDocDate` | date |  |
| 14 | `DueDays` | smallint |  |
| 15 | `SupplierDueDate` | datetime |  |
| 16 | `DaysUntilSupplierDue` | int |  |
| 17 | `SupplierCurrencyID` | varchar(3) |  |
| 18 | `SupplierPayableAmount` | decimal(38,0) |  |
| 19 | `AllocatedPaymentAmount` | decimal(38,2) |  |
| 20 | `RemainingSupplierPayable` | decimal(38,0) |  |
| 21 | `PaymentDisplayStatus` | nvarchar(80) |  |
| 22 | `EstimatedImportTaxVND` | decimal(28,2) |  |
| 23 | `PlannedTaxPaymentDate` | datetime |  |
| 24 | `TaxPaymentStatusName` | nvarchar(13) NOT NULL |  |
| 25 | `TaxPaymentDate` | date |  |

Nút/hành động từ `SY_FrmOptBtnTbl (option_buttons)`:

| KeyID | Caption | Action | Source (rút gọn) | Para | Before/After | Tắt? |
|---|---|---|---|---|---|---|
| 983 | Dự kiến nộp thuế | ExecSQL | `dbo.AP_BPTMUI_PrepareShipmentEntryV13Stp '{0}','{User}','TAX_PLAN'` | ShipmentKey | None/Reload |  |
| 981 | Xem tóm tắt đơn đặt hàng | ExecSQL | `AP_BPTMShipment_ShowSummaryStp '{0}'` | ShipmentKey | None/None |  |
| 984 | Xác nhận nộp thuế | ExecSQL | `dbo.AP_BPTMUI_PrepareShipmentEntryV13Stp '{0}','{User}','TAX_PAID'` | ShipmentKey | None/Reload |  |
| 982 | Nhập hạn thanh toán | ExecSQL | `dbo.AP_BPTMUI_PrepareShipmentEntryV13Stp '{0}','{User}','DUE'` | ShipmentKey | None/Reload |  |
| 985 | Mở form dự kiến nộp thuế (thử) | ShowUserForm | `AP_BPTMTaxPlanEntryFrm` | OrderDocumentID | None/None | tắt |

**Mô tả màn hình:**

- `FrmFormList` hiển thị một lưới trên view `AP_BPTMShipmentsListView` (46 cột), khóa dòng `ShipmentKey`.
- Toolbar ẩn Thêm/Sửa/Xóa/Copy (`HBA/HBE/HBD/HBC = 1`), nên đây là **danh sách chỉ đọc**. Lọc, in, xuất Excel vẫn giữ mặc định.
- Lưới hiện 25 cột theo đúng thứ tự `GD2`, thứ tự này cũng là mặc định khi người dùng bấm reset (`GD2A`). 21 cột kỹ thuật bị ẩn (`HDE`).
  Nhãn cột lấy từ `SY_FmtFldTbl`; snapshot không có bảng này nên chỉ biết tên field.
- Menu "Tùy chọn" có 4 nút `ExecSQL` chạy trên dòng đang chọn (`{0}` = `ShipmentKey`, `{User}` = người đăng nhập). Ba nút mở bước nhập
  hạn thanh toán / dự kiến nộp thuế / xác nhận nộp thuế (cùng SP, khác tham số chế độ) rồi `Reload`. Nút thứ tư chỉ hiển thị tóm tắt.
  Nút thứ 5 (`ShowUserForm` → `AP_BPTMTaxPlanEntryFrm` với `WhereStr OrderDocumentID = '{0}'`) đang tắt.

### 5.4 Ví dụ 2: form EDIT master-detail `FA_Move2026Frm` ("Phiếu di chuyển / bàn giao máy")

**Form `FA_Move2026Frm`** — FormType `EDIT`, tiêu đề "Phiếu di chuyển / bàn giao máy"; menu: `1207` Tài sản > Phiếu di chuyển / bàn giao máy (bật); 33 dòng `SY_FrmCfg`.


Thiết lập cấp form:

| KeyID | Giá trị | Thuộc tính | Ý nghĩa |
|---|---|---|---|
| `DFP` | `DocumentDate` | LayoutX.DocumentDateField | DocumentDate, Ngay, PeriodID, Quy, QuarterID, YearID, Nam..., Nếu là Ngày dùng để tính STT của Phiếu, nếu kỳ kế toán đã  |
| `DMK` | `{P}{MM}{YY}/{4}` | CommonDocumentSetting.DocumentMask | Document Mask, Lấy từ hệ thống hoặc là : {P}{MM}{YY}/{3}, {P}{MM}{YY}{3}, {P}{MM}{YY}/{4}, {P}{MM}{YY}{4}, {P}{YY}{MM}/{ |
| `DPR` | `MLI` | LayoutX.DocumentPrefix | Ký tự đầu của phiếu, Document Prefix : KH, .. {BranchID} , {User}, {CostCenterID}, {StoreHouseID} ... nếu muốn tăng theo |
| `SP` | `9` | LayoutX.DocumentFilterType | Hiện Control lọc chứng từ trên toolbar,Chọn loại lọc theo Kỳ (Tháng), Quý, Năm hoặc từ ngày đến ngày(DateToDate),  theo  |

Bảng slot `T0` (Master): `TN`=`FA_MoveTbl`, khóa `PK`=`DocumentID`.

| SubID | Giá trị | Thuộc tính TableInfoX | Ý nghĩa |
|---|---|---|---|
| `GD2` | `DocumentID;DocumentDate;MoveTypeID;NguoiGiao;NguoiNhan;ReferenceNo;Memo;Notes;isLock` | GridColumnOrdersFix | Grid Column Orders . Thứ tự các cột : ItemID;ItemName;Unit;Quantity... Có thể dùng Admin t |
| `PK` | `DocumentID` | PrimaryKey | PrimaryKey on table |
| `SO` | `DocumentDate Desc, DocumentID Desc` | SortByFields | Order by / Sort by Fields in Select command |
| `TN` | `FA_MoveTbl` | TableName | Schema table, Insert, Update, Delete dữ liệu trên Table này |

Cột lưới `T0` theo thứ tự `GD2` (9 cột hiển thị cố định; bảng có 18 cột):

| # | Cột | Kiểu (columns.json) | Ghi chú |
|---:|---|---|---|
| 1 | `DocumentID` | varchar(30) NOT NULL |  |
| 2 | `DocumentDate` | datetime NOT NULL |  |
| 3 | `MoveTypeID` | varchar(30) NOT NULL |  |
| 4 | `NguoiGiao` | nvarchar(150) |  |
| 5 | `NguoiNhan` | nvarchar(150) |  |
| 6 | `ReferenceNo` | nvarchar(100) |  |
| 7 | `Memo` | nvarchar(150) |  |
| 8 | `Notes` | nvarchar(150) |  |
| 9 | `isLock` | bit NOT NULL |  |

Cột còn lại của bảng không nằm trong `GD2` và không ẩn (vẫn có thể hiện sau các cột cố định): `UserCreate`, `UserUpdate`, `DateUpdate`, `DateCreate`, `ContractID`, `EffectiveFrom`, `EffectiveTo`, `ReferenceDate`, `DocumentLink`.

Bảng slot `T1` (Detail 1): `TN`=`FA_MoveDetailTbl`, khóa `PK`=`UserAutoID`.

| SubID | Giá trị | Thuộc tính TableInfoX | Ý nghĩa |
|---|---|---|---|
| `DCP` | `Chi tiết di chuyển / bàn giao` | TabCaption | Tiêu đề của Tab detail chứa  grid detail. vd: chi tiết hàng hóa |
| `FKA1` | `AssetID` | Foreign_KeyAMain | Foreign_Key on master table A --> : A.DocumentID = B.DocID  |
| `FKB1` | `AssetID` | Foreign_KeyB1 | Foreign_Key on join table B --> : A.DocumentID = B.DocID |
| `GD1` | `2` | GridHeaderLines | Grid HeaderLines. 0 = ẩn header, Chiều cao của header Caption : 1,2... |
| `GD2` | `AssetID;AssetName;Unit;Quantity;DepartmentID;ObjectID;CostCenterID;CostID;FromObjectID;Fro…` | GridColumnOrdersFix | Grid Column Orders . Thứ tự các cột : ItemID;ItemName;Unit;Quantity... Có thể dùng Admin t |
| `HDE` | `UserAutoID;DocumentID` | HideColumnArr | Ẩn cột trên lưới, Hide Column on grid |
| `LCK` | `AssetName;LifecycleStatusAfter` | LockColumnArr | Readonly / LockColumn Column list on grid, khóa các cột này lại |
| `PK` | `UserAutoID` | PrimaryKey | PrimaryKey on table |
| `SE1` | `A.AssetName, A.Unit` | SelectFields1 | Join field list : ObjectName, Address ...  |
| `SUM` | `Quantity` | SummaryColumnArr | Summary Column list on grid |
| `TN` | `FA_MoveDetailTbl` | TableName | Schema table, Insert, Update, Delete dữ liệu trên Table này |
| `TN1` | `FA_AssetTbl` | TableName1 | Join table |

Cột lưới `T1` theo thứ tự `GD2` (23 cột hiển thị cố định; bảng có 23 cột):

| # | Cột | Kiểu (columns.json) | Ghi chú |
|---:|---|---|---|
| 1 | `AssetID` | varchar(50) NOT NULL |  |
| 2 | `AssetName` | từ bảng join | khóa sửa (LCK), A.AssetName (join FA_AssetTbl: AssetID=AssetID) |
| 3 | `Unit` | từ bảng join | A.Unit (join FA_AssetTbl: AssetID=AssetID) |
| 4 | `Quantity` | decimal(18,2) | dòng tổng (SUM) |
| 5 | `DepartmentID` | varchar(50) |  |
| 6 | `ObjectID` | varchar(50) |  |
| 7 | `CostCenterID` | varchar(50) |  |
| 8 | `CostID` | varchar(50) |  |
| 9 | `FromObjectID` | varchar(100) |  |
| 10 | `FromStoreHouseID` | varchar(50) |  |
| 11 | `ToStoreHouseID` | varchar(50) |  |
| 12 | `FromLocation` | nvarchar(500) |  |
| 13 | `ToLocation` | nvarchar(500) |  |
| 14 | `ToLocationID` | nvarchar(50) |  |
| 15 | `ToQuanHuyen` | nvarchar(50) |  |
| 16 | `ToXaPhuong` | nvarchar(50) |  |
| 17 | `ToChuyenKhoa` | nvarchar(250) |  |
| 18 | `ToZoneID` | nvarchar(50) |  |
| 19 | `HandoverDate` | datetime |  |
| 20 | `HandoverComponents` | nvarchar(max) |  |
| 21 | `AssetCondition` | nvarchar(1000) |  |
| 22 | `LifecycleStatusAfter` | varchar(30) | khóa sửa (LCK) |
| 23 | `Notes` | nvarchar(150) |  |

Bố cục ô nhập `LYT1` (tab master 1, sắp theo `SubValue`):

| STT | Control/Field | Loại control | Rộng×Cao | Kiểu dữ liệu (bảng master) | Cờ |
|---:|---|---|---|---|---|
| 001 | `DocumentID` | EditX (ô nhập text) | X4×Y1 | varchar(30) NOT NULL | xuống dòng mới |
| 002 | `DocumentDate` | DateX (ngày) | X4×Y1 | datetime NOT NULL |  |
| 003 | `MoveTypeID` | ComboX (danh sách chọn) | X6×Y1 | varchar(30) NOT NULL | rộng nhãn 110 |
| 004 | `NguoiGiao` | EditX (ô nhập text) | X7×Y1 | nvarchar(150) | xuống dòng mới |
| 005 | `NguoiNhan` | EditX (ô nhập text) | X7×Y1 | nvarchar(150) |  |
| 006 | `ContractID` | ComboX (danh sách chọn) | X6×Y1 | nvarchar(100) | xuống dòng mới |
| 007 | `EffectiveFrom` | DateX (ngày) | X4×Y1 | datetime |  |
| 008 | `EffectiveTo` | DateX (ngày) | X4×Y1 | datetime |  |
| 009 | `ReferenceNo` | EditX (ô nhập text) | X6×Y1 | nvarchar(100) | xuống dòng mới |
| 010 | `ReferenceDate` | DateX (ngày) | X4×Y1 | datetime |  |
| 011 | `Memo` | EditX (ô nhập text) | X14×Y1 | nvarchar(150) | xuống dòng mới |
| 012 | `Notes` | EditX (ô nhập text) | X14×Y1 | nvarchar(150) | xuống dòng mới |
| 013 | `DocumentLink` | EditX (ô nhập text) | X14×Y1 | nvarchar(1000) | xuống dòng mới |

**Mô tả màn hình** (`FrmMasterDetail`, chứng từ `FAM` trong `SY_DocSetup`):

- **Danh sách chứng từ** (lưới master): bảng `FA_MoveTbl`, khóa `DocumentID`, sắp `DocumentDate Desc, DocumentID Desc`, 9 cột cố định
  (`GD2`). Toolbar có ô lọc theo **kỳ** (`SP = 9` → `DocFilterType.Period`). Nút Thêm/Sửa/Xóa/Copy/In giữ mặc định, vì không có khóa `HB*`.
- **Đánh số chứng từ**: tiền tố `MLI` (`DPR`) + mặt nạ `{P}{MM}{YY}/{4}` (`DMK`), đếm theo `DocumentDate` (`DFP`). Ví dụ `MLI1026/0001`.
  `SY_DocSetup` lại ghi tiền tố `DCTS` cho `FAM`; xem câu hỏi mở.
- **Tab master 1** (`LYT1`), 13 ô xếp theo hàng. `isFirstPos = 1` nghĩa là xuống dòng, độ rộng tính theo X×40 px:
  - Hàng 1: `DocumentID` (X4) · `DocumentDate` (ngày, X4) · `MoveTypeID` (combo, X6, nhãn 110 px)
  - Hàng 2: `NguoiGiao` (X7) · `NguoiNhan` (X7)
  - Hàng 3: `ContractID` (combo X6) · `EffectiveFrom` · `EffectiveTo` (ngày)
  - Hàng 4: `ReferenceNo` · `ReferenceDate`
  - Hàng 5–7: `Memo`, `Notes`, `DocumentLink`, mỗi ô X14

  Combobox `ContractID` tự tra theo quy ước PrimaryKey (`ContractListFrm`). `MoveTypeID` không có form nào có `PrimaryKey = MoveTypeID`,
  nên nguồn nằm ở `SY_FrmDrdwTbl` (không có trong snapshot); bảng có thể là `FA_MovementTypeTbl` (14 dòng).
- **Tab detail "Chi tiết di chuyển / bàn giao"** (`T1`): bảng `FA_MoveDetailTbl` (PK `UserAutoID`), nối master qua `DocumentID`
  (mặc định = PK master). Join `FA_AssetTbl` theo `AssetID` để lấy `AssetName`, `Unit`. 23 cột theo `GD2`, header 2 dòng.
  `AssetName` và `LifecycleStatusAfter` bị khóa. Có dòng tổng `Quantity`. `UserAutoID` và `DocumentID` bị ẩn.
- **Logic ngoài form**: trigger `TR_FA_MoveTbl_LifecycleSync`, `TR_FA_MoveDetail_LifecycleSync`, `TR_FA_MoveDetail_TerritorySnapshot`
  cập nhật vòng đời tài sản khi lưu. Bản web phải giữ DB làm nơi thực thi các quy tắc này.

## 6. Nút / hành động / ô lọc

File gộp `data/form-actions-medcom.csv` (192 dòng). Một số dòng có SQL dài; CSV chỉ giữ ≤ 100 ký tự.

| Bảng (snapshot) | Kích hoạt | Cột chính | Số dòng / form | Phân bố |
|---|---|---|---|---|
| `SY_FrmOptBtnTbl` (`option_buttons`) | Nút trên OptionBar / menu "Tùy chọn" của form hoặc của một grid (`GridName`: `grdChitiet` 54, `grdList` 9, `grdChitiet2` 2) | `KeyID` (thứ tự), `Caption`, `Action`, `Source`, `WhereStr`, `Para`, `RequireFieldArr`, `BeforeAction`, `AfterAction`, `EnableStatus`, `ReturnMasterField`, `ReturnDetailField`, `RefTable/RefCompareField/RefDisplayField*` (để trống), `IsMultiSelect`, `IsRecordCompare`, `IsDisable` | 91 / 50 form (58 đang bật) | Action: `ShowSelectForm` 44 · `ExecSQL` 26 · `ShowUserForm` 17 · `UserControlX` 2 · `ShowSelectListDetail` 2. Before: `SaveSkipErr` 43 · `Save` 22 · `None` 6 · `SaveContinue` 1. After: `Reload` 26 · `None` 9. EnableStatus: `AddOrEdit` 44 · `None` 19 |
| `SY_FrmGrdActTbl` (`grid_actions`) | Khi người dùng đổi giá trị cột `ColumnID` trên lưới | `GridName`, `ColumnID`, `ActType` (= `ExecSQL`), `Action`, `Source`, `Para` (cho phép `Master.<Field>`), `TargetColumn`, `TargetValue` | 52 / 31 form (17 tắt) | `UpdateColumn` 49 · `UpdateColumnIfEmpty` 2 · `ShowMsg` 1. 42/52 kích hoạt theo `ItemID` |
| `SY_FrmMstActTbl` (`form_actions`) | Khi đổi field master, hoặc sự kiện `MaterAction = acAfterSaved` | `MaterAction`, `Action`, `ActType`, `Source`, `Para`, `ColumnID`, `TargetColumn`, `Oderby` | 31 / 24 form (7 tắt) | `UpdateColumn` 26 · `ExecSQL` sau khi lưu 3 · `BeforeUpdateColumn` 2 |
| `SY_FrmFltTbl` (`form_filters`) | Ô lọc trên toolbar | `KeyID`, `ColumnID`, `Caption`, `Type` (enum `SearchControlTypes`), `Source`, `ValueColumn`, `DisplayColumn`, `DefaultValue`, `DefaultValueSQL`, `Operator`, `WhereString` | 18 / 9 form (DB có ≈ 244) | `Type` 3 = ComboBox (11), 11 = UserControlX (1), rỗng = TextBox (6). `SearchControlTypes`: 0 Text, 1 Date, 2 Number, 3 Combo, 4 ComboCheck, 5 Check, 6 Radio, 9 Period, 10 DocumentType, 11 UserControlX, 12 CurrentDate, 13 DateToDate, 14 Quarter, 15 Year, 16 ButtonExeSQL, 17 TopRecord, 18 UserFilterCombo, 30–33/50–53 lọc trên detail 1/2 |

Các loại `Action` của nút (`Functions` danh sách mẫu, khoảng dòng 10257):

| Action | Ý nghĩa |
|---|---|
| `ShowSelectForm` | Mở form chọn master-detail từ một view `*SelectView`, rồi đổ dữ liệu về master (`ReturnMasterField`) và detail (`ReturnDetailField`). Ví dụ: "Chọn đơn đặt hàng" → `AR_OrderSelectView` (8), `AP_OrderSelectView` (6), `AP_InputRequestSelectView`, `IV_InputPurchaseSelectView`... |
| `ShowSelectList` / `ShowSelectListDetail` | Chọn dữ liệu master / dòng detail từ một câu `SELECT` |
| `ExecSQL` | Chạy SP/SQL với tham số `{0}`, `{1}`… lấy theo thứ tự `Para`. Có thể dùng `{User}`, `{BranchID}`, `{P}` (khóa chính), `N'{JSON}'`, `N'{XML}'` (toàn bộ chứng từ). SP trả thông điệp bằng `SELECT N'…' AS Msg, 1 AS MsgType` hoặc `RAISERROR`. Ví dụ: `AP_Purchase_Make_Output_Stp '{0}' , '{User}'` ("Tạo phiếu xuất kho", 9 form) |
| `ExecSQLShowData` / `ExecSqlLoadField` | Chạy SQL rồi hiển thị kết quả / nạp giá trị trả về vào field hiện tại |
| `ShowUserForm` / `ShowMultiUserForm` | Mở form khác theo tên, có `WhereStr`. Ví dụ: `CombineCodeListFrm` (gộp mã, 11), `CategoryAutoItemIDFrm`, `ObjectGroupAutoObjectIDFrm`, `ItemInvAccountUpdateFrm` |
| `ShowPrint` | In bằng SP báo cáo |
| `UserControlX` | Nạp một user control viết thêm, ví dụ `ExecSQLWithParaButtonCtl` |
| `DataEditorFrm` / `SelectMasterDetailFrm` / `SelectCreateDataFrm` | Form engine: nhập liệu tự vẽ (F12), chọn master-detail, chuyển dữ liệu sang phân hệ khác |

`BeforeAction` / `AfterAction`:

- `SaveContinue` / `SaveContinueCheckDetail`: lưu, dừng nếu lỗi.
- `SaveSkipErr`: lưu, lỗi vẫn chạy tiếp.
- `Save`: lưu rồi chuyển sang chế độ xem.
- `Edit`: chuyển sang chế độ sửa.
- `None`: không làm gì.
- `Reload` / `ReloadCurrent` / `ReloadDetail`: nạp lại toàn bộ / dòng master hiện tại / phần detail.

Ví dụ hành động lưới: khi đổi `ItemID`, engine gọi `SY_GetItemUnitPriceStp '{0}' , '{1}' , '{2}'` với `Para = Master.DocumentDate;Master.ObjectID;ItemID`
rồi cập nhật `UnitPrice;Notes2;ChietKhau1..4` (16 form bán hàng), hoặc gọi `SY_GetItemUnitCostStp` để lấy giá vốn (9 form).
Ví dụ hành động master: khi đổi `ObjectID` ở hóa đơn bán (17 form), gọi `AR_InvoiceGetObjectManagerAndEmployeeStp '{0}'` để điền `EmployeeID;ManagerID`.

Ngoài 4 bảng trên, form workflow mới còn khai báo nút và hook trong `SY_FrmCfg`:

- Nút dạng control (`LYS*`, §5.2).
- Hook cấp form: `EBE` (kiểm tra trước khi sửa, 17 form), `EBD` (trước khi xóa, 16), `EBS` (trước khi lưu), `ESS` (sau khi lưu),
  `ES6`/`ES7` (nạp lại sau khi lưu), `SUD` (cộng detail lên master).

Ví dụ `EBE` của `IV_GoodsQualityControlConfirmFrm`: `SELECT N'Bạn không thể sửa đề nghị đã gửi' as Msg, 1 as MsgType from
IV_InboundRequestTbl where DocumentID = '{0}' and StatusID NOT IN (6, 7)`.

## 7. Phân quyền

### 7.1 Cấu trúc

| Bảng | Cột | Ghi chú |
|---|---|---|
| `SY_UserGroup` (28) | `UserGroupID` (PK), `UserGroupName`, `IsDisable`, `BranchID` | 3 nhóm gắn chi nhánh (`MB`/`MN`), 25 nhóm dùng chung |
| `SY_UserGroupPermisstion` (11.961) | `ID` (PK), `UserGroupID`, `MenuID`, `IsRun`, `IsAdd`, `IsUpdate`, `IsDelete`, `isManager`, `isAdmin`, `isAutoLock`, `isHideAmount`, `isLockDoc`, `isUnLockDoc`, `isExportExcel` | Snapshot thiếu `ID`, `isHideAmount`, `isExportExcel`. Không có ràng buộc duy nhất (UserGroupID, MenuID): có 5 cặp trùng |
| `SY_UserPermisstion` (17.934) | `ID`, `UserName`, `MenuID` + đúng các cờ trên | Quyền riêng theo người dùng, **không có trong snapshot** |
| `SY_User` (42) | `UserName`, `UserGroupID`, `UserAuthority` (ủy quyền), `BranchID`, `StoreHouseID`, `CostCenterID`, `EmployeeID`, `ManagerID`, `StartupForm`... | Mỗi user thuộc **1 nhóm**. Không đọc dữ liệu (có cột mật khẩu) |
| `SY_UserGroupDetail` (168), `SY_UserBranch`, `SY_UserStorehouse` | Thuộc tính mở rộng nhóm, phạm vi chi nhánh/kho | Không có trong snapshot |
| `WA_*`, `KD_*` | Bộ `Menu/UserGroupPermisstion/UserPermisstion` riêng cho Web App và phân hệ KD | WA: 58 menu, 1.345 / 2.016 dòng quyền; KD: 93 menu, 1.155 / 7.007 |

Ý nghĩa các mức quyền (`PermissionType` trong `Functions.GetPermission`):

- `IsRun` = xem/mở form (và hiện menu).
- `IsAdd` / `IsUpdate` / `IsDelete` = thêm / sửa / xóa.
- `isManager` = sửa/xem chứng từ của người khác; mở các cột/ô khóa mức Manager (`LCK2`, `HDE2`, quyền 7 trong `LYT`).
- `isAdmin` = quyền cao nhất trên form (mức 9).
- `isAutoLock` = tự khóa chứng từ sau khi lưu.
- `isLockDoc` / `isUnLockDoc` = khóa / mở khóa chứng từ.
- `isHideAmount` = ẩn các cột tiền (`ACP`).
- `isExportExcel` = được xuất Excel.

**Cách tính**: lấy MAX từng cờ trên UNION của (quyền nhóm của user) + (quyền nhóm của user ủy quyền) + (quyền riêng user). Chỉ xét
menu có `isDisable = 0` và `FormName + '_' + Para` trùng tên runtime của form. Sau đó:

- `View` = `IsRun` OR bất kỳ cờ thêm/sửa/xóa/manager/admin nào; `isAdmin` kéo theo `isManager`.
- Giá trị NULL được thay bằng mặc định: `isLockDoc` NULL → **true**, `isUnLockDoc`/`isAutoLock`/`isHideAmount`/`isExportExcel` NULL → false.

**Khi không tìm được dòng quyền nào** (form mở bằng nút `ShowUserForm`, form không nằm trong menu, hoặc nhóm không có dòng cho menu đó),
`GetPermission` rơi vào nhánh dự phòng (`Functions.cs`, khoảng dòng 1616–1630):

- `View = true`, `Manager = true`, `LockDoc = true`, `ExportExcel = true`.
- `AddNew/Edit/Delete = true` nếu form có trong một menu đang bật, **hoặc không có trong menu nào**. Chỉ khi form chỉ nằm trong menu đã tắt
  thì mới chỉ đọc.

Như vậy mô hình là **mặc định cho phép**. Việc chặn chủ yếu dựa vào chỗ menu không hiện ra. Ngoại lệ: Admin luôn vào được `NguoiDungPhanQuyenFrm`.

### 7.2 Số liệu Medcom

- 28 nhóm, mỗi nhóm có dòng quyền cho 427 menu (riêng `KD` 430, `QL` 429): ma trận đủ cho **mọi menu có FormName**.
  55 menu không có dòng quyền đều là **menu nhóm** (không có FormName); `SY_GetUserMenuFnc` tự thêm chúng làm cha.
- Tổ hợp cờ phổ biến (IsRun, IsAdd, IsUpdate, IsDelete, isManager, isAdmin):
  - (1,1,1,1,1,0): 5.732 dòng, toàn quyền mức Manager;
  - (1,0,0,0,0,0): 4.471 dòng, chỉ xem;
  - (0,0,0,0,0,0): 1.060 dòng;
  - (1,1,1,1,1,1): 465 dòng.
- `isLockDoc` / `isUnLockDoc` / `isAutoLock` NULL lần lượt ở 6.245 / 6.928 / 205 dòng: cột được thêm sau nên dòng cũ để NULL.
  Theo mặc định ở trên, hơn một nửa số dòng được **khóa chứng từ** nhưng không được mở khóa.

| UserGroupID | Tên nhóm | Chi nhánh | Số dòng quyền | IsRun | IsAdd | IsUpdate | IsDelete | isManager | isAdmin | isLockDoc | isUnLockDoc | IsRun trên menu-form đang bật |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Admin | Quản Trị |  | 427 | 413 | 274 | 275 | 273 | 281 | 24 | 28 | 28 | 288 |
| BGD | BGD |  | 427 | 427 | 286 | 287 | 285 | 291 | 36 | 400 | 298 | 301 |
| Hanh Chinh | TP Hành Chính | MB | 427 | 156 | 9 | 11 | 9 | 11 | 11 | 11 | 11 | 35 |
| KD | Kinh doanh (Web) |  | 430 | 338 | 288 | 283 | 281 | 294 | 17 | 388 | 285 | 285 |
| KTCN | Kế toán công nợ |  | 427 | 392 | 277 | 278 | 275 | 284 | 22 | 364 | 275 | 281 |
| KTDH | KT đơn hàng |  | 427 | 387 | 280 | 279 | 277 | 283 | 19 | 361 | 274 | 281 |
| KTDHTQ | Kế toán đơn hàng kiêm thủ quỹ |  | 427 | 402 | 298 | 292 | 287 | 299 | 28 | 379 | 290 | 285 |
| KTK | Kế Toán Kho |  | 427 | 385 | 276 | 292 | 290 | 296 | 19 | 374 | 287 | 281 |
| KTQ | Kế toán Quỹ |  | 427 | 408 | 304 | 297 | 292 | 305 | 28 | 383 | 297 | 287 |
| KTT | Kế toán trưởng |  | 427 | 426 | 286 | 287 | 285 | 291 | 33 | 33 | 33 | 301 |
| KTTH | Kế toán tổng hợp |  | 427 | 413 | 273 | 274 | 272 | 278 | 18 | 49 | 49 | 288 |
| NVAdminHN | NV admin HN |  | 427 | 413 | 274 | 275 | 273 | 263 | 17 | 270 | 254 | 288 |
| NVKDHCM | NV kinh doanh_HCM |  | 427 | 413 | 272 | 273 | 271 | 277 | 17 | 1 | 1 | 288 |
| NVKDHN | NV kinh doanh_HN |  | 427 | 413 | 272 | 273 | 271 | 277 | 17 | 268 | 268 | 288 |
| NVKYTHUAT | Nhân viên Kỹ thuật |  | 427 | 427 | 2 | 1 | 1 | 2 | 1 | 2 | 2 | 301 |
| PGD | Phó Giám Đốc |  | 427 | 424 | 283 | 284 | 282 | 288 | 17 | 279 | 279 | 298 |
| QL | Quản lý (Web) |  | 429 | 376 | 287 | 288 | 286 | 293 | 30 | 344 | 278 | 283 |
| QLNganhhangDuocMN | Quản lý ngành hàng dược phẩm Miền Nam | MN | 427 | 331 | 122 | 125 | 122 | 125 | 19 | 2 | 2 | 208 |
| QLNganhhangPOCTMB | Quản lý ngành hàng POCT Miền Bắc | MB | 427 | 369 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 243 |
| QLNganhhangPOCTMN | Quản lý ngành hàng POCT Miền Nam | MN | 427 | 331 | 122 | 124 | 122 | 124 | 18 | 1 | 1 | 208 |
| QLNganhTruyenMauHN | Quản lý ngành hàng truyền máu_HN |  | 427 | 331 | 122 | 124 | 122 | 124 | 18 | 123 | 123 | 208 |
| TPAdminHCM | TP admin HCM |  | 427 | 413 | 272 | 273 | 271 | 277 | 17 | 268 | 268 | 288 |
| TPAdminHN | TP admin HN |  | 427 | 413 | 272 | 273 | 271 | 277 | 17 | 268 | 268 | 288 |
| TPKhoVanHCM | TP kho vận HCM |  | 427 | 413 | 272 | 273 | 271 | 277 | 17 | 268 | 268 | 288 |
| TPKhoVanHN | TP kho vận HN |  | 427 | 413 | 272 | 273 | 271 | 277 | 17 | 268 | 268 | 288 |
| TPKTHUAT | TP Kỹ thuật |  | 427 | 427 | 2 | 5 | 1 | 1 | 1 | 1 | 1 | 301 |
| TPTMHCM | TP thương mại HCM |  | 427 | 423 | 284 | 287 | 283 | 289 | 31 | 3 | 3 | 298 |
| TPTMHN | TP thương mại Hà Nội |  | 427 | 423 | 284 | 287 | 283 | 289 | 31 | 3 | 3 | 298 |

Các cột cờ chỉ đếm giá trị `True` ghi rõ trong DB, không tính NULL. Cột cuối đếm số menu có FormName đang bật mà nhóm được `IsRun`;
tổng số menu như vậy là 301.

## 8. Loại chứng từ và bảng trạng thái

### 8.1 `SY_DocSetup` (44 loại)

Cột trong DB: `DocType` (PK), `DocName`, `PreFix`, `isAuto`, `AccountID`, `STT`, `TableName`, `TableDetail`, `FormID`, `DocGroupName`, `isAcc`.
Snapshot không có `isAuto`, `AccountID`, `STT`. `isAcc = 1` là chứng từ có hạch toán.

| DocType | Tên chứng từ | Tiền tố số CT | Bảng master | Bảng chi tiết | FormID | Nhóm | Hạch toán (isAcc) | Form được menu trỏ tới? |
|---|---|---|---|---|---|---|:---:|---|
| AL | Thiết lập chi phí trả trước | PB | GJ_AllocateSetupTbl | GJ_AllocatePeriodTbl | GJ_AllocateSetupFrm | Tổng hợp | 0 | bật (160801) |
| CI | Kiểm kê kho | KK | IV_CheckStockTbl | IV_CheckStockDetailTbl | IV_CheckStockFrm | Quản lý kho | 0 | bật (0708) |
| CP | Phiếu chi | PC | CS_PaymentTbl | CS_PaymentDetailTbl | CS_PaymentFrm | Thu chi | 1 | bật (0924,0926) |
| CPB | Phiếu chi ngân hàng | BN | CS_PaymentTbl | CS_PaymentDetailTbl | CS_PaymentFrm_Bank | Thu chi | 1 | bật (0926) |
| CR | Phiếu thu | PT | CS_ReceiptTbl | CS_ReceiptDetailTbl | CS_ReceiptFrm | Thu chi | 1 | bật (0916,0920) |
| CRB | Phiếu thu ngân hàng | BC | CS_ReceiptTbl | CS_ReceiptDetailTbl | CS_ReceiptFrm_Bank | Thu chi | 1 | bật (0920) |
| EQ | Đánh lại số chứng từ | CT | vDocumentForRebuiltID |  | SY_MakeDocumentIDFrm | Tổng hợp | 1 | tắt |
| EQL | Thanh lý / Hủy dụng cụ | TLDC | EQ_LiquidateTbl | EQ_LiquidateDetailTbl | EQ_LiquidateFrm | Dụng cụ | 0 | bật (1106) |
| EQM | Phiếu di chuyển dụng cụ | DCDC | EQ_MoveTbl | EQ_MoveDetailTbl | EQ_MoveFrm | Dụng cụ | 0 | tắt |
| EQR | Phiếu sửa chửa - bảo trị dụng cụ | SCDC | EQ_RepairTbl | EQ_RepairDetailTbl | EQ_RepairFrm | Quản lý dụng cụ | 1 | tắt |
| ET | Đánh lại số chứng từ | CT | vDocumentForRebuiltID |  | SY_MakeDocumentIDFrm | Tổng hợp | 1 | tắt |
| EX | Xuất kho nội bộ | PX | IV_OutputTbl | IV_OutputDetailTbl | IV_StockOutputFrm | Quản lý kho | 1 | bật (0703) |
| FA | Tăng giảm tài sản | TD | FA_AdjustTbl | FA_AdjustDetailTbl | FA_AdjustmentFrm | Tài sản | 0 | tắt |
| FAM | Phiếu di chuyển tài sản | DCTS | FA_MoveTbl | FA_MoveDetailTbl | FA_Move2026Frm | Tài sản | 0 | bật (1207) |
| FAR | Phiếu sửa chửa - bảo trị tài sản | SCTS | FA_RepairTbl | FA_RepairDetailTbl | FA_RepairFrm | Tài sản | 1 | — |
| FL | Thanh lý tài sản | TLTS | FA_LiquidateTbl | FA_LiquidateDetailTbl | FA_LiquidateFrm | F | 0 | bật (1214) |
| GJ | Tổng hợp ( nhật ký chung ) | TH | GJ_EntryTbl | GJ_EntryDetailTbl | GJ_Entryfrm | Tổng hợp | 1 | bật (1602) |
| IA | Phân rã - lắp ghép | PL | IV_AdjustTbl | IV_AdjustDetailTbl | IV_StockAdjustFrm | Quản lý kho | 0 | bật (0706) |
| IN | Nhập kho nội bộ | PN | IV_InputTbl | IV_InputDetailTbl | IV_StockInputFrm | Quản lý kho | 1 | bật (07025) |
| IO | Phiếu nhập xuất thắng | NXT | IV_InOutTbl | IV_InOutDetailTbl | IV_InOutFrm | Quản lý kho | 1 | tắt |
| IT | Chuyển kho | CK | IV_TranferTbl | IV_TranferDetailTbl | IV_StockTranferFrm | Quản lý kho | 1 | bật (0705) |
| KM | Phiếu MH / giảm giá / KM | KM | AR_PhieuGiamGiaTbl | AR_PhieuGiamGiaDetailTbl | AR_PhieuGiamGiaFrm | Bán hàng | 0 | — |
| OF1 | Đơn xin phép | DXNP | OF_LeaveApplicationTbl |  | OF_LeaveApplicationFrm | Office | 0 | — |
| OF2 | Xin tạm ứng | DXTU | OF_ImprestOrderTbl |  | OF_ImprestOrderFrm | Office | 0 | — |
| OF3 | Xin duyệt chi / Đề nghị thanh toán | DXDC | OF_PaymentOrderTbl |  | OF_PaymentOrderFrm | Office | 0 | — |
| OF4 | Tờ trình đề xuất | TTDX | OF_SuggestionTbl | OF_SuggestionDetailTbl | OF_SuggestionFrm | Office | 0 | — |
| P2 | Phiếu đề nghị nhập hàng | YNH | AP_InputRequestTbl | AP_InputRequestDetailTbl | AP_InputRequestFrm | Mua hàng | 0 | tắt |
| PI | Mua hàng nội địa | MH | AP_PurchaseTbl | AP_PurchaseDetailTbl | AP_PurchaseFrm | Mua hàng | 1 | bật (0503,0504) |
| PII | Mua hàng nhập khẩu | MNK | AP_PurchaseTbl | AP_PurchaseDetailTbl | AP_PurchaseFrm_IMPORT | Mua hàng | 1 | tắt |
| PO | Đơn đặt hàng nhà cung cấp | PO | AP_OrderTbl | AP_OrderDetailTbl |  | Mua hàng | 0 | — |
| PR | Hàng trả lại nhà cung cấp | MT | AP_ReturnTbl | AP_ReturnDetailTbl | AP_ReturnFrm | Mua hàng | 1 | bật (0508) |
| PS | Mua dịch vụ | MD | AP_ServiceTbl | AP_ServiceDetailTbl | AP_ServiceFrm | Mua hàng | 1 | bật (0507) |
| S1 | Bảng giá bán | GB | AR_PriceTbl | AR_PriceDetailTbl | AR_StandardPriceFrm | Bán hàng | 0 | — |
| S2 | Bảng giá theo khách hàng - khu vực | BG | AR_PriceTbl | AR_PriceDetailTbl | AR_CustomerPriceFrm | Bán hàng | 0 | — |
| S3 | Phiếu đề nghị xuất hàng | YXH | AR_InvoiceOrderTbl | AR_InvoiceOrderDetailTbl | AR_InvoiceOrderFrm | Bán hàng | 0 | — |
| S4 | Hủy đơn đặt hàng | HDH | AR_OrderCancelTbl | AR_OrderCancelDetailTbl | AR_OrderCancelFrm | Bán hàng | 0 | — |
| S5 | Bảng điểm tích lũy | BD | AR_DiemTbl | AR_DiemDetailTbl | AR_BangDiemTichLuyFrm | Bán hàng | 0 | — |
| SB | Đơn đặt hàng (Tỉnh) | BC | AR_Order2Tbl | AR_Order2DetailTbl | AR_OrderThanhTam2Frm | S | 0 | tắt |
| SH | Bán hộ - Xuất hộ | XBH | AR_BanHoTbl | AR_BanHoDetailTbl | AR_BanHoFrm | Bán hàng | 0 | — |
| SI | Bán hàng | BH | AR_InvoiceTbl | AR_InvoiceDetailTbl | AR_InvoiceFrm | Bán hàng | 1 | bật (06035) |
| SO | Đơn đặt hàng | DH | AR_OrderTbl | AR_OrderDetailTbl | AR_OrderVietDucFrm | Bán hàng | 0 | bật (06022) |
| SR | Hàng bán trả lại | BT | AR_ReturnTbl | AR_ReturnDetailTbl | AR_ReturnFrm | Bán hàng | 1 | bật (0605) |
| SS | Bán dịch vụ | BD | AR_ServiceTbl | AR_ServiceDetailTbl | AR_ServiceFrm | Bán hàng | 1 | bật (0604) |
| TC | Tham chiếu chứng từ công nợ | TC | GJ_RefDocSetupTbl |  | GJ_RefDocumentSetupfrm | Tổng hợp | 0 | bật (1607) |

Nhận xét:

- `EQ` và `ET` là hai dòng giống nhau (đánh lại số chứng từ).
- `FormID` có thể là biến thể Para (`CS_PaymentFrm_Bank`, `AP_PurchaseFrm_IMPORT`).
- `PO` không có `FormID`.
- `DocGroupName` nhập không thống nhất (`F`, `S`, "Dụng cụ" / "Quản lý dụng cụ").
- Các chứng từ workflow mới (IV_InboundRequest, InternalTransfer, ReturnRequest, AR_InvoiceRequest, BPTM...) **không đăng ký** trong `SY_DocSetup`.
  Số chứng từ của chúng được khai báo trực tiếp trong `SY_FrmCfg` (`DPR`/`DMK`).

### 8.2 Các bảng trạng thái có trong snapshot (liệt kê đầy đủ)

| Snapshot | Bảng nguồn |
|---|---|
| `purchase_status` | `AP_PurchaseStatusTbl` |
| `purchase_order_status` | `AP_OrderStatusTbl` |
| `inbound_status` | `IV_InboundRequestStatusTbl` |
| `inbound_order_types` | `IV_OrderTypeTbl` |
| `inbound_cost_status` | `IV_InboundRequestCTCPStatusTbl` |
| `sales_order_status` | `AR_OrderStatusTbl` |
| `sales_invoice_status` | `AR_InvoiceStatusTbl` |
| `transfer_request_status` | `IV_InternalTransferRequestStatusTbl` |
| `transfer_batch_status` | `IV_InternalTransferBatchStatusTbl` |
| `return_request_status` | `IV_ReturnRequestStatusTbl` |
| `po_status` | `AP_POProcessStatusTbl` |
| `shipment_status` | `AP_POShipmentStatusTbl` |
| `po_payment_status` | `AP_POPaymentStatusTbl` |
| `contract_status` | `CF_ContractStatusTbl` |


#### `contract_status` (4 dòng)

| StatusID | StatusName |
|---|---|
| 1 | Đã chuyển Kế toán |
| 2 | Đã chuyển SA |
| 3 | Đã duyệt |
| 4 | Từ chối phê duyệt |

#### `inbound_cost_status` (5 dòng)

| StatusID | StatusName | SortOrder | IsFinal |
|---|---|---|---|
| 0 | Chưa tạo chứng từ mua dịch vụ | 0 | False |
| 1 | Đã tạo chứng từ mua dịch vụ | 10 | False |
| 2 | Đã phân bổ một phần | 20 | False |
| 3 | Đã phân bổ hết | 30 | True |
| 4 | Hủy theo dõi | 40 | True |

#### `inbound_status` (14 dòng)

| StatusID | StatusName | IsReject |
|---|---|---|
| 0 | Nháp |  |
| 1 | Yêu cầu TM xem lại | True |
| 2 | Đã gửi thủ kho |  |
| 3 | Yêu cầu thủ kho xem lại | True |
| 4 | Đã gửi TP SA |  |
| 5 | Yêu cầu TP SA xem lại | True |
| 6 | Đã gửi PM |  |
| 7 | Yêu cầu PM xem lại | True |
| 8 | Đã gửi Kỹ thuật |  |
| 9 | Yêu cầu Kỹ thuật xem lại | True |
| 10 | Đã gửi BLĐ |  |
| 11 | BLĐ từ chối | True |
| 12 | Hủy PA | True |
| 13 | Đã gửi kế toán |  |

#### `po_payment_status` (4 dòng)

| PaymentStatusCode | PaymentStatusName | SortOrder | IsPaid | IsActive |
|---|---|---|---|---|
| UNPAID | Chưa thanh toán | 10 | False | True |
| PARTIAL | Thanh toán một phần | 20 | False | True |
| PAID | Đã thanh toán | 30 | True | True |
| NOT_REQUIRED | Không theo dõi thanh toán | 90 | True | True |

#### `po_status` (5 dòng)

| StatusCode | StatusName | SortOrder | IsClosed | IsCancelled | IsActive |
|---|---|---|---|---|---|
| DRAFT | Chưa đặt hàng | 10 | False | False | True |
| ORDERED | Đã đặt hàng | 20 | False | False | True |
| PARTIAL | Chưa hoàn thành | 30 | False | False | True |
| COMPLETED | Hoàn thành | 40 | True | False | True |
| CANCELLED | Hủy | 90 | True | True | True |

#### `purchase_order_status` (4 dòng)

| StatusID | StatusName |
|---|---|
| 0 | Chờ sản xuất |
| 3 | Đã sản xuất xong |
| 6 | Đã hoàn thiện |
| 9 | Hủy |

#### `purchase_status` (5 dòng)

| StatusID | StatusName |
|---|---|
| 1 | Nháp |
| 2 | Chờ duyệt |
| 3 | Đã duyệt |
| 4 | Đã từ chối |
| 5 | Đã gửi đặt mua hàng |

#### `return_request_status` (12 dòng)

| StatusID | StatusName | IsReject |
|---|---|---|
| 0 | Nháp | False |
| 1 | Yêu cầu thủ kho xem lại | True |
| 2 | Đã gửi PM | False |
| 3 | Yêu cầu PM xem lại | True |
| 4 | Đã gửi Kỹ thuật | False |
| 5 | Yêu cầu Kỹ thuật xem lại | True |
| 6 | Đã gửi NVKD | False |
| 7 | Yêu cầu NVKD xem lại | True |
| 8 | Đã gửi BLĐ | False |
| 9 | BLĐ từ chối nhập | True |
| 10 | Đã gửi kế toán | False |
| 11 | Đã nhập kho | False |

#### `sales_invoice_status` (10 dòng)

| StatusID | StatusName | OrderStatusID | StockStatusID | isReceiptStatus |
|---|---|---|---|---|
| 0 | Lập hóa đơn | 1 |  | False |
| 1 | Đơn đã xử lý chưa chuyển kho | 1 | 4 | False |
| 2 | Đã chuyển xuống kho/Chưa đóng hàng | 1 | 4 | False |
| 3 | Đã xuất hàng | 2 | 6 | False |
| 6 | Đã đi gửi hàng | 2 |  | False |
| 7 | Khách đã nhận hàng | 3 |  | False |
| 8 | Đã thu tiền | 3 |  | True |
| 9 | Trả lại 1 phần | 4 |  | False |
| 10 | Trả lại hàng | 5 |  | False |
| 11 | Khách từ chối nhận hàng | 10 |  | False |

#### `sales_order_status` (19 dòng)

| StatusID | StatusName | isCancelStatus | IsReject |
|---|---|---|---|
| -2 | TDV Kiểm tra lại | False |  |
| -1 | Đơn nháp | False |  |
| 0 | Chờ duyệt | False |  |
| 1 | Chuyển kho | False |  |
| 2 | Đã xuất hàng | False |  |
| 3 | Đã thu tiền | False |  |
| 4 | Trả lại 1 phần | False |  |
| 5 | Trả lại hàng | False |  |
| 10 | Đã hủy | True |  |
| 11 | Yêu cầu NVKD xem lại | False | True |
| 12 | Đã gửi PM | False |  |
| 13 | Yêu cầu PM xem lại | False | True |
| 14 | Đã gửi SA | False |  |
| 15 | Yêu cầu SA xem lại | False | True |
| 16 | Đã gửi Kỹ thuật | False |  |
| 17 | Yêu cầu Kỹ thuật xem lại | False | True |
| 18 | Đã gửi Kế toán | False |  |
| 19 | Yêu cầu Kế toán xem lại | False | True |
| 20 | Đã gửi Thủ kho | False |  |

#### `shipment_status` (6 dòng)

| ShipmentStatusCode | ShipmentStatusName | SortOrder | IsClosed | IsActive |
|---|---|---|---|---|
| PLANNED | Dự kiến | 10 | False | True |
| READY | Hàng sẵn sàng | 20 | False | True |
| IN_TRANSIT | Đang vận chuyển | 30 | False | True |
| INBOUND_REQUEST | Đã tạo đề nghị nhập hàng | 40 | False | True |
| RECEIVED | Đã nhập hàng | 50 | True | True |
| CANCELLED | Hủy | 90 | True | True |

#### `transfer_batch_status` (15 dòng)

| StatusID | StatusCode | StatusName | SortOrder | IsReject | IsActive |
|---|---|---|---|---|---|
| 0 | DRAFT | Đang lập đợt | 0 | False | True |
| 10 | PM_REVIEW | Yêu cầu PM xem lại | 10 | True | True |
| 20 | WAIT_TECH | Chờ kỹ thuật xác nhận | 20 | False | True |
| 21 | TECH_REVIEW | Yêu cầu Kỹ thuật xem lại | 21 | True | True |
| 25 | TECH_RETURNED | Kỹ thuật trả lại PM | 25 | False | False |
| 40 | WAIT_SA | Chờ TP SA phê duyệt | 40 | False | True |
| 41 | SA_REVIEW | Yêu cầu TP SA xem lại | 41 | True | True |
| 45 | SA_RETURNED | TP SA trả lại PM | 45 | False | False |
| 60 | WAIT_ACCOUNTING | Chờ kế toán ra PXK | 60 | False | True |
| 61 | ACCOUNTING_REVIEW | Yêu cầu Kế toán xem lại | 61 | True | True |
| 70 | PXK_CREATED | Đã liên kết PXK | 70 | False | True |
| 100 | IN_TRANSIT | Đang điều chuyển | 100 | False | True |
| 120 | COMPLETED | Đã nhận đủ / Hoàn tất | 120 | False | True |
| 130 | PARTIAL | Nhận thiếu / Có chênh lệch | 130 | False | True |
| 900 | CANCELLED | Đã hủy | 900 | True | True |

#### `transfer_request_status` (6 dòng)

| StatusID | StatusCode | StatusName | SortOrder | IsReject | IsActive |
|---|---|---|---|---|---|
| 0 | DRAFT | Nháp | 0 | False | True |
| 10 | SENT_PM | Đã gửi PM | 10 | False | True |
| 20 | PM_CONFIRMED | PM đã xác nhận | 20 | False | True |
| 30 | PM_RETURNED | PM yêu cầu NVKD chỉnh sửa | 30 | True | True |
| 40 | BATCHED | Đã vào đợt điều chuyển | 40 | False | True |
| 90 | CANCELLED | Đã hủy | 90 | True | True |

#### `inbound_order_types` (5 dòng)

| OrderTypeID | OrderTypeName |
|---|---|
| 1 | Hàng nhập NN |
| 2 | Hàng nhập nội địa |
| 3 | Điều chuyển nội bộ |
| 4 | Hàng xuất |
| 5 | Xuất bán |

Các bảng trạng thái khác có trong DB nhưng **chưa có nội dung** trong snapshot (số dòng xấp xỉ):

- `GJ_InvoiceStatusTbl` (6)
- `CS_ReceiptPlanStatusTbl` (6)
- `CS_PaymentPlanStatusTbl` (4)
- `AR_ObjectNewStatusTbl` (4)
- `AR_OrderDeliveryStatusTbl` (3)
- `AR_KeHoachDiTuyenStatusTbl` (2)
- `HR_StatusTbl` (7)
- `HR_PersonStatusTbl` (3)
- `IV_DamageInsideStatusTbl` (3)
- view `AR_StockOutStatusView`

Bảng loại tương tự:

- `CS_CSTypeTbl` (28), `CS_PaymentTypeTbl` (33), `CS_ReceiptTypeTbl` (5)
- `FA_AssetTypeTbl` (15), `FA_MovementTypeTbl` (14), `FA_ServiceTypeTbl` (7)
- `IV_PackageTypeTbl` (7), `EI_PaymentTypeTbl` (9)
- `CF_AccountTypeTbl` (14), `CF_EventTypeTbl` (4), `CF_CustomerTypeTbl` (4), `CF_PaymentTypeTbl` (3), `CF_ImportCostTypeTbl` (3)

Hai mô hình trạng thái cùng tồn tại:

- **Kiểu cũ**: `StatusID int` + `StatusName`.
- **Kiểu 2026**: `StatusCode` chữ, kèm `SortOrder`, `IsReject`, `IsClosed`/`IsFinal`, `IsActive`.

Workflow nhiều bước (đề nghị nhập hàng, điều chuyển nội bộ, trả hàng, đơn bán) đặt trạng thái theo "gửi bước kế / yêu cầu xem lại" (`IsReject`).
Trên form, việc chuyển trạng thái do `StatusButtonCtl` thực hiện: menu trạng thái lấy từ SQL (`MSQ`), màu lấy theo field màu (`BCF`/`FCF`),
và có SQL kiểm tra/thực thi (`C4`..`C9`).

## 9. Schema MedData

### 9.1 Object theo tiền tố

| Tiền tố | Ý nghĩa | Bảng | View | SP | Function | Trigger | Tổng |
|---|---|---:|---:|---:|---:|---:|---:|
| AR | Bán hàng / công nợ phải thu (Accounts Receivable) | 97 | 33 | 163 | 10 | 15 | 318 |
| IV | Kho (Inventory) | 53 | 45 | 76 | 1 | 0 | 175 |
| AP | Mua hàng / công nợ phải trả (Accounts Payable) | 43 | 41 | 73 | 2 | 8 | 167 |
| SY | Hệ thống (menu, form, quyền, tham số, số dư...) | 61 | 1 | 31 | 52 | 2 | 147 |
| GJ | Kế toán tổng hợp (General Journal) | 54 | 3 | 71 | 0 | 2 | 130 |
| FA | Tài sản cố định (Fixed Asset) | 36 | 22 | 46 | 1 | 0 | 105 |
| CF | Danh mục dùng chung (Config / master data) | 64 | 0 | 13 | 0 | 9 | 86 |
| (none) | Không có tiền tố (chủ yếu view v*) | 6 | 62 | 8 | 1 | 0 | 77 |
| WA | Ứng dụng web (Web App: báo cáo, dashboard, đơn theo hợp đồng) | 11 | 5 | 61 | 0 | 0 | 77 |
| CS | Thu chi tiền mặt / ngân hàng (Cash) | 19 | 4 | 20 | 0 | 4 | 47 |
| HR | Nhân sự - tiền lương | 28 | 0 | 9 | 0 | 0 | 37 |
| WB | Hàm cho web (WB_*Fnc) | 0 | 0 | 0 | 37 | 0 | 37 |
| dt | SP hệ thống cũ của SQL Server (database diagram/source control) | 0 | 0 | 31 | 0 | 0 | 31 |
| PC | Giá thành (Product Cost) | 18 | 0 | 7 | 0 | 0 | 25 |
| EQ | Công cụ dụng cụ (Equipment) | 12 | 0 | 9 | 0 | 0 | 21 |
| AG | Xuất kho đại lý / mã QR (Agency) | 8 | 0 | 7 | 0 | 0 | 15 |
| SL | Lương doanh số (Sales salary) | 8 | 0 | 2 | 3 | 0 | 13 |
| KD | Phân hệ "Kinh doanh" có menu/quyền riêng (KD_Menu, KD_UserGroupPermisstion) | 9 | 0 | 3 | 1 | 0 | 13 |
| TR | Trigger đặt tên theo quy ước TR_<bảng>_<mục đích> | 0 | 0 | 0 | 0 | 10 | 10 |
| vIS | View IS | 0 | 8 | 1 | 0 | 0 | 9 |
| PL | Kế hoạch (Plan) | 6 | 0 | 1 | 0 | 0 | 7 |
| CC | Giá thành kiểu cũ (CostPrice) | 4 | 2 | 0 | 0 | 0 | 6 |
| OF | Văn phòng điện tử (eOffice: đơn từ, tạm ứng, tờ trình) | 6 | 0 | 0 | 0 | 0 | 6 |
| ZZ | Bảng backup kỹ thuật | 6 | 0 | 0 | 0 | 0 | 6 |
| CL | Báo cáo "CL" (bảng cân đối, công nợ, tồn kho) | 0 | 0 | 5 | 0 | 0 | 5 |
| EI | Hóa đơn điện tử (eInvoice) | 5 | 0 | 0 | 0 | 0 | 5 |
| API | SP phục vụ API (web/mobile) | 0 | 0 | 4 | 0 | 0 | 4 |
| EP | Vận chuyển (ePost) | 4 | 0 | 0 | 0 | 0 | 4 |
| SP | SP tiện ích | 0 | 0 | 3 | 0 | 0 | 3 |
| IS | Nhập/xuất phụ (IS) | 2 | 0 | 0 | 1 | 0 | 3 |
| AD | Duyệt (Approve setup) | 3 | 0 | 0 | 0 | 0 | 3 |
| Temp | Bảng tạm | 3 | 0 | 0 | 0 | 0 | 3 |
| Temp2 | Bảng tạm | 3 | 0 | 0 | 0 | 0 | 3 |
| Temp3 | Bảng tạm | 3 | 0 | 0 | 0 | 0 | 3 |
| GL | Báo cáo tài chính (General Ledger) | 0 | 0 | 2 | 0 | 0 | 2 |
| EL | Danh sách hóa đơn (eInvoice list) | 2 | 0 | 0 | 0 | 0 | 2 |
| vInput |  | 0 | 2 | 0 | 0 | 0 | 2 |
| fn |  | 0 | 0 | 0 | 1 | 0 | 1 |
| sp |  | 0 | 0 | 1 | 0 | 0 | 1 |
| vAG |  | 0 | 1 | 0 | 0 | 0 | 1 |
| vCS |  | 0 | 1 | 0 | 0 | 0 | 1 |
| vGJ |  | 0 | 1 | 0 | 0 | 0 | 1 |
| **Tổng** | | **574** | **231** | **647** | **110** | **50** | **1612** |

Tiền tố là mã phân hệ đặt **trước dấu `_` đầu tiên**. Ngoài các phân hệ nghiệp vụ, còn có:

- `dt_*`: SP hệ thống cũ của SQL Server.
- `ZZ_*`, `Temp*`, `AAA`: backup, bảng tạm.
- Bảng journal không tiền tố: `MedcomErpCommandJournal/Schema`, `MedcomPurchaseRequestCommand*` (dấu vết của bản web Medcom trước).
- `ER` có 7 form trong `SY_FrmLstTbl` nhưng **không có bảng nào** trong MedData.

### 9.2 Quy ước đặt tên

| Loại | Quy ước | Số liệu MedData |
|---|---|---|
| Bảng | `<Phân hệ>_<Tên>Tbl`; bảng chi tiết `<Tên>DetailTbl`; bảng đính kèm `<Tên>AttachTbl` | 502/574 kết thúc `Tbl` |
| View | `<Phân hệ>_<Tên>View`, view chọn dữ liệu `*SelectView`, view dùng chung không tiền tố `v<Tên>` (`vCustomer`, `vItem`, `vChartAcc*`...) | 131 `View` + 74 `v*` / 231 |
| SP | `<Phân hệ>_<Tên>Stp`; báo cáo `<FormName>Stp` = `<...>ReportStp` (bắt buộc, vì engine tìm SP theo tên menu) | 600/647 `Stp`, trong đó 316 `ReportStp` |
| Function | `<Phân hệ>_<Tên>Fnc` (ví dụ `SY_GetUserMenuFnc`, `WB_*Fnc`) | 105/110 |
| Trigger | Cũ: `<Bảng>_<Hành động>` (`AR_InvoiceTbl_UpdateRefDoc`, `CS_Receipt_Delete_Triger`). Mới (2026): `TR_<Bảng>_<Mục đích>` (`TR_FA_MoveTbl_LifecycleSync`) | 40 kiểu cũ, 10 `TR_*` |
| Form | `<Phân hệ>_<Tên>Frm`; danh mục thường `<Tên>ListFrm`; biến thể theo Para `<Form>_<Para>`; layout user control `<Form>_<Control/OPT>` | |
| Báo cáo | `<Phân hệ>_<Tên>Report` = file `Reports\<...>.rpx` = SP `<...>ReportStp`. Tham số SP phổ biến: `@FromDate`/`@ToDate` (175/200), `@Template` (145), `@ObjectID` (126), `@BranchID` (121), `@ItemID` (98), `@DocumentID` (74) | |

### 9.3 Cột chuẩn

| Cột | Số bảng có cột | Kiểu phổ biến | Ghi chú |
|---|---:|---|---|
| `UserAutoID` | 235 | `varchar(50)` (128) / `varchar(40)` (91) | Khóa chính chuỗi của **mọi bảng chi tiết** (60/60) và 231 bảng nói chung. Thường không có default. Ứng dụng sinh chuỗi 25 ký tự = tiền tố + `yyMMddHHmmss` + 2×mili-giây + số ngẫu nhiên (`Functions.GetCurrentUserAutoID`). Có 25 bảng mới dùng `newid()` |
| `DocumentID` | 190 | `varchar(30)` (124) | PK của bảng master chứng từ (76 bảng); trong bảng chi tiết là khóa nối về master |
| `DocumentDate` | 79 | `datetime` | Có ở mọi master (67/67) |
| `StatusID` | 36 | `int` | Chỉ 9/67 master có; các workflow mới có thêm bảng trạng thái riêng |
| `isLock` | 59 | `bit`, default 0 | Khóa chứng từ (49/67 master) |
| `BranchID` | 66 | `varchar(50)` | Chi nhánh (38/67 master); lọc theo `FilterEx '{BranchID}'` |
| `UserCreate` / `DateCreate` / `UserUpdate` / `DateUpdate` | 162 / 158 / 150 / 153 | `varchar(50)` / `datetime` | Audit: master có, detail **không** (0/60) |
| `ObjectID`, `ItemID`, `Notes`, `Memo` | 103, 104, 213, 86 | `varchar(50/100)`, `nvarchar(100)`, `nvarchar(400)` | Đối tượng (KH/NCC/NV), vật tư, ghi chú |
| Khác hay gặp | | | `Amount`, `Quantity`, `UnitPrice`, `CostCenterID`, `CostID`, `AccountID`, `EmployeeID`, `CurrencyID`, `RateExchange`, `Lot`, `StoreHouseID`, `LinkID`, `RefDoc`, `STT`, `ParentID`, `CodeID/CodeName/CodeName2`, `isDisable`, `isBold` |

Mẫu khóa chính:

- `UserAutoID` 231 bảng, `DocumentID` 76, `CodeID` 27, `StatusID` 14, `ID` 12, `AutoID` 8…
- 15 bảng không có PK.
- 379 FK trên 230 bảng; 197 FK `is_not_trusted` (tạo `WITH NOCHECK`). Bảng được tham chiếu nhiều nhất: `CF_ObjectTbl` (43), `CF_ItemTbl` (42),
  `CF_CostCenterTbl` (16), `CF_StoreHouseTbl` (16), `CF_CostTbl` (14).
- 261/574 bảng rỗng: DB mẫu có nhiều phân hệ chưa dùng.

### 9.4 Bảng danh mục `CF_*` (64 bảng)

`CF_ObjectTbl` là **bảng đối tượng dùng chung** cho khách hàng / NCC / nhân viên / đại lý (78 cột; các cờ `isCustomer`, `isVendor`, `IsEmployee`…).
Vật tư hàng hóa nằm ở `CF_ItemTbl` (+ `CF_ItemUnitTbl` cho quy đổi đơn vị, `CF_ItemGroupTbl`, `CF_CategoryTbl`).
Danh mục kho là `CF_StoreHouseTbl`, chi nhánh `CF_BranchTbl`, tài khoản `CF_ChartAccTbl` (cùng các bộ `QD15`/`QD48`/`VH`), đơn vị tính `CF_UnitTbl`,
kênh bán / trung tâm chi phí `CF_CostCenterTbl`, khoản mục phí `CF_CostTbl`. Phần lớn được mở bằng form LIST theo quy ước PrimaryKey.

| Bảng | Khóa chính | Số cột | Số dòng (xấp xỉ) | FK vào | Dùng bởi SY_FrmLstTbl |
|---|---|---:|---:|---:|---:|
| `CF_QRPackageTbl` | QRPackageID | 19 | 222259 | 0 | 0 |
| `CF_ContractDetailTbl` | UserAutoID | 18 | 1493 | 0 | 0 |
| `CF_ItemUnitTbl` | UserAutoID | 11 | 966 | 0 | 1 |
| `CF_ItemTbl` | ItemID | 39 | 772 | 42 | 1 |
| `CF_ObjectTbl` | ObjectID | 78 | 719 | 43 | 5 |
| `CF_ContractTbl` | ContractID | 22 | 429 | 3 | 1 |
| `CF_ChartAccQD15` | AccountID | 12 | 359 | 0 | 0 |
| `CF_ChartAccQD48` | AccountID | 12 | 354 | 0 | 0 |
| `CF_ChartAccVH` | AccountID | 10 | 339 | 0 | 0 |
| `CF_ChartAccTbl` | AccountID | 17 | 214 | 0 | 1 |
| `CF_LocationTbl` | LocationID | 8 | 64 | 2 | 1 |
| `CF_UnitTbl` | Unit | 3 | 63 | 0 | 1 |
| `CF_ItemCodeSequenceTbl` | CategoryID;ItemGroupID | 6 | 48 | 0 | 0 |
| `CF_CostTbl` | CostID | 11 | 37 | 14 | 1 |
| `CF_ItemGroupTbl` | ItemGroupID | 9 | 35 | 0 | 1 |
| `CF_StoreHouseTbl` | StoreHouseID | 10 | 24 | 16 | 1 |
| `CF_HangSanXuatTbl` | UserAutoID | 6 | 22 | 0 | 1 |
| `CF_CostCenterTbl` | CostCenterID | 16 | 20 | 16 | 1 |
| `CF_ImpExpTbl` | ImpExpID | 8 | 18 | 0 | 1 |
| `CF_ZoneTbl` | ZoneID | 6 | 15 | 1 | 1 |
| `CF_AccountTypeTbl` | AccountTypeID | 8 | 14 | 0 | 0 |
| `CF_RelationTbl` | RelationID | 6 | 14 | 2 | 1 |
| `CF_AccountBankTbl` | AccountNo | 13 | 12 | 0 | 1 |
| `CF_AccountKindTbl` | AccountKindID | 8 | 12 | 0 | 0 |
| `CF_CategoryTbl` | CategoryID | 14 | 12 | 1 | 1 |
| `CF_AccountGroupTbl` | AccountGroupID | 2 | 11 | 0 | 0 |
| `CF_IncotermTbl` | IncotermID | 12 | 11 | 0 | 1 |
| `CF_ObjectGroupTbl` | ObjectGroupID | 16 | 11 | 2 | 1 |
| `CF_PaymentTermTbl` | PaymentTermID | 9 | 11 | 1 | 1 |
| `CF_DepartmentTbl` | DepartmentID | 8 | 8 | 1 | 1 |
| `CF_HinhThucGiaoHangTbl` | HinhThucGiaoHang | 2 | 7 | 0 | 1 |
| `CF_NhomNganhHangTbl` | NhomNganhHangID | 8 | 6 | 0 | 0 |
| `CF_ThuTrongTuanTbl` | ThuTrongTuan | 2 | 6 | 0 | 0 |
| `CF_LoaiSoTayTbl` | LoaiSoTayID | 6 | 5 | 1 | 1 |
| `CF_VATTbl` | VATID | 11 | 5 | 0 | 1 |
| `CF_ContractStatusTbl` | StatusID | 4 | 4 | 0 | 1 |
| `CF_CurrencyTbl` | CurrencyID | 10 | 4 | 1 | 1 |
| `CF_CustomerTypeTbl` | CustomerTypeID | 2 | 4 | 0 | 0 |
| `CF_EventTypeTbl` | EventTypeID | 6 | 4 | 1 | 1 |
| `CF_ChuyenKhoaTbl` | ChuyenKhoa | 2 | 3 | 0 | 1 |
| `CF_ImportCostTypeTbl` | CostType | 7 | 3 | 3 | 0 |
| `CF_NhaXeGoiHangTbl` | NhaXeGoiHang | 5 | 3 | 0 | 1 |
| `CF_ObjectRelationTbl` | UserAutoID | 10 | 3 | 0 | 0 |
| `CF_PaymentTypeTbl` | PaymentTypeID | 8 | 3 | 1 | 1 |
| `CF_StoreHouseGroupTbl` | StoreHouseGroup | 2 | 3 | 0 | 1 |
| `CF_AllocateMethodTbl` | AllocateKind | 4 | 2 | 3 | 0 |
| `CF_BranchTbl` | BranchID | 17 | 2 | 7 | 1 |
| `CF_PrinterTableTbl` | TableID | 2 | 2 | 0 | 0 |
| `CF_BankContractTbl` | BankContractID | 12 | 0 | 2 | 1 |
| `CF_BankTbl` | AccountNo | 10 | 0 | 0 | 0 |
| `CF_ContractAttachTbl` | UserAutoID | 7 | 0 | 0 | 0 |
| `CF_ContractBBNTDetailTbl` | UserAutoID | 7 | 0 | 0 | 0 |
| `CF_ContractBBNTTbl` | DocumentID | 8 | 0 | 0 | 0 |
| `CF_ContractThanhToanTbl` | UserAutoID | 7 | 0 | 0 | 0 |
| `CF_CurrencyRateTbl` | UserAutoID | 8 | 0 | 0 | 1 |
| `CF_ItemCurrencyTbl` | UserAutoID | 10 | 0 | 0 | 0 |
| `CF_LocationDetailTbl` | UserAutoID | 5 | 0 | 0 | 0 |
| `CF_LotTbl` | Lot | 10 | 0 | 0 | 1 |
| `CF_ObjectAttachTbl` | — | 8 | 0 | 0 | 0 |
| `CF_ObjectContactTbl` | UserAutoID | 16 | 0 | 0 | 0 |
| `CF_ObjectMapTbl` | UserAutoID | 6 | 0 | 0 | 0 |
| `CF_ObjectTempTbl` | ObjectTempID | 13 | 0 | 0 | 0 |
| `CF_Property2Tbl` | UserAutoID | 6 | 0 | 0 | 0 |
| `CF_PropertyTbl` | UserAutoID | 6 | 0 | 0 | 0 |

### 9.5 Bảng chứng từ chính (master / chi tiết)

Gồm các cặp đăng ký trong `SY_DocSetup`, cộng các master nhận diện theo cấu trúc (PK `DocumentID` + có `DocumentDate`) có dữ liệu.
Danh sách đầy đủ 67 master / 60 detail: `data/db-tables-medcom.csv` (cột `Kind`).

| Bảng master | PK | Số dòng | Bảng chi tiết | PK chi tiết | Số dòng chi tiết | Nguồn nhận diện |
|---|---|---:|---|---|---:|---|
| `FA_MoveTbl` | DocumentID | 635 | `FA_MoveDetailTbl` | UserAutoID | 635 | SY_DocSetup FAM |
| `AR_OrderTbl` | DocumentID | 155 | `AR_OrderDetailTbl` | UserAutoID | 307 | SY_DocSetup SO |
| `AR_InvoiceTbl` | DocumentID | 38 | `AR_InvoiceDetailTbl` | UserAutoID | 89 | SY_DocSetup SI |
| `IV_InboundRequestTbl` | DocumentID | 25 | — |  |  | cấu trúc cột (PK DocumentID + DocumentDate) |
| `AP_PurchaseTbl` | DocumentID | 14 | `AP_PurchaseDetailTbl` | UserAutoID | 62 | SY_DocSetup PI |
| `AP_ServiceTbl` | DocumentID | 13 | `AP_ServiceDetailTbl` | UserAutoID | 18 | SY_DocSetup PS |
| `IV_InputTbl` | DocumentID | 11 | `IV_InputDetailTbl` | UserAutoID | 15 | SY_DocSetup IN |
| `IV_OutputTbl` | DocumentID | 9 | `IV_OutputDetailTbl` | UserAutoID | 10 | SY_DocSetup EX |
| `AP_OrderTbl` | DocumentID | 8 | `AP_OrderDetailTbl` | UserAutoID | 10 | SY_DocSetup PO |
| `IV_InternalTransferRequestTbl` | DocumentID | 7 | `IV_InternalTransferRequestDetailTbl` | UserAutoID | 18 | cấu trúc cột (PK DocumentID + DocumentDate) |
| `CS_PaymentTbl` | DocumentID | 6 | `CS_PaymentDetailTbl` | UserAutoID | 5 | SY_DocSetup CP |
| `AR_InvoiceRequestTbl` | DocumentID | 4 | `AR_InvoiceRequestDetailTbl` | UserAutoID | 6 | cấu trúc cột (PK DocumentID + DocumentDate) |
| `GJ_EntryTbl` | DocumentID | 3 | `GJ_EntryDetailTbl` | UserAutoID | 4 | SY_DocSetup GJ |
| `AR_PriceTbl` | DocumentID | 2 | `AR_PriceDetailTbl` | UserAutoID | 16 | SY_DocSetup S1 |
| `AR_KeHoachDiTuyenTbl` | DocumentID | 2 | `AR_KeHoachDiTuyenDetailTbl` | UserAutoID | 1 | cấu trúc cột (PK DocumentID + DocumentDate) |
| `IV_ReturnRequestTbl` | DocumentID | 2 | `IV_ReturnRequestDetailTbl` | UserAutoID | 3 | cấu trúc cột (PK DocumentID + DocumentDate) |
| `IV_CheckStockTbl` | DocumentID | 1 | `IV_CheckStockDetailTbl` | UserAutoID | 0 | SY_DocSetup CI |
| `FA_RepairTbl` | DocumentID | 1 | `FA_RepairDetailTbl` | UserAutoID | 1 | SY_DocSetup FAR |
| `IV_TranferTbl` | DocumentID | 1 | `IV_TranferDetailTbl` | UserAutoID | 1 | SY_DocSetup IT |
| `CS_ReceiptPlan2Tbl` | DocumentID | 1 | `CS_ReceiptPlan2DetailTbl` | UserAutoID | 0 | cấu trúc cột (PK DocumentID + DocumentDate) |
| `GJ_AllocateSetupTbl` | AllocateID | 0 | `GJ_AllocatePeriodTbl` | UserAutoID | 0 | SY_DocSetup AL |
| `CS_ReceiptTbl` | DocumentID | 0 | `CS_ReceiptDetailTbl` | UserAutoID | 0 | SY_DocSetup CR |
| `vDocumentForRebuiltID` | (view/không có) |  | — |  |  | SY_DocSetup EQ |
| `EQ_LiquidateTbl` | DocumentID | 0 | `EQ_LiquidateDetailTbl` | UserAutoID | 0 | SY_DocSetup EQL |
| `EQ_MoveTbl` | DocumentID | 0 | `EQ_MoveDetailTbl` | UserAutoID | 0 | SY_DocSetup EQM |
| `EQ_RepairTbl` | DocumentID | 0 | `EQ_RepairDetailTbl` | UserAutoID | 0 | SY_DocSetup EQR |
| `FA_AdjustTbl` | DocumentID | 0 | `FA_AdjustDetailTbl` | UserAutoID | 0 | SY_DocSetup FA |
| `FA_LiquidateTbl` | DocumentID | 0 | `FA_LiquidateDetailTbl` | UserAutoID | 0 | SY_DocSetup FL |
| `IV_AdjustTbl` | DocumentID | 0 | `IV_AdjustDetailTbl` | UserAutoID | 0 | SY_DocSetup IA |
| `IV_InOutTbl` | DocumentID | 0 | `IV_InOutDetailTbl` | UserAutoID | 0 | SY_DocSetup IO |
| `AR_PhieuGiamGiaTbl` | DocumentID | 0 | `AR_PhieuGiamGiaDetailTbl` | UserAutoID | 0 | SY_DocSetup KM |
| `OF_LeaveApplicationTbl` | DocumentID | 0 | — |  |  | SY_DocSetup OF1 |
| `OF_ImprestOrderTbl` | DocumentID | 0 | — |  |  | SY_DocSetup OF2 |
| `OF_PaymentOrderTbl` | DocumentID | 0 | — |  |  | SY_DocSetup OF3 |
| `OF_SuggestionTbl` | DocumentID | 0 | `OF_SuggestionDetailTbl` | UserAutoID | 0 | SY_DocSetup OF4 |
| `AP_InputRequestTbl` | DocumentID | 0 | `AP_InputRequestDetailTbl` | UserAutoID | 0 | SY_DocSetup P2 |
| `AP_ReturnTbl` | DocumentID | 0 | `AP_ReturnDetailTbl` | UserAutoID | 0 | SY_DocSetup PR |
| `AR_InvoiceOrderTbl` | DocumentID | 0 | `AR_InvoiceOrderDetailTbl` | UserAutoID | 0 | SY_DocSetup S3 |
| `AR_OrderCancelTbl` | DocumentID | 0 | `AR_OrderCancelDetailTbl` | UserAutoID | 0 | SY_DocSetup S4 |
| `AR_DiemTbl` | DocumentID | 0 | `AR_DiemDetailTbl` | UserAutoID | 0 | SY_DocSetup S5 |
| `AR_Order2Tbl` | DocumentID | 0 | `AR_Order2DetailTbl` | UserAutoID | 0 | SY_DocSetup SB |
| `AR_BanHoTbl` | DocumentID | 0 | `AR_BanHoDetailTbl` | UserAutoID | 0 | SY_DocSetup SH |
| `AR_ReturnTbl` | DocumentID | 0 | `AR_ReturnDetailTbl` | UserAutoID | 0 | SY_DocSetup SR |
| `AR_ServiceTbl` | DocumentID | 0 | `AR_ServiceDetailTbl` | UserAutoID | 0 | SY_DocSetup SS |
| `GJ_RefDocSetupTbl` | DocumentID | 0 | — |  |  | SY_DocSetup TC |

Số dòng rất nhỏ, ví dụ `AR_InvoiceTbl` 38, `AP_PurchaseTbl` 14. Nhiều khả năng MedData mới bắt đầu dùng cho các luồng 2026 (phần lớn dữ liệu kế toán
lịch sử có thể ở DB khác); cần xác nhận. Ngoại lệ là `CF_QRPackageTbl` (≈ 222 nghìn dòng mã QR) và `FA_MoveTbl` (635).

### 9.6 Bảng hệ thống `SY_*` (61 bảng; cột đầy đủ: `data/sy-tables-columns.md`)

| Bảng | Vai trò | Số dòng (xấp xỉ) | Có trong snapshot workflow-config? |
|---|---|---:|---|
| `SY_Menu` | Cây menu desktop (MenuID phân cấp, FormName, Para, Filter, isDisable, ShowDialog, isNotCheckPermission...) | 482 | có (7/19 cột) |
| `SY_FrmLstTbl` | Đăng ký form động: FormID → FormType, CaptionVN/EN/CH, TableName, PrimaryKey, Filter... | 287 | có (16/23 cột) |
| `SY_FrmCfg` | Cấu hình layout/thuộc tính form động dạng key-value (FID, KeyID, SubID, KeyValue, SubValue, PFID, VDate) | 10687 | một phần (3.419 dòng) |
| `SY_FmtFldTbl` | Từ điển nhãn/định dạng field (FieldName, FormName, CaptionVN/EN/CH, AlignX, Min/MaxWidth) | 4215 | không |
| `SY_FmatTbl` | Định dạng số/chuỗi (FormatString, MaskString, NumberDecimal...) | 30 | không |
| `SY_FrmDrdwTbl` | Nguồn combobox/dropdown theo form + grid + cột (Source SQL, ValueColumn, DisplayColumn, ColumnArr...) | 2361 | không |
| `SY_FrmExpTbl` | Biểu thức/công thức cột (Expression, RefColumn, RoundType...) | 424 | không |
| `SY_FrmCtrTbl` | Vị trí control kiểu cũ (CtlTop/CtlLeft/Width/Height) | 174 | không |
| `SY_FrmParTbl` | Tham số/điều kiện theo grid (Type, ColumnID, Value, Target) | 0 | không (0 dòng) |
| `SY_FrmFltTbl` | Ô lọc trên toolbar của form (KeyID, ColumnID, Type=SearchControlTypes, Source...) | 244 | một phần (18 dòng) |
| `SY_FrmOptBtnTbl` | Nút tùy chọn (OptionBar) của form | 91 | có |
| `SY_FrmGrdActTbl` | Hành động khi đổi giá trị cột trên lưới | 52 | có |
| `SY_FrmMstActTbl` | Hành động khi đổi field master / sau khi lưu | 31 | có |
| `SY_StTbl` | Chuỗi ngôn ngữ / thông điệp (StringID, StringVN/EN/CH) | 582 | không |
| `SY_RpTbl` | Định nghĩa tham số báo cáo dùng chung (ParaName, Type, ValueList...) | 50 | không |
| `SY_RpDTbl` | Tham số theo từng báo cáo (RpName, PName, DefaultSQL, LockExpression...) | 2231 | không |
| `SY_RpFTbl` | File mẫu lưu trong DB (FileName, FileContent): file báo cáo từ DesignerForm, mẫu Word/Excel của AttachWordX | 2441 | không |
| `SY_DocSetup` | Loại chứng từ: DocType, tiền tố số CT, bảng master/detail, FormID, isAcc | 44 | có (8/11 cột) |
| `SY_Setup` | Tham số hệ thống (CodeID/CodeValue) | 63 | không |
| `SY_InitSetup` | Kỳ bắt đầu, phương pháp tính giá | 1 | không |
| `SY_Period` | Kỳ kế toán (tháng), cờ khóa sổ isLock/isLockData | 24 | không |
| `SY_Year` | Năm tài chính | 2 | không |
| `SY_Quarter` | Quý | 8 | không |
| `SY_User` | Người dùng (UserName, nhóm, chi nhánh, kho, ủy quyền UserAuthority, mật khẩu...) | 42 | không (cố ý) |
| `SY_UserGroup` | Nhóm người dùng | 28 | có |
| `SY_UserGroupDetail` | Thuộc tính mở rộng của nhóm (KeyID/KeyName/Value) | 168 | không |
| `SY_UserGroupPermisstion` | Quyền theo nhóm × menu | 11961 | có (11/14 cột) |
| `SY_UserPermisstion` | Quyền riêng theo người dùng × menu (cộng dồn với quyền nhóm) | 17934 | không |
| `SY_UserBranch` | Người dùng × chi nhánh | 0 | không |
| `SY_UserStorehouse` | Người dùng × kho | 0 | không |
| `SY_UserLog` | Nhật ký thao tác | 879 | không |
| `SY_UserLogDetail` | Chi tiết nhật ký | 20933 | không |
| `SY_ApproveSetupTbl` | Thiết lập duyệt nhiều cấp | 0 | có (0 dòng) |
| `SY_ApproveDocumentTbl` | Chứng từ chờ/đã duyệt | 0 | không |
| `SY_BalanceItemTbl` | Số dư đầu kỳ hàng tồn | 690 | không |
| `SY_BalanceObjectTbl` | Số dư đầu kỳ công nợ | 17 | không |
| `SY_BalanceAccountTbl` | Số dư đầu kỳ tài khoản | 9 | không |
| `SY_NotifyMsg` | Thông báo cho người dùng | 12 | không |
| `SY_MessageTbl` | Tin nhắn nội bộ | 48 | không |
| `SY_UserToken` | Token thiết bị (push notification) | 9 | không |
| `SY_APILog` | Log gọi API | 3367 | không |
| `SY_UsLc` | Đăng ký máy/bản quyền | 108 | không |
| `SY_STT` | Bảng số thứ tự 1..N (tiện ích SQL) | 100815 | không |
| `SY_ResUser` | Tài nguyên/khóa cấu hình theo người dùng | 84 | không |
| `SY_DshBrdCnt` | Nội dung dashboard theo MenuID | 10 | không |
| `SY_ImDatTbl` | Kịch bản import dữ liệu (ImportSQL/DeleteSQL) | 44 | không |
| `SY_Link` | Liên kết DB khác (LinkServer) | 2 | không (cố ý) |

## 10. So sánh nhanh với TinPhong

**Dữ liệu có được**:

- `ui-SY_*.json`: lọc `%BeeC%`, gồm 2 form, 103 dòng `SY_FrmCfg`, 4 nút, 8 ô lọc, 10 dòng `SY_FmtFldTbl`.
- `source-menu`: 2 menu.
- `source-config-form-templates`: 9 form mẫu.
- `D:\Data\TinPhong\Layout\<DB>\*.dat`: tên file = tên form từng mở trên máy đó (thư mục `TinPhong` có 61 file).
- `*_RecentlyList.dat`: các menu dùng gần đây (MenuID, VN, FormName); đã đọc nội dung nhưng bỏ phần tên người dùng.

Kết quả chi tiết: `data/tinphong-vs-medcom.csv`. Đối chiếu trên toàn bộ khách hàng: `data/layout-forms.csv`, `data/reports-catalog.csv` (tài liệu 02).

| Khía cạnh | Kết quả | Mức chuẩn hóa |
|---|---|---|
| Lược đồ bảng metadata | `SY_Menu` (19 cột), `SY_FrmLstTbl` (23), `SY_FrmCfg` (8), `SY_FrmOptBtnTbl` (27), `SY_FrmFltTbl` (31), `SY_FmtFldTbl` (10): **trùng tên cột 100 %** giữa hai DB | Cao: cùng engine Tools, cùng migration (`Connector` tự `ALTER TABLE` khi chạy) |
| Từ vựng khóa `SY_FrmCfg` | Mọi họ khóa của TinPhong (`T{n}`, `T{n}C{k}`, `LYT`, `LYSX`, `DFP`, `SP`, `HBA..HBE`) đều có ở Medcom. Chỉ có `TRS` (TopRecord) không xuất hiện trong snapshot Medcom, nhưng có trong `TableInfoX` | Cao |
| 67 tên form/báo cáo quan sát ở DB TinPhong | 20 form động **cùng FormID** ở Medcom (danh mục: `CustomerListFrm`, `ObjectListFrm`, `VendorListFrm`, `StorehouseListFrm`, `ZoneListFrm`, `ChartAccListFrm`, `ItemListFrm`, `AR_OrderVietDucFrm`...). 19 dùng **lớp viết tay chung** (`AP_PurchaseFrm`, `IV_StockInputFrm`, `IV_StockOutputVD*Frm`, `NguoiDung*`, `SetupFrm`...). 6 báo cáo có SP ở MedData. 1 biến thể Para (`AP_PurchaseFrm_IMPORT`). 1 lệnh hệ thống. Còn lại **20 riêng TinPhong**: 7 form tích hợp `BeeC_*`, 6 báo cáo dược GDP/KSĐB (`BBGNThuocKSDBReport`, `BienBan*`, `SoNhapXuatTonThuocKSDBReport`, `TheKhoReport`), `DangKyLuuHanhFrm`, `NhaSanXuatFrm`, `NguoiGiaoHangFrm`, `DVGiaoHangListFrm`, `BranchListFrm`, `SY_FrmLstSettingXFrm`, `FrmReportParaSetup2` (file layout lưới thứ 2 của form hệ thống) | Trung bình: lõi danh mục + chứng từ dùng chung, phần ngành dược/tích hợp riêng |
| Đánh số MenuID | 26 cặp (MenuID, FormName) quan sát được: **9 trùng** (`01`, `0107` PeriodSetupFrm, `010100/010101` người dùng, `010108` SetupFrm, `0101081` UserLog, `010502` số dư tồn, `0119` Đăng xuất, `06022` AR_OrderVietDucFrm). **2 khác** (`010102`: TinPhong là Phân quyền, Medcom là `SY_UserBranchStorehouseFrm`; `0607`: TinPhong là Hóa đơn `AR_Invoice2Frm`, Medcom là báo cáo `AR_InvoiceJournalReport`). **15 MenuID không có ở Medcom** (nhóm `0684xx` GDP, `0258`, `0106x` BeeC...) | Thấp ở tầng nghiệp vụ: chỉ khung `01xx` hệ thống ổn định |
| Mã chung mang tên khách | Trong mã chung có lớp `AR_InvoiceTinPhongMNFrm`, `AR_OrderThanhTamFrm`, `AR_OrderThanhTam2Frm`, `IV_StockOutputVDFrm`/`VD2Frm` (VD có thể là Việt Đức). Trong DB Medcom có form động `AR_OrderVietDucFrm`, `AR_HoSoKhachHangThanhTamFrm` | Tùy biến theo khách bị trộn vào lõi |

**Đánh giá**:

- Metadata ERP.NET **chuẩn hóa tốt ở tầng engine**: cùng lược đồ `SY_*`, cùng ngữ nghĩa FormType, cùng bộ khóa `SY_FrmCfg`, cùng quy ước tên SP/báo cáo.
- **Ở tầng nội dung thì không chuẩn hóa**. Mỗi DB khách là một bản sao từ DB mẫu hoặc DB của khách khác, rồi được sửa trực tiếp
  (thêm/tắt menu, thêm form, đổi MenuID), không có cơ chế "gói chuẩn + phần mở rộng".
- Bản web nên coi **engine là sản phẩm** và **metadata là dữ liệu theo từng tenant**. Muốn kết luận chắc hơn, cần export đầy đủ
  `SY_Menu`/`SY_FrmLstTbl` của ít nhất 2–3 khách.

## 11. Hàm ý cho bản web

1. **Renderer theo FormType**: ưu tiên `LIST` (lưới sửa trực tiếp), `EDIT` (master + tab ô nhập + n tab detail), `LISTEDIT`. Chỉ ba loại này
   đã phủ 122/122 menu form động đang bật ở Medcom. `EDITTOP/POS/TIMELINE/CALENDAR/TREE` để sau (Medcom không dùng).
2. **Giữ thứ tự resolve**: trang code riêng (registry theo FormName) → form metadata → báo cáo (`*Report`). Như vậy có thể thay dần từng form viết
   tay mà không đổi menu. Với Medcom cần viết code cho 49 form viết tay đang bật: chứng từ lõi AP/AR/IV/CS/GJ (18 form trong `GetFormAcc`),
   số dư đầu kỳ, khóa sổ, phân quyền, tài sản/CCDC, thiết lập báo cáo tài chính.
3. **Báo cáo là khối lớn nhất (128 mục đang bật)**. Cần một "report runner" chung:
   - đọc tham số của `<FormName>Stp` (`parameters.json` / `sys.parameters`) và `SY_RpDTbl`/`SY_RpTbl` để dựng form điều kiện;
   - chạy SP, trả lưới / Excel;
   - xử lý mẫu `.rpx` riêng (tài liệu 02).
4. **Mô hình cấu hình có kiểu**:
   - Chuyển `SY_FrmCfg` (key-value) thành JSON có schema, dựa trên `winforms-property-keys-source.csv` (1.541 khóa, có mô tả).
   - Viết bộ giải mã `LYT` 21 trường (đã làm thử trong script). Đổi đơn vị X (40 px) / Y (20 px) sang lưới 24 cột; map `ControlType` sang component web.
   - Đọc metadata **runtime theo DB**, không sinh code tĩnh, vì mỗi khách khác nhau.
5. **Cần export thêm** (chỉ đọc) trước khi dựng màn hình thật:
   - `SY_FrmCfg` đầy đủ (hiện mới ≈ 32 %),
   - `SY_FrmDrdwTbl` (nguồn combobox),
   - `SY_FmtFldTbl` (nhãn cột/ô),
   - `SY_FrmExpTbl` (công thức),
   - `SY_FrmFltTbl` đầy đủ,
   - `SY_StTbl` (chuỗi/thông điệp),
   - `SY_RpDTbl`/`SY_RpTbl`/`SY_RpFTbl` (tham số + mẫu báo cáo),
   - các cột còn thiếu của `SY_Menu` (`MenuType`, `ShowDialog`, `isNotCheckPermission`, `IconIndex`, `isBeginGroup`, `isBold`, `ShortKey`, `ReportPara`).
6. **Hành động = lệnh server**. ERP.NET ghép chuỗi SQL với `{0}`/`{User}`/`Master.X` (nguy cơ SQL injection). Bản web nên:
   - mô hình hóa mỗi `Source` thành lệnh có tên, tham số bind rõ, kiểm quyền;
   - giữ giao thức thông điệp (`Msg`/`MsgType`, `RAISERROR`) và các chế độ `BeforeAction`/`AfterAction` (`Save*`, `Reload*`);
   - giữ các hook `EBE/EBD/EBS/ESS` làm điểm mở rộng vòng đời (trước sửa / trước xóa / trước lưu / sau lưu).
7. **Phân quyền**:
   - Tái hiện MAX(nhóm, ủy quyền, user) theo MenuID, khóa bằng `FormName[_Para]`, đủ 11 cờ.
   - **Không chép nhánh "mặc định cho phép"**: dùng mặc định từ chối, và gán quyền form con theo form/menu cha.
   - `isNotCheckPermission` cho lệnh chung.
   - Quyền cấp cột/ô (`LCK2/LCK3`, `HDE2/HDE3`, `ACP` + `isHideAmount`, `EditPermiss/VisiblePermiss` trong `LYT`).
   - Lưu ý DB đã có sẵn module `WA_*` (Web App) với menu/quyền riêng. Cần quyết định dùng lại `WA_Menu` hay `SY_Menu` cho bản web.
8. **Đánh số chứng từ và trạng thái**: dịch vụ đánh số dùng `DPR/DMK/DFP/DW2/DW3/DBSQ` + `SY_DocSetup`. Component chuyển trạng thái dùng cấu hình
   `StatusButtonCtl` (SQL menu, màu, SQL trước/sau) và các bảng `*StatusTbl` (`IsReject`, `IsFinal`, `SortOrder`).
9. **DB là nguồn logic**: 50 trigger và hàng trăm SP (`*_CheckSaveStp`, `*_UpdateRefDoc`, lifecycle sync...). Bản web gọi lại SP thay vì viết lại
   nghiệp vụ, ít nhất ở giai đoạn đầu.
10. **Quy ước dữ liệu**:
    - PK chuỗi (`DocumentID varchar(30)`, `UserAutoID varchar(40/50)`) do ứng dụng sinh; bản web phải sinh cùng định dạng.
    - Audit chỉ có ở master.
    - Nhiều FK `NOCHECK` hoặc thiếu FK, nên quan hệ phải suy theo tên cột (`ObjectID`→`CF_ObjectTbl`...) và theo quy ước PrimaryKey của `SY_FrmLstTbl`.

## 12. Câu hỏi còn mở

1. **Snapshot thiếu**: `SY_FrmCfg` 3.419 / ≈ 10.687 dòng, `SY_FrmFltTbl` 18 / ≈ 244. `provenance.json` nói đã lọc theo TableName, nhưng script
   `Start-MedcomAudit.ps1` hiện tại không có điều kiện lọc. Cần xác nhận cách trích và lấy bản đầy đủ. Kèm theo đó là `SY_FrmDrdwTbl`,
   `SY_FmtFldTbl`, `SY_FrmExpTbl`, `SY_StTbl`, `SY_Rp*`, `SY_UserPermisstion` (17.934 dòng quyền riêng, ảnh hưởng trực tiếp quyền hiệu lực).
2. **Phiên bản**: danh sách lớp viết tay lấy từ bản dịch ngược 2026-11-09, còn Medcom chạy bản 2026-10-09. Có lớp nào được thêm/bớt giữa hai bản không
   (ảnh hưởng phân loại 75 menu viết tay)?
3. **Báo cáo không có `.rpx` trên đĩa** (45 menu đang bật): mẫu lấy từ `SY_RpFTbl` (`FileContent`), từ tham số `@Template`, hay chỉ xuất lưới?
4. **Tiền tố số chứng từ mâu thuẫn**: `SY_DocSetup.FAM.PreFix = DCTS`, nhưng `SY_FrmCfg.FA_Move2026Frm.DPR = MLI`. Giá trị nào được dùng thực tế
   (dữ liệu `FA_MoveTbl.DocumentID` sẽ trả lời)?
5. **Khóa `C1`/`P1` trên `ExecSQLWithParaButtonCtl`** (53 dòng): còn tác dụng hay là rác cần dọn khi chuyển đổi?
6. **Quyền mặc định cho phép** (§7.1): form mở không qua menu (120 form động không có menu) nhận đủ quyền xem/thêm/sửa/xóa. Đây là chủ ý
   hay lỗi? Bản web nên **mặc định từ chối**. Nếu vậy cần một danh sách quyền cho các form "con" (mở bằng nút), ví dụ kế thừa quyền của form cha.
7. **Module WA/KD**: `WA_Menu` (58) và `KD_Menu` (93) phục vụ ứng dụng nào (MedcomApp, bản web cũ)? Có nên hợp nhất với `SY_Menu` cho bản web mới?
8. **Mức chuẩn hóa giữa khách hàng**: cần export đầy đủ `SY_Menu`, `SY_FrmLstTbl`, `SY_FrmCfg` của TinPhong và ít nhất một khách nữa
   (KEIKO qua `sql-bridge`, Meracine) để đo tỷ lệ trùng thực sự.
9. **Dữ liệu chứng từ MedData rất ít** (hóa đơn 38, mua hàng 14): đây là DB vận hành chính hay chỉ phục vụ luồng 2026? Dữ liệu kế toán lịch sử
   nằm ở DB nào?
10. **5 cặp (UserGroupID, MenuID) trùng** trong `SY_UserGroupPermisstion` (không có ràng buộc duy nhất): khi chuyển sang web, gộp theo MAX như engine hay làm sạch?
11. **`SY_GetUserMenuFnc` thêm cha mà không kiểm tra `isDisable`**. Hiện Medcom không bị ảnh hưởng, nhưng bản web nên giữ hay sửa hành vi này?

## Phụ lục: cách tái tạo

Các CSV/MD trong `data/` được sinh bằng script Python (chạy `python -I`, chỉ đọc nguồn), lưu kèm ở `data/scripts-30/`:

| Script | Tạo ra |
|---|---|
| `keys.py` | Từ điển khóa từ mã Tools |
| `build_menu_forms.py` | menu, forms |
| `build_cfg.py` | `SY_FrmCfg`, ví dụ |
| `build_misc.py` | hành động, quyền, chứng từ, schema, TinPhong |
| `topkeys.py`, `stitch.py` | Ghép tài liệu này |

Đường dẫn nguồn được ghi cứng ở đầu mỗi script.
