# 11 — Engine UI dùng chung: lưới, tra cứu, lọc, nút hành động, báo cáo, nhập/xuất, đính kèm, duyệt

Ngày khảo sát: 2026-11-11. Đọc trước: `00-nguon-du-lieu.md`. Phần form động/layout/Storer/hook lưu do tài liệu khác đảm nhiệm;
ở đây chỉ nhắc tới khi cần để hiểu thành phần UI.

## 0. Quy ước, nguồn và mức độ tin cậy

- **Dẫn nguồn code**: `Tools/GridX.cs:123` = file `.legacy/decompiled/Tools/Tools/GridX.cs` dòng 123 (gốc là thư mục dự án
  `Tools.dll` trong `.legacy/decompiled/Tools/`). Tương tự `Tools.Layout/…`, `Tools.Grid/…`, `Tools.SysForm/…`, `Tools.Utils/…`.
  File của ERP.NET ghi `[ERP.NET] ERP/LoginFrm.cs:2073` (= `.legacy/decompiled/ERP.NET/ERP/LoginFrm.cs`).
- **Nhãn**: **[V]** = đã thấy trong code/metadata/file thật. **[S]** = suy đoán (chưa thấy trực tiếp, cần kiểm chứng).
- **Metadata Medcom** (DB `MedData`, chỉ đọc): `workflow-config-20261019/*.json` (snapshot *một phần*: `form_config.json` có 3.419/10.687
  dòng `SY_FrmCfg`, `form_filters.json` 18/244 dòng `SY_FrmFltTbl`), `run-20261019/columns.json`, `row_counts.json`,
  `analysis/workflow-trace/configured_buttons.json` (77 nút). Số dòng bảng lấy từ `row_counts.json` (approximate_rows).
- Tên lớp phụ trợ bị obfuscate (vd. `uTk2P4TSsUEc53dOPb`, `Bv34pZOQth`) được giữ nguyên để grep lại được.
- Phần 5–7 (báo cáo, nhập/xuất, đính kèm, duyệt, dashboard) được tổng hợp từ hai lượt đọc mã song song; các trích dẫn chính
  đã được kiểm tra lại ngẫu nhiên (vd. `Tools/App.cs:958`, `Tools/ReportViewerFrm.cs:2447`, `Tools.Utils/Functions.cs:10323`,
  `Tools/Excels.cs:1146`, `Tools/SY_ApproveDocumentFrm.cs:2724`) và khớp.

### 0.1 Cơ chế chung mà mọi thành phần dùng

| Cơ chế | Mô tả | Nguồn |
|---|---|---|
| **PropertyX trong `SY_FrmCfg`** | Mọi control đặt trên layout (`*ButtonCtl`, `*ControlCtl`…) có lớp `…PropertyX : PropertyX` với các thuộc tính đọc bằng `GetValue("<key>")`. Lưu thành dòng `SY_FrmCfg(UserAutoID, FID, KeyID, SubID, KeyValue, SubValue, VDate, PFID)`: `FID`=tên form, `KeyID`=`LYS1/LYS2…` (bộ thuộc tính của layout n), `SubID`=tên control (vd. `ExecSQLWithParaButtonCtl_1`), `SubValue`=key thuộc tính (vd. `C4`), `KeyValue`=giá trị. `LYTn` giữ vị trí/kiểu control (vd. `'22;5;1;;1;;;Trạng thái;…'`). | `Tools.Layout/PropertyX.cs:271-275`; `Tools.Layout/LayoutX.cs:1304,1312` [V] |
| **TableInfoX trong `SY_FrmCfg`** | Cấu hình bảng/lưới: `KeyID='T0'` (master), `'T1'..'T9'` (detail), `SubID`=key (vd. `SUM`, `HDE`), `KeyValue`=giá trị. Đối tượng con dùng KeyID ghép: `T{n}F{1..9}` (định dạng điều kiện), `T{n}C{1..9}` (màu động), `T{n}CS` (column set), `T{n}LC{1..4}` (cột link). | `Tools.Layout/TableInfoX.cs:2499-2519, 2680-2684` [V] |
| **Khóa/mở bằng SQL/biểu thức** | Mọi PropertyX có `LBS` (SQL trả 1=khóa), `LBSP` (para), `LBEX` (biểu thức DataColumn, vd. `StatusID <> 8`). Màu: `PV1` chữ editor, `PV3` đậm, `PV4` màu caption, `PV5` nền caption, `PV6` caption đậm; `FH/FW/PT/PL` kích thước/đệm. | `Tools.Layout/PropertyX.cs:61-249` [V] |
| **Placeholder trong SQL cấu hình** | `{User} {UserID} {UserFullName} {BranchID} {EmployeeID} {ManagerID} {CeoID} {CostCenterID} {StoreHouseID} {ObjectID} {AgencyID}` (có/không `@`); `{P}` = khóa chính bản ghi hiện tại; `{0},{1}…` = para theo thứ tự; `{JSON}`/`{XML}` = dữ liệu đang sửa; `{GRID}` = XML toàn lưới; `Master.X` = cột của master; `A>B` = lấy A, rỗng thì lấy B. **Thay thế chuỗi thô, không tham số hóa.** | `Tools/SystemPara.cs:166-206`; `Tools/ExecSQLWithParaButtonCtl.cs:2721-2730`; `Tools/GridX.cs:5607, 5864-5886` [V] |
| **Quy ước kết quả `MsgInfoAction`** | SQL kiểm tra/thực thi trả: 0 dòng → tiếp tục; 1 ô → popup thông tin; có cột `Msg`, `MsgType` (+ `Title`, `MsgTooltip`): `0/5` hỏi Hủy/Tiếp tục, `1` lỗi chặn, `2` thông tin, `3` tooltip, `4` cảnh báo chặn; cột thừa hiện thành lưới. Enum `MsgTypes{OKCancel=0,Cancel=1,OK=2,Popup=3,PopupWaning=4,YesNo=5,Auto=9}`. | `Tools/MsgInfoAction.cs:16-25, 94-290` [V] |
| **Hành động trước/sau** (`C2`/`C3`, `BeforeAction`/`AfterAction`) | Từ khóa: `Save`, `SaveContinue`, `SaveContinueCheckDetail`, `SaveSkipErr`, `SaveFile`, `Edit`, `Reload`, `ReloadCurrent`, `ReloadDetail`, `None`/rỗng. | `Tools/FormControler.cs:9590` (`DoAction_Before_After`) [V] |
| **Cache metadata** | Các bảng `SY_Frm*` đọc qua `Cache.CreateData(…, CacheType.Forever1Day)`; F9 (admin) sửa cấu hình rồi `Cache.Clear`. | `Tools/FormControler.cs:8422`; `Tools/ComboX.cs:2199-2215` [V] |
| **Định dạng theo tên cột (toàn cục)** | `SY_FmtFldTbl(FieldName, FormName, FormatID, AlignX, MinWidth, MaxWidth…)` join `SY_FmatTbl(FormatString, MaskString, MaxLength, NumberDecimal, IsComplex, MinValue, MaxValue…)`; nạp vào cache khi khởi động; `Functions.GetFormat(field)` trả Format/Mask/Align/MaxLength. Caption đa ngôn ngữ cũng theo `FieldName`. | `Tools.Utils/Functions.cs:2743-2764, 4973-5120` [V] |
| **Bảng tên hằng** | `SY_FrmOptBtnTbl` (nút tùy chọn), `SY_FrmGrdActTbl` (grid action), `SY_FrmMstActTbl` (master action), `SY_FrmLstTbl`, `SY_FrmCtrTbl`, `SY_RpTbl`, `SY_RpDTbl`, `SY_StTbl`, `SY_Period`. | `Tools/Db.cs:47-56` [V] |

---

## 1. Lưới dữ liệu `GridX` (Janus GridEX)

### 1.1 Kiến trúc

- `GridX` **không phải control**: là lớp bọc một `Janus.Windows.GridEX.GridEX` + một `Storer` (DataTable có trạng thái) + `FormControler`.
  Đăng ký ~30 sự kiện GridEX (`FormattingRow`, `UpdatingCell`, `CellUpdated`, `DropDown`, `ColumnButtonClick`, `KeyDown`…).
  `Tools/GridX.cs:141-255` [V].
- `SetGrid(oGrid, oData, mFC, IsReadonly, IsOnlyEdit, ReBuildColumn, HideColumnArr, SummaryColumnArr, IsNoDeleteRow)`
  `Tools/GridX.cs:2355-2717` [V]:
  - Mặc định khóa thêm/sửa/xóa; readonly → Enter xuống dòng, dòng chọn đậm; editable → Enter sang ô, chọn nhiều dòng.
  - `ReBuildColumn`: sinh cột từ DataTable: caption = `LangField(columnName)`, số căn phải, ngày căn giữa + `CalendarCombo`
    + `dd/MM/yyyy`/mask `##/##/####`, bool → checkbox rộng 50, chuỗi rộng 120 (`:2409-2463`).
  - Ẩn cột hệ thống: `UserCreate, UserUpdate, DateCreate, DateUpdate` (không sửa), `UserAutoID, UID, ParentID, isSyn` (ẩn khỏi
    field chooser); nếu `SystemPara.isFixBranch` thì ẩn `BranchID` và gán mặc định chi nhánh đăng nhập (`:2464-2514`).
  - Áp format theo `SY_FmtFldTbl`; số mặc định `#,##0.##`; cột `byte[]` → ảnh `BoundImage` cao ≥32px; cột có mask → editor
    `MaskedEditBox` (`:2578-2697`).
  - Khóa chính tự tăng bị ẩn; tự co cột khi < 1.000 dòng, tối đa 350px (`:2551-2566, 2699-2712`).
  - Gắn `GridXContextMenu` (`:2714`).
- `SmartGridX` (`Tools/SmartGridX.cs:19-160`) là lớp con của `GridEX` chỉ để hiển thị danh sách (`SetList` nhận DataTable,
  Storer hoặc chuỗi SQL). **Không được tham chiếu ở đâu khác** trong Tools/ERP.NET (grep) [V] → có thể bỏ qua khi port.

### 1.2 Thuộc tính lưới cấu hình trong `TableInfoX` (SY_FrmCfg, KeyID `T0..T9`)

Chỉ liệt kê nhóm hiển thị/sửa lưới; các key nguồn dữ liệu (`TN, TV, SE, EX, SO, TRS, TSP, TN1..4, FKA*, IJ*…`) thuộc tài liệu
form động. Nguồn: `Tools.Layout/TableInfoX.cs` (số dòng = dòng `GetValue`) [V].

| Key | Thuộc tính | Ý nghĩa (theo Description trong code) | Dòng |
|---|---|---|---|
| `SUM` | SummaryColumnArr | Cột tính tổng ở footer: `Amount;TotalAmount` | 66 |
| `HDE` / `HDE2` / `HDE3` | HideColumnArr / …User / …Manager | Ẩn cột; ẩn với quyền User (Manager/Admin thấy); ẩn với User+Manager (chỉ Admin thấy) | 1327/1343/1359 |
| `LCK` / `LCK2` / `LCK3` | LockColumnArr / …User / …Manager | Khóa sửa cột; khóa với User; khóa với User+Manager | 82/242/258 |
| `ACP` | HiddenAmountColumnArrForPermission | Cột tiền ẩn khi user bị cấm xem số tiền (`Permiss.HideAmount`) | 98 |
| `RCD` | RequireColumnArr | Bắt buộc nhập | 130 |
| `DCD1..5` | DuplicateColumnArr1..5 | Không trùng với dữ liệu đã có (tổ hợp cột, vd. `Ten;DiaChi`) | 146-210 |
| `UIC` | UniqueIndexColumnArr | Không trùng giữa các dòng trên lưới (UniqueConstraint ≤4 cột) | 711 |
| `WWC` | WordWrapColumnArr | Nhiều dòng trong ô; Ctrl+Enter xuống dòng | 226 |
| `CUP` | UpperCaseColumns | Tự viết hoa | 1311 |
| `MSC` / `GD5` / `GD5A` | AddMultiSelectColumn / ShowSelectorColumn / ShowSelectorExpression | Cột checkbox chọn nhiều dòng; biểu thức bật/tắt checkbox từng dòng (`_ShowCheck > 0`) | 274/939/955 |
| `STV` / `STD` | SetTreeViewInfo / SetTreeViewSQLDemand | Cây nhiều cấp: `PK;ParentID;ExpandColumn;TargetColumn`; gốc cây từ SQL | 290/306 |
| `GCA` `GCRC` `GCSS` `GCSF` `GCSB` | Group… | Nhóm theo cột; hiện số record; dòng tổng dưới nhóm (mặc định 1); cỡ/đậm font nhóm | 322-407 |
| `GCSF2` | GridFontSizeUpDown | Tăng/giảm font lưới | 390 |
| `GRH` | GridRowHeaderContent | STT ở đầu dòng (RowHeader) | 548 |
| `GD1` / `GDC` | GridHeaderLines / GridHeaderCaptionShow | Số dòng tiêu đề (0 = ẩn); ẩn caption khi dùng column set | 564/580 |
| `GFH` / `GFC` | GridRowHeight / GridFrozenColumns | Cố định chiều cao dòng; số cột đóng băng | 596/612 |
| `GR2` / `GR3` | GridRowHeaderShow / GridRowCountShow | Ẩn/hiện cột chọn dòng; dòng “7 của 20” | 644/660 |
| `GD2` / `GD2A` / `GD2W` / `GD2V` | GridColumnOrdersFix / …Default / OrderWidths / AlwayVisible | Thứ tự cột cố định; thứ tự khi Reset; độ rộng theo thứ tự (`100;Max200;W150`); cột luôn hiện | 677-745 |
| `G01` / `G02` / `G03` | ColumnPositionLock / PositionDefault / SizeLock | Cấm kéo cột; thứ tự theo dữ liệu; cấm đổi độ rộng | 760-791 |
| `GD4` / `GD4C` / `GD4D` | GridSortDisable / SortClearOnLoad / SortColumn | Tắt sort; bỏ sort khi mở (mặc định 1); sort sẵn (`DocumentDate DESC, DocumentID`) | 807-840 |
| `GF1` | AutoNumberColumn | Cột STT tự tăng khi thêm dòng | 971 |
| `GCM` | DefaultColumnFromMaster | Lấy mặc định cột lưới từ master (vd. `ObjectID;Memo`) | 891 |
| `X50..X55`, `X60..X65`, `X70..X75` | FromMasterColumnLink1..3 … | Cột master → mặc định dòng mới / cập nhật lại khi master đổi / tính lại công thức / mặc định bằng SQL + para | 2158-2413 |
| `X01..X04`, `X21..X24` | X1/X2 ColumnName, Format, FormatBySQL, Para | Sinh mã tự động cho dòng (vd. `{0}-{1}-{STT3}` → `KH001-001`) | 2037-2143 |
| `KVF` | CopyKeepValueFieldArr | Giữ giá trị cột cho dòng nhập tiếp theo | 1375 |
| `ANCR` | AddNewByCopyResetField | Khi copy, các cột này lấy lại mặc định | 114 |
| `RDO` / `EDO` / `EDD` | ReadOnly / EditOnly / EditNoDeleteRow | Chỉ xem; chỉ sửa không thêm; không xóa dòng | 1423-1455 |
| `RUM` | RowUpdateMode | Lưu DB ngay sau mỗi dòng | 1471 |
| `RLM` / `RCR` | ReloadAfterMasterSave / ReloadCurrenRow… | Nạp lại lưới sau khi master lưu; nạp lại dòng khi di chuyển/sửa | 1487/1503 |
| `DBS` `DBD` `DBE` `S10` `S11` | CheckBeforeSave/Delete/Edit SQL, AfterSave/Delete SQL | SQL kiểm tra/hậu xử lý chi tiết (`{0}`=PK, `{M}`=master, `{isManager}`, `{isAdmin}`) | 423-487 |
| `DCP` / `NBC` | TabCaption / NewButtonCaption | Tiêu đề tab chi tiết; nút “Thêm dòng chi tiết” | 1518/1533 |
| `DSOP` | DisplayType | `GridView=0, GridView_EditModal=1, DataHTML=6, CardBox=10, CardBoxForMobile=12, Calendar=20, NoOutput=99` (`:22-31`) — chỉ được ghi, không thấy nơi đọc trong desktop → **[S]** dành cho bản web hiện có | 907 |
| `GWPS` / `GDW` / `GDWH` | GridWebPageSize / GridColumnEditorForWeb / …HiddenInput | Số dòng/trang, thứ tự cột nhập, input ẩn **cho web** (mô tả ghi rõ “trên web”) | 628/857/874 |
| `GD3` | DisableGridView | Không tự tạo lưới trong tab detail (dùng `GridDetailCtl`) | 923 |

Medcom (snapshot) dùng nhiều nhất: `PK/TN` 113, `GD2` 81, `HDE` 73, `DCP` 54, `LCK` 51, `SO` 45, `RDO` 29, `WWC` 17, `SUM` 6;
ví dụ `AR_OrderComfirmFrm T1 SUM='Amount;VATAmount;TotalAmount'`, `AR_ChiTieuNhanVien2022Frm T0 GCA='ManagerID'`,
`AR_InvoiceRequestFrm T1 GRH='3'` [V].

### 1.3 Thứ tự áp dụng cấu hình lên lưới

`LayoutX.Bv34pZOQth(TableInfoX, GridEX, Storer, FormControler)` (`Tools.Layout/LayoutX.cs:3120-3674`) [V], gọi cho master và
từng detail (`ApplySettingToGridDetail1..9/X`, `:3080-3118`). Thứ tự (quan trọng khi tái hiện vì các bước ghi đè nhau):

1. `RCD` bắt buộc → `ACP` ẩn cột tiền theo quyền (`:3156-3179`) → `STV` cây (`:3180-3205`) → `DCD1..5` (`:3206-3210`).
2. `GD1` dòng tiêu đề (`:3211-3218`) → `GCA` nhóm (`:3219`) → `GD2A` (lưu để Reset) → `GD2` thứ tự (`:3223-3230`) → `GD2V` (`:3233-3251`).
3. Ẩn theo quyền: `HDE3` (ẩn trừ Admin, Admin thì *bỏ ẩn*), `HDE2`, rồi `HDE` (`:3252-3271`).
4. Column sets `T{n}CS` (tối đa ~30 nhóm `G1..GV`, cặp key `11/12, 21/22…` = caption/danh sách cột, `RC` = số dòng tiêu đề nhóm)
   (`:3272-3336`; `Tools.Layout/ColumnSets.cs:33-337`).
5. `GD2W` độ rộng → `SUM` → `WWC` → `LCK/LCK2/LCK3` (tooltip “(Quyền User bị khóa)”) → `CUP` → `KVF` (`:3337-3413`).
6. Màu động `T{n}C1..9` → định dạng điều kiện `T{n}F1..9` (`:3414-3458`).
7. `GF1` STT → `GCM` mặc định từ master → sort `GD4/GD4C/GD4D` → `G01/G02/G03` → `GRH` (rộng 45) (`:3459-3535`).
8. `X1/X2` mã tự động → `X50..X75` master link → link column `LC1..4` → `GFH` → `GFC` → `UIC` (`:3536-3674`).

Sau đó `FormControler.ApplySystemToMe` nạp **bố cục người dùng** từ file `.dat` (mục 1.11) — tức file người dùng ghi đè thứ tự/độ
rộng/ẩn hiện của cấu hình, trừ khi cấu hình khóa (`G01/G03`) hoặc `GD2V` buộc hiện (`Tools/FormControler.cs:5319`) [V].

### 1.4 Tổng, nhóm, cột tính

- **Footer tổng** `SetSummaryColumn`: `TotalRow=True`, vị trí `BottomFixed`, nền RGB(237,235,232) chữ Maroon, `GroupTotals=Always`,
  hàm `Sum`, format theo `SY_FmtFldTbl` hoặc `#,###.##` (`Tools/GridX.cs:2322-2353`) [V]. Chỉ có **Sum** từ cấu hình; người dùng
  bật/tắt Sum từng cột qua menu “Tổng cộng theo cột” và lưu vào `.dat` cột `Sum` (giá trị `Sum`/`None`) [V].
- **Nhóm**: `GroupColumnArrs` = các cột `;`, prefix rỗng (`Tools/GridX.cs:463-493`); menu “Xem theo nhóm” (GroupByBox) và “Nhóm cột
  đang chọn” (`Tools/GridXContextMenu.cs:303-304`) [V].
- **Cột tính/công thức**: định nghĩa trong `SY_FrmExpTbl(FormID, DataName, Oderby, ColumnID, Expression, RefColumn, ParaArr, LevelLoop,
  RoundType, RoundPara, ResetColumnArr)` (424 dòng ở Medcom), nạp bởi `SetFomularFromConfig` (`Tools/FormControler.cs:8376-8410`).
  Khi một cột trong `RefColumn` đổi, `GridX.CalculateFormularGroup` reset `ResetColumnArr`, thay `{MasterPara}` rồi tính bằng
  **`DataColumn.Expression` của ADO.NET** và làm tròn `MidpointRounding.AwayFromZero` (`Tools/GridX.cs:6760-6930`) [V].
  F6 trên một cột = tính lại công thức cho mọi dòng (`:6343-6374`) [V]. (Chi tiết Storer thuộc tài liệu form động.)
- `GridX_TotalRowSumCondition` là mã thử nghiệm (`MsgBox("Test …")`, cột cứng `re_amount`) — không dùng (`Tools/GridX_TotalRowSumCondition.cs:42-60`) [V].

### 1.5 Định dạng có điều kiện và màu động

**`GridConditionFormat`** (KeyID `T{n}F{k}`, k=1..9) — `Tools.Layout/GridConditionFormat.cs` [V]:

| Key | Ý nghĩa |
|---|---|
| `C1` | Cột được tô (rỗng = cả dòng) |
| `C2` | Cột lấy giá trị so sánh (ValueColumn) |
| `C3` / `C4` | So sánh với cột khác (cột thứ 2 dùng cho Between) |
| `V1` / `V2` | Giá trị so sánh trực tiếp |
| `OP` | `Janus ConditionOperator` (số nguyên; có IsEmpty/IsNull…) |
| `CO` / `BO` | ForeColor / BackColor (ARGB int, vd. `-16728064`) |
| `FB` `FSZ` `FS` `TA` | Đậm, cỡ chữ, gạch ngang, căn lề |

Áp bằng `GridX.SetFormatCondition` → `GridEXFormatCondition` của Janus (`Tools/GridX.cs:7564-7657`; `Tools.Layout/LayoutX.cs:3676-3682`) [V].
Ví dụ Medcom: `AP_BPTMDueEntryFrm T0F1: C1='OrderDocumentID', C2='IsApplied', V1='1', BO='-16728064'` (xanh khi đã áp dụng);
`T0F2: V1='0', BO='-256', CO='-16777216'` [V].

**`GridDynamicColorFormat`** (KeyID `T{n}C{k}`): `A` cột tô (rỗng = cả dòng), `B` cột chứa màu, `C` áp vào ForeColor thay vì
BackColor, `FB/FSZ/FS/TA` (`Tools.Layout/GridDynamicColorFormat.cs:36-127`). Runtime `XGridDynamicFormatColorAction` xử lý
`FormattingRow`: màu = `Color.FromName(text)` hoặc `Color.FromArgb(int)` (`Tools.Grid/XGridDynamicFormatColorAction.cs:82-183`) [V].
Ví dụ Medcom lặp lại ở ~20 form trạng thái: `T2C1: A='StatusName', B='BackColor'` (màu lấy từ bảng `*StatusTbl.BackColor` join sẵn
trong view) [V].

### 1.6 Cột link (`GridColumnLink`, KeyID `T{n}LC1..4`)

Key (`Tools.Layout/GridColumnLink.cs:33-424`) [V]: `0` cột link; `2` form/report đích; `2A`/`2B` SQL trả tên form + para; `1`
FilterString (`EmployeeID='{0}'`); `3` mở DataEditor (FormKey); `NC1`/`NC2` nút thêm mới + cột trả về; `R` reload sau khi đóng;
`IC` hiện nút mũi tên thay vì link xanh (mặc định 1); `C1` FormMode (mặc định 9=Auto); `EM` chỉ bật khi sửa; `4` cột SourceID
(mở chứng từ theo loại); `URL` link web (`/Report/1240?EmployeeID={0}`); `5` LinkParam (rỗng = share mọi cột); `9` đóng form cha;
`LT` tiêu đề; `BT`/`BTC` text + class nút (web); `VEX` biểu thức hiện link; `D1/D2/D3` SQL + cột + nhóm cho cửa sổ DataViewer;
`D4` popup (mặc định 1); `C2`/`C3` hành động trước/sau.

Luồng `XGridLinkColumnAction.DoLinkClick` (`Tools.Grid/XGridLinkColumnAction.cs:95-560`) [V]: kiểu cột `Link`/`TextButton`/`Image`
(`:107-130`) → đẩy para vào **SharePara** (bộ nhớ dùng chung giữa form) từ cột lưới, ParamManager hoặc master (`:244-367`) →
nếu có `D1` thì chạy SQL và mở `ViewDataFrm` (`:374-406`) → chọn đích theo ưu tiên `3` (FrmMasterDetail Edit) › `2A` › `2` ›
`4` (`App.ShowFormBySourceID`) (`:408-476`) → mở modal nếu `D4`/`R`/`C3`, reload `Data.LoadData` nếu `R` (`:519-550`).
Medcom snapshot **không có** dòng `T*LC*` [V].

### 1.7 STT, mặc định từ master, mã tự sinh

- `AutoNumberSTTAction`: khi `AddingRecord` và cột STT rỗng → `RecordCount + 1` (`Tools.Grid/AutoNumberSTTAction.cs:62`) [V].
  (Không đánh lại khi xóa/sắp xếp.)
- `DefaultValueFromMasterAction`: khi lưới **nhận focus**, gán `column.DefaultValue = master[field]` cho các cột `GCM`
  (`Tools.Grid/DefaultValueFromMasterAction.cs:49-90`) [V].
- `XGridMasterLinkColumnAction` (`X50..X75`): copy/cập nhật/tính lại cột chi tiết khi cột master đổi, hoặc mặc định bằng SQL
  (`Select AccountID from IV_InputTypeTbl where InputType='{0}' and ObjectID=N'{1}'`) (`Tools.Layout/LayoutX.cs:3544-3555`) [V].
- Mặc định do người dùng tự đặt trong phiên: menu `DEFAULT_SETUP` → `GridXDefaultValueSetupFrm` gán `GridEXColumn.DefaultValue`,
  **không lưu** (`Tools/GridXContextMenu.cs:632-646`; `Tools/GridXDefaultValueSetupFrm.cs:294-364`) [V].

### 1.8 Sửa trực tiếp trên lưới

- Quyền thêm/sửa/xóa lấy từ `FormControler.Permiss` + `RDO/EDO/EDD`; trạng thái Storer (`IsNone/IsNew/IsEdit`) quyết định lưới
  có cho sửa không (`Tools/GridX.cs:2729-2790` `CheckGrid`) [V].
- **Grid action** — bảng `SY_FrmGrdActTbl(FormID, GridName, ColumnID, Action, Source, Para, TargetValue, TargetValue2, TargetColumn,
  TargetColumn2, MsgID, IsDisable, ActType, Oderby)` (52 dòng Medcom), nạp ở `Tools/FormControler.cs:8624-8648`, chạy khi cột
  `ColumnID` cập nhật (`Tools/GridX.cs:5739-5983`) [V]:
  - `Action`: `UpdateColumn`, `UpdateColumnIfEmpty` (chỉ khi cột đích đầu tiên rỗng/0), `ShowMsg`. `ActType`: chỉ `ExecSQL`
    (khác → “Action not support”).
  - `Para` tách `;`, mỗi phần là tên cột lưới, `Master.<cột>` hoặc chuỗi fallback `A>B`; số → dấu chấm thập phân, ngày →
    `yyyy-MM-dd`, rỗng ngày → `1900-01-01` (`:5607-5650`). Thay `{n}` và `{TênCột}` trong `Source`; `{GRID}` = XML cả lưới.
  - Kết quả: 1 cột → gán vào cột đích đầu tiên; nhiều cột → gán theo tên vào các cột trong `TargetColumn` có trong kết quả, rồi
    tính lại công thức; cột `Msg` (+`MsgType` 1/4 → lỗi và đưa con trỏ về ô), `MsgTooltip`, `MsgWarning`, `MsgWarningPopup`
    (bug: đọc nhầm cột `MsgWarning`, `:5961-5963`).
  - Medcom: 49 `UpdateColumn`, 2 `UpdateColumnIfEmpty`, 1 `ShowMsg`; điển hình
    `AR_InvoiceFrm grdChitiet ItemID → SY_GetItemUnitPriceStp '{0}','{1}','{2}'`, Para `Master.DocumentDate;Master.ObjectID;ItemID`,
    Target `UnitPrice;ChietKhau1;…;DiscountPercent`; lấy lô/hạn dùng
    `select top 1 Lot, ExpireDate, Quantity as StockQuantity from SY_GetBalanceItemLotEndFnc('{0}','%','{2}','%','{1}','%') where Quantity > 0 order by ItemID, ExpireDate, Lot` [V].
- **Master action** `SY_FrmMstActTbl(MaterAction, Action, Source, Para, ColumnID, … isLockScreen, ColumnIDArr)` (31 dòng) — chạy theo
  sự kiện Storer (`acAfterSaved`) hoặc khi cột master đổi (`UpdateColumn`, `BeforeUpdateColumn`) (`Tools/FormControler.cs:8649-8667`) [V];
  thuộc phạm vi tài liệu form động.
- `GridColumnAction` (khóa/ẩn/bắt buộc cột theo biểu thức): `ColumnActionEnum{IsNone=0, IsHide=1, IsLock=2, IsRequire=4}`
  (`Tools/GridColumnAction.cs:15-20`), API `GridX.SetActionColumn(column, expression, action, columns…)` (`Tools/GridX.cs:2946`) [V].
- **Phím tắt trong lưới** (`Tools/GridX.cs:5997-6411`) [V]: `F2` thêm mục danh mục cho cột dropdown, `F7` sửa mục đang chọn,
  `F3/F4` mở form chọn (cột DropSelect), `F3` (cột dropdown) mở popup tìm `frmEditX`, `Shift+F3` bảng ký tự, `F5` nạp lại mọi
  dropdown (trừ `SearchTopRecord`), `F6` tính lại công thức cột, `F9` (admin) sửa `SY_FrmDrdwTbl`.
- **Dán/cập nhật hàng loạt**: `Import_dt_Addnew` (thêm dòng từ DataTable, `:1860`), `Import_dt_Update` (khớp theo tối đa 3 cột khóa
  `Ref/Ref2/Ref3`, `:1697-1856`) — dùng cho dán clipboard/Excel (mục 6).

### 1.9 Context menu `GridXContextMenu`

Định nghĩa `Tools/GridXContextMenu.cs:215-361`, xử lý `:413-2045`, cập nhật trạng thái `:2229-2346` [V]:

| Nhóm | Lệnh (key) |
|---|---|
| Cột | `SETUP` Tùy chọn cột (`GridXColumnSetupFrm`: chọn cột hiển thị, tìm, chọn/bỏ hết, Syskey, Lockkey, Undo, Sắp lại, Tự co); `RESETLAYOUT` (thứ tự `GD2A`/vị trí gốc + autosize, `Tools/GridX.cs:7874`); `AUTOFIX`; `ALLCOLUMN` danh sách cột ẩn/hiện + `AUTOSIZE` + `ADDSELECTOR` (thêm cột chọn); `HIDECOLUMN` |
| Bố cục đặt tên | `LOADLAYOUT1..3` / `SAVELAYOUT1..3` → file `Layout\<DB>\<Form><Grid>Layout<n>.dat` (`:222-248, 2033-2044`) |
| Dữ liệu | `COPYTOCLIP` copy toàn lưới; `COPYTEXT` copy ô; `IMPORT_EXCEL` dán (Paste); `COPY` nhân bản dòng; `UpdateBatch` cập nhật hàng loạt (cột, giá trị, tăng dần), `UpdateBatchA` phân bổ giá trị, `UpdateBatchB` theo %; `Replace`; `ConvertFont` bỏ dấu; `DeleteAll`, `DeleteRow` (ẩn khi lưới báo cáo `isReportGrid`) |
| Lọc | `SORT_FILTER` lọc theo danh sách giá trị dán từ Excel/clipboard (`GridXFilterValueFrm`); `FILTER` hàng lọc (FilterRow `Automatic`); `FILTERVALUE` lọc nhanh theo giá trị ô hiện tại; `SORT_ASC/DESC/NONE` |
| Hiển thị | `GROUPBOX`, `ADDTOGROUPBOX`, `EnterKeyMode`, `SumColumns`, `WordwapColumns`, `Header2line`, `FrozenColumns`/`UnFrozenColumns`, `CARDMODE` (thẻ/lưới), `SHOWNAVI`, `ZOOM_1..4,9` (100/120/150/200/90%) |
| In/xuất | `PRINT` (ActiveReports từ lưới), `PRINT2` (Excel print preview), `EXPORT` Excel, `EXPORTPIVOT` Excel PivotTable |
| Admin | `Column2ArrayUpdateDefault` (ghi `GD2A`), `Column2ArrayUpdate` (ghi `GD2`), `Column2WidthArray` (ghi `GD2W`) vào `SY_FrmCfg` (`Tools/GridX.cs:7830-7872`); `EXPORT_SQL_FILE(3)` xuất script INSERT; `EXPORT_CAPTION` |

Quyền xuất (`KiemTraQuyenXuatDuLieuGrid`, `:2890-2926`) [V]: `LayoutX.ExportExcelPermiss` (key `EEXC`, enum
`SystemDefault=0, ManagerPermiss=2, AdminPermiss=3, Disable=5`, `Tools.Layout/LayoutX.cs:76-82, 856-860`) rồi quyền
`Permiss.ExportExcel` + tham số `isManagerNotExcel/isUserNotExcel` (`Tools.Utils/Functions.cs:254-280`). Không có quyền → menu
`COPYTOCLIP`/`EXPORT` mờ “(Không có quyền)”.

### 1.10 Xuất Excel `GridXExportExcelFrm`

`GridXContextMenu.ExportXls` ghi log `UpdateLog(form, "Export excel: N row")` rồi mở form (giữ Ctrl = xuất nhanh `.xlsx` vào
`Temp`; >60.000 dòng hỏi “Cơ bản/Đầy đủ”) (`Tools/GridXContextMenu.cs:2423-2470`) [V]. Tùy chọn (`Tools/GridXExportExcelFrm.cs:395-490`):
Excel 97 `.xls`; Excel 2003-2016 `.xlsx`; `.xlsx` có tiêu đề/header; `.xlsx` dạng bảng nhiều dữ liệu (`Excels.ExportTableToFile`);
PivotTable `.xls`; CSV `.csv` và CSV `.xls` (định dạng ngày mặc định `MM/dd/yyyy`, nhớ trong registry `Report_CSVFormat`);
“Mở file sau khi xuất”. Thư mục cuối nhớ ở registry `Report_ExportPath` (`:644, 724-764`) [V]. Engine: Janus `GridEXExporter`
+ Aspose.Cells/EPPlus/SpreadsheetGear trong `Excels` (mục 6).

### 1.11 Bố cục người dùng: `Layout\<DB>\<Form>.dat`

- **Đường dẫn**: `App.Cn.LayoutPath` = `<exe>\Layout\<DataName>` (`Tools.Data/Connector.cs:1405`) → mỗi **máy** × **database** một
  bộ file; không theo user, không lưu DB [V]. Nếu chưa có file theo DB mà có `<exe>\Layout\<Form>.dat` thì copy sang (bản mặc định
  phát hành kèm) (`Tools.Utils/Functions.cs:5676-5691`); không có file → tự co cột khi < 2.000 dòng (`:5731-5739`) [V].
- **Khi nào**: nạp trong `ApplySystemToMe` (`Tools/FormControler.cs:5319`); lưu khi đóng form nếu không hủy
  (`Tools/FormControler.cs:7708-7711`) hoặc gọi `SaveFormLayoutGrids` [V].
- **Cấu trúc** (`DataSet.WriteXml(…, WriteSchema)`, root `<Layout>` + `xs:schema` nhúng) (`Tools.Utils/Functions.cs:5138-5262`) [V]:
  - Bảng `T0` (mỗi cột một dòng, ghi theo thứ tự `Position`): `GridName` (tên control lưới; bảng con ghi `grid.ChildTableKey`),
    `ColumnName` (Key), `Width` int, `Visible` bool, `Position` int, `Sum` (`AggregateFunction`: `None`/`Sum`…), `Wrap` bool,
    `Tag` (cờ kiểu editor: `Color`, `DropCheck`, `CustomMaskInput`… — `Tools/GridX.cs:2681, 3132, 4014`).
  - Bảng `T1` (thuộc tính lưới, cặp `Name/Value`): `CardView` (`TableView`/`CardView`), `GroupBox`, `RecordNavigator`, `CardWidth`,
    `FrozenColumns`, `FilterMode` (`None`/`Automatic`), `EnterKeyMode` (`NextCell`/`NextRow`), `HeaderLines`, nhiều dòng
    `GroupColumnAsc|GroupColumnDes`, `SortAsc|SortDes`.
- **Mẫu thật** `D:\Data\Meracine-HN\KetoanDemo202609Dev\Layout\Medcom\` (68 file): `AR_InvoiceFrm.dat` 48.660 byte, 5 lưới
  (`gridEX1` 93 cột, `grdChitiet` 73, `grdHoaDon` 31, `grdTrangThai` 14, `grdDinhKhoan` 13). Trên toàn thư mục: `Sum=Sum` 186 /
  `None` 2.698; `Tag=Color` 6, `DropCheck` 3; T1 `GroupColumnAsc` 17 (BranchID, GroupName, PhongBan, YearID), `SortDes` 1 [V].
- **File `.dat` khác cùng thư mục** (cùng định dạng XML DataSet) [V]: `<Form><Grid>Layout1..3.dat` (bố cục đặt tên);
  `<Form>_filter.dat` / `_filter_d.dat` (bộ lọc nâng cao, mục 3.3); `<rpt>.dat` (lưới dữ liệu báo cáo, `Tools/ReportGridViewerCtl.cs:973-1003`);
  `<Name>.dat` của `ImportExcelFrm`/`FrmReportParaSetup` (`SaveLayoutGridSingle`, `Tools.Utils/Functions.cs:6464-6560`);
  `<User>_RecentlyList[<Lang>].dat` (menu gần đây, `Tools.SysForm/DashboardFrm.cs:913-916`). Mapping import Excel lại là
  `.txt` (mục 6).
- **Bố cục theo chứng từ**: `GridColumnSelectorButtonCtl` lưu danh sách cột hiển thị (`A;B;C;`) vào **một cột của bản ghi master**
  (key `P4`, vd. `DetailLayout`) và `UPDATE <TableMain>` ngay (`Tools/GridColumnSelectorButtonCtl.cs:83, 255-372`) [V].

---

## 2. Tra cứu, dropdown, F4

### 2.1 Bảng `SY_FrmDrdwTbl` (2.361 dòng ở Medcom)

Đọc ở `SetDropdownFromConfig` (`Tools/FormControler.cs:8422-8622`) cho cột lưới (`GridName <> ''`) và ở `:3705` cho control trên
form (`GridName = ''`, `ColumnID` = tên control, vd. `FldAssetTypeID`). Cột (schema `columns.json`) và cách dùng [V]:

| Cột | Ý nghĩa |
|---|---|
| `FormID`, `GridName`, `ColumnID` | Form; lưới (rỗng = control master); cột/control được gắn lookup |
| `Type` | rỗng/`Combo`/`Dropdown` = dropdown thường; `ValueList`/`ValueLstCb` = danh sách tĩnh trong `Source` (`String2DataTable`); `LangList` = danh sách theo chuỗi ngôn ngữ; `DropCheck` = chọn nhiều (checkbox); `DropSelect` = form chọn (F3/F4); `ColorSelct`, `ImgSelct`, `ImgColumn`, `FileSelct` = editor màu/ảnh/file |
| `Source` | SQL nguồn (đi qua `ReplaceSourceSQL`, có `{User}`…, `{0}` từ `ParaArr`) hoặc chuỗi ValueList |
| `ValueColumn`, `DisplayColumn`, `DisplayMember2` | Cột giá trị, cột hiển thị, hiển thị phụ |
| `ColumnArr`, `WidthArr` | Cột hiện trong danh sách thả xuống và độ rộng (`;`) |
| `LinkColumn` | Cột điền theo khi chọn (lấy cùng tên từ dòng nguồn) |
| `ParaArr`, `ParaRequireArr` | Para đưa vào `Source` (cột khác/Master) và para bắt buộc phải có trước khi mở |
| `ColumnName_Filter`, `ColumnValue_Filter`, `OnlyValue_Filter` | Lọc phụ thuộc (cascading): cột trong nguồn, cột trên lưới chứa giá trị lọc, giá trị cố định (`Tools/GridX.cs:3203-3226`) |
| `ReloadType` (+ `IsReload` cũ) | `OnFormLoad=0, FirstOpenDropdown=1, ParaSourceChange=2, AlwayReload=5, SearchTopRecord=6` (`Tools/ReloadTypes.cs`); `IsReload=1` mà `ReloadType=0` ⇒ 1 |
| `IsNotInList` | Cho nhập giá trị ngoài danh sách (`LimitToList = !IsNotInList`) |
| `DisableAddNew` | Tắt nút thêm mới (F2); thêm mới còn cần quyền AddNew trên form danh mục tương ứng (`GetPermissByPriKey`) |
| `IsMultiSelect`, `isMultiValue` | (DropSelect) chọn nhiều dòng; chèn nhiều dòng vào lưới |
| `ManualSQLSearch`, `ManualSQLOrderBy` | (DropSelect) tìm bằng SQL theo chữ gõ (`{s}`), không nạp trước |
| `SummaryFieldArr`, `EditableColumns` | (DropSelect) cột tổng, cột cho sửa trong form chọn |
| `GroupColumnArr`, `TreeViewColumn`, `TreeViewColumnParent`, `WordWrapArr` | Nhóm/cây/xuống dòng trong danh sách |
| `KeepValue` | Giữ giá trị cho dòng tiếp theo |
| `DefaultValue`, `DefaultValueSQL`, `EditType` | Mặc định (có `{User}`…); `EditType` = `LayoutItemX.Permission` (khóa khi mặc định không rỗng, chỉ Admin/Manager sửa…) (`:8555-8604`) |
| `Caption`, `GroupCaption`, `isLock`, `isInvisible`, `isWordWrap` | Đổi caption cột, khóa, ẩn (`:8434-8450`) |
| `IsDisable`, `TriggerOnOpenForm` | Tắt dòng cấu hình; (cờ mới, chưa thấy nơi đọc) |

Ví dụ thật (Medcom, control master): `FormID='FA_AssetListFrm', ColumnID='FldAssetTypeID', Source='Select * from FA_AssetTypeTbl',
ValueColumn='AssetTypeID', DisplayColumn='AssetTypeName', ColumnArr='AssetTypeName;YearUse', WidthArr='150;60'`; `FldUnit` từ
`CF_UnitTbl`, `IsReload=1` (`TechnicalDocs/asset-reconciliation/status-ui-20261019-resume2/after-dropdowns.json`) [V].

### 2.2 Hành vi runtime

- **Nạp**: `GridX.SetDropdown(DropName, GridColumn, ColNameArrs, ColWidthArrs, ValueList, ValueName, DisplayName, LinkColumn, …,
  ReloadType, GroupColumnArr, TreeViewColumn, TreeViewColumnParent, ConfigUserAutoID, ParaRequireArr)` (`Tools/GridX.cs:3152`) giữ
  thông tin trong `GridDropdownInfo` (`Tools/GridDropdownInfo.cs`); đa chọn `SetDropdownMultiCheck` (`:3087`); form chọn
  `SetFormSelect` (`:2890`) [V].
- **SearchTopRecord** (danh mục lớn): nếu SQL không có `{s}`, engine tự viết lại thành
  `Select top 18 * from (<select>) A where (<where gốc>) And (<col1> like N'%{s}%' or <col2> like …)` trên các cột chuỗi trong
  `ColumnArr`, hiện 15 dòng (`Tools/ComboX.cs:1536-1610`) [V]. Đây là mô hình “server-side search” cần giữ trên web.
- **Điền cột liên kết**: khi chọn, lấy `DataRowView` của mục được chọn và `SetValue` từng cột trong `LinkColumn`; giá trị rỗng →
  cột NoEdit trả về mặc định; sau đó tính công thức + phát sự kiện (`Tools/GridX.cs:7300-7380`) [V].
- **Popup tìm `frmEditX`** (F3 trên cột dropdown, hoặc DropSelect F3/F4/nút “…”): lưới + ô tìm; `ManualSQLSearch` thay `{s}` bằng chữ
  gõ và chạy lại SQL, nếu không thì lọc cục bộ `col like N'%x%'`; `isMultiValue` thêm nhiều dòng vào lưới cha; `SummaryField`,
  `EditableColumns` (`Tools/GridX.cs:5249-5330, 6288-6342`; `Tools/frmEditX.cs:1561-1690, 2112-2119, 2327, 2795`) [V].
- **ComboX** (control master): `SetList(ValueList, ValueName, DisplayName, ColNameArrs, ColWidths, ReloadType, GroupColumnArr)`
  (`Tools/ComboX.cs:1517`); phím `F2` thêm mới, `F7` sửa mục, `F3` sự kiện tìm, `F5` nạp lại, `F9` (admin) mở bảng
  `SY_FrmDrdwTbl` đã lọc theo form và đưa dòng đang dùng lên đầu (`:2199-2260`) [V]. Liên kết control khác: `SetLinkObject`
  (`:2419`).
- **ComboCheckX**: giá trị = chuỗi text `a, b, c` (`Tools/ComboCheckX.cs:394-407`); khi lọc → `(col = N'a' or col = N'b')`
  (`Tools/FormControler.cs:8164-8180`); khi truyền vào SP báo cáo `", "` → `";"` [V].
- `GridXCombo` chỉ là helper `SetDropDown(Name, ValueList, ValueName, DisplayName)` (`Tools/GridXCombo.cs:45`); `FilterDropDown`
  là struct `{ColumnName, ColumnValue, OnlyValue}` (`Tools/FilterDropDown.cs`) [V].

### 2.3 Control nhập nhanh / chọn nhiều

| Control | Key chính | Hành vi | Nguồn |
|---|---|---|---|
| `BarcodeInputCtl` | `Inx` datasource (0=master,1..=detail), `F1` SQL (`{0}`=mã quét), `F2` para (`{1},{2}…` từ form), `RL` chế độ DB, `BS` beep, `CA` cột chèn, `C2/C3` | Quét/gõ mã → chạy `F1`. `RL=1`: SQL tự insert, trả `MsgCode` (0=OK) + `Msg`, rồi reload lưới. `RL=0`: mỗi dòng kết quả → `NewRow` vào lưới (gán UserAutoID, khóa master, các cột `CA`). Âm `BeepOk.wav`/`BeepError.wav` | `Tools/BarcodeInputCtl.cs:33-137, 394-540` [V] |
| `QuickItemInputCtl` | như trên + `C1..C4` nguồn combo hàng, `RT` reload, `A2/A3` | “Nhập nhanh mã hàng vào grid chi tiết” (nguồn `vItemQuickListView`) | `Tools/QuickItemInputCtl.cs:32-208, 347, 519-650` [V] |
| `MultiDataSelectorCmdCtl` | `BT/BI/BC`, `Inx`+`DFS` hoặc `S1/S2` nguồn, `S3` cột, `S5` nhóm, `S4` chọn nhiều, `X6/X7/X7A` SQL từng dòng (`N'{Cột}'`, delay 100ms), `X1/X3` SQL một lần với `{XML}`, `NFN/NFM/NFD` mở form mới và copy master/detail, `C5/C6` kiểm tra, 9 slot para như ExecSQLWithPara | Lưới chọn → xử lý từng dòng hoặc gửi XML | `Tools/MultiDataSelectorCmdCtl.cs:37-2676, 2769` [V] |
| `DataLinkViewerCtl` | `S1` field, `S2/S3` SQL (top 50 nối `,`), `R1` field reload, `LP/LT`, `D1..D3` DataViewer, `FND/FNS/FN/FF` mở form, `RN/SP` báo cáo | Nhãn link trên form | `Tools/DataLinkViewerCtl.cs:34-273` [V] |

---

## 3. Lọc và tìm kiếm

### 3.1 Thanh tìm kiếm trên toolbar — bảng `SY_FrmFltTbl` (244 dòng Medcom)

Đọc ở `ToolBarEx` (`Tools/ToolBarEx.cs:4740`) và `SearchBarControler` (`Tools/SearchBarControler.cs:74-130`) theo
`order by KeyID, UserAutoID`. Cột [V]: `KeyID` (thứ tự), `ColumnID` (cột lọc hoặc *biểu thức chứa khoảng trắng*), `Caption`,
`ControlWidth`, `Type`, `Source`, `SourceType` (`SQL=0, ValueList=1, NotUse=9`), `ValueColumn`, `DisplayColumn`, `DisplayMember2`,
`ColumnArr`, `WidthArr`, `GroupColumnArr`, `ParaArr`, `IsSetDefaultValue` (giá trị lọc thành mặc định khi thêm mới),
`RememberLastValue`, `isLockWhenEditData`, `UseLikeOperator`, `Operator`, `WhereString` (mẫu WHERE, `{0}`/`{ColumnID}`),
`DefaultValue`, `DefaultValueSQL`, `EditType` (khóa theo quyền), `IsPrimaryKeyCombine`, `PrimaryKeyFormat`, `PrimaryKeyLen`
(ghép số chứng từ từ giá trị lọc), `IsReload`, `IsDisable`.

`Type` = `SearchControlTypes` (`Tools/SearchControlTypes.cs`) [V]: `TextBox=0, DateBox=1, NumberBox=2, ComboBox=3, ComboCheckBox=4,
CheckBox=5, RadioX=6, PeriodCombo=9, DocumentTypeCombo=10, UserControlX=11, CurrentDate=12, DateToDate=13, Quarter=14, Year=15,
ButtonExeSQL=16, TopRecordFilter=17, UserFilterCombo=18, TextBoxInDetail1=30 … ComboBoxInDetail2=53`.

`Operator` = `OperatorEnums` [V]: `EqualValue=0, LikeOperator=1, GreaterThan=2, GreaterOrEgual=3, LessThan=4, LessOrEgual=5,
NotEgual=6, UnCheckFilter_1=7, UnCheckFilter_0=8, CheckFilter_1=9, CheckFilter_0=10, None_NoAction=99`.

**Sinh WHERE** — `FormControler.BuiltFilterObject` (`Tools/FormControler.cs:7921-8294`) [V], nối các điều kiện bằng `And`:
- Text/Combo: `col = N'v'` (escape `'`), `Like` → `col like N'%v%'`, `NotEgual` → `<>`; nếu có `WhereString` thì thay `{ColumnID}`/`{0}`.
- Date: `> >= < <= <>` theo Operator; mặc định `Cast(col as date) = 'yyyy-MM-dd'` (SQL ≥2008).
- Number: chỉ khi ≠ 0, toán tử như trên. CheckBox/Radio: `= 1`, `= 0`, `<> 1` theo `CheckFilter_*`/`UnCheckFilter_*`, hoặc `WhereString` khi tích.
- ComboCheck: `( col = N'a' or col = N'b' )`. `UserFilterCombo`: chèn nguyên giá trị combo (một biểu thức WHERE dựng sẵn).
- `ColumnID` chứa khoảng trắng: là mẫu, thay `{TênCột}` bằng giá trị các cột của dòng combo đang chọn (ngày → `'yyyy-MM-dd'`,
  cột `ToDate` → `'… 23:59:59'`) (`:7941-7966`).
- **Kỳ/quý/năm/khoảng ngày** (`Tools/ToolBarEx.cs:3992-4088`): tự chọn cột `DocumentDate` › `PeriodID` › `QuarterID` › `Quy` ›
  `YearID` › `Nam`; mẫu `{table}.<col> between {FromDate} and {ToDate}` hoặc ` Year(col) = {YearID}`; `DateToDate` mặc định 7;
  không có combo kỳ thì dùng kỳ hiện tại `App.Cn.CurrentPeriod` (`Tools/FormControler.cs:7967-7978`).
- `DocumentTypeCombo`: nguồn `SY_DocumentTypeTbl where SourceID=…`, lọc `PK like '<prefix>%'` (`Tools/ToolBarEx.cs:4115-4168`;
  `Tools/FormControler.cs:7982-7995`). `TopRecordFilter`: combo số dòng tối đa (`:4092-4113`).
- Kết quả gán `Data.FilterEx2` (có requery) hoặc `FilterEx2_NoReload`; điều kiện của control có cờ “áp cho cả lần nạp không reload”
  vào `FilterEx3_NoReload` (`:8274-8293`).
- `RememberLastValue` → `HKCU\<DataName>\<Form>\<ControlName>` trong **registry** (`:8269-8272`). `IsSetDefaultValue` → giá trị
  lọc thành mặc định của cột khi thêm bản ghi (`:8232-8268`).

Ví dụ Medcom (`form_filters.json`) [V]: `AP_ApprovePurchaseRequestListFrm KeyID=001 ColumnID=BranchID Type=3 Source='Select * from CF_BranchTbl' DefaultValue='{BranchID}'`;
`AR_ChiTieuNhanVien2022Frm SaleMonth Type=3 Source='Select Distinct PeriodNo as SaleMonth from SY_Period order by PeriodNo' DefaultValueSQL='Select month(getdate())'`.
Phân bố snapshot: `Type=3` 11, rỗng 6, `11` (UserControlX) 1.

### 3.2 Lọc cố định và chi nhánh

`TableInfoX`: `FTR` Filter (người dùng đổi được qua nút lọc), `FTX` FilterEx cố định (vd. `'{BranchID}' = '' or BranchID = '{BranchID}'`),
`FTXS` SQL điều kiện áp FilterEx (vd. `SELECT 1 where '{User}' <> 'Admin'`) (`Tools.Layout/TableInfoX.cs:1232-1264`) [V].
Chi nhánh cố định: `SystemPara.isFixBranch` ẩn và gán `BranchID` (`Tools/GridX.cs:2508-2514`) [V].

### 3.3 Lọc nâng cao `FilterDialog` / `frmFilter` / `FrmFilterSetup`

- Mở từ toolbar (`FormControler.ShowFilterDialog`, `Tools/FormControler.cs:6678-6690`). Hai lưới điều kiện **master** và **detail**,
  mỗi dòng: `ID, FieldID, Operator, Value, Operator2, Value2, AndOr, DataType, STT, isVisible` (`Tools/FilterDialog.cs:368-387`) [V].
- Toán tử (`Tools/FilterDialog.cs:666-680`): `Like` (chứa), `NotLike`, `Begin`, `End`, `NoData` (rỗng), `HasData`, `=`, `>`, `>=`, `<`,
  `<=`, `<>`. Mặc định: chuỗi `Like/Like`, số/ngày `>= / <=` (khoảng), bool `=` (`:441-468`). Nút nhanh “Kỳ hiện tại/Ngày hiện tại/
  Năm hiện tại” khi có `DateFieldWhere`; lấy kỳ từ `SY_Period` (`Tools/frmFilter.cs:896-989, 1282-1320`) [V].
- Điều kiện detail chuyển thành `PK in (Select Distinct <DetailField> from (<nguồn detail> Where …) A)`; áp bộ lọc đặt `TopRecord=5000`
  nếu đang 0; không có dữ liệu → báo `NO_DATA` (`Tools/FormControler.cs:7660-7685`) [V].
- Lưu cấu hình/giá trị lọc: `Layout\<DB>\<Form>_filter.dat` và `<Form>_filter_d.dat` (`Tools/FilterDialog.cs:286`;
  `Tools/frmFilter.cs:1397-1431`) [V]. `FrmFilterSetup` = chọn cột nào xuất hiện trong lưới điều kiện (`isVisible`)
  (`Tools/frmFilter.cs:1378-1386`; `Tools/FrmFilterSetup.cs:252-297`) [V]. Tài liệu thứ cấp `FILTER_CONFIGURATION_EVIDENCE.md`
  (24 file `_filter*` ở gói Medcom; toán tử thấy `Like, =, >=, <=`) **khớp** với mã; các “UNKNOWN” của nó (cách dựng SQL) đã giải ở đây.

### 3.4 Lọc tại lưới

FilterRow Janus (`ShowGridFilterRow`, `FilterRowOnOff`, `Tools/GridX.cs:1054, 1475`), lọc theo giá trị ô (`FILTERVALUE`), lọc theo
danh sách dán (`SORT_FILTER` → `GridXFilterValueFrm`: chọn cột, tick giá trị, “Lọc giá trị từ excel hoặc clipboard”, “Xóa bỏ lọc”)
(`Tools/GridXFilterValueFrm.cs:291-362`) [V]. Đây là lọc phía client trên dữ liệu đã nạp.

### 3.5 Tham số người dùng nhập (`Params`, `ParamManager`, `ParamControler`, `Conditions`)

- `ParamManager` giữ **một DataTable một dòng** `Params`, mỗi tham số một cột (`AddParam(name, ParCtrlEnum)`, `SetValue/GetValue/
  GetValueSQL`, sự kiện `ValueChange`, `OnRequire`) (`Tools/ParamManager.cs:13-238`). `ParCtrlEnum{IsText=0, IsNumber=1, IsDate=2,
  IsList=3, IsCheck=4, IsGroup=5, IsListFree=6, Template=7, IsDateTime=8, isCheckList=9}` [V].
- `ParamControler.GetSQLWithPara(sql, "A;B")` lấy giá trị từ Storer, ParamManager hoặc ô tìm kiếm toolbar để thay `{0},{1}`
  (`Tools/ParamControler.cs:40-99`) [V].
- `Conditions` = danh sách `{Name, SQL, TaskAction}` với `ParCtrlActEnum{IsShow=1, IsHide=2, IsChangeValue=4, IsEnable=8,
  IsDisable=16, IsRequire=32}` — điều kiện hiện/ẩn/bắt buộc tham số báo cáo (`Tools/Conditions.cs`; `Tools/ParCtrlActEnum.cs`) [V].
- Định nghĩa tham số báo cáo ở `SY_RpTbl`/`SY_RpDTbl` (mục 5.3). Hộp nhập tham số chung cho nút là `FrmInputBox` (mục 4.3).

---

## 4. Nút tùy biến và hành động

Có **hai thế hệ** cấu hình nút [V]:

1. **Thanh nút tùy chọn** — bảng `SY_FrmOptBtnTbl` (91 dòng Medcom). Bản cũ `OptionBarX` chỉ hiện tối đa **5 nút**
   (`Tools/OptionBarX.cs:292-368`); bản mới nằm trong `ToolBarEx.LoadOptionBar` (`Tools/ToolBarEx.cs:4829-5178`).
2. **Control nút đặt trên layout** — các lớp `*ButtonCtl`, thuộc tính trong `SY_FrmCfg` (`LYSn`). Medcom: `ExecSQLWithParaButtonCtl`
   887 dòng thuộc tính / 49 nút, `StatusButtonCtl` 141 dòng, `PrintButtonCtl` 96 / 24 nút, `CommandButtonCtl` 35 / 4 nút,
   `AttachWebcamImageControlCtl` 106, `WebLinkViewerCtl` 42 (`form_config.json`, `configured_buttons.json`).

### 4.1 `SY_FrmOptBtnTbl`

Cột: `FormID, KeyID` (thứ tự), `GridName, Caption, Width, Action, Source, WhereStr, Para, RequireFieldArr, BeforeAction, AfterAction,
EnableStatus, ReturnMasterField, ReturnDetailField, RefTable, RefCompareField, RefCompareField2, RefDisplayField, RefDisplayField2,
MasterHiddenField, DetailHiddenField, HiddenFieldList, IsDisable, IsMultiSelect, IsRecordCompare` [V].

- `EnableStatus`: `None` (bật khi không sửa), `Add`, `Edit`, `AddOrEdit`, `All`/rỗng — bật/tắt theo trạng thái Storer
  (`Tools/OptionBarX.cs:370-451`) [V].
- Trên form danh sách (`FT_LIST`), trước khi chạy, giá trị dòng hiện tại của lưới được chép vào `Data` để `Para` đọc được
  (`Tools/ToolBarEx.cs:5066-5082`) [V].
- `Action` (`Tools/ToolBarEx.cs:5083-5178`) [V]:

| Action | Hành vi |
|---|---|
| `ExecSQL` | Hỏi “Bạn muốn <Caption>\r\n<Para1>: <giá trị>” (Có/Không) → `BeforeAction` → thay `{0}..`/`{Para}` → chạy, kết quả qua `MsgInfoAction` → `AfterAction` (`:5673-5760`, câu hỏi `:5689`) |
| `ExecSQLShowData` | Chạy SQL, hiện kết quả trong cửa sổ dữ liệu |
| `ShowPrint` | In |
| `ShowUserForm` / `ShowMultiUserForm` | Mở form tự viết (tên ở `Source`) có `ParentmFC` |
| `ShowCreateForm` | Tạo chứng từ |
| `ShowSelectList` / `ShowSelectListDetail` | Chọn danh sách (`Source` + `WhereStr` + `Para`) |
| `DataEditorFrm` | Mở `FrmMasterDetail` tên ở `Source` (phải kết thúc `Frm`) ở chế độ AddNew |
| `UserControlX` | Nạp user control động vào thanh (`:4842-4917`) |
| *khác* (vd. `ShowSelectForm`) | Mặc định: `SelectMasterDetailFrm` — master từ `Source`, detail từ `Source+"Detail"`, trả về `ReturnMasterField`/`ReturnDetailField`, so sánh số lượng đã chọn qua `RefTable/RefCompareField/RefDisplayField`, `IsRecordCompare` chặn chọn trùng dòng (`:5350-5460`) |

Medcom: `ShowSelectForm` 44, `ExecSQL` 26, `ShowUserForm` 17, `UserControlX` 2, `ShowSelectListDetail` 2; cặp trước/sau phổ biến
`SaveSkipErr/–` 43, `–/Reload` 12, `Save/Reload` 10. Ví dụ:
`AP_BPTMDueEntryFrm KeyID=991 Caption='Lưu và áp dụng nghiệp vụ' Action=ExecSQL Source="EXEC dbo.AP_BPTMUI_ApplyDueStp '{0}','{User}'" Para=UserAutoID BeforeAction=Save AfterAction=Reload` [V].

### 4.2 Key chung của các `*ButtonCtl`

| Key | Ý nghĩa | Gặp ở |
|---|---|---|
| `BT` / `BI` / `BC` | Caption / icon (tên resource, vd. `check`, `cancel`, `email16`) / màu nền ARGB | hầu hết |
| `C1` | ActionType (CommandButton, MakeDoc) hoặc FormMode (DataEditor) | |
| `C2` / `C3` | Hành động trước / sau (mục 0.1) | hầu hết |
| `C4` | SQL chính / ToSourceID / SourceSQL in | Exec, Command, Print, Email |
| `C5` | Hỏi xác nhận (Command, mặc định 1) / tên report (Print) / form (ShowForm) | |
| `CS4` / `CS5` | SQL kiểm tra trước (`MsgInfoAction`) / para | Exec, Command |
| `P1` / `P2` / `P3` | Para / tên lưới / RequireFieldArr (ExecSQLWithPara: `P3` = require) | |
| `SC` | Phím tắt F2..F12 | ShowForm, Print, Webcam |
| `BOL1` (`Confirm1`) | Hỏi “Bạn có chắc chắn thực hiện không ?” trước khi chạy | PropertyUserControlX (`Tools.Layout/PropertyUserControlX.cs:50`; `Tools/FrmInputBox.cs:1082`) |
| `LBS/LBSP/LBEX`, `PV1..PV6`, `FH/FW/PT/PL` | Khóa theo SQL/biểu thức, màu, kích thước | mọi PropertyX |

### 4.3 `ExecSQLWithParaButtonCtl` (“Hiện para để chọn, chạy SQLCommand với para truyền vào”)

Key (`Tools/ExecSQLWithParaButtonCtl.cs:36-2503`) [V]: `BT, BI, BC, P3, C2, C3, C4, CS4, CS5, C4R` (cập nhật field từ kết quả),
`HPS` (HTML cho web), và **9 slot tham số** `n=0..8` với key `{n+1}x`:

| Hậu tố | Ý nghĩa | Ví dụ key slot 1 / slot 2 |
|---|---|---|
| `1` | Kiểu control `FrmInputBox.Types`: `EditBox=0, ComboBox=1, CheckBox=2, DateBox=3, NumberX=4, MaskBox=5, RadioX=6, GridList=9, ComboBoxCheck=11, MultiselectText=12, Label=13, CheckBoxList=14` (`Tools/FrmInputBox.cs:25-39`) | `01` / `21` |
| `2` | Tên/caption para (bắt buộc để slot xuất hiện) | `02` / `22` |
| `3` / `A` / `C` | Readonly / bắt buộc / khóa nếu mặc định không rỗng | `03,0A,0C` / `23,2A,2C` |
| `4` / `4A` | Mặc định bằng SQL + para | `04,04A` |
| `5` / `5A` | Mặc định từ field master / từ ô tìm kiếm toolbar (`FldSearch<n>`) | `05,05A` |
| `6` / `6A` / `6B` | SQL nguồn combo / para / cột hiển thị | `06,06A,06B` / `26,26A,26B` |
| `7` / `8` / `9` | Value / Display / Display2 column | `07,08,09` / `27,28,29` |
| `B` | Cột điền theo (link) | `0B` / `2B` |

Luồng (`:2681-2766`, `Tools/FrmInputBox.cs:960-1110`) [V]:
1. Form danh sách: chép dòng lưới hiện tại vào `Data`; kiểm tra `P3`; ghi log “Bấm nút/Click …”.
2. `C2` → nếu có `CS4`: chạy `MsgInfoAction.ShowMsgInfoByExecSQL(mFC, CS4, CS5)`; bị chặn thì dừng.
3. Thay `{P}` (PK gốc), placeholder hệ thống, `{JSON}`, `{XML}` trong `C4`.
4. Dựng hộp `FrmInputBox` với các slot có tên; mặc định: SQL › master › toolbar.
5. OK: kiểm tra bắt buộc; thay `{0}`,`{1}`… **theo thứ tự slot hiển thị** bằng giá trị thô (ngày `yyyy-MM-dd HH:mm`, check 0/1,
   số dấu chấm); `BOL1` hỏi xác nhận; chạy trên kết nối mới timeout 3.600s; kết quả qua `MsgInfoAction.ShowMsgInfo`.
6. `C4R=1` → nạp lại field master từ cột kết quả (`DoAction_LoadValueFromDatatable`, `Tools/FormControler.cs:9420-9450`); `C3`;
   toast “Thực hiện xong”.

Ví dụ Medcom [V] (`configured_buttons.json`):
- `IV_GoodsInfoControlFrm` “Gửi PM”: slot1 `02='DocumentID'` readonly (`03=1`), bắt buộc, mặc định từ master (`05='DocumentID'`);
  slot2 `21='1'` (Combo) `22='PM'`, `26='select UserName, HoTen from SY_User where PM = 1'`, `27/28='UserName'`, `29='HoTen'`;
  slot3 `32='Ghi chú'` bắt buộc; `LBEX='StatusID NOT IN (4, 5)'`; `CS4` chặn nếu trạng thái đã đổi;
  `C4="update IV_InboundRequestTbl set StatusID = 6, SendTo = '{1}' where DocumentID = '{0}'; Insert into IV_InboundRequestLogTbl (…) Select '{0}', '{User}', 6,'{1}',N'{2}'; SELECT N'Đã gửi đề nghị' as Msg;"`, `C2=SaveContinue`, `C3=Reload`.
- `AP_ApprovePurchaseRequestListFrm` “Duyệt”: `C4="UPDATE AP_PurchaseRequestTbl SET StatusID = 3, isLock = 1, Notes = N'{0}' WHERE PurchaseRequestID = '{P}' SELECT N'Đã duyệt đề nghị' as Msg"`,
  `CS4` trả `Msg`+`MsgType=1` khi `StatusID IN (1,3)`, `C4R=1`. Cấu hình còn có `C1='ExecSQL'`, `P1='PurchaseRequestID'` nhưng
  **lớp này không đọc `C1`/`P1`** (không có trong PropertyX) → dư thừa do copy từ CommandButtonCtl [V].

### 4.4 Các nút khác

| Lớp | Key (ngoài BT/BI/BC/C2/C3) | Hành vi | Nguồn |
|---|---|---|---|
| `CommandButtonCtl` | `C1` ActionType: `ExecSQL`, `ExecSQLShowData`, `ExecSqlLoadField`, `ShowCreateForm`, `ShowPrint`, `ShowSelectList`, `ShowSelectListDetail`, `ShowUserForm`; `C5` hỏi xác nhận (mặc định 1); `C4` SQL/Form; `D5/D6` form + FormKey; `P1` para; `P2` lưới; `W3` where; `P3` require; `P4/P5` trả về master/detail; `P6..PE` so sánh chọn (như OptBtn); `MS` multi; `X1..X4` nhóm/sửa/cột/độ rộng; `X8/X9` nạp lại field sau khi chạy; `CS4/CS5` | Bản “layout” của SY_FrmOptBtnTbl. Ví dụ Medcom `AP_PurposeRequestListFrm` “Gửi đề nghị”: `C1=ExecSQL`, `C4="UPDATE AP_PurchaseRequestTbl SET StatusID = 2, isLock = 1 WHERE PurchaseRequestID = '{0}' SELECT N'Đã gửi đề nghị' as Msg"`, `P1=PurchaseRequestID`, `LBS` (SQL khóa nút)/`LBSP`, `CS4` kiểm tra trạng thái; `AR_OrderComfirmFrm` “Xem thông tin hợp đồng”: `C1=ExecSQLShowData`, `C4="AR_ContractInfoStp N'{0}'"`, `C5=0` | `Tools/CommandButtonCtl.cs:38-566, 673` [V] |
| `PrintButtonCtl` | `C4` SourceSQL (`'{0}'` từ `P1`), `C5` file report (rỗng = tên SP bỏ `Stp`), `PP` preview, `SP` hiện form tham số theo SP, `SC` | `App.ShowReport` hoặc `GetFormForReport` (mục 5). Ví dụ `AP_PurposeRequestListReportStp '{0}'`, `P1=PurchaseRequestID` | `Tools/PrintButtonCtl.cs:28-186, 431-512` [V] |
| `ShowFormButtonCtl` | `SP` hỏi; `C5` tên form; `C6/C7` SourceID cố định/cột SourceID; `P1` SharePara; `P2` alias; `SC` | Mở form theo tên/SourceID và tìm bản ghi theo SharePara | `Tools/ShowFormButtonCtl.cs:33-189, 284` [V] |
| `MakeDocBySourceIDButtonCtl` | `T1` tiêu đề; `C4` ToSourceID (PI, SI…); `C5/C6` SQL sau; `C7/C8` mở form kết quả | Đọc `<ModuleID>_DocSetup where DocType=C4`, mở `SelectCreateDataFrm` (tạo phiếu từ phiếu nguồn) | `Tools/MakeDocBySourceIDButtonCtl.cs:36-205, 388-425` [V] |
| `GridColumnClickEventButtonCtl` | `P2` lưới, `P4` cột (phải là DropSelect) | Nút thay cho bấm “…” trên cột | `Tools/GridColumnClickEventButtonCtl.cs:34-114, 209` [V] |
| `GridColumnSelectorButtonCtl` | `P2`, `P4` cột master lưu layout | Mục 1.11 | `Tools/GridColumnSelectorButtonCtl.cs:35-115` [V] |
| `DataEditorButtonCtl` | `R1/R2` require, `C1` FormMode (9=Auto), `P3` FormName, `SKY` key, `FF/LP` filter + para, `C5/C6` kiểm tra | Mở form sửa/thêm | `Tools/DataEditorButtonCtl.cs:38-248` [V] |
| `StatusButtonCtl` | `MTA/MTC/MSQ` danh sách trạng thái, `GFN/GDN/GDT` field giá trị/tên/ngày, `CDF/CDP`, `BCF/FCF/ACF` màu, `C4..C9` | Mục 7.3 | `Tools/StatusButtonCtl.cs:42-347, 848-964` [V] |
| `ApproveButtonCtl` | `AP`, `C4..C9` | Mục 7.3 | `Tools/ApproveButtonCtl.cs:34-199` [V] |
| `ImportExcelButtonCtl` / `ImportClipboardButtonCtl` | mục 6 | | |
| `EmailButtonCtl` / `WordExcelPrintButtonCtl` / `FileUploadBatchButtonCtl` | mục 5.8, 5.9, 7.1 | | |
| `WebLinkViewerCtl` / `HtmlWebButtonCtl` | `S1/S2/S3/LP/LT/LH` (URL `…?id={0}`) / `RO, HC, HS, HSP, DT, C4..C6` | Link web; HTML cho web | `Tools/WebLinkViewerCtl.cs:33-113`; `Tools/HtmlWebButtonCtl.cs:30-158` [V] |
| `UploadDataButtonCtl` | `BT, BC, C2..C4, P1` | **Stub**: kết thúc bằng `MsgBox("Test 11")` | `Tools/UploadDataButtonCtl.cs:34-118, 278` [V] |
| `Data{AddNew,Save,Delete,Reload,Close}ButtonCtl` | | Nút CRUD chuẩn đặt trên layout | `Tools/Data*ButtonCtl.cs` [V] |

---

## 5. Báo cáo

### 5.1 Pipeline tổng quát [V]

`(menu | nút In | link | code)` → xác định **tên báo cáo** `<X>Report` → SP `<X>ReportStp` → tham số từ `information_schema.parameters`
+ `SY_RpDTbl` + `SY_RpTbl` → hộp tham số `frmDialogReport` → chạy SP (`OleDbCommand`, StoredProcedure, timeout 900s) → `DataSet`
→ bảng 0 làm `DataSource` của layout `.rpx` (ActiveReports 6) / mẫu Word/Excel (Aspose) / lưới `.GRD` → xem, in, xuất, email.
File `.rpx` **không chứa SQL hay chuỗi kết nối**: hợp đồng dữ liệu là **tên cột của SP** (`DataField`).

### 5.2 Định vị file và kho mẫu

- `ReportPath = <exe>\reports\` (`[ERP.NET] ERP/LoginFrm.cs:2073`), không chia theo DB. File = mẫu chọn hoặc tên báo cáo, tự thêm
  `.rpx` (`Tools/ReportViewerFrm.cs:2330-2334, 7678-7681`). Phần mở rộng quyết định engine: `.GRD` lưới, `.doc/.docx/.dot` Word,
  `.xlt/.xls/.xlsx` Excel, còn lại ActiveReports (`:88-95, 2335, 2767-2780`) [V].
- **Kho phiên bản trên DB `SY_RpFTbl(UserAutoID, FileName, FileDate, Title, Notes, FileContent image)`** (2.441 dòng Medcom): trước khi
  mở, `DownloadTemplateFileFromServer` lấy bản mới nhất theo `FileName`; nếu ngày khác file cục bộ thì sao lưu
  `BackupLast\<name>_yyyy-MM-dd.ext`, tải về, đặt lại ngày file; chế độ admin hỏi “Cập nhật | So sánh | Bỏ qua”
  (`Tools.Utils/Functions.cs:10314-10410`). Mỗi lần upload chèn dòng mới (lịch sử nối dài) (`Tools/DesignerForm.cs:1921-2017`) [V].
- Mẫu hệ thống: `TemplateReport.rpx`, `TemplateSubReport.rpx`, `TemplateCrossTabReport.rpx`, `TempReport.rpx` (in từ lưới).

### 5.3 Ràng buộc báo cáo với menu/form/nút

| Lối vào | Quy tắc | Nguồn |
|---|---|---|
| Menu | Tên form kết thúc `REPORT` (≥ 8 ký tự) → `GetFormForReport`; SP = tên + `Stp`; tiêu đề từ `<ModuleID>_Menu`; admin+Ctrl tự sinh SP khung | `Tools/App.cs:662, 942-1083` (`:949-958`) [V] |
| Nút In trên chứng từ | `AR_InvoiceFrm` → `AR_InvoiceReport` (bỏ `Frm`, thêm `Report`; ghi đè bằng toolbar key `BPRN`); SP nhận `@Template` + `@<PK> nvarchar(max)` = danh sách ID `;` (tách bằng `SY_String2TableFnc`) — in **nhiều chứng từ** một lần, danh sách mặc định = các dòng đang hiện trên lưới | `Tools/FormControler.cs:6864-7075`; `Tools.Layout/ToolBarSetting.cs:175-182` [V] |
| Code cũ | `mFC.SetReport(file, title, "X_ReportStp '{DocumentID}'", "DocumentID")` | `Tools/FormControler.cs:6734-6741, 7100-7154` [V] |
| `PrintButtonCtl`, link, dashboard | `App.ShowReport(name, DataTable|SQL, …)` | `Tools/App.cs:895-940` [V] |

### 5.4 Tham số

- `SY_RpDTbl(RpName, PName, isSub, isReq, DefaultValueVN/EN, DefaultSQL, SourceType, SourceNew, Width, Height, Caption, isMultiSelect,
  ParaArr, EditType, LockExpression, LockExpressionSQL, UserType, Link)` (2.231 dòng) — theo từng báo cáo
  (`Tools.Utils/Functions.cs:7458-7560`). `PName='Template'`: `DefaultValueVN` = `"file1;Tên 1;file2;Tên 2"`; `UInput1..6`: người ký.
- `SY_RpTbl(ParaName, VN, Type, W, H, ValueList, ValueMember, DisplayMember, DisplayMember2, ColArr, WidthArr, LinkColumn, GroupColumnArr,
  ArrangeEnum, WUnit, L, T, ShowComboButton, isMultiSelect, isManualSearch, IsReload, RequireCondition, ActionEnum)` (50 dòng) — danh mục
  tham số toàn cục theo tên (`Tools/App.cs:1639-1748`; trình sửa `Tools/FrmReportParaSetup.cs:816-860`, `SourceType` = `Auto;Textbox;
  Dropdown;DropSelect;ValueList`, `Type` theo `ParCtrlEnum`) [V].
- Tham số đặc biệt tự xử lý: `@TEMPLATE @STATUS @PERIODID @FROMPERIODID @TOPERIODID @YEAR @MONTH @FROMDATE @TODATE @DATE @REPORTDATE
  @BRANCHID @USER @USERNAME @COMPUTER` (`Tools/App.cs:1224-1635`); `DefaultSQL` có `{MenuPara} {Para} {OtherParam}`; khóa bằng
  `LockExpression(SQL)`/`EditType` (`:1160-1223`). Giá trị từ form gọi: `@<PK>` = ID hiện tại, mặc định `{Column}` = cột dòng hiện tại,
  SharePara (`FromDate/ToDate` được chia sẻ lại sau mỗi lần chạy) (`Tools/ReportViewerFrm.cs:2519-2523`) [V].
- Hộp `frmDialogReport` (OK: kiểm `FromDate <= ToDate`; kiểu chạy 0 báo cáo, 1 lưới dữ liệu, 9 in nhanh, 10 email; số bản `FldCopy`
  1–99 cho in nhanh; máy in mặc định `CboPrinterDefault` lưu registry `<Report>_Printer`) (`Tools/ReportViewerFrm.cs:4598-4753`;
  `Tools/frmDialogReport.cs:898-1085`) [V].
- Chọn mẫu: combo `cbTemplate`; nhớ lựa chọn trong registry `<Name>\Template`; nếu kết quả SP có cột `Template` thì giá trị dòng đầu
  ghi đè (`Tools/ReportViewerFrm.cs:2517, 2621-2649, 7608-7676`) [V].
- Admin mở báo cáo → tự chèn dòng `SY_RpDTbl` còn thiếu (`Tools/App.cs:1156-1159`) [V].

### 5.5 Dữ liệu và kết quả nhiều bảng

`LoadData` (`Tools/ReportViewerFrm.cs:2287-2704`) [V]: không tham số → chạy SQL thô; có → SP theo thứ tự `ParamManager.Params`
(ngày năm 1 → NULL, đa chọn `", "`→`";"`, Template bỏ đuôi). ≥ 2.000 dòng: hiện trước 150 dòng rồi nạp nền (`:3523-3643`).
Bảng kết quả thứ 2 có cột `Msg`,`Type` → `Type=1` popup, `>1` chặn, không hiện báo cáo (`:2669-2683`). Timeout/deadlock → đề nghị
“thử lại/cập nhật thống kê” (`:2573-2611`). **Subreport**: file `<tên control Subreport>.rpx`, dữ liệu = bảng kế tiếp trong DataSet (chỉ số
tăng dần), `Tag="Filter:<Col>"` lọc theo nhóm hiện tại; Tag dài = `ReportPropertyX` chạy SQL riêng (`:3810-3934`).

### 5.6 Cấu trúc `.rpx` (mẫu `D:\Data\Meracine-HN\KetoanDemo202609Dev\Reports\`)

- 776 `.rpx` ở gốc (+ 7 `.doc`, 5 `.docx`, 4 `.xlt`, 2 `.xls`; `BackupRpt\` 82, `BackupLast\` 19). Đặt tên `<Module>_<Tên>Report.rpx`
  (733 file; AR 218, GJ 103, CS 93, IV 78, AP 40, HR 35…); còn lại là subreport (`*_SubReport_NNN`, `*PhanNN`, `*Sub`) và mẫu hệ thống [V].
- XML UTF-8 BOM (130 file có NUL thừa sau thẻ đóng): `<ActiveReportsLayout Version="3.1" PrintWidth DocumentName ScriptLang="C#|VB.NET"
  MasterReport="0">` (C# 697, VB.NET 79) → `<StyleSheet>`, `<Sections>`, `<Script><![CDATA[…]]>` (135 file), `<ReportComponentTray/>`,
  `<PageSettings … PaperSize="9" Orientation="1|2"/>` (A4; 1=dọc, 2=ngang [S] mạnh), `<Watermark3>` (6 file), `<Parameters/>` **luôn rỗng**,
  **không có DataSource** [V] (tự kiểm: `CS_ReceiptReport.rpx` 0 lần `DataSource/ConnectionString`).
- Section: ReportHeader/PageHeader/Detail/PageFooter/ReportFooter mọi file; GroupHeader/Footer ở 570 file. Control: `AR.Label` 14.255,
  `AR.Field` 13.058 (`DataField="Cột"` 12.240), `AR.Image` 93, `AR.Line` 50, `AR.Subreport` 31, `AR.CheckBox` 21, `AR.ReportInfo` 13,
  `AR.Barcode` 9, `AR.ChartControl` 1; tổng dùng `SummaryType` (1 tổng cuối, 4 số trang). Script là sự kiện section (`*_Format`,
  `*_BeforePrint`) dùng `rpt.Fields[…]`, `rpt.Sections[…]` [V].
- Ví dụ `CS_ReceiptReport.rpx` (phiếu thu) [V]: ReportHeader/PageHeader ẩn; `GroupHeader1 DataField="DocumentID" NewPage="1"` (mỗi
  phiếu một trang → in nhiều phiếu); control `SysCom1/2` (tên công ty), `aaaTitle`←`Title`, `SoChungTu`←`DocumentID`,
  `DATETIMEREPORT_01`←`DocumentDate` (“Ngày {D} tháng {M} năm {Y}”), `NguoiNopTien`←`Payor`, `DiaChi`←`Address`,
  `LyDoThanhToan`←`Memo`, `CountNumber1` trên `BaseTotal` (số tiền bằng chữ), `Uinput1-4` (người ký). `AR_BBThayTheReport.rpx`: subreport
  ở GroupFooter, script C# lọc lại `DataSource` subreport theo `DocumentID`.
- **Quy ước theo tên control** mà viewer xử lý (phải tái hiện) (`Tools/ReportViewerFrm.cs:2967-3315, 5935-6177`) [V]: `SysCom1-3`
  (dòng công ty), `sys*` (tham số hệ thống: `sysSignatureName1`, `sysThuTruong`…), `SYSLOGO*`, `IMG*` (`Images\<giá trị>.jpg`),
  `UINPUT1..6`, `COUNTNUMBER*` (bằng chữ, Tag `x;VND;VN;Abs`), `DATETIMEREPORT*` (`{D} {M} {Y} {YY} {longdate}`), `LNG*` (caption ngôn
  ngữ), `SUB*` (phụ đề), `PAR*` (caption tham số), `DAY*`, `SORTBY/NOSORT`, section `Tag="AutoGrow"` / `"VisibleExp:<expr>"`,
  crosstab `txtRowKeyCrossTab`, `txtColumnTopLevelCrossTab`, `txtSumFieldNameCrossTab`… (`clsPivotReport` tự pivot DataTable,
  `FncPivots{Sum, Max}`), `ReportPropertyX` (base64 UTF-16 XML trong `Tag`/`UserData`, key `01` SQL, `02` para, `20-36` tính toán/biểu
  đồ/bằng chữ, `40` hiển thị, `SZ`, `SP`) (`Tools.Layout/ReportPropertyX.cs:359-438`). Caption đa ngôn ngữ trong `SY_FrmCtrTbl`
  (`FormID=<rpt>`, `ParentCtlName="<Section>;<Control>"`) (`Tools/ReportViewerFrm.cs:2706-2732`).

### 5.7 In, xuất, email

- Xuất từ viewer (`Tools/ReportViewerFrm.cs:1970-1995, 7024-7924`) [V]: PDF (AR `PdfExport`), Excel (AR `XlsExport`, merge/không merge,
  >60k dòng gợi ý bảng thô), “Excel 2016” (chuyển đổi), Excel dạng bảng từ DataTable, Excel PivotTable (COM), Word (= AR `RtfExport`
  đặt đuôi `.doc`). `ReportExportFrm` thêm XML, Text, HTML, RTF, “mở sau khi xuất” (`Tools/ReportExportFrm.cs:431-650, 1033-1103`).
  Form `<Report>_Export` nếu tồn tại thay chức năng xuất mặc định (`:4954-4970`). Tên file xuất theo `EWC/EWCT`.
- In: hộp in AR; in nhanh `PrintOut(printer, copies)` 1–99, ghi log; lỗi máy in → ghi `Printer Error` và in máy mặc định
  (`:3400-3437, 3941-4001`). Sau khi in/xuất từ chứng từ: tăng `LanIn`/`PrintCount`; nếu `Permiss.AutoLock` thì `isLock=1`
  (`Tools/FormControler.cs:6743-6862`) [V].
- Email (`Tools/ReportViewerFrm.cs:7926-8156`) [V]: mã `01` PDF, `02/02A` Excel, `03` Word, `04/04A` PDF + thân HTML/ảnh, `05/05A`
  chỉ thân, `06/08` Outlook, `07` mặc định, `09` gửi hàng loạt. Người nhận = cột đầu tiên có tên chứa `EMAIL`, hoặc
  `CF_ObjectTbl.Email` theo `ObjectID`. Cấu hình SMTP `SY_EmlSetupTbl` (key `ReportEmail_<User>`; không chép thông tin xác thực).
  Sau gửi: `ESE` (SQL) / `RMA` (reload). Gửi hàng loạt `ReportBatchEmailFrm`: cần cột `ObjectID|MaKhachHang`, `ObjectName|TenKhachHang`,
  `Email`; mỗi khách được tick → lọc `DefaultView` → PDF `Temp\<id>_<ms>.pdf` → gửi SMTP (`EmailSleepTime`) hoặc Outlook Outbox
  (`Tools/ReportBatchEmailFrm.cs:364-648`).

### 5.8 Mẫu Word/Excel

- Thư viện **Aspose.Words/Aspose.Cells** (kích hoạt bằng `AsposeActivate.ModifyInMemory.ActivateMemoryPatching()` — vá giấy phép trong bộ
  nhớ) (`Tools/ReportViewerFrm.cs:4040-4132`; `Tools/Excels.cs:314`) [V]; `WordX` dùng Word COM nhưng chỉ tham chiếu nội bộ → **[S]** mã chết.
- Placeholder trộn (`O0C57MdGjVi0xwFQRq/KGRi8H29eafSQjbfen.cs:44-309`) [V]: `{Cột}`, ngày `{Cột:DD} {Cột:MM} {Cột:YY} {Cột:YYYY}`, số
  `{Cột:VND} {Cột:USD}` (bằng chữ) `{Cột:N0..N2}`; **chỉ dòng đầu**; nguồn = SQL phụ `S1/S2`, form, DataTable báo cáo, tham số, hệ thống.
  Bảng chi tiết: 20 trường `Field01..20` (`WordFieldInfoX`, `FT` = `Auto=1, TableFromDataList=3, TableFromDetail=4..8, TableFromSQLCommand=9,
  NumberToWord=10, QR_Code_Image=12, ImageFromSQLCmd=14`) — đoạn `{WordFieldName}` được thay bằng **bảng Word sinh ra** (header, dòng, tổng);
  Excel chưa hỗ trợ bảng (`Tools.Layout/WordFieldInfoX.cs:18-31`; `Tools.Layout/AttachWordLayoutX.cs:466-469`).
- `WordExcelPrintButtonCtl`: mẫu lưu nhị phân trong bảng tùy ý `S1` (vd. `AA_TableAttachTbl`), cột `S5` FileName, `S6` Content, `S7` STT, `S8`
  UserAutoID, lọc `S2/S3` → tải về `Temp\` → `AttachWordEditor2018Frm` chế độ `ViewMergerData` (`Tools/WordExcelPrintButtonCtl.cs:95-200, 422-481`).
  `AttachWordX`: danh sách mẫu trong `SY_FrmCfg` (`FID=<Form>_<Control>`, `KeyID='Template'`, `KeyValue`=file, `SubValue`=tên), file ở
  `Reports\`, đồng bộ `SY_RpFTbl` (`Tools/AttachWordX.cs:716-822`) [V].

### 5.9 In từ lưới, pivot, thiết kế

- `GridX.PrintPreview`: có `skin2.res` → Aspose workbook + `ReportFromGridToExcelPrintFrm`; không → `ReportFromGrid.MakeReportFromGrid` sinh
  layout AR bằng code (`SysCom1-4`, tiêu đề, `Caption_*`, `FieldName_*`, nhóm, tổng), lưu `TempReport.rpx`, in các dòng đang hiện
  (`Tools/GridX.cs:1325-1352`; `Tools/ReportFromGrid.cs:131-623`). Tùy chọn font/cỡ/khổ lưu **registry** `ReportFromGridSetting_<Title>_*`
  (`Tools/ReportFromGridSettingFrm.cs:665-728`) [V].
- Lưới dữ liệu báo cáo `ReportGridViewerCtl`: cấu hình `ReportSettingLayoutX` trong `SY_FrmCfg` (`FID=<rpt>`, `<rpt>_Data2..9`), pivot lưới
  `PV1..PVB`, quyền sửa mẫu `EPER` (`EditReports` = AllUser/Manager/Admin) (`Tools.Layout/ReportSettingLayoutX.cs:108-120, 220-451, 1428-1532`) [V].
- Thiết kế tại chỗ: designer ActiveReports 6 (`Tools/DesinerToolAR.cs:11-197`), sao lưu `BackupRpt\<name> ( <DB> Backup ) <time>.rpx`, Ctrl+W
  “Lưu & upload” lên `SY_RpFTbl` (`Tools/DesignerForm.cs:1877-2017`) [V].
- Quyền/ghi log: xuất cần `Permiss.ExportExcel`; `HCA` ẩn cột tiền; log `<ModuleID>_UserLogDetail` cho xem/in/xuất/email/sửa
  (`Tools.Data/Connector.cs:2158-2176`). `GetFormForReport` gán quyền theo báo cáo rồi ghi đè bằng quyền hiện tại (`Tools/App.cs:1014` vs `:1076`)
  → **[S]** lỗi.
- Đối chiếu `RPX_STRUCTURAL_EVIDENCE.md` (gói Medcom 786 file): khớp về tỷ lệ C#/VB, 31 subreport, NUL thừa, Tag base64; **sai/thiếu**: coi
  quy ước tên `<X>Report → <X>ReportStp` là không suy được (thực tế là hợp đồng runtime), không nêu `<Parameters/>` rỗng / không DataSource,
  subreport resolve theo **Name** control, kho `SY_RpFTbl`, bảng `Msg/Type`.

---

## 6. Nhập/xuất dữ liệu

- **Lối vào** [V]: `ImportExcelButtonCtl` (key `BT, BI, P2` lưới, `C2/C3`, `BL` bulk copy, `B2T` bảng đích bulk, `BCDN/BCDV` cột/giá trị mặc
  định bulk, `SB/SO` SQL trước/sau — không đọc `C1/C4/CS4/P1`) (`Tools/ImportExcelButtonCtl.cs:37-196, 315-417`); lệnh toolbar `IMPORTEXCEL`:
  form danh sách → dán clipboard; có form tự viết `<X>_ImportFrm` thì mở; không có cấu hình `<Form>_ImportExcel` thì hỏi “Đơn giản|Nâng cao”
  (`Tools/ToolBarEx.cs:2499-2540`); `ImportClipboardButtonCtl` (`BT, BI, P2, C2, C3`).
- **Đọc Excel** bằng **EPPlus** (`License.SetNonCommercialPersonal("Test")`) — sheet `Sheet1..9`, dòng tiêu đề “Không có tiêu đề”/`Dòng 1..20`,
  xem trước 5.000 dòng; chuyển kiểu `ConvertText` (OADate, vi-VN, invariant, bool `1/-1/TRUE/X`), lỗi ô → “Tiếp|Tiếp tất cả|Ngừng”, bỏ dòng
  rỗng (`Tools/Excels.cs:1144-1263, 1492-1600`; `Tools/ImportDataMapColumnFrm.cs:818-870, 1110`). Bộ lọc file cho `.xls` nhưng EPPlus không đọc
  được `.xls` nhị phân → **[S]** lỗi “Lỗi đọc file Excel”.
- **Ghép cột** `ImportDataMapColumnFrm`: lưới `ExcelPos, ExcelColumn, DataColumn, SampleColumn`; tự ghép theo caption **bỏ dấu**, phần còn lại
  theo thứ tự; “*** Bỏ qua ***”; lưu mapping ở **file** `Layout\<DB>\<SettingName><độ dài các tiêu đề>.txt` dòng `index;ExcelHeader;DataColumn`
  (`:1153-1297, 1804-1866`); ô lỗi tô đỏ “Có N ô lỗi” (`:1457-1525`). Ghi vào lưới rồi lưu bằng Save thường; hoặc `SqlBulkCopy` (batch 2.000,
  timeout 1.800s, **không transaction**) (`Tools/Db.cs:488-514`) [V]. Không có chức năng tải file mẫu [V].
- **Import nâng cao** `Tools.SysForm/ImportExcelFrm.cs` (dữ liệu **dán từ clipboard** vào lưới): cấu hình `SY_FrmCfg FID='<Form>_ImportExcel'`
  (`ImportExcelLayoutX`: `C1, DN, SBC, M1` bảng master, `M2` cột chèn, `CD0` PK (mặc định `DocumentID`), `DFP` cột ngày trong kỳ, `FEX`,
  `S1..S4/X2..X4` SQL sau; `T1..T3` bảng detail (`ImportTableInfoX`: `T1` bảng, `T2` cột, `T3/T5` SQL kiểm trùng, `T4` bỏ qua null); 20 trường
  `F1..FK` (`ImportFieldInfoX`: `FN, DV, FC, MC1` fill-down, `CSF`, `EXP/EXR` biểu thức, `FR` bắt buộc, `LV/L2V/L41V` tra mã bằng SQL, `L3V/L8V`
  chèn danh mục mới với mã tự sinh, `CV` SQL kiểm tra)) (`Tools.Layout/ImportExcelLayoutX.cs:87-772`; `ImportTableInfoX.cs:33-93`;
  `ImportFieldInfoX.cs:35-425`). Kiểm tra: ngày trong `SY_Period`, PK **chưa tồn tại**, độ dài, `CV` (`ImportExcelFrm.cs:1624-1787`); `ChkAutoReplace`
  đổi PK trùng thành `PK_1, PK_2`. **Chỉ INSERT**, câu lệnh literal từng dòng, **không transaction**; `ImportData()` luôn trả false nên thông báo
  lỗi không bao giờ hiện (`:2108-2117, 2293`) [V].
- **Dán clipboard** (`Functions.GetClipboardDt`, ưu tiên định dạng “XML Spreadsheet”, rồi TAB/xuống dòng) → `ClipboardDataFrm`: thay tên bằng mã
  theo dropdown (`ValueMember` hoặc `DisplayMember`), ô không khớp `LimitToList` tô đỏ, bỏ qua dropdown > 10.000 dòng; “Thêm mới” hoặc “Cập nhật
  vào dữ liệu hiện tại” theo ≤3 khóa (`Tools/ClipboardDataFrm.cs:652-957`; `Tools/GridX.cs:1697-1856`) [V].
- `ImportExportData` là sao lưu/khôi phục nhóm bảng (XML+Deflate, upsert theo PK, `NOCHECK CONSTRAINT`), không phải Excel
  (`Tools/ImportExportData.cs:120-802`) [V]. `ExcelGridCtl` nhúng bảng tính SpreadsheetGear lưu ở bảng `<Table>_ExcelTbl(UserAutoID, MasterKeyID, Content)`
  (`Tools/ExcelGridCtl.cs:47-1006`) [V].
- Medcom snapshot: không có `ImportExcelButtonCtl`/`*_ImportExcel` (snapshot thiếu 2/3 `SY_FrmCfg` nên chưa kết luận) [V].

---

## 7. Đính kèm, tiện ích, duyệt, dashboard

### 7.1 Đính kèm và tiện ích

- **Lưu trong DB**, bảng quy ước `<TableMain bỏ "Tbl">AttachTbl(UserAutoID PK, <PK cha>, FileName, FileType, STT, Content image, Content2 image
  (thumbnail), FileSize, Base64Content, Base64Content2)` với FK cascade tới bảng cha; admin tự tạo DDL (`Tools/AttachFileX.cs:462-546`) [V].
  `Base64*` → **[S]** phục vụ bản web. Medcom có `AR_OrderAttachTbl` (1 dòng), `IV_InboundRequestAttachTbl` (11) [V].
- `STT` = ô đính kèm: lẻ 1,3,5 file; chẵn 2,4,6 ảnh; 20–30 Word/Excel (`Tools/AttachFileControlCtl.cs:178`; `AttachImageControlCtl.cs:249`) [V].
  Giới hạn `MFS` KB (mặc định 10.240; ảnh 5.120), ảnh resize `IS` (640/1024) + thumbnail `SIS` (150–240); nguồn ảnh “Chọn ảnh|Web cam|Clipboard”
  (`Tools/AttachFileX.cs:317-360, 816-968`). Bug: vượt dung lượng → NullReference (`:860-864`) [V].
- Control: `AttachFileControlCtl` (`STT, BTA/BTV/BTD, MFS, DEA`), `AttachImageControlCtl` (+`ITN, IOV, SIS, IS, UCO`),
  `AttachWebcamImageControlCtl` (`STT, BTA, SC, ITN, IOV, SIS` — **dùng ở Medcom** 53 control, vd. `AR_OrderComfirmFrm BTA='Ảnh chụp hư hỏng', STT='2'`),
  `AttachWebcamImageGridControlCtl` (ảnh vào cột lưới), `FileUploadBatchButtonCtl` (tên file = PK cha), `AttachWordControlCtl`
  (`P1/P2/P3` = `EditPermission{None=0, AllUser=1, Owner=3, Manager=7, Admin=9}`) [V]. Webcam dùng SDK thương mại **Datastead VideoGrabber**
  hoặc chụp IP camera qua HTTP (URL lưu registry) (`Tools/WebCamCaptureFrm.cs:17, 793, 1494-1518`) [V].
- `HtmlEditorX` = WebBrowser design mode (`DocumentText/BodyInnerHtml`); `RichTextBoxX` = RTF; `DownLoadFileFrm` = tải URL (cập nhật/backup);
  `SelectFileUploadServerTestFrm` thực ra là hộp cấu hình kết nối SQL (`Tools/HtmlEditorX.cs:24, 835-891`; `Tools/SelectFileUploadServerTestFrm.cs:255-369`) [V].
- **Email**: `EmailManager` dùng `System.Net.Mail.SmtpClient`, cấu hình bảng `SY_EmlSetupTbl` theo `KeyID` (máy chủ, cổng mặc định 25, SSL, người
  gửi, tiêu đề/đầu/cuối thư; mật khẩu mã hóa — không chép), đoán Gmail/Yahoo nếu thiếu máy chủ; Outlook qua COM
  (`Tools/EmailManager.cs:85-282`; `Tools/OutlookEmail.cs:51-101`). `EmailButtonCtl`: `SP, ES/EP` tiêu đề + para, `C4/P1` SQL nội dung (nhiều
  result set, `TD` → bảng HTML), `C5/P2` text `{0}`, `EK` key cấu hình chung (`Tools/EmailButtonCtl.cs:32-475`) [V].

### 7.2 Duyệt chứng từ — năm cơ chế song song

| # | Cơ chế | Lưu trữ | Medcom |
|---|---|---|---|
| 1 | Duyệt 5 cấp `SY_ApproveDocumentFrm` | `SY_ApproveSetupTbl` (theo `SourceID`: `UserLevel1..5` user **hoặc** nhóm, `UserCaption/UserRole1..5`, `isLevelEnd4/5`, `ToApproveID`, `Notifier*`), `SY_ApproveDocumentTbl` (`isApprove1..5`: NULL chưa duyệt, 1 duyệt, 0 không duyệt, 2 đang xem; `ApproveDate/Note1..5`, `isFinish`), `SY_ApproveCountTbl`, view `SY_ApproveUserView` | **Không dùng** (cả 3 bảng 0 dòng) |
| 2 | Khóa/mở một cấp `SY_ApproveDocumentOneLevelFrm` | `<TableMain>.IsLock`, quyền `LockDoc/UnLockDoc` | [S] có dùng qua toolbar |
| 3 | `ApproveButtonCtl` | `<T>StatusTbl` / `<T>StatusUserTbl` (người duyệt theo trạng thái, `LimitAmount`) / `<T>StatusLogTbl`, cột `StatusID` | Không dùng |
| 4 | `StatusButtonCtl` | `UPDATE <TableMain> SET <GFN>=…, <GDN>=…, <GDT>=getdate()` | **Có** (141 dòng thuộc tính) |
| 5 | `ExecSQLWithParaButtonCtl`/`CommandButtonCtl` + SP chuyển trạng thái + `*LogTbl` | bảng trạng thái theo nghiệp vụ | **Có — cơ chế duyệt thật** |

Chi tiết [V]:
- (1) Ai được duyệt cấp N: login = `UserLevelN` **hoặc** thuộc nhóm `UserLevelN` (`Tools/SY_ApproveDocumentFrm.cs:2636-2644`); thứ tự cấp **không bị ép**;
  bất kỳ cấp nào có `ApproveDate` → `UPDATE <TableMain> SET IsLock = 1` (kể cả *không duyệt* → vẫn khóa) (`:2720-2786`); không gửi thông báo, không gọi SP.
  Mở từ toolbar khi form có `SourceID` và có cấu hình (`Tools/ToolBarX.cs:1357-1410`).
- (3) Bước kế = `min(StatusID) > hiện tại`; phải là `Approver` của trạng thái hiện tại hoặc trạng thái `isOverApprove` (duyệt vượt cấp); thêm lựa chọn
  “Trả lại”/“Không duyệt” (`isReturnStatus/isRejectStatus`); chặn sửa/xóa khi `StatusID > 0` và `isEditDocument = 0`; bug: `SQLBeforeCheck` bị ghi đè
  (`Tools/ApproveButtonCtl.cs:466-706, 545-547`).
- (4) Ví dụ `AR_OrderComfirmFrm StatusButtonCtl: MSQ='select * from AR_OrderStatusTbl', GFN='StatusID', GDN='StatusName', CDF='StatusName',
  BCF='BackColor', FCF='ForeColor', ACF='StatusName'`; chỉ cần quyền Edit, không có cấp/duyệt viên (`Tools/StatusButtonCtl.cs:848-964`).
- (5) Ví dụ `IV_ReturnRequest_ApproveFrm` “Phê duyệt”: `C4="EXEC dbo.IV_ReturnRequestTransitionStp N'{0}', 'APPROVE', '{User}', N'{1}'"`,
  `CS4` chặn khi `StatusID <> 8`, `LBEX='StatusID <> 8'`; `IV_InternalTransferSAFrm` “Gửi Kế toán”: `C4="IV_InternalTransfer_BatchSAApproveStp '{0}','{User}',N'{1}'"`,
  `CS4="IV_InternalTransfer_BatchCheckBeforeUpdateStp '{0}','40,41'"`. Bảng trạng thái có cờ (`purchase_status` 1 Nháp…5 Đã gửi đặt hàng;
  `transfer_batch_status` có `StatusCode, SortOrder, IsReject, IsActive`) và log (`IV_InboundRequestLogTbl`, `IV_ReturnRequestLogTbl`, `AR_OrderLogTbl`…).

### 7.3 Dashboard, thông báo, popup

- `DashboardFrm`: SP `<ModuleID>_UpdateDshBrdStp '<user>', 0|1` (1 = “Tính lại”) trên kết nối riêng, nền, timeout 180s; làm mới sau 2s rồi mỗi
  `DashboardTime` phút (mặc định 15) (`Tools.SysForm/DashboardFrm.cs:892, 1253-1355`). Một bảng kết quả → một widget lưới; nhiều bảng → mỗi bảng một
  widget, tên từ cột `SYSNAME_<x>`, kiểu `Grid/Chart/Text` (Chart/Text là control stub ~60 dòng → **[S]** không có biểu đồ thật), cờ bố cục
  `sysWidthFull/Auto/1X/2X`, `sysHeight2X/3X`, màu dòng `sysBackColor/sysColor/sysForeColor`, `sysWarning/sysAlert`; click tiêu đề mở form `sysLink`,
  double-click dòng mở form ở cột `Action` với mọi cột + `FromDate/ToDate` làm SharePara [V]. Bảng `SY_DshBrd(KeyID, KeyName, ItemName, GiaTri,
  GiaTri2, Notes, Orderby, Action, IsWanrning, …)` khớp cột hiển thị [S].
- `WA_DashboardFrm` quản trị **bản web hiện có**: bảng `WA_Dashboard(STT, StoreName, UserGroupID, isDesktop, isMobile, Template, isDisable…)`
  (SP theo nhóm user, vd. `WA_Dashboard_AdminStp`, `_ChartStp`), `WA_Menu` (`NotifyIconSQLCmd`…), `SY_APICfg`, khóa `SY_Setup` (`DashboardTemplate`…)
  (`Tools.SysForm/WA_DashboardFrm.cs:1598-1793`) [V].
- `NotifyMonitor`: poll `SY_NotifyCheckStp @id, @u` mỗi 15s (tối thiểu 10s), `Application Name=ERP.Notify`, con trỏ theo `ID`; SP đọc
  `SY_NotifyMsgTbl(ID, FromUserID, ToUserID, Title, Message, NotifyType, ColorHex, ERPFormName, WebFormName, WebRoute, DocumentID, StatusID, IsView,
  ShowERP, ShowWeb, ExpireAt, EventKey…)`; MainFrm hiện balloon 3s, click mở `SY_NotifyListFrm`; tin được **SP phía DB** tạo (`SY_NotifySendStp`)
  (`Tools/NotifyMonitor.cs:106-170`; `[ERP.NET] ERP/MainFrm.cs:813-878, 1460-1466`) [V].
- `Popup.ShowPopup` toast tự đóng sau 4s, xếp chồng 45px; `PopupForm` hộp tiến trình có nút Dừng (`Tools/Popup.cs:52-167`; `Tools/PopupForm.cs:33-160`) [V].

---

## 8. Hàm ý cho bản web

**Nguyên tắc chung**
1. **Metadata là hợp đồng, SQL trong metadata là nợ kỹ thuật.** Giữ các bảng `SY_FrmCfg`, `SY_FrmDrdwTbl`, `SY_FrmFltTbl`, `SY_FrmGrdActTbl`,
   `SY_FrmOptBtnTbl`, `SY_RpDTbl/SY_RpTbl` làm *nguồn đọc* để sinh cấu hình component, nhưng **mọi SQL chạy phía server**, không bao giờ gửi chuỗi SQL
   hay tên cột tự do từ client. Toàn bộ engine hiện tại ghép chuỗi giá trị người dùng vào SQL (para nút, lọc, grid action, import) → web phải
   parameter hóa (`sp_executesql` với tham số đặt tên ánh xạ từ `{0}`/`{Field}`) hoặc thay bằng endpoint nghiệp vụ.
2. Dựng **một “metadata resolver” phía API** trả JSON đã chuẩn hóa cho từng form: cột (caption theo ngôn ngữ từ `SY_FmtFldTbl`, format/mask/align/
   width), quyền đã áp (HDE/HDE2/HDE3, LCK*, ACP, EEXC), lookup, filter, action. Client không cần biết key 2–4 ký tự.
3. Giữ **quy ước `MsgInfoAction`** (`Msg`, `MsgType`, `Title`, `MsgTooltip`, bảng phụ) làm định dạng phản hồi chuẩn của mọi lệnh kiểm tra/thực thi —
   SP hiện có (`CS4`, `S10`, `SY_*Stp`) đã trả theo quy ước này.
4. Chuyển trạng thái **máy-cục bộ** sang DB theo user: `.dat` bố cục lưới, `_filter.dat`, mapping import `.txt`, registry (giá trị lọc nhớ, mẫu báo cáo,
   máy in, người ký `Uinput`, zoom, thư mục xuất). Đề xuất bảng `UserGridLayout(UserID, FormID, GridName, LayoutName, JsonLayout, UpdatedAt)` với JSON
   mô phỏng T0 (cột: key, width, visible, position, sum, wrap) + T1 (view, groupBy, sort, frozen, filterRow, headerLines); có thể import một lần từ `.dat`.

**DataGrid** (mục 1)
- Tính năng bắt buộc: thứ tự/độ rộng/ẩn hiện cột có lưu, đóng băng cột, nhóm + tổng nhóm, footer Sum (chỉ Sum), column set (header nhóm), tree, sort
  cấu hình, hàng lọc + lọc theo giá trị ô + lọc theo danh sách dán, card view, STT đầu dòng, cột chọn nhiều + biểu thức bật checkbox, word-wrap,
  ảnh trong ô, zoom font.
- Định dạng điều kiện (`T*F*`) và màu động (`T*C*`) → rule engine khai báo (cột, toán tử Janus, giá trị/cột so sánh, màu) dịch sang style; tránh eval tùy ý.
- Sửa trực tiếp: lock/hide theo vai trò, required, unique trong lưới, keep value, mặc định từ master (GCM/X50..), STT tự tăng, mã tự sinh (X01..),
  công thức `SY_FrmExpTbl` (là biểu thức ADO.NET DataColumn → cần một evaluator tương thích, chạy cả client lẫn server để kiểm), grid action
  `SY_FrmGrdActTbl` → endpoint “on-change” trả các cột đích + Msg; debounce và chạy tuần tự như desktop.
- Context menu: giữ copy/paste vùng, nhân bản dòng, cập nhật hàng loạt/phân bổ/%, replace, xóa hết; in/xuất Excel/PivotTable phía server (OpenXML),
  kiểm `EEXC` + quyền ExportExcel + log.
- Lưu ý dung lượng: desktop nạp toàn bộ (TopRecord 5000 khi lọc); web cần phân trang/virtualization phía server và tính tổng phía server
  (`GWPS` đã có sẵn ý tưởng này).

**Lookup** (mục 2)
- Endpoint `GET /lookup/{dropdownConfigId}?q=&params=` dùng `SY_FrmDrdwTbl.Source` phía server; mặc định hành vi `SearchTopRecord`
  (top N + like trên `ColumnArr`) cho danh mục lớn, cache cho `OnFormLoad`.
- Trả về đủ cột `ColumnArr` + `LinkColumn` để client điền cột liên kết; hỗ trợ cascading (`ColumnName_Filter`/`ColumnValue_Filter`), `ParaRequireArr`,
  multi-check (giá trị nhiều mã), DropSelect (dialog chọn nhiều dòng, sửa cột `EditableColumns`, tổng `SummaryFieldArr`), “thêm mới” (F2) mở form danh
  mục theo quyền, `IsNotInList`.
- Giữ phím tắt quen thuộc (F2/F3/F4/F5/F7) cho người dùng kế toán; F9 chỉ cho admin cấu hình.

**Filter bar & lọc nâng cao** (mục 3)
- Schema lọc từ `SY_FrmFltTbl` (`Type`, `Operator`, `WhereString`, mặc định/SQL mặc định, nhớ giá trị, khóa khi sửa) → server dựng WHERE tham số hóa,
  `WhereString` chỉ cho phép dạng mẫu đã duyệt. Combo kỳ/quý/năm/khoảng ngày lấy từ `SY_Period`.
- Lọc nâng cao master/detail với danh sách trường **allow-list**, toán tử như mục 3.3, lưu “bộ lọc đã đặt tên” theo user.

**Action buttons** (mục 4)
- Hợp nhất `SY_FrmOptBtnTbl` và `*ButtonCtl` thành một mô hình `ActionDefinition { kind, caption, icon, color, enableWhen (EnableStatus + LBEX/LBS),
  requireFields, beforeAction, precheck (CS4), paramDialog (≤9 slot: type, default SQL/master/toolbar, list source, link), execute, confirm (C5/BOL1),
  resultHandling (MsgInfo, C4R refresh fields), afterAction, audit }`.
- `kind`: execSql (→ server gọi SP/lệnh đã khai báo, có tham số), showData, showForm/report/url, selectFromSource (master-detail picker trả về
  ReturnMaster/DetailField, so sánh lượng đã chọn), makeDoc (`<Module>_DocSetup`), status (StatusButton), print, email, import, upload.
- Hành động trước/sau: cài đặt đúng ngữ nghĩa `Save/SaveContinue/SaveSkipErr/Reload/ReloadCurrent/ReloadDetail/Edit` trong form engine web.

**Report viewer** (mục 5)
- Giữ hợp đồng: tên báo cáo ↔ SP `<Name>Stp`; tham số từ `information_schema` + `SY_RpDTbl` + `SY_RpTbl`; thứ tự result set (bảng 0 = chính,
  bảng kế = subreport, bảng `Msg/Type` = thông báo); `@<PK>` danh sách `;` để in nhiều chứng từ; danh sách mẫu `PName='Template'`; cột `Template` tự chọn mẫu.
- 776 `.rpx` không chạy được trên web: cần chọn engine (ví dụ dịch sang một định dạng báo cáo .NET có web viewer, hoặc HTML→PDF tự dựng) và **công cụ
  chuyển đổi** rpx→định dạng mới dựa trên cấu trúc XML đã mô tả; ưu tiên theo tần suất dùng (log `UserLogDetail`). Phải tái hiện quy ước tên control
  (`SysCom*`, `Uinput*`, `CountNumber*`, `DATETIMEREPORT*`, `sys*`, crosstab) và rà 135 script C#/VB.
- Xuất PDF/Excel/Word phía server; mẫu Word/Excel `{Field}`: thay Aspose (đang vá giấy phép) bằng thư viện có giấy phép hợp lệ; bảng chi tiết sinh
  động như `WordFieldInfoX`.
- Email/batch email: dùng `SY_EmlSetupTbl` nhưng lưu bí mật trong kho bí mật của server, gửi qua hàng đợi nền.

**Import Excel** (mục 6)
- Server parse (`.xlsx` và `.xls`), chọn sheet/dòng tiêu đề, auto-map theo caption bỏ dấu, lưu mapping theo user+form trong DB, preview với lỗi từng ô,
  tra mã danh mục (`LV/L2V`), thêm danh mục mới có kiểm soát, **transaction** toàn bộ, báo cáo kết quả chính xác (sửa lỗi luôn báo thành công),
  quyết định rõ insert-only hay upsert; cung cấp file mẫu tải về (desktop chưa có).

**Đính kèm, duyệt, thông báo** (mục 7)
- Đính kèm: giữ `*AttachTbl` (đã có `Base64Content` — dấu hiệu bản web cũ dùng) hoặc chuyển nội dung ra object storage, giữ khóa `(<PK cha>, STT)`;
  enforce `MFS`, sinh thumbnail phía server, chụp ảnh qua `getUserMedia` thay VideoGrabber.
- Duyệt: mô hình hóa theo cơ chế thực tế của Medcom (**bảng trạng thái + SP chuyển trạng thái + LogTbl + StatusButton/ExecSQL**) với bảng chuyển
  trạng thái cho phép (from→to, vai trò, cần ghi chú); `SY_Approve*` chỉ cần nếu khách hàng khác có dùng.
- Thông báo: dùng lại `SY_NotifyMsgTbl` (đã có `ShowWeb`, `WebRoute`, `WebFormName`) qua SignalR/poll; dashboard theo `WA_Dashboard`/`<Module>_UpdateDshBrdStp`.

**Rủi ro pháp lý/kỹ thuật**: Aspose kích hoạt bằng vá bộ nhớ, EPPlus chế độ phi thương mại, VideoGrabber thương mại, Excel/Outlook COM — không mang
sang web. Lỗi hiện có cần quyết định giữ hay sửa: rejected vẫn khóa chứng từ (SY_Approve), `SQLBeforeCheck` ghi đè (ApproveButton), `MsgWarningPopup`
đọc nhầm cột (grid action), `GridDetailCtl` dùng key `C2` cho hai thuộc tính (`Tools/GridDetailCtl.cs:394, 410`), import luôn báo thành công.

---

## 9. Câu hỏi còn mở

1. **Dữ liệu metadata đầy đủ**: snapshot chỉ có 3.419/10.687 dòng `SY_FrmCfg`, 18/244 dòng `SY_FrmFltTbl`, và **không có** `SY_FrmDrdwTbl` (2.361 dòng),
   `SY_FrmExpTbl` (424), `SY_FmtFldTbl`/`SY_FmatTbl`, `SY_RpDTbl` (2.231), `SY_RpTbl` (50). Cần trích xuất (chỉ đọc) để thống kê `Type`, `ReloadType`,
   các SQL lookup/lọc thực tế và đo phạm vi chuyển đổi.
2. **Bản web đã tồn tại?** Các key “cho web” (`DSOP`, `GWPS`, `GDW`, `GDWH`, `BTC`, `URL`, `HPS`, `HtmlWebButtonCtl`, `Base64Content`, `WA_*`,
   `SY_NotifyMsgTbl.ShowWeb/WebRoute`) cho thấy đã có một runtime web đọc cùng metadata. Đó là sản phẩm nào, còn chạy không, và có thể tái sử dụng
   quy ước của nó?
3. **Bố cục người dùng thực tế**: file `.dat` nằm theo máy; người dùng thực tế phụ thuộc bao nhiêu (đặc biệt `Layout1..3`, `_filter.dat`)? Có cần
   công cụ import `.dat` → DB khi chuyển không? Ai là “chủ” bản `.dat` mặc định phát hành trong `<exe>\Layout\`?
4. **Ngữ nghĩa `ConditionOperator` (key `OP`)**: giá trị số theo enum Janus — cần bảng ánh xạ chính xác số ↔ toán tử (chưa trích enum Janus).
5. **`frmEditX`/`SelectMasterDetailFrm`/`SelectCreateDataFrm`** chỉ được khảo sát ở mức API; luồng chọn master-detail (so sánh số lượng đã chọn,
   `RefTable`) và tạo chứng từ từ `<Module>_DocSetup` cần một lượt đọc riêng trước khi thiết kế “picker”.
6. **Công thức `SY_FrmExpTbl`** dùng cú pháp `DataColumn.Expression`; cần liệt kê các hàm/toán tử thực sự xuất hiện (IIF, ISNULL, CONVERT, LEN…) để chọn
   evaluator web tương thích.
7. **Cơ chế duyệt ở khách hàng khác** (KEIKO, TinPhong, VLS…): có ai dùng `SY_Approve*` (5 cấp) hay `ApproveButtonCtl` (`*StatusUserTbl`) không? Medcom
   chỉ dùng StatusButton + SP.
8. **Báo cáo**: tần suất sử dụng từng `.rpx` (từ `<ModuleID>_UserLogDetail`) để ưu tiên chuyển đổi; nội dung 135 script; các `ReportPropertyX`
   base64 trong Tag; các form `<Report>_Export` tùy biến; báo cáo `.GRD`.
9. **Các key cấu hình “thừa”** (vd. `C1`, `P1` trên `ExecSQLWithParaButtonCtl` ở Medcom) — có phiên bản Tools.dll khác đọc chúng không? Cần so phiên bản DLL
   giữa các khách hàng trước khi coi là vô nghĩa.
10. **`TriggerOnOpenForm`** (SY_FrmDrdwTbl), `DisplayOutput` (DSOP) và `SearchControlTypes` dạng `*InDetail1/2` (30–53) — chưa thấy nơi đọc trong bản
    desktop này; có thể do bản web hoặc phiên bản mới hơn sử dụng.
11. **Quyền xuất dữ liệu**: thứ tự ưu tiên chính xác giữa `EEXC`, `Permiss.ExportExcel`, `isManagerNotExcel/isUserNotExcel` và `HCA/ACP` khi cùng lúc cấu hình
    — cần kịch bản kiểm thử trên bản chạy thật.
