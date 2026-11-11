# 10 — Engine form động (dispatch, vòng đời, SY_FrmCfg, control, lưu dữ liệu, hook SQL)

Ngày khảo sát: 2026-11-11. Đọc trước: `00-nguon-du-lieu.md`.

Nguồn chính: mã dịch ngược `Tools.dll` và `ERP.NET.exe` (bản 09/11/2026). Mọi đường dẫn trong tài liệu này
là **tương đối so với `D:\Data\Web-ERP\.legacy\decompiled\`**, ví dụ `Tools/Tools.Layout/LayoutX.cs:1730`
(thư mục `Tools/` là assembly, `Tools.Layout/` là namespace). Số dòng ứng với bản dịch ngược hiện tại.

Ký hiệu mức bằng chứng:

- **[XM]** — đã xác minh trực tiếp trong mã (đọc thân hàm, không chỉ tên).
- **[SL]** — suy luận từ mã/metadata, chưa chạy thử.
- **[?]** — chưa rõ, cần kiểm tra thêm (xem mục 12).

Dữ liệu metadata dùng làm ví dụ: snapshot DB MedData (Medcom) ở
`D:\Data\Medcom\TechnicalDocs\db-audit\workflow-config-20261019\` (`forms.json` = 287 dòng `SY_FrmLstTbl`,
`form_config.json` = 3.419 dòng `SY_FrmCfg`). Bản export `forms.json` chỉ có một phần cột; danh sách cột đầy đủ
lấy từ `D:\Data\TinPhong\...\results\ui-SY_FrmLstTbl.json` và từ mã nâng cấp schema trong `Connector.cs`.

---

## 1. Bức tranh tổng thể

```
SY_Menu (FormName, Para, Filter, ShowDialog)
   │  MainFrm.MenuClick                         ERP.NET/ERP/MainFrm.cs:1231
   │    SharePara["Para"] = Para; App.Cn.Filter = Filter
   │    form = GetFormAcc(FormName)   (switch viết tay trong MainFrm)
   │        ?? App.GetFormByName(FormName)      Tools/Tools/App.cs:490
   │             1) lớp .NET trùng tên (reflection)       SysObject.GetFormByNameEx
   │             2) SY_FrmLstTbl.FormType → lớp form động   App.GetFormFromSQL
   │             3) report (GetFormForReport)
   │    form.Name = FormName  hoặc  FormName + "_" + Para   ← trở thành FID của SY_FrmCfg
   ▼
Form.Load  (FrmFormList / FrmFormListEdit / FrmMasterDetail / ... hoặc form viết tay)
   mFC = new FormControler(); Lyt = mFC.LoadLayout(Name)     → LayoutX đọc SY_FrmCfg WHERE FID = Name
   Lyt.Do_ExecSQLOnFormLoad()                                 → hook ESL
   mFC.SetControlBar(...)                                     → toolbar + quyền (Functions.GetPermission)
   mFC.SetData(slot T0, T1..TJ)                               → mỗi slot một Storer (Datas[1..n])
   Lyt.AddControlTab(LYT1/2/3/A/B/C/5/6/...)                  → sinh control từ chuỗi LYT + LYS
   mFC.SetGrid(...); Lyt.ApplySettingToGrid*(...)             → lưới master/detail theo TableInfoX
   mFC.SetFomularFromConfig()     → SY_FrmExpTbl (công thức)
   mFC.SetDropdownFromConfig()    → SY_FrmDrdwTbl, SY_FrmGrdActTbl, SY_FrmMstActTbl
   Storer.Action += handler       → nối các hook EBN/EON/EBE/EBD/EBS/ESDB/ESS/ESS2/ESCA/ESD/ESLOS
   mFC.Data.LoadDataDelay(700)
```

Ba tầng dữ liệu cấu hình mà web renderer phải đọc:

| Tầng | Bảng | Vai trò | Tài liệu |
|---|---|---|---|
| Danh mục form | `SY_FrmLstTbl` | FormID → FormType, caption, (fallback) bảng/khóa | mục 2 |
| Cấu hình form | `SY_FrmCfg` | toàn bộ layout, bảng master/detail, hook SQL, toolbar | mục 4–7 |
| Cấu hình phụ theo form | `SY_FrmDrdwTbl` (dropdown/lookup), `SY_FrmExpTbl` (công thức), `SY_FrmGrdActTbl`, `SY_FrmMstActTbl`, `SY_FrmOptBtnTbl`, `SY_FrmFltTbl` | combo/lookup, công thức, action lưới/master, nút tùy chọn, bộ lọc toolbar | chỉ nêu điểm nối ở mục 5.6, 6.8 |

---

## 2. Dispatch form

### 2.1 Thứ tự tìm form — `App.GetFormByName` [XM]

`Tools/Tools/App.cs:490-756`:

1. Kiểm tra hạn hosting (`SystemPara "HstExDT"`) và đăng ký bản quyền (đếm record) — có thể thoát ứng dụng
   (`App.cs:500-653`). Không tái tạo trên web, nhưng lưu ý: đây là logic "khóa phần mềm", không phải nghiệp vụ.
2. `Functions.CheckDBConnectionAndDateTime()`, ghi log `UpdateLog(FormName, Para, "Open")` (`App.cs:729-735`).
3. `SysObject.GetFormByNameEx(FormName)` (`Tools/Tools/SysObject.cs:91`): `Type.GetType(FormName)` rồi quét
   mọi type có `BaseType` là `Form`/`FrmMasterDetail`/`FrmFormList`… so khớp **tên lớp không phân biệt hoa thường**.
   ⇒ **Nếu có lớp viết tay trùng FormID thì lớp đó thắng**, `SY_FrmLstTbl` bị bỏ qua.
4. Lỗi ở bước 3 → `GetFormFromSQL(FormName)` (`App.cs:2039`).
5. Không có → `GetFormForReport(FormName)`.
6. Không có và user là admin/`ADMIN*` + giữ **Ctrl** → hộp thoại tạo dòng `SY_FrmLstTbl` mới
   (`App.cs:669-718`; LIST/LISTEDIT bắt buộc có TableName và PrimaryKey).

Ở `MainFrm.MenuClick` (`ERP.NET/ERP/MainFrm.cs:1231-1310`): `SharePara("Para") = SY_Menu.Para`;
`App.Cn.Filter = SY_Menu.Filter` (filter bổ sung cho master, xem 3.6); sau khi tạo form,
**`form.Name = FormName + "_" + Para`** nếu Para khác rỗng (`MainFrm.cs:1242, 1262`). Vì `LoadLayout(Name)` chạy
trong `Load` (sau khi gán Name), **FID trong `SY_FrmCfg` của một menu có Para là `FormName_Para`**, trong khi
FormType vẫn tra theo `FormName` gốc. Form viết tay còn tự đổi tên (ví dụ `AR_InvoiceFrm` → `AR_InvoiceFrm_EXPORT`,
`ERP.NET/ERP/AR_InvoiceFrm.cs:2199`). [XM]

Mở form từ nơi khác: `App.ShowFormByName(name, ShowDialog, FindDocumentID, FilterString)` (`App.cs:758`) đặt
`SharePara("DocumentID")`/`_FilterString` và `Mode = FormMode.Find`; `App.ShowFormBySourceID(SourceID, DocID)`
(`App.cs:802`) tra `SY_GetFormNameBySourceIDStp` → `vSourceListFull` → `{Module}_DocSetup.FormID`. [XM]

### 2.2 FormType → lớp form [XM]

`GetFormFromSQL` đọc `Select * from SY_FrmLstTbl where FormID = '...'` (`App.cs:2042`, `Db.SY_FormList =
"SY_FrmLstTbl"` ở `Tools/Tools/Db.cs:52`); FormType rỗng ⇒ `LIST` (`App.cs:2056`). Caption = `CaptionVN` nếu
`LangID = "VN"`, ngược lại `CaptionEN` (`CaptionCH` không dùng ở đây).

| FormType | Lớp | FT (FormControler) | Thuộc tính lấy từ `SY_FrmLstTbl` | Ghi chú |
|---|---|---|---|---|
| `LIST` | `Tools.SysForm/FrmFormList` | `FT_LIST` | SettingInfoRow, TableName, PrimaryKey, TableDetailLeftJoinField, TableDetailSelectFrom, HideColumnArr, SummaryColumnArr, LockColumnArr, EditorColumnArr, FilterEx (`App.cs:2057-2079`) | Lưới sửa trực tiếp nhiều dòng (Janus GridEX), không có panel editor |
| `LISTEDIT`, `LISTEDIT2` | `Tools.SysForm/FrmFormListEdit` (`ListFormType` = giá trị) | `FT_EDIT` | như LIST (`App.cs:2081-2104`) | Lưới + panel editor từng dòng. Khác nhau duy nhất: `ToolBarX1.ViewMode` = 1 (LISTEDIT) / 2 (LISTEDIT2) (`Tools/Tools.SysForm/FrmFormListEdit.cs:953-960`) |
| `EDIT` | `Tools.SysForm/FrmMasterDetail` | `FT_EDIT` | chỉ caption (`App.cs:2106-2119`) | Chứng từ master-detail. **TableName/PrimaryKey của SY_FrmLstTbl bị bỏ qua**, bắt buộc có slot `T0` trong `SY_FrmCfg` (`FrmMasterDetail.cs:957-961`) |
| `EDITTOP` | `Tools.SysForm/FrmMasterEditTop` | `FT_EDIT` | chỉ caption | Editor (layout `1`) đặt trong `grpDoc` phía trên, `ViewMode = 2` (`FrmMasterEditTop.cs:242, 956-958`). Mô tả trong `Functions.GetFormTypeList`: "Nhập dữ liệu không cần bấm nút sửa" — cơ chế tự vào chế độ sửa chưa đối chiếu hết [SL] |
| `POS` | `Tools.SysForm/POSTableFrm` | `FT_EDIT` | chỉ caption | Ô vuông thông tin, cấu hình `PO` (mục 4.8) |
| `CALENDAR` | `Tools.SysForm/FormCalendarFrm` | `FT_EDIT` | chỉ caption | Lịch tháng, cấu hình `CO` |
| `TIMELINE` | `Tools.SysForm/FormTimeLineFrm` | `FT_EDIT` | chỉ caption | Tiến độ, cấu hình `TLO` |
| `TREE` | `Tools.SysForm/FormTreeViewFrm` | — | chỉ caption | **Form rỗng (chỉ có Label "Tree view")**, không có logic (`FormTreeViewFrm.cs`, 109 dòng). Dạng cây thật nằm ở `TableInfoX.SetTreeViewInfo` (STV) trên lưới |
| khác | — | — | — | trả `null` → thử report |

`Functions.GetFormTypeList()` (`Tools/Tools.Utils/Functions.cs:10233`) chỉ liệt kê LIST, LISTEDIT, EDIT, EDITTOP,
POS, TIMELINE, CALENDAR cho hộp thoại tạo form (LISTEDIT2, TREE không có trong danh sách chọn).

Các form khác của engine **không** được dispatch qua FormType:

| Lớp | Khi nào mở |
|---|---|
| `FrmAddnew` | Thêm nhanh từ combo/lookup (F2/F7, nút "+"), xem 5.6 |
| `SelectMasterDetailFrm`, `SelectMasterOnlyFrm` | Nút tùy chọn/Command kiểu ShowSelectForm/ShowSelectList (`Tools/Tools/ToolBarEx.cs:5422`, `OptionBarX.cs:870`) |
| `DashboardFrm`, `WA_DashboardFrm` | Màn hình chính sau khi dựng menu (`Tools/Tools.Utils/Menus.cs:220-230, 518`) |
| `ViewDataFrm` | Lưới hiển thị kết quả hook (MsgInfo), trùng dữ liệu… |

Phân bố FormType ở MedData: LIST 149, EDIT 122, LISTEDIT 12, LISTEDIT2 4 (không có EDITTOP/POS/CALENDAR/TIMELINE/TREE).

### 2.3 Bảng `SY_FrmLstTbl` — các cột và ai đọc

Cột thực tế (TinPhong): FormID, FormType, CaptionVN, CaptionEN, CaptionCH, TableName, PrimaryKey, HideColumnArr,
SummaryColumnArr, AddNewColumnArr, FilterEx, LockColumnArr, TableDetail, TableDetailLeftJoinField,
TableDetailSelectFrom, TableDetail2, TableDetail2LeftJoinField, TableDetail2SelectFrom, Filter, PrimaryKeyFormat,
PrimaryKeyLen, DefaultColumnArr, EditorColumnArr. Mã còn truy vấn cột **`PrimaryKey2`** (`Connector.cs` hàm
`Ln9uJ3cnEa`, `where PrimaryKey = ... or PrimaryKey2 = ...`) — cột này không có trong export TinPhong [?].

| Cột | Người đọc (đã xác minh) | Ý nghĩa thực tế |
|---|---|---|
| FormID | `GetFormFromSQL` | Khóa; trùng tên form/menu FormName |
| FormType | `GetFormFromSQL` | Mục 2.2. **Toolbar của form LIST cho phép đổi LIST/LISTEDIT/LISTEDIT2 và ghi thẳng vào bảng** (`ToolBarEx.cs:2441-2458, 3189`; không thấy kiểm tra quyền tại điểm ghi) |
| CaptionVN/EN/CH | `GetFormFromSQL`, `LayoutX.SetFormTitle` (`LayoutX.cs:1428`: `Caption{LangID}`) | Tiêu đề |
| TableName, PrimaryKey | LIST/LISTEDIT **chỉ khi slot T0 chưa cấu hình** (`FrmFormList.cs:277-286`); FrmAddnew; tìm form thêm nhanh theo `PrimaryKey = FieldName` (`Connector.cs` `RaiseAddNewEvent`) | Bảng/khóa fallback. Với EDIT bị bỏ qua |
| TableDetailLeftJoinField, TableDetailSelectFrom | LIST/LISTEDIT fallback: `SetData(TableName, PK, "*", LeftJoinField, SelectFrom, ...)` (`FrmFormList.cs:285`) | Tên gây hiểu nhầm: thực chất là **cột join thêm của master** và **mệnh đề FROM** khi không có T0 |
| HideColumnArr | LIST/LISTEDIT (`SetGrid ... HideColumnArr`), FrmAddnew; toolbar có menu sửa trực tiếp cột này (`ToolBarEx.cs:3129-3133`) | Cột ẩn trên lưới, phân tách `;` hoặc `,` [SL về `,`] |
| SummaryColumnArr | LIST/LISTEDIT | Cột tổng dưới lưới |
| LockColumnArr | LIST (`mFC.LockColumn`), FrmAddnew | Cột khóa không cho sửa |
| EditorColumnArr | LISTEDIT: thứ tự cột khi **tự sinh editor** (`FrmFormListEdit.cs:1575-1592`) | Xem 5.8 |
| FilterEx | LIST/LISTEDIT fallback khi không có T0 | Điều kiện cố định |
| PrimaryKeyFormat, PrimaryKeyLen | LIST/LISTEDIT `GetNewPrimaryKeyDefault` (`FrmFormList.cs:632-675`) | Sinh mã mới = Format + `max(substring)+1` pad trái `Len` chữ số |
| AddNewColumnArr | `FrmAddnew` (thêm nhanh) (`Connector.cs:1011, 1078`, `FrmAddnew.cs:394`) | Danh sách cột hiện trong form thêm nhanh |
| DefaultColumnArr | `FrmAddnew` (`FrmAddnew.cs:402-560`) | Cột lấy giá trị mặc định từ form cha (ParentFC.Data) hoặc ShareParam |
| TableDetail*, TableDetail2*, Filter | **Không thấy engine đọc từ SY_FrmLstTbl** (các chỗ đọc `["TableDetail"]` là của `SY_DocSetup`, `ToolBarEx.cs:5607`, `CommandButtonCtl.cs:1135`) | Di sản; MedData: 0 dòng dùng |

Thống kê MedData: AddNewColumnArr 1 form, DefaultColumnArr 2, FilterEx 7, LockColumnArr 7, TableDetail 0, Filter 0.

---

## 3. Vòng đời, chế độ, toolbar, khóa

### 3.1 Ba khái niệm "chế độ" — đừng nhầm [XM]

| Khái niệm | Định nghĩa | Ý nghĩa |
|---|---|---|
| `StoreStatusEnum` (`Tools/Tools.Data/StoreStatusEnum.cs`) | `IsNone=0, IsNew=1, IsEdit=2` | **Trạng thái dữ liệu = dirty state** của `Storer` master (`mFC.Data.Status`). Toàn bộ bật/tắt nút, khóa editor dựa vào đây |
| `FormMode` (`Tools/Tools/FormMode.cs`) | `Normal=0, Find=1, AddNew=2, Edit=3, FindEditOrAddNew=5, Auto=9` | **Cách mở form**. `Find`: lọc theo `SharePara(PK)` hoặc `_FilterString`, ẩn nhóm tìm; `AddNew`/`Edit`: mở form ở dạng hộp thoại, tự gọi AddNew/Edit và **đóng form sau khi lưu/hủy** (`FrmMasterDetail.cs:1521-1600, 1699-1743`); `FindEditOrAddNew`: có dữ liệu → Edit, không có → AddNew |
| `ViewMode` (`Tools/Tools/ViewMode.cs`, `FormControlerViewMode.cs`) | `0 List, 1 Detail, 2 DetailEx` | Bố cục lưới/editor: 0 = chỉ lưới khi xem, chỉ editor khi sửa; 1 = lưới + editor dock phải; 2 = editor luôn hiện, lưới ẩn khi đang sửa. Lưu registry `{FormName}\ViewMode` (mặc định 1 cho FT_LIST, 2 cho FT_EDIT) |

`FormControler.FORM_DATA_STATUS` (`FormControler.cs:313`) và `FORM_TYPE_ENUM {FT_LIST, FT_EDIT}` (`:321`) là
enum nội bộ; `FT_LIST` lưu cả lưới bằng `UpdateSource`, `FT_EDIT` lưu master + detail bằng `Storer.Save`.

### 3.2 Sự kiện `StoreActionEnum` (`Tools/Tools.Data/StoreActionEnum.cs`) [XM]

Mọi hook nối vào sự kiện `Storer.Action` của master. Giá trị: acNone 0, acNew 1, acEdit 2, acSaving 3,
**acAfterSaved 4**, acCancel 5, acChanged 6 (đổi dòng hiện hành / reload detail), acDelete 8, acRequire 9,
acLoadData 10, acStatusChanged 11, acUpdate 12, acUpdated 13, acCallChange 14, acRequireAtRow 15, acDuplicate 16,
acResetDefault 17, acCanceled 18, acAfterMasterSaved 19, acLockObjectEditor 20, acDefaultViewChange 21,
**acBeforeSave 22**, acFocusFieldName 23, **acBeforeNew 24**, **acBeforeEdit 25**, **acBeforeDelete 26**,
**acAfterDeleted 27**, acBeforeLoadData 28, acSetDefaultValue 30, acNewCopy 31.

Handler đầy đủ nhất là `FrmMasterDetail.WwL5VhCwA5` (`Tools/Tools.SysForm/FrmMasterDetail.cs:1745-1960`):

| Sự kiện | Việc làm (theo thứ tự trong mã) |
|---|---|
| acBeforeNew | `Do_ExecSQLCheckBeforeAddNew` (EBN); false ⇒ hủy thêm |
| acNew, acNewCopy | `Do_ExecSQLOnAddNew` (EON) gán giá trị trả về vào field |
| acBeforeEdit | EBE; false ⇒ hủy sửa |
| acBeforeDelete | EBD; false ⇒ hủy xóa |
| acBeforeLoadData | ESLD |
| acChanged, acLoadData | ESLR |
| acBeforeSave (Value≠true) | 1) `MustHaveDetailRecord` (MHD) và lưới detail rỗng ⇒ hủy; 2) ghép **SearchField** từ detail (SFD…); 3) cộng tổng detail lên master (SUD/SUD2); 4) EBS (hoặc EBC khi "Lưu tiếp"); 5) nếu qua: ESDB (gán lại field trước khi ghi) |
| acAfterSaved | ESS (+ ES2/ES4, ES6/ES7), ESS2 (trễ 2,5 s); `T0.RLM` ⇒ reload |
| acCanceled | ESCA |
| acAfterDeleted | ESD (`Value` = khóa vừa xóa) |
| acEdit, acNew, acNewCopy, acChanged, acLoadData | ESLOS/ESLOS2 (khóa/mở khóa control theo SQL) |

`FrmFormList` (LIST) nối EBS/EBD qua `FormControler.BeforeUpdateData/BeforeDeleteData` và phần còn lại qua
`Data.Action` (`FrmFormList.cs:464-545`); ở LIST không có ESLD/ESLR/ESDB/ESLOS. Form viết tay tự nối (mục 9).

### 3.3 Luồng nút lệnh [XM]

**Thêm** — `FormControler.AddNew` (`FormControler.cs:2054`) → `Storer.AddNew` (`Tools/Tools.Data/Storer.cs:2154`):
acBeforeNew (có thể hủy) → kiểm tra `Permiss.AddNew` và `Status = IsNone` → tạo `NewRow` → gán `UserAutoID`
(nếu PK là UserAutoID), `UID` → chạy từng `DefaultValueSQL` (số chứng từ, mã CF, AutoNumber, SQL mặc định) →
action check `LockObjectEditor` → acNew. Sau đó `LoadDocumentPrefixWithColumnArr` (DW2/DW3) và focus editor đầu.

**Copy** (`AddNewBySaveCopy`, `FormControler.cs:2100`): hỏi "copy đến ngày hiện tại / theo ngày chứng từ / hủy"
nếu có `DocumentDate`; FT_EDIT: sao chép giá trị master (trừ PK và field có DefaultValueSQL `isUnique`), reset các
field `ANCR`, `isLock=0`, `UserUpdate/DateUpdate = null`, xóa `UID`/`LinkID`, sao chép detail 2–6 với PK mới
(`UserAutoID + STT`), reset `ANCR` của từng detail; phát acNewCopy. Nếu có hook `EONC` thì copy do SQL đảm nhận
(`FormControler.cs:4803`, `LayoutX.cs:4333`).

**Sửa** — nút Sửa (`FormControler.cs:6597`): BeforeEditCheck → **kiểm tra khóa** `f6Qlxl5k7J` (3.5) →
BeforeEditData → `Edit()` → `Storer.Edit` (`Storer.cs:2310`): nếu `RCR` thì nạp lại dòng hiện hành từ DB → acBeforeEdit
(EBE) → `Status = IsEdit` → acEdit.

**Lưu** — nút Lưu (`FormControler.cs:5966`): BeforeUpdateData (LIST: EBS) → `Save()` (`:2504`); in sau khi lưu
nếu bật PRINTAFTERSAVE. Chi tiết ghi DB ở mục 6. `Save()` có các trễ `Thread.Sleep` ngẫu nhiên phụ thuộc ngày cài đặt
(`:2522-2564`) — cơ chế chống bẻ khóa, **không tái tạo**. FT_EDIT còn hỏi khi ngày chứng từ khác kỳ đang lọc hoặc
vượt hiện tại 1 tháng (`:2573-2584`).

**Lưu tiếp** (`SaveContinue`, `:6006`): `isSaveAndContinue = true` → `Save()` → `Edit()` lại; nút Hủy ẩn, nút Lưu
đổi thành "Hoàn tất". Dùng EBC thay EBS (`LayoutX.cs:4378`). `SaveAddNew` (`:6074`) = lưu rồi thêm mới, xóa detail.

**Hủy** — `Cancel()` (`:2451`) → `Storer.Cancel` (`Storer.cs:2400`): acCancel → `RejectChanges` → acCanceled
(ESCA). LIST đang thêm mới thì nạp lại.

**Xóa** — nút Xóa (`FormControler.cs:4641`): kiểm tra khóa → BeforeDeleteData (EBD ở LIST/EDIT) → hỏi xác nhận →
`Storer.Delete` (`Storer.cs:2416`): acBeforeDelete (EBD) → `currentRow.Delete()` → `UpdateSource(IsDelete:true)` →
acAfterDeleted (ESD) → acChanged; ghi log "Xóa/Delete".

**Tìm** — `ShowFilterDialog` (`FormControler.cs:6678`): dựng điều kiện; điều kiện trên detail được chuyển thành
`PK in (Select Distinct DetailField from (detail source where ...))` (`:7670-7679`).

**Nạp lại** — menu RELOAD, `DoAction_Before_After("Reload"/"ReloadCurrent"/"ReloadDetail")` (`:9590`); tự nạp lại
mỗi `D2` giây (mặc định 600) và khi form được focus nếu `RDA = 1`.

**In** — `PrintReportFromGrid` hoặc `PrintReportFromDocument` theo `BPOP` (mục 4.4); report thuộc tài liệu khác.

**Đóng** — `FormClosing` (`FormControler.cs:7688`): nếu `Status ≠ IsNone` hỏi "Lưu thay đổi?" Có/Không/Hủy;
Có ⇒ `Save()`, thất bại thì không đóng. Sau đó lưu layout lưới, dừng timer; `FormClosed` chạy ESC (không đồng bộ).

### 3.4 Toolbar (`ToolBarEx`, `ToolBarX`, `ToolbarBaseX`) [XM]

Nút chuẩn và phím tắt (mnemonic Alt, `Tools/Tools/ToolBarEx.cs:1255-1424`): **&Thêm** (Alt+T), **&Copy** (Alt+C),
**&Sửa** (Alt+S), **&Xóa** (Alt+X), **&Lưu** (Alt+L), **Lưu tiế&p** (Alt+P), **&Không lưu** (Alt+K), **Tì&m** (Alt+M),
**&In** (Alt+I), **Tùy c&họn** (Alt+H), **Đó&ng** (Alt+N), "Chuyển dữ liệu" (Copy To). Phím hệ thống
(`FormControler.cs:8670-8690`): **Ctrl+F10** = thiết lập FormControler/dropdown (admin mode), **Ctrl+F11** = ngôn ngữ
(Manager), **Ctrl+F12** = `LayoutSettingFrm` (thiết kế layout, admin mode). Trong control: F2/F7 thêm nhanh
(nút "+"), F3/F4 mở danh sách, F5 nạp lại nguồn, F9 cấu hình combo (`ComboX.cs:2199-2252`, `EditX.cs:1302-1321`,
`GridX.cs:5997-6301`). `PrintButtonCtl`/`AttachWebcamImageControlCtl` có phím F tự cấu hình (`SC`).

Hiển thị theo trạng thái — `CheckButton` (`FormControler.cs:5682-5837`):

| Trạng thái | Hiện | Enabled |
|---|---|---|
| IsNone | Thêm, Copy, Sửa, Xóa, Tìm, In, Đóng, Tùy chọn, Chuyển | Thêm = CanAdd; Copy = CanAdd & có dòng; Sửa = CanEdit & có dòng; Xóa = CanDelete & có dòng (FT_EDIT cần RowNo>0); In = có dòng |
| IsNew / IsEdit | Lưu, Lưu tiếp, Hủy, (Lưu&Mới, Lưu&Copy) | Lưu&Mới/Copy = CanAdd |

Đồng thời `akVldynHsy(IsNone)` khóa toàn bộ editor master khi IsNone (`Locked = true`), mở khóa khi sửa/thêm, khóa
nhóm tìm kiếm trên toolbar khi đang sửa (`:5844-5881`).

Cờ ẩn nút (`ToolBarSetting`, key form-level, mục 4.4) **đồng thời hạ quyền**: `Permiss.AddNew &= ShowAddNewButton`,
tương tự Edit/Delete (`FrmFormList.cs:252-263`, `FrmMasterDetail.cs:945-956`). Quyền gốc lấy từ
`Functions.GetPermission(form.Name)` trong `SetControlBar` (`FormControler.cs:3055`), cấu trúc `PermissionType`
(`Tools/Tools.Data/PermissionType.cs`): View, AddNew, Edit, Delete, Manager, Admin, AutoLock, HideAmount, LockDoc,
UnLockDoc, ExportExcel. Storer detail nhận `Delete = Delete | AddNew | Edit` (`FormControler.cs:4126-4138`).
Cơ chế phân quyền chi tiết thuộc tài liệu khác.

Menu "Tùy chọn" (`ToolBarEx.cs:1728-1926`): LIST/LISTEDIT/LISTEDIT2 (đổi FormType, chỉ form LIST), VIEWMODE 0/1/2,
LOCK (khóa/mở khóa chứng từ), STATUS, RELOAD, AUTOLOAD (10 phút), ngôn ngữ, IMPORTEXCEL (ẩn bằng HIEM), LOGVIEW,
SETUP (SETREQUIRE, SETDUPLICATE, SETSHOWCOLUMN, SETDEFAULT, AUTOSAVE 5 phút, PRINTAFTERSAVE, DOCPREFIX), TOOLS (gộp mã,
đánh lại số, gộp chứng từ, khóa/mở khóa hàng loạt, chuyển trạng thái hàng loạt, xóa tất cả…), import/export.

### 3.5 Khóa chứng từ [XM]

`FormControler.SetLock(expr, isSQL, params, langKey)` (`FormControler.cs:7449, 7607`) đăng ký quy tắc; trước khi
Sửa/Xóa, `f6Qlxl5k7J` (`:6523-6595`) duyệt từng quy tắc:

- quy tắc có chứa `isLock`: **đọc lại `IsLock` từ DB** (`Select IsLock from {TableMain} where PK = ...`) và cập nhật dòng;
- quy tắc SQL: thay `{0}`/`{Field}` (ngày định dạng `yyyy-MM-dd`), chạy, **có dòng trả về ⇒ khóa**;
- quy tắc biểu thức: `DataTable.Select(expr)` trên bản sao dòng hiện hành, có dòng ⇒ khóa;
- khóa ⇒ `ShowWarning(Lang(langKey))`, chặn thao tác. Quy tắc theo detail (`SetLockMasterByDetail`) kiểm tra
  trên Storer detail (`z7ilB2n6nt`, `:6635`).

Quy tắc engine tự thêm cho EDIT (`FrmMasterDetail.cs:1131-1186`; form viết tay thêm tương tự, ví dụ
`AR_InvoiceFrm.cs:2273-2279`):

| Quy tắc | Điều kiện bật | langKey |
|---|---|---|
| Kỳ đã khóa sổ: `Select * From SY_CheckDateOfPeriodOpeningFnc('{0}') where isClosed = 1` (tham số = `DFP`) | Có `DFP` và `DDC = 1` (mặc định 1) | InvalidDatePeriodDoc |
| Cùng kỳ, **kiểm tra lại lúc lưu**: ActionCheck `MasterSaved` chạy `SY_CheckDateOfPeriodOpeningFnc(?)` trong transaction, kết quả `0` ⇒ rollback | như trên | InvalidDatePeriodDoc |
| `UserCreate <> '{user}'` | bảng có `UserCreate`, `SPA2 ≠ 1`, user không phải Admin (hoặc không phải Manager nếu `SystemPara.isManagerCanEditDoc`) | NoPermissToEditDelete |
| `isLock = 1` | bảng có cột `isLock` | NoPermissToEditDeleteLockDoc |

Khóa/mở khóa thủ công: menu LOCK → `SY_ApproveDocumentOneLevelFrm`, cần `Permiss.LockDoc` hoặc `UnLockDoc`
(`ToolBarEx.cs:2088-2104`); chứng từ khóa tô hồng trên lưới nếu `D1 = 1`. Khóa cấp control: `LBEX`/`LBS` (mục 4.10),
hook ESLOS (mục 7). Khóa cột: `LCK`, `LCK2` (khóa với User), `LCK3` (khóa với User+Manager). `LockRow` (struct
`Tools/Tools/LockRow.cs`) dùng cho `SetLockRow` của lưới.

### 3.6 Lọc dữ liệu theo người dùng [XM]

- **LIST** (`FrmFormList.cs:320-353`): bảng có `UserCreate` và user không Manager/Admin ⇒ thêm
  `{Table}.UserCreate = '{user}'`; có `BranchID` và user có chi nhánh ⇒ `GetBranchFilter` (trừ `SPA3 = 1`); user
  chỉ có quyền Thêm ⇒ `1=0` (không thấy dữ liệu).
- **EDIT** (`FrmMasterDetail.cs:1407-1469`): `FilterEx` của T0 (chỉ áp dụng khi `FTXS` trả > 0 nếu có) +
  `App.Cn.GetFilter()` (filter của menu) + `CostCenterID` của user; không phải Manager/Admin thì thêm
  `UserCreate = '{user}'` (trừ `SPA2`); thêm filter chi nhánh (trừ `SPA3`). Mặc định giá trị mới:
  BranchID, EmployeeID, ManagerID, CostCenterID, StoreHouseID theo user (`:1189-1213`).
- Bảng ≥ 10.000 dòng mà không cấu hình `TRS` ⇒ tự thêm bộ lọc "Top 5000" (`FrmFormList.cs:314-318`,
  `FrmMasterDetail.cs:1361-1364`).

---

## 4. Cấu hình `SY_FrmCfg`

### 4.1 Lược đồ, nạp, lưu, cache [XM]

Schema (`Tools/Tools.Data/Connector.cs:1703, 1590, 1631`): `UserAutoID varchar(50) PK, FID varchar(250),
KeyID varchar(50), SubID varchar(50) NULL, KeyValue nvarchar(max), SubValue nvarchar(max), VDate datetime, PFID
varchar(250)`; index `SY_FrmCfg_IX_FID` trên FID (`:1574`). Không có ràng buộc duy nhất trên (FID, KeyID, SubID…).

- Nạp chế độ chạy (`LayoutX.LoadLayoutDB`, `Tools/Tools.Layout/LayoutX.cs:1285-1380`):
  `Cache.CreateData("Select KeyID, SubID, KeyValue, SubValue From SY_FrmCfg where FID = '{FormName}' and
  Coalesce(KeyValue,'') <> ''", Forever1Day)`; cột chỉ đọc. Chế độ thiết kế (`isReadOnly = false`) đọc cả dòng rỗng.
- Mọi getter dùng `DataTable.Select("KeyID = '...' [and SubID = '...'] [and SubValue = '...']")[0]` — **lấy dòng
  đầu tiên**, rỗng ⇒ mặc định (`LayoutX.cs:1603`, `TableInfoX.cs:2680`, `PropertyX.cs:271`).
- Lưu (`SaveConfig`, `LayoutX.cs:1382-1426`): kiểm tra PK từng slot → **`Delete from SY_FrmCfg where FID = ...`**
  rồi Insert lại từng dòng có KeyValue khác rỗng (nối chuỗi, chỉ escape `'`), cuối cùng
  `Update SY_FrmCfg set PFID = '{ParentTopFormName}'`. Không transaction, không kiểm tra xung đột.
- PFID = tên form cha (`ParentLinkmFc.FormBase().Name`) tại lúc lưu thiết kế; engine **không đọc** PFID khi chạy.
  MedData: 30 dòng có PFID.
- Cache: `CacheType {Nomal5Min=0, Fast15Min=1, Forever1Day=9}`; `Cache.Clear()` chỉ làm hết hạn loại ≠ Forever1Day,
  `Cache.Clear(true)` xóa tất cả (gọi khi lưu thiết kế, `LayoutSettingFrm.cs:5323, 6668`) (`Tools/Tools/Cache.cs:16, 75`).
  ⇒ Thay đổi cấu hình chỉ có hiệu lực ở **máy đã lưu**; máy khác phải chờ hết ngày hoặc khởi động lại [SL].

### 4.2 Mô hình địa chỉ (KeyID / SubID / SubValue) [XM]

| Nhóm | KeyID | SubID | SubValue | KeyValue | Lớp đọc |
|---|---|---|---|---|---|
| Key cấp form | literal (FW, SP, EBS, HBA…) | — | — | giá trị | `LayoutX.GetValue` và wrapper `ToolBarSetting`, `CommonDocumentSetting`, `SearchAndSumSetting`, `ExecSQLCommand`, `TabMaster`, `TabDetail` |
| Số tự động 1/2 | `{key}-1`, `{key}-2` (ADT-1, DPR-1, DMK-2…) | — | — | giá trị | `AutoDocNumberSetting.GetValue` = `ParentLyt.GetValue(Key + "-" + ID)` (`AutoDocNumberSetting.cs:220`) |
| Slot bảng | `T0`…`T9`, `TA`…`TJ` | literal (TN, PK, SO…) | — | giá trị | `TableInfoX` |
| Định dạng điều kiện lưới | `{slot}F1`…`{slot}F9` (vd `T0F1`) | C1, C2, V1, OP, CO, BO… | — | | `GridCondition` → `GridConditionFormat` |
| Màu động lưới | `{slot}C1`…`{slot}C9` (vd `T4C1`) | A, B, C, FB… | — | | `GridDynamic` → `GridDynamicColorFormat` |
| Nhóm cột | `{slot}CS` | `11`/`12` caption/cột nhóm 1, `21`/`22` nhóm 2 … (G1…GV), `RC` số dòng header nhóm (1) | — | | `ColumnSets` |
| Cột link lưới | `{slot}LC1`…`{slot}LC4` | 0, 1, 2, 2A, 3, 5, BT, URL… | — | | `GridColumnLink` |
| Thuộc tính cột lưới/field | `F0` (master/list), `F1`…`F9` (detail 1–9) | tên cột | `CF` format, `CV` caption VN, `CE` caption khác VN, `DV` mặc định, `DS` mặc định bằng SQL | giá trị | `LayoutX.RY44wZYG3s` (`LayoutX.cs:2918-2995`); `F0/CF` còn là format của editor master (`GetFieldFormatMaster`, `:2903`) |
| Vị trí control | `LYT{tab}` | FieldName / tên control | thứ tự `001`, `002`… (sort) | chuỗi 21 vị trí | `LayoutX.GetControlLayout` + `LayoutItemX.SetConfig` |
| Thuộc tính control | `LYS{tab}` | FieldName / tên control | **mã thuộc tính** (BT, C4, LBEX…) | giá trị | `PropertyX.GetValue` (`PropertyX.cs:271`) |
| Control con của GroupBox | `LYT{tab}{GroupField}` / `LYS{tab}{GroupField}` | như trên | như trên | | `AddControlTab` đệ quy (`LayoutX.cs:1989-1990`) |
| Control đơn lẻ ngoài form | `LYTX`, `LYSX` với **FID = `{Form}_{ConfigKey}`** | | | | `LayoutItemX.LoadLayoutSingle` (`LayoutItemX.cs:2154`) — MedData: `AR_ChiTieuQuanLy2022Frm_FLT004` |
| Copy khi thêm mới | `CD` | 01, 01S, 02…54 | — | | `CopyDataOnAddNew` |
| Kiểm tra bảng liên kết | `LTC` | 01…06 | — | | `LinksTableCheck` (**không có consumer**) |
| Tùy chọn web | `WO` | … | — | | `WebOptions` (**không có consumer trong WinForms**) |
| POS / List / Calendar / Timeline | `PO`, `LO`, `CO`, `TLO` | literal | — | | `POSTableOptions`, `FormListOptions`, `FormCalendarOptions`, `FormTimelineOptions` |

Các layout khác (`FrmAddnewLayoutX`, `SelectMasterDetailLayoutX`, `ImportExcelLayoutX`, `DataMapsLinkLayoutX`
(CopyFrom/CopyTo), `ReportSettingLayoutX`, `frmEditXSettingLayoutX`) dùng cùng bảng với FID riêng, ví dụ thêm nhanh:
`{ModuleID}_AddNew{FieldName}Frm[_{FormCha}]` (`Connector.cs` `RaiseAddNewEvent`). Không thuộc phạm vi chi tiết ở đây.

Thống kê KeyID MedData: LYS* 1307, LYT* 727, T0 408, T1 265, T2 154, T4 84, T3 68, T1CS 48, HBA/HBC/HBD 28,
T1F1 24, T0F2 17, EBE 17, EBD 16, SP 16, DFP 15, DPR 14… Không form nào dùng T5–TJ.

### 4.3 Slot bảng T0…TJ [XM]

`LoadLayoutDB` khởi tạo 20 `TableInfoX` (`LayoutX.cs:1318-1357`). Key literal là **T0–T9 rồi TA–TJ** (không có
`T10`…`T19`). `CopyTableSetting` xác nhận ánh xạ TableDetail10 = TA … TableDetail19 = TJ (`LayoutX.cs:1446-1467`).

| Slot | Thuộc tính LayoutX | DataName trong `mFC.Datas` (EDIT) | Chỉ số Datas | Bảng XML/JSON hook | Tab layout chứa lưới | Áp format lưới |
|---|---|---|---|---|---|---|
| T0 | TableMaster | `Master` | 1 | `T0` | — (lưới danh sách) | `F0` |
| T1 | TableDetail | `Detail` | 2 | `T1` | `5` (TabDetail trang 1) | `F1` |
| T2 | TableDetail02 | `Detail2` | 3 | `T2` | `6` | `F2` |
| T3…T9 | TableDetail03…09 | `Detail3`…`Detail9` | 4…10 | `T3`…`T9` | `7`…`13` | `F3`…`F9` |
| TA…TJ | TableDetail10…19 | `Detail10`…`Detail19` | 11…20 | `T10`…`T19` | tab tự tạo, không layout | không áp `F*`, chỉ TableInfoX |

`isValid()` = có TN và PK (`TableInfoX.cs:2653`); slot không hợp lệ bị bỏ qua. Liên kết master–detail:
`MasterField = MUL` (mặc định PK master), `DetailField = MDL` (mặc định **PK master**) (`TableInfoX.cs:2759-2775`,
`FrmMasterDetail.cs:972`). Tên bảng XML là `"T" + (chỉ số Datas − 1)` và **bỏ qua Storer ReadOnly**
(`FormControler.cs:9523-9532`), nên với form viết tay số `Tn` theo thứ tự `SetData`, không theo slot.

Lưu ý: `SetData` chỉ được gọi cho slot hợp lệ, trong khi `ApplySettingToGridDetail2…9` lấy cứng `Datas[3…10]`
(`LayoutX.cs:3037-3107`). Nếu cấu hình bỏ trống một slot ở giữa (ví dụ có T1, T3 nhưng không có T2) thì chỉ số Datas
lệch và thiết lập lưới áp nhầm Storer [SL — suy từ mã, chưa chạy thử]. MedData luôn dùng slot liên tục.

### 4.4 Key cấp form (KeyID literal) [XM]

Nguồn: `LayoutX.cs:281-958`, `ToolBarSetting.cs`, `CommonDocumentSetting.cs`, `SearchAndSumSetting.cs`,
`AutoDocNumberSetting.cs`, `TabMaster.cs`, `TabDetail.cs`. Cột "Dùng" = có consumer ngoài lớp định nghĩa
(quét toàn bộ Tools + ERP.NET, loại trừ form thiết kế).

| Key | Thuộc tính | Kiểu/mặc định | Ý nghĩa | Dùng |
|---|---|---|---|---|
| FW / FH | FormWidth / FormHeight | int 0 | Kích thước khi mở dạng hộp thoại; 9999 = maximize | có (EDIT, EDITTOP) |
| MS1–MS4 | MultiSelectFieldName/Enable/UpdateSQL/UpdateSQLParam | | Cột chọn nhiều dòng trên lưới chính, SQL cập nhật mỗi lần tick (`Selector` = 0/1) | có (EDIT) |
| DFP | DocumentDateField | "" | Cột ngày chứng từ: tính số CT, kiểm tra kỳ khóa, bộ lọc kỳ | có |
| SRC | DocumentSourceID | "" | Mã phân hệ (PN, PX…) → tiền tố số CT `Functions.GetDocPreFix` | có |
| DPR | DocumentPrefix | "" | Tiền tố số CT, hỗ trợ `{BranchID}`, `{User}`… | có |
| DW2 / DW3 | DocumentPrefixWithColumnPara / Prefix | "" | Tiền tố ghép giá trị cột, vd `{BranchID}-DNX`; tính lại khi cột đổi | có |
| ADT | AutoDoc0Type | 0 | `DefaultValueType`: 0 DocumentID, 1 CF_Table, 8 NotUse, 9 AutoNumber | có |
| RDA | ReloadDataWhenFormActiveFocus | 2 (Default) | 0 No, 1 Yes, 2 Default | có |
| SP | DocumentFilterType | 0 | Bộ lọc thời gian trên toolbar: 0 none, 9 kỳ (giá trị "1" đọc thành 9), 12 ngày hiện tại, 13 từ ngày–đến ngày, 14 quý, 15 năm | có |
| SPA | DocumentFilterDay | 7 | Số ngày mặc định cho kiểu 13 | có |
| SPA2 | DocumentNoCheckUser | 0 | 1 = không giới hạn theo UserCreate | có |
| SPA3 | DocumentNoCheckBranch | 0 | 1 = không lọc theo chi nhánh | có |
| FLT | FormLayoutType | 1 | Lưới bên trái/phải/trên/dưới | **không** |
| FLG | FullLogTrack | 2 | 0 Simple, 1 FullLog (log XML trước/sau), 2 theo hệ thống (`FullLogDefault`), 9 không log | có |
| EEXC | ExportExcelPermiss | 0 | 0 hệ thống, 2 Manager, 3 Admin, 5 cấm | có (`GridXContextMenu`) |
| UCC | UserBaseClass | "" | Tên lớp .NET cài thêm logic; phải có `ParentmFC` và `Init()` | có (LIST, LISTEDIT, EDIT) |
| EST | EnableSQLTransaction | 1 | 0 = tắt transaction (link server) | có |
| MHD | MustHaveDetailRecord | 0 | Bắt buộc có dòng detail 1 | có (EDIT) |
| LFD | LockFieldWhenDetailHasData | "" | Khóa field khi đã có detail | **không** |
| HTA, HGB | HideAllToolsAndSearch, HideGroupButton | 0 | Ẩn toolbar / nhóm nút | có |
| HBA, HBC, HBE, HBSC, HBD, HBP, HFB, HBO | Ẩn nút Thêm, Copy, Sửa, Lưu tiếp, Xóa, In, Tìm, Tùy chọn | 0 | 1 = ẩn và hạ quyền tương ứng | có |
| HCB | HideConvertButton | **1** | Nút "Chuyển" mặc định ẩn | có |
| HIEM | HideImpportExcelMenu | 0 | Ẩn menu import Excel | có |
| BPOP | PrintButtonOption | 0 | Kiểu in (in danh sách / in chứng từ / auto) | có |
| BPRN | PrintReportName | "" | Tên report thay thế | có |
| SSP / SSN | ShowSaveAndPrintButton / ShowSaveAndNewButton | 0 | Nút Lưu&In / Lưu&Mới | SSP **không**, SSN có |
| D1 | DocumentLockGridFormat | 1 | Tô hồng chứng từ khóa | có |
| D2 | AutoRefreshDocInterval | 600 | Giây tự nạp lại | có |
| DMK | DocumentMask | "" | Mặt nạ số CT `{P}{MM}{YY}/{4}`… (rỗng = mặc định hệ thống) | có |
| DWB | DocumentPrefixWithBranchID | 0 | Ghép mã chi nhánh (cũ, thay bằng DW2/DW3) | có |
| DMF | DocumentFilterString | "" | Where bổ sung khi tìm số lớn nhất | có |
| FAC | DocumentPrefixAllCount | 0 | Đếm chung mọi tiền tố | có |
| ADL | CF_DocumentLen | 4 | Độ dài số với CF_Table | có |
| DDC | DocumentDateCheckClosePeriod | **1** | Kiểm tra kỳ khóa sổ | có |
| RDAU | RebuiltDocumentID_AfterUpdateFieldArr | "" | Tính lại số CT khi đổi combo này | có |
| RDAD | RebuiltDocumentID_ForDocumentDate | 1 | Tính lại số CT khi đổi ngày | có |
| UTDC | UseTempDocuemnt | 0 | Số CT tạm `..._xxxxTMP` | có (AR_Invoice) |
| DBSQ / DBSP | DocumentIDFromSQL / Para | "" | Lấy số CT bằng SQL | có |
| DFN-n, DPR-n, DMK-n, DUQ-n (mặc định 1), DMF-n, DWB-n, FAC-n, ADL-n, RDAU-n, DBSQ-n, DBSP-n, ADT-n (n=1,2) | AutoDocNumber1/2 | | Số tự động cho cột thứ hai/ba (`ColumnName = DFN-n`) | có |
| SFDM, SFD, SFD2, SFDMA, SFDA, SFD2A, SFDMB, SFDB, SFD2B | SearchAndSumSetting | "" | Ghép giá trị cột detail thành chuỗi tìm kiếm trên master (mặc định cột `SearchField`), cắt 1000 ký tự | có (EDIT) |
| SUD / SUD2 | SumFieldFromDetail1Arr / 2Arr | "" | Cặp `MasterField;DetailField;...` — cộng detail lên master trước khi lưu | có |
| T1V, T2V, T3V, TAV, TBV, TCV | Tab1…TabC Caption | "" | Tiêu đề tab master "1","2","3","A","B","C" | có |
| TPV1…TPV5 | Tab1…Tab5 VisiblePermiss | 0 | Tab detail: 0 mọi người, 1 Manager, 4 Admin | có (EDIT) |
| ESL…EONC3 | ExecSQLCommand | | Mục 7 | |

Lưu ý: MedData có key `T4V` ("Thông tin hư hỏng") — **không có thuộc tính nào đọc `T4V`** (TabMaster chỉ có
T1V/T2V/T3V/TAV/TBV/TCV); đây là dòng mồ côi.

### 4.5 SubID của slot bảng (`TableInfoX`) [XM]

Nguồn: `Tools/Tools.Layout/TableInfoX.cs:62-2413`. Nhóm theo chức năng; "—" ở cột Dùng = không có consumer trong
WinForms (khai báo nhưng không chạy).

**Nguồn dữ liệu & SQL nạp**

| SubID | Thuộc tính | Mặc định | Ý nghĩa |
|---|---|---|---|
| TN | TableName | "" | Bảng ghi (INSERT/UPDATE/DELETE) |
| PK | PrimaryKey | "" | Khóa chính |
| PKU | UserAutoIDColumn | "" | Cột UserAutoID (mặc định UID/UserAutoID/newid()) |
| TV | TableViewData | "" | View dùng để **đọc**; ghi vẫn vào TN (`Storer.SourceUpdate` thay tên view bằng bảng, `Storer.cs:703`) |
| SE | SelectFields | "" (= `{TV hoặc TN}.*`) | Danh sách cột select, có thể dùng `{SystemPara}` |
| EX | ExpressionFieldAll | "" | Cột biểu thức thêm (`... as Color`) |
| TN1/SE1/FKA1/FKB1/IJ1/TA1(mặc định "A")/JC1 | join 1 | | `Left join TN1 TA1 on {TV|TN}.FKA1 = TA1.FKB1 JC1`; IJ1=1 ⇒ inner join; SE1 thêm vào select. **FKA1/FKB1 là khóa join tra cứu, không phải khóa master-detail** |
| TM2/TN2/SE2/FKA2/FKB2/IJ2/TA2("B")/JC2 | join 2 | | như trên; `TM2` = bảng vế trái (mặc định TN) |
| TM3…/TA3("C") , TM4…/TA4("D") | join 3, 4 | | chỉ xét join n khi join n−1 đủ |
| SO | SortByFields | "" | ORDER BY |
| SDD | SelectDistinctData | 0 | DISTINCT |
| TRS | TopRecord | −1 | TOP n (−1 = không giới hạn) |
| FTR | Filter | "" | Điều kiện, toolbar có thể thay |
| FTX | FilterEx | "" | Điều kiện cố định |
| FTXS | FilterEx_ConditionCheckSQL | "" | SQL trả >0 thì mới áp FTX (EDIT) |
| MUL / MDL | FieldLinkOnMaster / OnDetail | PK master | Cột nối master-detail |
| TSP / TSP2 | StoreProduceData / Para | "" | Lấy dữ liệu bằng store — **—** |
| NT1 / NT2 | aaNotes1/2 | "" | Ghi chú cho người cấu hình |

SQL sinh ra (`TableInfoX.GetSelectFieldList/GetLeftJoinFieldList/GetSelectFromTable`, `:2521-2631`;
`Storer.get_Source`, `Storer.cs:621-659`):

```sql
Select [Distinct] [top TRS] {SE | TV.* | TN.*} [, EX] [, SE1 [, SE2 [, SE3 [, SE4]]]]
From {TV | TN}
  Left|inner join TN1 TA1 on {TV|TN}.FKA1 = TA1.FKB1 JC1
  Left|inner join TN2 TA2 on {TM2|TN}.FKA2 = TA2.FKB2 JC2  ...
Where (FTR) And (FTX) And (filter toolbar/quyền) And (filter tìm kiếm)
Order By SO
```

Mọi phần có `{` được qua `SystemPara.ReplaceSourceSQL` (mục 7.2).

**Hiển thị lưới** (áp ở `LayoutX.Bv34pZOQth`, `LayoutX.cs:3120-3674`)

| SubID | Thuộc tính | Mặc định | Ý nghĩa |
|---|---|---|---|
| HDE, HDE2, HDE3 | HideColumnArr / User / Manager | "" | Ẩn cột; HDE2 ẩn với User, HDE3 ẩn với User+Manager |
| ACP | HiddenAmountColumnArrForPermission | "" | Ẩn cột tiền khi `Permiss.HideAmount` |
| GD2 | GridColumnOrdersFix | "" | Thứ tự cột cố định (MedData: 81 dòng) |
| GD2A | GridColumnOrdersDefault | "" | Thứ tự khi reset |
| GD2V | GridColumnAlwayVisible | "" | Luôn hiện |
| GD2W | GridColumnOrderWidths | "" | Độ rộng theo GD2, hỗ trợ `Max200`, `W150` |
| GD1 | GridHeaderLines | 2 | Số dòng header; 0 = ẩn |
| GDC | GridHeaderCaptionShow | 1 | |
| GFH | GridRowHeight | 0 | |
| GFC | GridFrozenColumns | 0 | |
| GR2 / GR3 | GridRowHeaderShow / GridRowCountShow | 1 / 1 | |
| GRH | GridRowHeaderContent | 0 | STT đầu dòng |
| G01 / G02 / G03 | khóa vị trí cột / về thứ tự dữ liệu / khóa độ rộng | "" | |
| GD4 / GD4C (mặc định 1) / GD4D | tắt sort / xóa sort khi mở / sort sẵn `Col [DESC], ...` | | |
| GCA | GroupColumnArr | "" | Group theo cột |
| GCRC (0) / GCSS (1) / GCSF (1) / GCSF2 (0) / GCSB (1) | đếm group, dòng tổng group, cỡ chữ group/grid, đậm group | | |
| SUM | SummaryColumnArr | "" | Dòng tổng |
| WWC | WordWrapColumnArr | "" | Nhiều dòng trong ô |
| STV | SetTreeViewInfo | "" | `Child;Parent;ExpandColumn;TargetColumn` — hiện dạng cây |
| STD | SetTreeViewSQLDemand | "" | — |
| CUP | UpperCaseColumns | "" | Tự viết hoa |
| `{slot}CS` | ColumnSets | | Nhóm cột G1…GV (caption + danh sách cột), `ColumnSetHeaderLines` |
| `{slot}F1..F9` | GridFormatCondition | | Tô màu theo điều kiện: C1 cột tô (rỗng = cả dòng), C2 cột giá trị, C3/C4 cột so sánh, V1/V2 giá trị, OP toán tử, CO/BO màu chữ/nền (ARGB int), FB, FSZ, FS, TA |
| `{slot}C1..C9` | GridDynamicFormat | | Màu lấy từ giá trị cột: A cột tô, B cột chứa màu, C áp lên chữ |
| `{slot}LC1..LC4` | LinkColumn | | Cột link mở form/report/URL (0 cột, 2 form, 1 filter, 5 param, C1 FormMode, BT nút, VEX điều kiện hiện…) |
| DSOP, GWPS, GDW, GDWH | DisplayType, WebPageSize, EditorForWeb, HiddenInput | | **—** (dành cho bản web cũ) |
| GD3 | DisableGridView | 0 | Không tự tạo lưới detail (dùng GridDetailCtl) |
| GD5 / GD5A | ShowSelectorColumn / Expression | | **—** |
| DCP | TabCaption | "" | Tiêu đề tab detail |
| NBC | NewButtonCaption | "" | **—** |

**Quyền sửa & kiểm tra**

| SubID | Thuộc tính | Mặc định | Ý nghĩa |
|---|---|---|---|
| RDO | ReadOnly | 0 | Chỉ đọc (không lưu, không vào XML hook) |
| EDO | EditOnly | 0 | Không thêm dòng |
| EDD | EditNoDeleteRow | 0 | Không xóa dòng |
| RUM | RowUpdateMode | 0 | Lưu từng dòng ngay khi rời dòng |
| RLM | ReloadAfterMasterSave | 0 | Nạp lại sau khi master lưu |
| RCR | ReloadCurrenRowOnEditOrSelectOnGrid | 0 | Nạp lại dòng hiện hành khi Sửa/Xóa |
| MSC | AddMultiSelectColumn | 0 | Cột check chọn nhiều |
| LCK / LCK2 / LCK3 | LockColumnArr / User / Manager | "" | Khóa cột (mọi người / User / User+Manager) |
| RCD | RequireColumnArr | "" | Bắt buộc nhập |
| DCD1…DCD5 | DuplicateColumnArr1…5 | "" | Mỗi nhóm cột không được trùng dữ liệu đã có trong DB (`StorerDuplicateCheck`) |
| UIC | UniqueIndexColumnArr | "" | Không trùng giữa các dòng trên lưới (UniqueConstraint ≤ 4 cột) |
| ANCR | AddNewByCopyResetField | "" | Reset khi Copy |
| KVF | CopyKeepValueFieldArr | "" | Giữ giá trị xuống dòng mới |
| GCM | DefaultColumnFromMaster | "" | Mặc định cột detail từ master |
| GF1 | AutoNumberColumn | "" | Cột STT tự tăng |
| X01–X04, X21–X24 | X1/X2 ColumnName/Format/FormatBySQL/FormatPara | "" | Sinh mã theo mẫu `{0}-{1}-{STT3}` |
| X50–X55, X60–X65, X70–X75 | FromMasterColumnLink1..3 + DefaultValue/Update/Formular/SQL/SQLPara | "" | Đồng bộ cột master → lưới (copy khi thêm dòng, cập nhật khi master đổi, tính lại công thức) |
| DBS / DBD / DBE / S10 / S11 | CheckBeforeSave/Delete/Edit, AfterSave/AfterDelete (cấp detail) | "" | **— (không được gọi ở đâu)** |

### 4.6 `CopyDataOnAddNew` — KeyID `CD` [XM]

Chạy trong `LayoutX.Tlp4uhYvv2` sau `AfterAddNewData` (`LayoutX.cs:4603-…`) khi form được mở từ form cha
(`ParentLinkmFc`, ví dụ Command "ShowCreateForm"/DataEditor):

| SubID | Ý nghĩa |
|---|---|
| 01 | MasterCopyFromParent: cột copy từ master cha (`*` = mọi cột trùng tên; không có ở cha thì lấy SharePara) |
| 01S | MasterCopyFromSharePara |
| 05 / 06 | MasterCopyFromDetail01/02: lấy từ dòng hiện hành detail 1/2 của cha |
| 02 / 03 | MasterCopyBySQL / Param (ưu tiên giá trị master, rồi detail 1, 2…) |
| 04 | Copy2LinkID (mặc định gán DocumentID cha vào `LinkID`) |
| 11–14, 21–23 & 29, 31–34, 41–44, 51–54 | Detail 1–5: CopyFromParent / BySQL / BySQLParam / Copy2LinkID |
| 08 / 09 | DocumentPrefixBySQL / Para — đặt lại tiền tố số CT (`FrmMasterDetail.cs:1572-1580`) |
| NL | AllowNullValue (1) |
| 24 / 25 | Sau khi lưu mở form theo tên / theo SourceID |
| 26 / 27 | SavedExecSQL / Param: chạy SQL (MsgInfo) với tham số lấy từ form cha sau khi lưu (`FrmMasterDetail.cs:1703-1714`) |

### 4.7 Chuỗi `LYT` — 21 vị trí [XM]

`LayoutItemX.SetConfig(string)` (`Tools/Tools.Layout/LayoutItemX.cs:1895-2131`) tách bằng `;` và gán theo chỉ số.
Mã gốc VB dùng `On Error Resume Next`: phần tử thiếu/không parse được **giữ giá trị mặc định của constructor**
(`LayoutItemX.cs:1655-1693`) và lỗi bị nuốt im lặng. `GetConfig()` (`:2133-2152`) là chiều ghi.

| # | Thuộc tính | Parse (SetConfig) | Mặc định ctor | Ghi (GetConfig) |
|---|---|---|---|---|
| 0 | ControlType | `ToInteger` (lỗi ⇒ giữ EditX) | 1 EditX | số |
| 1 | SizeX | `ToInteger` | 3 | số; 99 = XFull, 0 = Auto (ẩn trên WinForms) |
| 2 | SizeY | `ToInteger` | 1 | số; 99 = YFull |
| 3 | isFirstPos | `= "1"` | false | `1` hoặc rỗng |
| 4 | isReadOnly | `= "1"` | false | `1` hoặc rỗng |
| 5 | CaptionWidth | `ToInteger` (rỗng ⇒ lỗi ⇒ giữ 85) | 85 | rỗng nếu 85 |
| 6 | (trường riêng `lvRHKa9gXZ`) | chuỗi | "" | ghi nguyên. **Không có property công khai nào đọc** — chỉ round-trip (tài liệu cũ gọi là DisplayName2) |
| 7 | CaptionText | `Replace(":", ";")` | "" | `Replace(";", ":")` |
| 8 | EditPermiss | `Val` | 0 AllUser | rỗng nếu 0 |
| 9 | VisiblePermiss | `Val` | 0 | rỗng nếu 0 |
| 10 | DefaultValue | `Replace(":", ";")` | "" | `Replace(";", ":")` |
| 11 | ComboWidth2 | `Val` | 0 | rỗng nếu 0 |
| 12 | SetToolTipDataCheck | `Val` | 0 None | 1 Warning, 2 NoDuplicate |
| 13 | SetToolTipDataHint | `= "1"` | false | |
| 14 | EnableType | `Val` | 0 NotUse | |
| 15 | DefaultValueSQL | nếu khác rỗng: `Replace("\"", "'")` rồi `Replace(":", ";")` | "" | `Replace("'", "\"")` rồi `Replace(";", ":")` |
| 16 | AnchorType | trước khi đọc gán `Top|Left` (5); khác rỗng ⇒ `Val` | 5 | rỗng nếu 5 |
| 17 | RequireValue | `= "1"` | false | |
| 18 | isDisableOrHidden | `= "1"` | false | |
| 19 | SizeP (padding) | `Val` | 0 | số |
| 20 | SizeWebM (độ rộng mobile) | `Val` | 0 Auto | số |

Enum (`LayoutItemX.cs:24-140`):

- `ControlTypes`: 1 EditX, 2 ComboX, 3 ComboCheckX, 4 DateX, 5 NumberX, 6 CheckX, 7 ColorPickerX, 20 RadioX,
  22 UserControl, 23 GroupBox, 24 ButtonMenuX, 26 ButtonX, 28 LabelCaption, 30 HTMLTextOrScripts.
- `Permission` (EditPermiss/VisiblePermiss): 0 AllUser, 2 LockDefaultValueNotEmpty, 3 LockDefaultValueSQLNotEmpty,
  4 HideDefaultValueNotEmpty, 5 HideDefaultValueSQLNotEmpty, 7 Manager, 9 Admin.
- `EnableTypes`: 0 NotUse, 1 NoneOrNormal, 2 EditOrNew, 3 AddNewOnly, 4 EditOnly, 7 Manager, 9 Admin.
- `SizeXLayouts`: 1–20, 22, 99 XFull, 0 Auto; `SizeYLayouts`: 1–16, 99 YFull; `SizePadingLayouts`: 0–6.

Hệ quả cần nhớ: ký tự `;` trong caption/default/SQL được mã hóa thành `:` ⇒ **không thể biểu diễn dấu `:` thật**
trong các trường đó; dấu `'` trong DefaultValueSQL được lưu là `"`. MedData: 719 chuỗi LYT 21 vị trí, 8 chuỗi 20 vị trí.

### 4.8 Thuật toán bố cục (`LayoutX.AddControlTab`, `LayoutX.cs:1730-2805`) [XM]

Hằng số (`LayoutItemX.cs:1646-1652`): **lưới 40 cột** (`ColMax = 40`), ColWidth 40 px, ColSpace 6, RowWidth 20 px,
RowSpace 4; nhân hệ số khi font hệ thống ≥ 9 pt. Duyệt các dòng `LYT{tab}` **theo SubValue tăng dần**:

1. `SetConfig`; `isDisableOrHidden` ⇒ bỏ qua.
2. Field không có trong `mFc.Data.Parent` và ControlType ≤ 20 ⇒ đổi thành LabelCaption nền xám "! {caption} ?".
3. `RequireValue` ⇒ `Data.SetRequireValue(Field)`.
4. Giá trị mặc định (5.3), quyền xem/sửa (5.2).
5. Vị trí: `col`, `row` bắt đầu 0. `isFirstPos` ⇒ xuống dòng (row += SizeY **của control đầu dòng trước**);
   `col + SizeX > 40` ⇒ xuống dòng (XFull lấp phần còn lại của dòng nếu còn ≥1 cột); còn lại đặt cạnh nhau.
   `Left = LeftSpace + col·ColWidth + (col−1)·ColSpace`, `Top = TopSpace + row·RowWidth + (row−1)·RowSpace`;
   rộng = `SizeX·40 + (SizeX−1)·6` (SizeX tối đa 40; XFull = tới mép −30); cao = `SizeY·20 + (SizeY−1)·4`
   (YFull = tới đáy). `SizeP > 0` ⇒ trừ bớt `SizeP·40 + (SizeP−1)·6` khỏi chiều rộng (để trống phía sau).
6. CaptionWidth = 85 và SizeX < 4 ⇒ caption = ½ chiều rộng control; caption hiển thị = `LangMessageDefault(CaptionText)`,
   rỗng ⇒ `LangField(FieldName)` (bảng ngôn ngữ). HTMLTextOrScripts không caption ⇒ CaptionWidth 0.
7. Tạo control (bảng 5.1), `TabIndex = 20 + thứ tự`, Anchor từ vị trí 16 (+Right nếu XFull, +Bottom nếu YFull).
8. Áp `PropertyX` chung (`mVW4TQnW4s`, `:2807`): khóa theo LBS/LBEX, màu chữ/caption (PV1/PV4/PV5), đậm (PV3/PV6),
   `FH`/`FW` cố định, `PT`/`PL` dịch vị trí.

Tab layout (ID là phần sau `LYT`) — `FrmMasterDetail.AddControlLayout` (`FrmMasterDetail.cs:1990-2440`),
`FrmFormListEdit.AddControlLayout` (`FrmFormListEdit.cs:1309`):

| ID | Vị trí | Caption |
|---|---|---|
| `1`, `2`, `3`, `A`, `B`, `C` | TabMaster trang 1–6 | T1V, T2V, T3V, TAV, TBV, TCV (rỗng ⇒ "Thông tin 2"…; trang 1 rỗng ⇒ tiêu đề form) |
| `5` | TabDetail trang 1 (cùng lưới detail 1) | DCP của T1 |
| `6`…`13` | TabDetail trang 2–9 (cùng lưới detail 2–9) | DCP của T2…T9 (rỗng ⇒ "Chi tiết n") |
| `X` | control đơn (`LYTX`) | |

TabDetail ẩn nếu không có `LYT5` và không có lưới T1 (`CheckDetailVisible`, `:1977`). Form viết tay dùng thêm
ID khác (AR_InvoiceFrm dùng 1, 2, 3, 6, 9, 10, 11).

### 4.9 Thuộc tính control `LYS` (PropertyX) [XM]

Thuộc tính chung (`Tools/Tools.Layout/PropertyX.cs`) — SubValue: `FH` FixHeight, `FW` FixWidth, `PT` PaddingTop,
`PL` PaddingLeft, `LBS`/`LBSP` LockUnlockBySQL/Para (SQL trả 1 = khóa, chạy lại ở acEdit/acNew/acChanged/acLoadData),
`LBEX` LockUnlockByExpression (biểu thức DataTable trên dòng hiện hành, true = khóa), `PV1` màu chữ editor (ARGB),
`PV3` chữ đậm, `PV4` màu caption, `PV5` nền caption, `PV6` caption đậm.

| Lớp (ControlType) | SubValue riêng |
|---|---|
| PropertyEditX (1, 30) | `PC` PasswordChar |
| PropertyComboX (2), PropertyComboCheckX (3), PropertyCheckX (6), PropertyButtonMenuX (24) | không có thêm |
| PropertyDateX (4) | `MVR`/`MV` min bắt buộc/giá trị, `MXR`/`MX` max |
| PropertyNumberX (5) | `MVR`/`MV`, `MXR`/`MX` (decimal), `SCB` nút xóa (1), `SUD`, `SUV1`, `SUV2` (nút tăng giảm) |
| PropertyRadioX (20) | `SFB` khung (1), `SFT` tiêu đề khung, `VLQ` SQL nguồn (cột 0 = value, cột 1 = caption), `VLS` danh sách value, `VLC` danh sách caption, `VCW` độ rộng từng radio |
| PropertyGroupBox (23) | `SFT` tiêu đề khung |
| PropertyButtonX (26) | `BI` icon resource, `BC` màu nền |
| PropertyLabelCaptionX (28) | `B0` kiểu viền, `B1` màu viền, `B2` cỡ viền (1), `FS` cỡ chữ (8.25), `FB` FontStyle, `FN` font, `FC` màu chữ, `F1`/`B4` viền chữ, `BC` nền, `TA` canh lề (16) |
| PropertyUserControlX (22, mặc định) | `TXT`, `TXT2`, `BOL1` (mặc định 0), `BOL2` (mặc định **1**, rỗng = true), `NUM`, `NUM2`, `DTE` |

UserControl có lớp PropertyX riêng (kế thừa PropertyUserControlX) — xem 5.7.

---

## 5. Control

### 5.1 ControlType → control WinForms [XM]

`LayoutX.AddControlTab` switch (`LayoutX.cs:1964-2729`):

| Mã | Control | Gắn dữ liệu | Đặc điểm |
|---|---|---|---|
| 1 EditX (mặc định) | `EditX` | `mFc.SetEditorArr` (5.6) | SizeY > 1 ⇒ multiline có scroll; PasswordChar |
| 2 ComboX | `ComboX` | `SetEditorArr` + `SY_FrmDrdwTbl` | `ComboWidth2 > 20` ⇒ độ rộng phần mã, mặc định 93; hiển thị 2 cột (DisplayMember2) |
| 3 ComboCheckX | `ComboCheckX` | `SetEditorArr` (`SetList`) | chọn nhiều |
| 4 DateX | `DateX` | `SetEditor(dateX, field)` | format = `F0/CF` > `SY_FmtFldTbl` > `dd/MM/yyyy`; cột không phải kiểu ngày ⇒ dùng mask; Min/Max đặt `Require = true` |
| 5 NumberX | `NumberX` | `SetEditor` | format mặc định `#,##0.##`; Min/Max (−999 = không giới hạn) |
| 6 CheckX | `CheckBoxX` | `SetEditor` | |
| 7 ColorPickerX | `ColorPickerX` | `SetEditorArr` | |
| 20 RadioX | nhóm `RadioX` trong `UIGroupBox` | `radioX.SetControl(Data, field)` | caption/value từ VLC/VLS/VLQ hoặc CaptionText/DefaultValue; tên control `Fld{Field}_{value}` |
| 22 UserControl | lớp theo tên (5.7) | `SetControl(Data, field)` | |
| 23 GroupBox | `UIGroupBox` | — | chứa layout con `LYT{tab}{Field}` |
| 24 ButtonMenuX | `ButtonX` có menu | — | menu từ DefaultValueSQL (cột 0 id, cột 1 text) hoặc DefaultValue (`MenuEx`); click ⇒ `ButtonObjectClick` |
| 26 ButtonX | `UIButton` | — | `Tag` = DefaultValue; click ⇒ `ButtonObjectClick(sender,"","")` cho form viết tay xử lý |
| 28 LabelCaption | `LabelX` | — | Text = DefaultValue hoặc caption; DefaultValueSQL ⇒ nối giá trị cột 0 của mọi dòng |
| 30 HTMLTextOrScripts | rơi vào nhánh mặc định (EditX) [XM]; PropertyX = PropertyEditX | | không có xử lý HTML riêng trong WinForms |

Tên control quy ước: `Fld{FieldName}` (editor), `lb{Field}` (label), `btnMenu{Field}`, UserControl = đúng
FieldName. Field `UserCreate/UserUpdate/DateCreate/DateUpdate` luôn chỉ đọc (`CheckSystemField`, `:2885`).

### 5.2 Quyền xem/sửa của một control [XM]

Mã giả theo `LayoutX.cs:1829-1857, 2751-2778`:

```
readOnly = LYT[4]
# Ẩn (control không được tạo):
if VisiblePermiss == 9 and !Admin                                  -> skip
if VisiblePermiss == 7 and !(Admin or Manager)                     -> skip
if VisiblePermiss == 2 and DefaultValue != ""                      -> skip
if VisiblePermiss == 3 and DefaultValueSQL != "" and Scalar(SQL)!="" -> skip   (chạy SQL lúc dựng form)
# Chỉ đọc:
if EditPermiss == 9 and !readOnly: readOnly = !Admin
if EditPermiss == 7 and !readOnly and !(Admin or Manager): readOnly = true
if EditPermiss == 2 and !readOnly: readOnly = (DefaultValue != "")
if EditPermiss == 3 and DefaultValueSQL != "" and !readOnly and Scalar(SQL) != "": readOnly = true
if EnableType == 9 and !readOnly and !Admin: readOnly = true
if EnableType == 7 and !readOnly and !Manager and !Admin: readOnly = true
# Bật/tắt theo trạng thái dữ liệu (đăng ký với FormControler):
if EnableType == 1: SetViewObject   -> chỉ dùng được khi Status = IsNone
elevated = (EditPermiss==9 and Admin) or (EditPermiss==7 and (Manager or Admin))
if !elevated:
    EnableType == 2: SetEditObject     -> dùng được khi IsNew hoặc IsEdit
    EnableType == 3: SetAddNewOnlyObject -> chỉ khi IsNew
    EnableType == 4: SetEditOnlyObject  -> chỉ khi IsEdit
```

Giá trị 4/5 (Hide…) của Permission **không được xử lý** trong nhánh LYT (chỉ dropdown `EditType` coi 4 như khóa,
`FormControler.cs:3845, 8587`). Ngoài ra editor master luôn bị `Locked` khi Status = IsNone (3.4). Mọi kiểm tra này
chỉ ở giao diện; Storer không kiểm tra lại quyền theo field khi ghi.

### 5.3 Giá trị mặc định [XM]

Theo `LayoutX.cs:1792-1828, 2730`:

1. `DefaultValue` chứa `AutoNumber` ⇒ `SetDefaultValueSQL(field, type AutoNumber, len 4)`.
2. chứa `CF_Table` ⇒ dạng `CF_Table;{len};{prefix}` ⇒ mã danh mục tự tăng (`DefaultValueType.CF_Table`).
3. còn lại ⇒ `SystemPara.ReplaceSourceSQL(DefaultValue)` (token `{BranchID}`, `{User}`… mục 7.2) rồi
   `Data.SetDefaultValue` (chỉ ControlType < 20). RadioX dùng DefaultValue làm danh sách value.
4. `DefaultValue` rỗng và có `DefaultValueSQL` (ControlType ≤ 20) ⇒ `SetDefaultValueSQL(field, ReplaceSourceSQL(sql))`:
   `ExecuteScalar` lúc **AddNew**, token `{Field}` thay bằng giá trị mặc định của field khác
   (`Storer.cs:2238-2277`).

Nguồn mặc định khác (theo thứ tự áp dụng khi tạo form, cái sau đè cái trước nếu cùng field) [SL về thứ tự đè]:
`SY_FrmDrdwTbl.DefaultValue/DefaultValueSQL` (`FormControler.cs:3804-3836`), field-level `F0..F9 DV/DS`,
mặc định theo user (BranchID…), `DFP` = ngày trong kỳ hiện tại (`FrmMasterDetail.cs:1138`), số chứng từ cho PK,
`UserCreate = login`, `DateCreate = ngày server` (`Storer.cs:1494-1503`). Lưu ý: với AutoNumber/CF_Table dòng
`2730` vẫn gọi `SetDefaultValue(field, "AutoNumber")`; giá trị thật do `DefaultValueSQL` gán lại lúc AddNew [SL].

### 5.4 Định dạng số/ngày [XM]

`Functions.GetFormat(FieldName)` (`Tools/Tools.Utils/Functions.cs:5061`) trả `FormatSystem`
(`Tools/Tools/FormatSystem.cs`: Format, FormatID, Mask, MaxLength, Params, NumberDecimal (mặc định 2), isComplex,
MinValue, MaxValue, Align, MinWidth, MaxWidth) từ `SY_FmtFldTbl A left join SY_FmatTbl B on A.FormatID = B.FormatID
where FieldName = @p` — **toàn cục theo tên cột, không theo form**. Ghi đè theo form: `SY_FrmCfg F0..F9 / CF`.
Số lẻ làm tròn công thức = `Functions.GetDecimal(field)` (6.8).

### 5.5 Bắt buộc nhập & min/max [XM]

`Column.Require = !DataColumn.AllowDBNull` theo schema DB (`Tools/Tools.Data/Columns.cs:44`), cộng thêm LYT[17],
`RCD`, DateX Min/Max. `Storer.CheckRequire` (`Storer.cs:2570-2653`): text rỗng, số null, ngày null, bool null ⇒ thiếu;
**min/max chỉ được kiểm tra khi field đã Require** (field không Require trả true ngay). Không kiểm tra MaxLength
(chỉ control giới hạn). Thiếu ⇒ sự kiện `acRequire` (cảnh báo + focus).

### 5.6 Nguồn combo/lookup và thêm nhanh [XM]

Editor master: `FormControler.SetEditorArr` (`FormControler.cs:3676-3971`) đọc `SY_FrmDrdwTbl where IsDisable = 0
and Coalesce(GridName,'') = '' and FormID = '{form}'`, chọn dòng `ColumnID = 'Fld{Field}' or ColumnID = '{Field}'`
có `ValueColumn`. Lưới: `SetDropdownFromConfig` (`:8410-8668`) đọc dòng có `GridName`. Cột dùng: Type
(rỗng/Dropdown, `ValueList`, `ValueLstCb`, `LangList` = danh sách tĩnh từ `Source`; `DropCheck` = chọn nhiều;
`DropSelect` = form chọn; `ColorSelct`, `ImgSelct`, `ImgColumn`, `FileSelct`), Source (SQL hoặc chuỗi), ValueColumn,
DisplayColumn, DisplayMember2, ColumnArr, WidthArr, LinkColumn (gán cột liên quan khi chọn), ParaArr,
ParaRequireArr, ColumnName_Filter/ColumnValue_Filter/OnlyValue_Filter, ReLoadType/isReLoad, GroupColumnArr,
TreeViewColumn(Parent), WordWrapArr, SummaryFieldArr, IsNotInList, IsMultiSelect, ManualSQLSearch(+OrderBy),
DisableAddNew, DefaultValue, DefaultValueSQL, EditType (Permission), Caption, isLock, isInvisible, KeepValue,
EditableColumns, isMultiValue, UserAutoID (F9 mở cấu hình). EditX tên `FldMemo`/`FldNotes` hoặc kiểu Ellipsis mà
không cấu hình ⇒ gợi ý `select distinct top 2000 {Field} from {Table}`. Chi tiết `SY_FrmDrdwTbl` thuộc tài liệu
lookup riêng.

Thêm nhanh (F2/F7 hoặc nút "+", `Connector.RaiseAddNewEvent`, `Tools/Tools.Data/Connector.cs:911-1060`):
(1) form viết tay `AddNew{Field}Frm`; (2) `FrmAddnewLayoutX` với FID `{ModuleID}_AddNew{Field}Frm[_{FormCha}]`;
(3) `SY_FrmLstTbl where PrimaryKey = '{Field}'` (ưu tiên FormID trong `SY_StTbl` StringID
`{Module}_AddNewKey_{Field}`, rồi TableName bắt đầu bằng 2 ký tự đầu của Para) ⇒ `FrmAddnew` hiển thị
`AddNewColumnArr`, ẩn `HideColumnArr`, khóa `LockColumnArr`, mặc định `DefaultColumnArr` từ form cha; lưu xong trả
giá trị khóa về combo (`OnAddNewFieldReturnValue`). Quyền nút "+" = `GetPermissByPriKey(ValueColumn).AddNew`.

### 5.7 UserControl (ControlType 22) [XM]

Phân giải lớp (`LayoutX.cs:2361-2487`): `FieldName.Split('_')[0]` (nếu < 4 ký tự thì ghép 2 phần đầu) ⇒
`SysObject.zRbaposUpF0(tên)` (`SysObject.cs:31`) tìm type kế thừa `UserControl`/`Control` theo tên. Vì vậy cùng
một lớp đặt nhiều lần bằng hậu tố: `ExecSQLWithParaButtonCtl`, `ExecSQLWithParaButtonCtl_1`… Hợp đồng late-bound
(mỗi bước lỗi thì bỏ qua): `ParentItemX = LayoutItemX` → `PropertyX.Init(LayoutID, FieldName, Layout)` → `ParentmFC`
→ thêm vào tab → `Init()` → `SetControl(mFc.Data, FieldName)` → vị trí/kích thước → `ReadOnly` (không có thì
`Enabled = !readOnly`). Không tìm thấy lớp ⇒ Label "UserControl not found".

36 lớp có PropertyX riêng trong `Tools/Tools/` (AddNewCFButtonCtl, ApproveButtonCtl, Attach*Ctl, BarcodeInputCtl,
CommandButtonCtl, ComPortReaderCtl, DataEditorButtonCtl, DataLinkViewerCtl, Email*Ctl, ExcelGridCtl,
ExecSQLWithParaButtonCtl, FileUploadBatchButtonCtl, GridColumn*Ctl, GridDataEditorCtl, GridDetailCtl,
HtmlWebButtonCtl, Import*Ctl, MakeDocBySourceIDButtonCtl, MultiDataSelectorCmdCtl, PrintButtonCtl,
QuickItemInputCtl, ResetPasswordCtl, RichTextBoxCtl, ShowFormButtonCtl, StatusButtonCtl, TaxCodeLookupCtl,
UploadDataButtonCtl, WebLinkViewerCtl, WordExcelPrintButtonCtl), cộng 10 lớp `PropertyUserControlX` trong ERP.NET.
MedData chỉ dùng 6 lớp (133 vị trí): ExecSQLWithParaButtonCtl 49, PrintButtonCtl 24, AttachWebcamImageControlCtl 23,
StatusButtonCtl 21, WebLinkViewerCtl 12, CommandButtonCtl 4. Key LYS chính của 6 lớp này:

| Lớp | SubValue (LYS) |
|---|---|
| ExecSQLWithParaButtonCtl | `BT` caption, `BI` icon, `BC` màu, `C2`/`C3` ActionBefore/After (SaveContinue, SaveContinueCheckDetail, SaveSkipErr, Edit, Save, Reload, ReloadCurrent, ReloadDetail — `FormControler.DoAction_Before_After`), `C4` SQL chạy (`{P}`, `{JSON}`, `{XML}`, `{0}`…), `C4R` nạp lại giá trị trả về, `CS4`/`CS5` SQL kiểm tra trước (MsgInfo)/para, `P3` RequireFieldArr, `HPS` HTML; tối đa **9 tham số nhập** n=1..9: `n1` Type, `n2` Name, `n3` Readonly, `nA` Require, `nC` khóa nếu có mặc định, `n4`/`n4A` DefaultValueSQL/Para, `n5` mặc định từ master, `n5A` từ toolbar, `n6`/`n6A`/`n6B` nguồn combo/para/cột, `n7` value, `n8` display, `n9` display2, `nB` link cột (ví dụ `02`=Name1, `0A`=Require1, `22`=Name2) |
| PrintButtonCtl | `BT`, `BC`, `C2`, `C3`, `C4` SQL/store dữ liệu report, `C5` file report, `P1` para, `SP` form chọn para, `SC` phím F, `PP` xem trước (1) |
| StatusButtonCtl | `MTA`/`MTC` menu từ text, `MSQ` menu từ SQL, `GFN` field giá trị, `GDN` field hiển thị, `CDF` field caption nút, `CDP` tiền tố caption, `GDT` field ngày giờ chuyển, `BCF`/`FCF`/`ACF` tô màu lưới theo trạng thái, `BT` (mặc định "Chuyển trạng thái"), `C2`/`C3`, `C4`/`C5` SQL kiểm tra trước (`{S}` = trạng thái mới), `C6`/`C7` SQL sau, `C8`/`C9` nạp lại field |
| AttachWebcamImageControlCtl | `STT` số thứ tự ảnh (chẵn 2..18), `BTA` tiêu đề, `SC` phím, `ITN` bảng ảnh (mặc định `{TableMain}AttachTbl`), `IOV`, `SIS` (100) |
| WebLinkViewerCtl | `S1` field nguồn, `S2`/`S3` SQL nguồn/para, `LP` para URL, `LT` caption, `LH` URL (`{0}`…) |
| CommandButtonCtl | `BT`, `BI`, `BC`, `C1` ActionType (ExecSQL, ShowSelectForm, ShowCreateForm, ShowUserForm…), `C5` hỏi xác nhận (1), `C2`/`C3`, `CS4`/`CS5`, `X8`/`X9`, `C4` SQL hoặc form, `D5`/`D6` form/FormKey, `P1` para, `P2` grid, `W3` where, `P3` require, `P4`/`P5` trả về master/detail, `P6`–`P9`, `PA`–`PE`, `MS`, `X1`–`X4` |

### 5.8 LISTEDIT không có LYT: tự sinh editor [XM]

`FrmFormListEdit.AddControlLayout` (`FrmFormListEdit.cs:1309-1336`): có `LYT1` ⇒ `AddControlTab`; **không có** ⇒
`AddControl()` (`:1555-…`) sinh editor cho mọi cột hiện trên lưới theo thứ tự cột (`EditorColumnArr` đặt thứ tự):
decimal/double ⇒ NumberX (`#,###.##`), DateTime ⇒ DateX, bool ⇒ CheckBoxX, có dropdown trong `SY_FrmDrdwTbl`
(`ValueColumn = cột`) ⇒ ComboX/ComboCheckX, `ColorSelct` ⇒ ColorPickerX, có mask trong format ⇒ DateX mask,
còn lại EditX; độ rộng `LO/EL1` (250, MaxLength ≤ 50) hoặc `LO/EL2` (350); `isInvisible` ẩn, `Caption` đè tiêu đề.

---

## 6. Lưu dữ liệu (`Storer`, `Storers`, `Connector`)

### 6.1 Storer và Datas [XM]

`FormControler.SetData(TableMain, PK, SelectFields, LeftJoinFields, SelectFrom, Filter, FilterEx, Sort, DataName,
Master, MasterField, DetailField, IsDetail, ReadOnly, ReloadAfterMasterSave, DataViewName, TopRecord)`
(`FormControler.cs:4105-4153`) thêm một `Storer` vào `Datas` (1-based; Datas[1] = mFC.Data = master). Storer giữ
`DataTable` (dữ liệu) + `SchemaUpdate` (schema bảng ghi), danh sách `Column` (Value, ValueDefault, OgrinValue,
Require, Min/Max, KeepValue, công thức). Detail nạp trễ `(n−1)·100+50` ms, lọc theo `DetailField = giá trị
MasterField` mỗi khi master đổi dòng.

### 6.2 Trình tự lưu và transaction [XM]

**FT_EDIT** (`FormControler.Save`, `FormControler.cs:2571-2665`):

```
master.EnableSQLTransaction = EST (tắt nếu đã có transaction ngoài)
master.Save(TrueUpdate:true, SaveNoStatus)                         Storer.cs:2655
  ├─ CheckRequire (master)
  ├─ acBeforeSave  → handler form: MHD, SearchField, SUD, EBS, ESDB    (ngoài transaction)
  ├─ kiểm tra số chứng từ trùng (DefaultValueSQL.isUnique): sửa ⇒ báo lỗi; thêm ⇒ hỏi lấy số mới
  ├─ kiểm tra PK trùng / PK bị đổi
  └─ UpdateSource()                                                 Storer.cs:4520
       ├─ BEGIN TRAN (Connector.Transaction(AtBegin))               Connector.cs:1786
       ├─ acUpdate  → mỗi detail: Save(OnlyCheck) (CheckRequire, trùng…) ; lỗi ⇒ Cancel
       ├─ gán cột audit, chuẩn hóa PK
       ├─ adapter.Update(master changes)
       ├─ acUpdated → mỗi detail: gán DetailField = MasterField (nếu PK master đổi) ;
       │              detail.Save(SaveNoStatus) → detail.UpdateSource dùng chung transaction (IsTrans)
       ├─ ActionCheck MasterSaved (vd kỳ khóa sổ) ⇒ nếu vi phạm: ROLLBACK + thông báo
       ├─ COMMIT
       └─ AcceptChanges, Status = IsNone, acAfterSaved → ESS, ESS2, RLM, CD/26…   (sau commit)
master.Save(false, OnlyStatus) ; AfterUpdateData ; UpdateLog(Thêm/Sửa ...)
```

Lỗi bất kỳ trong `UpdateSource` ⇒ ROLLBACK, hiện lỗi kèm các dòng lỗi; `MSDTC` ⇒ gợi ý tắt EST
(`Storer.cs:4972-5019`). Storer detail mặc định `EnableSQLTransaction = false` (`Storer.cs:921`) nên không mở
transaction lồng. Hook EBS/ESDB chạy **trước** transaction; ESS/ESS2/ESD/ESCA chạy **sau** commit, lỗi của chúng
không làm hỏng dữ liệu đã ghi.

**FT_LIST** (`FormControler.cs:2667-2888`): acBeforeSave → `UpdateSource(ChangeStatus:true)` cho toàn bộ thay đổi
của lưới (thêm/sửa/xóa nhiều dòng trong một lần) → nạp lại nếu là thêm mới → log từng dòng (tối đa 500/loại).

### 6.3 Sinh INSERT/UPDATE/DELETE [XM]

`Storer.UpdateSource` dùng `OleDbDataAdapter` với lệnh tham số `?` (`Storer.cs:4577-4672`):

- `UPDATE {TableMain} SET [c1] = ?, [c2] = ?, ... WHERE [pk] = ?` — **mọi cột của SchemaUpdate** (không chỉ cột
  đổi), bỏ cột identity, bỏ cột PK trừ khi PK bị sửa; WHERE theo **giá trị gốc** của PK (hoặc theo `PrimaryKey` của
  schema nếu có khóa ghép). **Không có kiểm tra đồng thời** (không so cột khác, không rowversion) ⇒ ghi đè cuối thắng.
- `INSERT INTO {TableMain} ([c1], ...) VALUES (?, ...)` — mọi cột trừ identity.
- `DELETE FROM {TableMain} WHERE [pk] = ?`.
- `SchemaUpdate` = `Select {SelectFields} From {TableMain}` (thay tên view/SelectFrom bằng TableMain) ⇒ cột ghi =
  cột select thuộc bảng chính; cột join (SE1…) không ghi.
- PK identity: dòng mới cộng tạm 99999, lấy giá trị thật qua `RowUpdated`.
- Xóa master chỉ xóa dòng master: ở `acUpdate`/`acUpdated` các detail bỏ qua khi `IsDelete = true`
  (`Storer.cs:6034-6044`) ⇒ dòng detail phải do FK cascade/trigger/hook ESD xử lý [?].

### 6.4 Cột audit và chuẩn hóa [XM]

`Storer.cs:4685-4742`, `PI6uVRItXe` (`:1486-1503`):

| Cột | Thêm mới | Sửa |
|---|---|---|
| DateCreate | `App.Cn.ServerDateTime` | giữ nguyên |
| UserCreate | `Connector.UserLogin` | giữ nguyên |
| DateUpdate | `NULL` | `ServerDateTime` — **trừ khi `Connector.isAdminMode`** |
| UserUpdate | `NULL` | login — trừ khi admin mode |
| PK (không phải UserAutoID, `PriKeyUnicode = false`) | `ConvertUnicode_Khongdau` (bỏ dấu) + `Trim` | như thêm |

`isLock`, `UID`, `LinkID`, `UserUpdate/DateUpdate` được reset khi Copy (3.3).

### 6.5 Kiểm tra trùng [XM]

- `DCD1..5` ⇒ `Storer.SetDuplicateCheck` ⇒ `StorerDuplicateCheck` (`Tools/Tools.Data/StorerDuplicateCheck.cs:57-100`):
  ở acBeforeSave, nếu mọi cột trong nhóm có giá trị, chạy `Select * from {TableMain} where c1 = N'v1' and ... and
  PK <> N'{PK gốc}'` (giá trị nối chuỗi, không escape) ⇒ có dòng thì hủy lưu và hiện lưới "Dữ liệu bị trùng".
- `UIC` ⇒ UniqueConstraint trong DataTable (trùng giữa các dòng đang nhập).
- `DUQ` (AutoDocNumber) / PK identity ⇒ `Functions.HasExistKey` lúc lưu.
- `ToolTipDataCheck` (LYT[12]) và PK của EDIT ⇒ kiểm tra ngay khi rời editor: `Select F from T0 where F = '{F}' and
  F <> '{F_Old}'` (`LayoutX.cs:2734-2746`, `FrmMasterDetail.cs:1624-1630`).

### 6.6 Số chứng từ / mã tự động [XM]

`DefaultValueSQL` (`Tools/Tools.Data/DefaultValueSQL.cs`): `DefaultValueType {DocumentID=0, CF_Table=1, NotUse=8,
AutoNumber=9}`. `GetDocumentID` (`:108-…`): có SQLCommand ⇒ dùng SQL; CF_Table ⇒ mã danh mục; AutoNumber ⇒ số
tăng; mask `DATETIME`/`{P}DATETIME`; mặc định: tìm số lớn nhất trong cùng **tháng/năm của DateField** và cùng tiền tố
(trừ FAC), cộng `DMF`, thay `{P}`, `{DD}`, `{MM}`, `{YY}` và số chữ số (`{3}`, `{4}`…). EDIT gán cho PK khi có SRC
hoặc DPR (`FrmMasterDetail.cs:1141-1167`): tiền tố = `DPR` (qua ReplaceSourceSQL) hoặc `GetDocPreFix(SRC)`;
AutoDocNumber1/2 cho cột khác. LIST/LISTEDIT: `PrimaryKeyFormat/Len` hoặc bộ lọc toolbar `IsPrimaryKeyCombine`
(`FrmFormList.cs:547-630`); PK `UserAutoID/UID` ⇒ `Functions.GetUserAutoID()`.

### 6.7 Công thức [XM]

`SY_FrmExpTbl` (FormID, DataName, ColumnID, Expression, RefColumn, ParaArr, LevelLoop, ResetColumnArr, Oderby,
IsDisable, RoundType, RoundPara) ⇒ `Datas[DataName].SetFomular(ColumnID, Expression, RefColumn, ParaArr, LevelLoop,
ResetColumnArr)` (`FormControler.cs:8376-8408`, `Storer.cs:5614-5669`; `FormularGroup` chỉ là cấu trúc dữ liệu).
Khi một cột trong `RefColumn` (`;`) đổi trên lưới (`GridX.CalculateFormularGroup`, `Tools/Tools/GridX.cs:6760-…`):
reset `ResetColumnArr`; biểu thức rỗng ⇒ gán NULL; ngược lại thay `{MasterField}` bằng giá trị master (số dùng `.`)
rồi tính bằng **`DataColumn.Expression` của ADO.NET** trên một dòng tạm; Infinity/NULL ⇒ NULL; số ⇒ làm tròn
`Functions.GetDecimal(UpdateField)` chữ số, `MidpointRounding.AwayFromZero`. LevelLoop mặc định 20 (chống lặp vô hạn).
RoundType/RoundPara tồn tại trong schema nhưng không thấy được đọc ở đây [?].

### 6.8 Nhật ký [XM]

`App.Cn.UpdateLog(form, "Thêm/Sửa/Xóa {PK} : {giá trị}", chuỗi giá trị cột (≤500 ký tự/cột), form, PK, xmlFull)`;
FullLog (`FLG=1` hoặc mặc định hệ thống) ghi thêm XML dataset trước khi sửa (`FormControler.cs:9135-9298`, bỏ cột
`SearchField`, detail ≤ 500 dòng). `FLG=9` tắt log.

---

## 7. Hook SQL (`ExecSQLCommand`, key cấp form)

### 7.1 Bảng hook [XM]

Định nghĩa `Tools/Tools.Layout/ExecSQLCommand.cs`; thực thi `LayoutX.Do_*` (`LayoutX.cs:3730-4447`).
"MsgInfo" = `MsgInfoAction.ShowMsgInfoByExecSQL` (đọc **result set đầu tiên có dòng**); "ShowMsgInfo" = `CreateData`
(**result set đầu**) rồi `MsgInfoAction.ShowMsgInfo`.

| Key | Thuộc tính | Gọi khi | Token thay (theo thứ tự) | Thực thi / kết quả |
|---|---|---|---|---|
| ESL | ExecSQLOnFormLoad | Form Load; lại khi Activated nếu RDA=1 | SystemPara → `{isManager}`,`{isAdmin}` → `{X}` cho X trong `ESLP` lấy từ SharePara | MsgInfo, kết quả bỏ qua |
| ESLP | ExecSQLOnFormLoadSharePara | — | | danh sách SharePara cho ESL |
| ESC | ExecSQLOnFormClosed | FormClosed | SystemPara → isManager/isAdmin | **ThreadPool**, `ExecuteNonQuery_NewCnn` (`ShowErrMsg` mặc định true, `Functions.cs:4098`), không chờ kết quả, form đã đóng; lỗi có thể bật thông báo từ luồng nền [SL] |
| ESLD | ExecSQLBeforeLoadData | acBeforeLoadData + trước lần nạp đầu (EDIT, EDITTOP) | SystemPara → isManager/isAdmin | MsgInfo |
| ESLR | ExecSQLBeforeLoadDataRow | acChanged/acLoadData (đổi dòng master) — EDIT, EDITTOP | SystemPara → `{0}`/`{PK}` = PK hiện hành → isManager/isAdmin → `{Cột}` | MsgInfo |
| EBN | ExecSQLCheckBeforeAddNew | acBeforeNew | SystemPara → isManager/isAdmin → `{Cột}` (giá trị dòng đang đứng) | MsgInfo; **false ⇒ hủy Thêm** |
| EON | ExecSQLOnAddNew | acNew, acNewCopy | SystemPara → isManager/isAdmin → `{Cột}` | `CreateData`; mỗi cột của dòng đầu gán vào field cùng tên |
| EBE | ExecSQLCheckBeforeEdit | acBeforeEdit | SystemPara → `{0}`/`{PK}` → isManager/isAdmin (không có `{Cột}`) | ShowMsgInfo; false ⇒ hủy Sửa. **Lỗi SQL ⇒ cho qua** |
| EBD | ExecSQLCheckBeforeDelete | BeforeDeleteData + acBeforeDelete | như EBE | như EBE (fail-open) |
| EBS | ExecSQLCheckBeforeSave | acBeforeSave (EDIT/EDITTOP/LISTEDIT/viết tay), BeforeUpdateData (LIST) | isManager/isAdmin → `{0}` = PK **gốc** (mới ⇒ `0`) → `{1}`=`{XMLDATA}`=`{XML}` = XML dữ liệu → `{JSON}` → `{Cột}` = `GetColumnValueSQL` (escape `'`, ngày `yyyy-MM-dd HH:mm`, bool 0/1, số dấu `.`) → SystemPara | ShowMsgInfo; false ⇒ hủy Lưu. Lỗi SQL ⇒ cho qua (+ admin có thể tạo SP mẫu); exception ⇒ cảnh báo, log, **cho qua** |
| EBC | ExecSQLCheckBeforeSaveContinue | như EBS khi "Lưu tiếp" | như EBS | như EBS |
| EB2 | ExecSQLCheckBeforeSaveXMLColumnArr | — | | **không có consumer** (XML luôn đủ cột) |
| ESDB | SQLUpdateDataBeforeSaveCheck | sau EBS khi EBS qua | isManager/isAdmin → `{Status}`/`{STATUS}` (1 mới, 2 sửa) → `GetSQLCommandFillPara(ESDP)`: `{Field}`/`{index}` = `GetValueAllDataSQL` (master → detail 1..4 → SharePara), `{P}`, SystemPara → `{Cột}` còn lại | `CreateData`; cột dòng đầu gán vào field master trước khi ghi |
| ESDP | SQLUpdateDataBeforeSaveCheckPara | | | danh sách para cho ESDB |
| ESS | ExecSQLAfterSaveData | acAfterSaved (sau commit) | SystemPara → `{0}`/`{PK}` → `{Cột}` → SystemPara | MsgInfo; true ⇒ chạy ES2, false ⇒ ES4 |
| ES2 / ES4 | ExecSQLAfterSaveOnOK / OnCancel | sau ESS | chỉ `{0}`/`{PK}` (**không** SystemPara) | MsgInfo kiểu OK |
| ES6 / ES7 | ExecSQLAfterSave_IsDoReload / IsDoReloadDetail | sau ESS (kể cả không có ESS) | | 1 ⇒ nạp lại master / phát acChanged (nạp lại detail) |
| ESS2 | ExecSQLAfterSaveDataDelay | acAfterSaved | SystemPara → `{0}`/`{PK}` → `{Cột}` | ThreadPool: chờ **2.500 ms** rồi `ExecuteNonQuery_NewCnn` (kết nối riêng, ngoài transaction; người dùng không chờ, kết quả không kiểm tra) |
| ESCA | ExecSQLAfterCancelData | acCanceled | SystemPara → `{0}`/`{PK}` → `{Cột}` → SystemPara | MsgInfo |
| ESD | ExecSQLAfterDeteleData | acAfterDeleted | SystemPara → `{0}`/`{PK}` = khóa đã xóa | MsgInfo kiểu OK |
| ESLOS / ESLOP | SqlLockObjectOnEditOrAddNew / Para | acEdit, acNew, acNewCopy, acChanged, acLoadData (EDIT) | isManager/isAdmin → `GetSQLCommandFillPara(ESLOP)` | mỗi giá trị trả về là **tên control/field/grid cần khóa** |
| ESLOS2 / ESLOP2 | SqlUnLockObjectOnEditOrAddNew / Para | như trên | như trên | tên control cần mở khóa |
| EONC / EONC2 / EONC3 | ExecSQLOnCopy / ParaArr / AutoEdit (1) | nút Copy (`FormControler.cs:4803`) | `{P}` = PK, isManager/isAdmin, SystemPara, `{N}` = số CT mới, `{0}` = giá trị người dùng nhập lại cho field EONC2 | `ExecuteScalar` trả khóa mới → nạp lại, tìm dòng, tự Sửa nếu EONC3 |

Ở `FrmFormList` (LIST) chỉ nối: ESL, ESC, EBN, EON, EBE, EBD, EBS, ESS, ESS2, ESCA, ESD (`FrmFormList.cs:235, 464-532`).
MedData dùng: EBE 17, EBD 16, ES6 3, ESS 1, EBS 1, ES7 1.

### 7.2 Thay token — `SystemPara.ReplaceSourceSQL` (`Tools/Tools/SystemPara.cs:166-226`) [XM]

1. Mọi tham số hệ thống: bảng `{ModuleID}_Setup (CodeID, CodeValue)` nạp lúc đăng nhập (`Functions.GetSetupParam`,
   `Functions.cs:1770-1820`), mỗi CodeID đăng ký 2 lần (`CodeID` và `Sys{CodeID}`), thêm `UserFullName`, `UserName`,
   `User`; `PeriodID = yyyyMM` của ngày server; `BranchID`, `BranchName`, `BranchAddress`, `BranchTaxcode`,
   `BranchPhone`, `BranchShortName`. Thay `{Key}` (đúng hoa thường) và `{KEY}` (in hoa).
2. Cố định: `{@User}`, `{User}`, `{USER}`, `{@UserID}`, `{UserID}`, `{USERID}` ⇒ login; **chuỗi trần `@User`/`@USER` ⇒
   `'login'` (có nháy)**; `{UserFullName}`; `{@BranchID}/{BranchID}/{BRANCHID}`, tương tự `CeoID`, `ManagerID`,
   `EmployeeID`, `AgencyID`, **`ObjectID`**, `CostCenterID`, `StoreHouseID` ⇒ giá trị của **người dùng đăng nhập**
   (`App.Cn.*`).
3. `{isManager}`, `{isAdmin}` (1/0) thay riêng trong từng `Do_*`; `{0}`, `{PK}`, `{P}`, `{N}`, `{Status}` như bảng 7.1;
   `{Cột}` = giá trị field (danh sách token lấy bằng `Cache.GetParaSQL`, `Cache.cs:108`: mọi `{x}` dài ≥ 2 ký tự và
   không chứa `@`).

Hệ quả quan trọng:

- **Thứ tự khác nhau giữa các hook**: ở EBN/EON/ESLR/ESS/ESS2/ESCA, SystemPara chạy **trước** cột, nên `{ObjectID}`,
  `{BranchID}`, `{EmployeeID}`, `{CostCenterID}`, `{StoreHouseID}`… luôn là giá trị phiên đăng nhập (kể cả khi
  rỗng), không phải giá trị bản ghi. Ở EBS thì ngược lại (cột trước). Web phải tái hiện đúng thứ tự từng hook hoặc
  chuẩn hóa có chủ đích.
- Chỉ EBS dùng `GetColumnValueSQL` (escape `'`, định dạng chuẩn). Các hook khác dùng `ToString(Value)`: **không escape
  nháy đơn**, ngày/số theo culture máy client ⇒ rủi ro SQL injection và lỗi định dạng; `{0}` là PK không escape.
- Không dùng tham số SQL thật; mọi giá trị nối chuỗi.

### 7.3 Quy ước trả về Msg / MsgType (`MsgInfoAction.ShowMsgInfo`, `Tools/Tools/MsgInfoAction.cs:180-293`) [XM]

`MsgTypes {OKCancel=0, Cancel=1, OK=2, Popup=3, PopupWaning=4, YesNo=5, Auto=9}`. Thuật toán:

1. Không có bảng / 0 dòng / 0 cột ⇒ **cho qua (true)**.
2. Đúng 1 cột × 1 dòng ⇒ popup thông tin nội dung ô đó, **true**.
3. Mức mặc định = 0 (khi gọi với Auto); gọi với kiểu cố định (OK cho ES2/ES4/ESD) thì dùng kiểu đó.
4. Cột `Title` ⇒ tiêu đề; cột `Msg` ⇒ tiêu đề (đè Title); cột `MsgType` ⇒ mức (đè); cột `MsgTooltip` ⇒ tooltip
   cuối màn hình. Các cột này bị gỡ khỏi bảng trước khi hiển thị; giá trị lấy từ **dòng đầu**.
5. Theo mức:

| MsgType | Hiển thị | Trả về |
|---|---|---|
| 0, 5 | Còn cột khác ⇒ lưới dữ liệu với nút "Hủy bỏ / Tiếp tục"; không còn cột ⇒ hỏi "Tiếp tục / Hủy bỏ" (timeout 30 s) | true nếu chọn Tiếp tục |
| 1 | Cảnh báo (hoặc lưới cảnh báo nút "Hủy bỏ") | **false — chặn** |
| 2 | Thông báo / lưới nút "Tiếp tục" | true |
| 3 | Tooltip | true |
| 4 | Tooltip lỗi | **false** |
| khác | Tooltip | true |

Lỗi SQL trong `ShowMsgInfoByExecSQL` ⇒ thử lại sau 5 s nếu timeout/deadlock, còn lại tooltip lỗi và **false**; trong
EBE/EBD/EBS (dùng `CreateData`) lỗi ⇒ `null` ⇒ **true**. Mọi thông điệp được ghi vào `MsgInfoAction.ErrorList`.
Lưu ý: một SELECT trả nhiều cột mà **không có cột MsgType** sẽ thành câu hỏi Tiếp tục/Hủy (mức 0).

### 7.4 Dữ liệu `{XML}` / `{JSON}` cho EBS [XM]

`FormControler.GetDirtyDataXML` (`FormControler.cs:9487-9537`): FT_EDIT ⇒ DataSet `Data`, bảng `T0` = một dòng giá
trị hiện tại của master (mọi cột), bảng `T{i−1}` = **toàn bộ** dòng của Storer detail thứ i (bỏ Storer ReadOnly),
`Db.GetXMLString(ds, FillZeroValue2Number:true)`; FT_LIST ⇒ chỉ các dòng thay đổi. JSON tương tự
(`GetDirtyDataJson`, `:9539`). Nháy đơn được nhân đôi trước khi nhúng vào chuỗi SQL. SP mẫu engine sinh cho admin
(`LayoutX.cs:4449-4548`) có chữ ký `@OldPrimaryKey nvarchar(50), @XML XML` và đọc
`@XML.nodes('/Data/T0')`, `'/Data/T1'`; ghi chú trong mẫu: tên field trong XML phân biệt hoa thường.

### 7.5 Quy ước tên SP và view [XM/SL]

Engine **không hardcode** tên `*_BeforeSaveStp`, `*_AfterSaveStp`, `*_CheckSaveStp`: tên nào cũng được, cấu hình
trong EBS/ESS/EBE… (không tìm thấy chuỗi này trong Tools/ERP.NET). Điều được mã hóa cứng:

- Admin (`UserLogin = ADMIN`) gặp lỗi SQL ở EBS/EBE/EBD mà từ đầu tiên của lệnh chứa `Stp` ⇒ hỏi "Built the Store
  PROCEDURE?" và tạo SP mẫu (`@OldPrimaryKey, @XML` cho EBS; `@DocID` cho EBE/EBD) (`LayoutX.cs:4449-4596`).
- Mẫu mô tả trong thuộc tính: `AR_BeforeSaveInvoiceStp`, `SP_CheckEditInvoiceStp`, `SP_UpdateInvoiceCheckDiscountStp`…
- `*ViewData`/view đọc: cấu hình qua `TV` của slot (MedData 21 dòng TV, ví dụ `FA_AssetCurrentContractView` dùng làm
  join TN2). `*SelectView` là nguồn của nút chọn dữ liệu (ví dụ mẫu `AP_OrderSelectView`, `Functions.cs:10268`;
  `ER_ProcessOrderFrm` dùng `ER_OrderSelectView`).
- Form viết tay gọi SP trực tiếp theo tên cố định (ví dụ `AR_Invoice_eInvoiceData_Stp`, `{Report}Stp`), xem mục 8.

Ví dụ MedData: `EBE = EXEC dbo.IV_InternalTransfer_RequestCheckEditStp '{0}','{User}'`;
`EBS = AR_OrderDetail_WarningOverQuantityStp N'{1}'` (nhận XML); `EBD = SELECT N'...' Msg, 1 MsgType FROM ... WHERE
DocumentID='{0}' AND StatusID NOT IN (0,1)`.

---

## 8. Form viết tay dựa trên engine

Đặc điểm chung (đối chiếu `ERP.NET/ERP/AR_InvoiceFrm.cs`, `AP_PurchaseFrm.cs`) [XM]:

- **Không kế thừa form động**: `public class AR_InvoiceFrm : Form` (`AR_InvoiceFrm.cs:29`), `AP_PurchaseFrm : Form`
  (`AP_PurchaseFrm.cs:26`). Engine dùng bằng **thành phần**: `mFC = new FormControler(); Lyt = mFC.LoadLayout(Name)`
  (`AR_InvoiceFrm.cs:2206-2208`). Trong ERP.NET có 189 lớp kế thừa thẳng `Form`, 120 file tạo `FormControler`;
  vài form kế thừa form viết tay khác (6 lớp kế thừa `AR_InvoiceFrm`, 4 `AR_ServiceFrm`, 3 `IV_StockOutputFrm`…).
  `SysObject` cũng nhận lớp có BaseType `FrmMasterDetail`/`FrmFormList` nhưng không thấy lớp nào trong ERP.NET dùng.
- Đặt tên form trước `LoadLayout` để chọn FID (biến thể `AR_InvoiceFrm_EXPORT` khi Para/isExport, `:2196-2200`).
- Đăng ký bảng: nếu `Lyt.TableMaster.isValid()` dùng T0, **không thì SQL cứng** (`AR_InvoiceTbl left join
  CF_ObjectTbl …`, `:2223-2230`); tương tự T1 (fallback `AR_InvoiceDetailTbl`), cộng Storer ngoài cấu hình
  (`DetailVAT` = `AR_VATInvoiceTbl` nối `DocumentID`→`InvoiceID`, `Acc` = view `AR_InvoiceAcc2View` ReadOnly +
  ReloadAfterMasterSave) và slot T5–T7 từ cấu hình (`:2232-2258`). AP_PurchaseFrm tương tự (Allocate, DetailVAT, Acc,
  T6, T7; `AP_PurchaseFrm.cs:1922-1948`).
- Tự gọi `SetActionCheckData`/`SetLock` (kỳ khóa sổ, UserCreate, isLock), `SetFomularFromConfig`,
  `AddControlTab` cho các tab layout (1, 2, 3, 6, 9, 10, 11), **cộng editor thiết kế sẵn trong Designer** nối bằng
  `mFC.SetEditorArr(FldDocumentID, FldObjectID, ...)` (`:2285-2398`), `SetGrid` với danh sách cột ẩn/cột tổng cứng
  (`:2409-2423`), số chứng từ (`:2433-2437`), `SetDropdownFromConfig`, `ApplySettingToGrid*`.
- Handler `Data.Action` riêng: ở acBeforeSave chạy kiểm tra nghiệp vụ C# (ngày hóa đơn ≠ ngày CT, tồn kho, tài
  khoản, tổng tiền, công nợ…) **trước** rồi mới EBS và ESDB (`AR_InvoiceFrm.cs:2840-2912`); acAfterSaved cập nhật
  hóa đơn điện tử rồi ESS/ESS2 (`:2926-2933`).
- `UserBaseClass` (UCC) là đường mở rộng cho form động không cần form viết tay: lớp có `ParentmFC` và `Init()`
  (`LayoutX.cs:3684-3728`, `FrmFormList.cs:366-408`).

⇒ Với web: form viết tay = "form động + plugin". Phần cấu hình (layout, slot, hook) đọc như form động; phần C# phải
được chuyển thành server command/validator riêng cho từng form.

---

## 9. Ví dụ thật từ MedData

### 9.1 `FA_PartRegFrm` — EDIT đơn giản, chỉ master

`SY_FrmLstTbl`: FormType `EDIT`, TableName `FA_PartRegistrationFrmTbl`, PK `UserAutoID` (bị bỏ qua vì EDIT).
`SY_FrmCfg` (27 dòng), trích:

```
T0  TN  FA_PartRegistrationFrmTbl        T0  PK  UserAutoID
T0  SO  DateCreate DESC, UserAutoID DESC  T0  WWC ItemName;ResultMessage
T0  GD2 ItemID;ItemName;RegistrationModeName;...;DateCreate
T0  HDE UserAutoID;RequestID;RegistrationMode;PartCondition;...
DFP DateCreate    SP 13    SPA 30
EBE SELECT N'Yêu cầu đăng ký QR/Serial đã lưu không được sửa. ...' Msg,1 MsgType
EBD SELECT N'Không được xóa lịch sử đăng ký QR/Serial.' Msg,1 MsgType
LYT1 RegistrationMode  2;6;1;1;;100;;;;;AUTO_BATCH;;;;;;;;;0;0   (SubValue 001)
LYT1 PartCondition     2;6;1;;;100;;;;;NEW;;;;;;;;;0;0           (002)
LYT1 ItemCode          1;6;1;;1;100;;;;;;;;;;;;;;0;0             (004)
LYT1 RequestedCount    5;4;1;1;;;;;;;1;;;;;;;;;0;0               (008)
LYT1 Notes             1;12;3;1;;;;;;;;;;;;;;;;0;0               (011)
```

Giải mã:

- Dạng chứng từ một bảng (không có T1 ⇒ TabDetail ẩn, `TabMaster` lấp form). Lưới danh sách: cột theo GD2, ẩn HDE,
  xuống dòng ItemName/ResultMessage, sắp `DateCreate DESC`. PK UserAutoID ⇒ tự sinh khi thêm.
- Toolbar có bộ lọc **từ ngày–đến ngày** (`SP=13`) trên cột `DateCreate`, mặc định 30 ngày. `DFP` có giá trị nên bật
  kiểm tra kỳ khóa sổ theo `DateCreate` (DDC mặc định 1) và gán mặc định ngày trong kỳ.
- EBE/EBD trả `Msg + MsgType=1` không điều kiện ⇒ **bản ghi đã lưu không bao giờ sửa/xóa được** (chỉ thêm mới).
  Bảng có UserCreate ⇒ user thường chỉ thấy bản ghi của mình.
- `RegistrationMode`: ComboX (2), rộng 6/40 cột, cao 1, **đầu dòng**, caption 100 px, mặc định `AUTO_BATCH`; nguồn
  combo lấy từ `SY_FrmDrdwTbl` (không có trong snapshot). `ItemCode`: EditX chỉ đọc. `RequestedCount`: NumberX, đầu
  dòng, mặc định `1`. `Notes`: EditX rộng 12 cột, **cao 3 dòng ⇒ multiline**, đầu dòng.

### 9.2 `IV_InboundRequestFrm` — EDIT nhiều bảng, join, UserControl

`SY_FrmLstTbl`: EDIT, TableName `IV_InboundRequestTbl`, PK `OrderNumber` (bị bỏ qua; T0 dùng `DocumentID`).
`SY_FrmCfg` 184 dòng. Phần dữ liệu:

```
T0 TN IV_InboundRequestTbl  PK DocumentID  SO DocumentID Desc  GD2 DocumentID;DocumentDate;StatusName
T0 TN1 CF_ObjectTbl  FKA1 ObjectID  FKB1 ObjectID  SE1 A.ObjectName
T0 TN2 IV_InboundRequestStatusTbl  FKA2 StatusID  FKB2 StatusID  SE2 B.StatusName, B.BackColor
T1 TN IV_InboundRequestDetailsTbl  PK UserAutoID  DCP Chi tiết hàng hóa
T1 TN1 CF_ItemTbl  FKA1 ItemID  FKB1 ItemID  SE1 A.ItemName, A.Unit   LCK Amount;ItemName;...  WWC PalletNote;NoPalletNote
T1CS 11 Thông tin hàng hóa / 12 ContractID;ItemID;...  21 Số lượng trên chứng từ / 22 ...  (5 nhóm)
T1F1 C1 UserAutoID;DocumentID;...  C2 Additional  V1 1  BO -256
T2 TN IV_InboundRequestCTCPTbl  DCP Chứng từ chi phí  LCK Cost;VATPercent;...
T3 TN IV_InboundRequestNoSuitableTbl  RDO 1  DCP Hàng hóa không phù hợp
T4 TN IV_InboundRequestLogTbl  RDO 1  TN1 IV_InboundRequestStatusTbl (A.StatusName, A.BackColor)  SO ThoiGian desc
T4C1 A StatusName  B BackColor
T1V Thông tin đơn hàng   T2V Thông tin hư hỏng   T3V Đánh giá và kết luận   T4V Thông tin hư hỏng (không ai đọc)
DFP DocumentDate  DPR DN  DMK {P}{MM}{YY}/{4}  SP 9
EBE / EBD  SELECT N'Bạn không thể sửa/xóa đề nghị đã gửi' as Msg, 1 as MsgType
           from IV_InboundRequestTbl where DocumentID = '{0}' and StatusID NOT IN (0, 1)
```

SQL nạp master engine sinh ra (theo `TableInfoX`, chưa gồm filter quyền):

```sql
Select IV_InboundRequestTbl.*, A.ObjectName, B.StatusName, B.BackColor
From IV_InboundRequestTbl
 Left join CF_ObjectTbl A on IV_InboundRequestTbl.ObjectID = A.ObjectID
 Left join IV_InboundRequestStatusTbl B on IV_InboundRequestTbl.StatusID = B.StatusID
Order By DocumentID Desc
```

Detail 1 lọc `IV_InboundRequestDetailsTbl.DocumentID = {DocumentID master}` (MUL/MDL mặc định = PK master) — **không
phải** theo FKA1/FKB1 (đó là join `CF_ItemTbl A on ...ItemID = A.ItemID`).

Màn hình:

- Số đề nghị tự động: `DN` + tháng + năm + `/` + 4 số theo tháng của `DocumentDate` (ví dụ dạng `DN1126/0001`);
  bộ lọc theo **kỳ (tháng)** trên toolbar (`SP=9`); kiểm tra kỳ khóa sổ.
- 3 tab master: "Thông tin đơn hàng" (`LYT1`, 30 control), "Thông tin hư hỏng" (`LYT2`), "Đánh giá và kết luận"
  (`LYT3`). Tab detail: "Chi tiết hàng hóa" (lưới T1, header nhóm 5 nhóm cột, dòng `Additional = 1` tô nền vàng
  `-256` = ARGB FFFFFF00, khóa nhiều cột), "Chứng từ chi phí" (T2), "Hàng hóa không phù hợp" (T3 chỉ đọc), "Lịch sử
  gởi / duyệt" (T4 chỉ đọc, màu theo cột BackColor).
- Ví dụ LYT: `DocumentID 1;4;1;1;;;;Số đề nghị;...` = EditX 4 cột, đầu dòng, caption "Số đề nghị";
  `StatusID 2;4;1;;1;;;;;;0;...` = ComboX chỉ đọc, mặc định `0`; `IsRain 6;1;1;...` = CheckBox 1 cột;
  `StatusButtonCtl_1 22;3;1;;1;;;Chuyển trạng thái;;;0;...` = UserControl StatusButtonCtl, chỉ đọc, mặc định `0`.
- UserControl: `ExecSQLWithParaButtonCtl` "Gửi BLĐ" (LYS: `C1 ExecSQL`, `C2 SaveContinue` trước, `C3 Reload` sau,
  `C4 update IV_InboundRequestTbl set StatusID = 10 where DocumentID = '{0}'; Insert into IV_InboundRequestLogTbl ...`,
  `CS4` kiểm tra "Dữ liệu đã được cập nhật hoặc trạng thái đã thay đổi…" với para `CS5 DocumentID`, `P1 OrderNumber`,
  hai tham số nhập `02 DocumentID` (chỉ đọc `03`, bắt buộc `0A`, mặc định từ master `05`) và `22 Notes` (bắt buộc
  `2A`), `LBEX StatusID NOT IN (0, 1)` ⇒ nút bị khóa khi trạng thái ≠ 0/1, màu `BC -32640`, icon `BI userlog`);
  "Gửi Thủ kho" tương tự (StatusID = 2); `PrintButtonCtl` in `AP_GoodsInspectionAndReceivingReportStp '{0}'`;
  `StatusButtonCtl_1` menu từ `select * from IV_InboundRequestStatusTbl` (`MSQ`, `GFN StatusID`, `GDN StatusName`,
  tô màu `BCF BackColor`); `AttachWebcamImageControlCtl` ảnh 2/4/6 (`STT`), `WebLinkViewerCtl` mở URL trong cột
  `BBKCUrl`.
- Ràng buộc trạng thái: EBE/EBD chặn sửa/xóa khi `StatusID ∉ {0,1}`; nút gửi bị khóa theo LBEX; việc chuyển trạng
  thái **không** đi qua Storer mà qua SQL trong nút (C4), sau đó `Reload`.

### 9.3 `AccountBankListFrm` — LIST không có `SY_FrmCfg`, dùng cho thêm nhanh

`SY_FrmLstTbl`: LIST, TableName `CF_AccountBankTbl`, PK `AccountNo`, `AddNewColumnArr = AccountNo;BankName;
BankName2;ObjectID;Province;Notes`, `DefaultColumnArr = ObjectID`, LockColumnArr rỗng; **không có dòng SY_FrmCfg**.

- Mở từ menu: T0 không hợp lệ ⇒ `SetData("CF_AccountBankTbl", "AccountNo", "*", "", "CF_AccountBankTbl", "", FilterEx,
  ...)` ⇒ `Select CF_AccountBankTbl.* From CF_AccountBankTbl`; lưới sửa trực tiếp nhiều dòng, Lưu một lần cho cả lưới
  (FT_LIST). Không có PrimaryKeyFormat ⇒ người dùng tự nhập AccountNo (bỏ dấu, trim khi lưu). Nếu bảng có UserCreate thì
  user thường chỉ thấy dòng mình tạo [SL: chưa xem schema bảng].
- Thêm nhanh: ở form khác, combo/lookup có field `AccountNo` bấm F2 ⇒ không có `AddNewAccountNoFrm`, không có layout
  `{Module}_AddNewAccountNoFrm` ⇒ tìm `SY_FrmLstTbl where PrimaryKey = 'AccountNo'` ⇒ `FrmAddnew` hiện 6 cột trong
  AddNewColumnArr, gán sẵn `ObjectID` từ chứng từ đang mở (DefaultColumnArr), lưu xong trả `AccountNo` về combo.

(Ví dụ LISTEDIT có LYT: `FA_AssetListFrm` — 51 control ở `LYT1`, 9 ở `LYT2`, T0 join `CF_ItemTbl` (A) và view
`FA_AssetCurrentContractView` (B); `SPA2 = 1` nên mọi user thấy mọi tài sản.)

---

## 10. Hàm ý cho bản web (renderer phải hỗ trợ)

1. **Dispatch**: FormID → (form viết tay có plugin?) → FormType (`LIST`, `LISTEDIT`, `LISTEDIT2`, `EDIT`, `EDITTOP`,
   `POS`, `CALENDAR`, `TIMELINE`; `TREE` không có hành vi). FID cấu hình = `FormID` hoặc `FormID_Para` theo menu;
   hỗ trợ mở ở chế độ Find/AddNew/Edit/FindEditOrAddNew với tham số (PK, filter).
2. **Trình biên dịch cấu hình phía server**: đọc `SY_FrmCfg` theo đúng mô hình địa chỉ 4.2 (lấy dòng đầu khi trùng,
   rỗng = mặc định, mặc định khác 0/rỗng: HCB=1, DDC=1, RDAD=1, EST=1, GD1=2, GR2/GR3=1, GCSS/GCSB/GCSF=1, GD4C=1,
   TA1..4=A..D, TRS=−1, SPA=7, D1=1, D2=600, BOL2=1, DUQ=1, EONC3=1…), xuất JSON typed; không gửi SQL thô xuống
   browser. Phải biết key nào "khai báo nhưng không chạy" (danh sách mục 4.4/4.5) để không vô tình kích hoạt.
3. **Parser LYT** đúng 21 vị trí, mặc định khi thiếu (đặc biệt CaptionWidth 85, Anchor 5), giải mã `:`→`;`,
   `"`→`'`; giữ nguyên vị trí 6 để round-trip.
4. **Layout 40 cột**: CSS grid 40 cột, quy tắc xuống dòng (isFirstPos, tràn, XFull/YFull), SizeY → số dòng (multiline
   cho EditX), SizeP = khoảng trống sau, SizeWebM cho mobile; tab master `1,2,3,A,B,C`, tab detail `5..13`,
   GroupBox lồng `LYT{tab}{Group}`.
5. **Bộ control**: EditX (password, multiline), ComboX (2 cột hiển thị, F2 thêm nhanh), ComboCheckX, DateX
   (format/mask), NumberX (format, min/max), CheckX, ColorPicker, RadioX (VLS/VLC/VLQ), GroupBox, ButtonX/ButtonMenuX
   (sự kiện cho plugin), LabelCaption (text/SQL), UserControl theo registry tên lớp (ít nhất 6 lớp MedData dùng).
6. **Quyền theo control/cột/tab**: EditPermiss/VisiblePermiss/EnableType (mã giả 5.2), HDE2/HDE3/LCK2/LCK3/ACP,
   TPV1..5, cờ ẩn nút toolbar hạ quyền. Tất cả phải **tính lại ở server khi ghi** (WinForms không kiểm tra lại).
7. **Trạng thái dữ liệu** IsNone/IsNew/IsEdit, khóa editor khi xem, hiện/ẩn nút theo bảng 3.4, cảnh báo rời trang
   khi đang sửa, ViewMode 0/1/2, Lưu tiếp / Lưu&Mới / Copy (reset ANCR, isLock, UID, LinkID…).
8. **Khóa chứng từ**: isLock (đọc lại DB trước khi sửa/xóa), UserCreate theo SPA2/quyền, kỳ khóa sổ
   (`SY_CheckDateOfPeriodOpeningFnc`) cả lúc mở sửa và trong transaction lưu, LBEX/LBS, ESLOS/ESLOS2.
9. **Bộ lọc dữ liệu theo quyền** (UserCreate, BranchID, CostCenterID, filter menu, FTX/FTXS, top 5000 khi > 10.000).
10. **Lưu**: một command server "save document" = validate (Require theo schema + cấu hình, DCD/UIC, số chứng từ trùng,
    MHD) → hook EBS/ESDB → transaction (master + mọi detail không ReadOnly, theo đúng thứ tự) → kiểm tra kỳ trong
    transaction → commit → ESS/ES2/ES4/ES6/ES7, ESS2 (bất đồng bộ). Cân nhắc thêm kiểm tra đồng thời (WinForms không
    có). Tái hiện cột audit (và ngoại lệ admin mode — nên bỏ), chuẩn hóa PK (bỏ dấu, trim).
11. **Hook**: dựng lại đúng thứ tự thay token từng hook (7.1/7.2) hoặc thay bằng tham số SQL có chủ đích; giữ quy ước
    Msg/MsgType (7.3) để SP hiện có chạy được; payload XML `Data/T0, T1…` giống hệt (tên bảng theo chỉ số Storer).
    Hook "fail-open" (EBE/EBD/EBS khi SQL lỗi) nên đổi thành fail-closed có cấu hình.
12. **Số chứng từ**: DocumentMask/Prefix/SourceID/DW2-DW3/AutoDocNumber1-2/CF_Table/AutoNumber/SQL, cấp số ở server
    và cấp lại khi trùng lúc lưu.
13. **Công thức**: evaluator tương thích `DataColumn.Expression` (toán tử, IIF, Convert, Len…), `{MasterField}`,
    RefColumn trigger, ResetColumnArr, làm tròn AwayFromZero theo số lẻ của format, giới hạn vòng lặp.
14. **Lưới**: GD2/GD2A/GD2V/GD2W, ColumnSets, FormatCondition, DynamicColor, Group/Sum, LinkColumn, X50..X75,
    KVF, GF1, AutoNumber STT, tree view (STV).
15. **Ngôn ngữ & format**: caption từ CaptionText → `LangField(Field)`; CV/CE theo LangID; format toàn cục
    `SY_FmtFldTbl` + override `F0..F9/CF`.
16. **Cache & phiên bản cấu hình**: WinForms cache cả ngày theo máy; web cần version/ETag cho cấu hình, và tránh
    "delete all rows của FID rồi insert" khi lưu thiết kế.

---

## 11. Đối chiếu với tài liệu thứ cấp

| Khẳng định trong tài liệu cũ | Kết quả đối chiếu mã |
|---|---|
| 21 vị trí LYT (WINFORMS_SOURCE_GUIDE_EVIDENCE §5) | Đúng thứ tự và mã hóa; vị trí 6 không có property công khai (chỉ round-trip); EnableType 7/9 = readonly nếu thiếu quyền Manager/Admin; Permission 4/5 không xử lý trong nhánh LYT |
| 20 slot T0, T1–T9, TA–TJ | Đúng (`LayoutX.cs:1318-1357`) |
| `FKA1/FKB1` = khóa master/detail (CSHARP_ENGINE_ARCHITECTURE_REVIEW §2.2) | **Sai**: là khóa join tra cứu; liên kết master-detail là MUL/MDL (mặc định PK master) |
| Hook bảng DBS/DBD/DBE/S10/S11 | Có khai báo nhưng **không có lời gọi** |
| PropertiesX.vb | Lớp thực tế là `PropertyX` (+ 12 lớp con) |
| UserControl defaults TXT/TXT2/BOL1/BOL2/NUM/NUM2 | Đúng; còn có `DTE` |
| Form viết tay kế thừa base form | Không: kế thừa `Form`, dùng `FormControler` bằng thành phần |
| SaveConfig xóa toàn bộ FID rồi insert | Đúng (`LayoutX.cs:1409`), không transaction |
| Cache Forever1Day, `Clear(True)` | Đúng (`Cache.cs:75`, `LayoutSettingFrm.cs:5323, 6668`) |

---

## 12. Câu hỏi còn mở

1. Bản dịch ngược hiện tại có đúng là bản Tools.dll đang chạy ở từng khách hàng không? Các key "khai báo nhưng không
   chạy" (SSP, GDW, GWPS, DSOP, WO, LTC, FLT, LFD, DBS…) có được một **bản web cũ** đọc không (MedData có `SSP = 1`
   ở 9 form nhóm IV_*)?
2. Xóa master không xóa detail qua Storer: dòng detail được xóa bằng FK cascade, trigger hay để mồ côi? Cần đọc
   schema/trigger từng bảng (`foreign_keys.json`, `triggers.json`).
3. `EDITTOP`: cơ chế "nhập không cần bấm Sửa" cụ thể (editor không bị Locked? tự `Edit()` khi gõ qua `acCallChange`?)
   chưa đối chiếu hết `FrmMasterEditTop.cs`.
4. `POSTableFrm`, `FormCalendarFrm`, `FormTimeLineFrm` mới đọc ở mức key cấu hình (PO/CO/TLO); hành vi kéo-thả,
   cập nhật (`DD2`, `DD5`) chưa phân tích. MedData không dùng ba loại này.
5. Thứ tự đè giá trị mặc định giữa LYT DefaultValue, `SY_FrmDrdwTbl.DefaultValue(SQL)`, `F*/DV|DS`, mặc định theo user
   và DefaultValueSQL — cần chạy thử hoặc lần theo thứ tự gọi trong từng loại form.
6. `SY_FrmLstTbl.PrimaryKey2` chỉ thấy trong một truy vấn của `Connector`; DB nào có cột này?
7. `Functions.GetPermission`, `GetBranchFilter`, `App.Cn.GetFilter`, `GetPermissByPriKey` — logic phân quyền chi tiết
   chưa đọc (thuộc tài liệu phân quyền).
8. `SY_FrmExpTbl.RoundType/RoundPara` không thấy được dùng khi tính công thức — có lớp nào khác đọc?
9. Đổi FormType từ menu Tùy chọn của form LIST ghi thẳng `SY_FrmLstTbl` cho mọi người — có chặn quyền ở chỗ dựng
   menu không (biến `HCZalims8NA` chỉ là cờ "là form LIST")?
10. `Db.GetXMLString(..., FillZeroValue2Number:true)`: định dạng chính xác của XML (null, ngày, số, dòng detail đã
    xóa có xuất hiện không) cần chạy thử để web sinh payload tương thích byte-by-byte với SP hiện có.
11. Hành vi khi `SY_FrmCfg` có nhiều dòng trùng (FID, KeyID, SubID[, SubValue]): engine lấy dòng đầu của
    `DataTable.Select` — thứ tự phụ thuộc thứ tự SQL trả về (không ORDER BY) ⇒ không xác định; cần đếm trùng trên các DB.
12. `UserBaseClass` thực tế được cấu hình ở DB nào, lớp nào? (MedData không có `UCC`.)
