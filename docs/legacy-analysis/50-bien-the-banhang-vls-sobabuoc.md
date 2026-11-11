# 50 — Các biến thể cùng engine: BanHang (POS), ERP.VLS (đào tạo), SoBaBuoc (ATTP), POS_DEMO (web tĩnh)

Ngày khảo sát: 2026-11-11. Chỉ đọc: không chạy exe, không kết nối DB/mạng. Đọc trước `00-nguon-du-lieu.md`.

**Quy ước.**
- Nguồn mã ghi dạng `BanHang/BanHang/InvoiceFrm.cs:2408`, tương đối trong `D:\Data\Web-ERP\.legacy\decompiled\`.
  Lưu ý: namespace thật của BanHang là **`BanHang`**, không phải `ERP` (thư mục `BanHang/BanHang/`, `BanHang/BanHang.eInvoice/`...).
- Nguồn triển khai/tài liệu ghi đường dẫn đầy đủ.
- **[XM]** = đã xác minh trong mã/file. **[SĐ]** = suy đoán có cơ sở, cần kiểm chứng trên DB.
- Không chép mật khẩu, hash, khóa API, chuỗi kết nối, tên máy chủ hay dữ liệu khách hàng. Chỗ nào có các giá trị đó chỉ ghi "có, đã lược".

---

## 0. Tóm tắt điều quan trọng nhất

1. **Ba exe biến thể đều là "vỏ mỏng"** trên `Tools.dll`. Nghiệp vụ thật nằm chủ yếu trong **metadata DB** (form động `SY_FrmLstTbl`/`SY_FrmCfg`), SP và mẫu in `.rpx`. Mã biên dịch chỉ chứa vài form chuyên biệt.
   - **SoBaBuoc** gần như không có mã ATTP. Toàn bộ sổ 3 bước là form động `KD_ATTP*` cộng 5 mẫu in [XM].
   - **ERP.VLS** chạy thực tế bằng form động 2026, gắn thêm 2 DLL plugin nạp qua khóa `UCC` [XM].
2. **BanHang có schema riêng**, không dùng bảng của ERP.NET:
   - BanHang: `InvoiceTbl`, `InvoiceDetailTbl`, `ReturnTbl`, `NhapKhoTbl`, `XuatKhoTbl`, `KiemKeTbl`, `ChuyenKhoTbl`, `OrderTbl`, `InvoiceOnlineTbl`...
   - ERP.NET: `AR_InvoiceTbl`, `IV_InputTbl`...
   - Ở Santino, DB bán hàng `X23STN` và DB kế toán ERP.NET `X23STNKT` là hai DB tách nhau. SP **`LayDuLieuTuBanHangStp`** đặt trong DB kế toán đọc chéo DB (`X23STN..InvoiceTbl`) để đổ chứng từ sang `AR_InvoiceTbl`, `AR_ReturnTbl`, `IV_*`, `CS_*` theo kỳ, đánh dấu `LinkID='Import'` [XM].
3. **Không có giao diện cảm ứng, không có ca thu ngân, không có thiết bị ngoại vi chuyên dụng** trong BanHang:
   - Máy quét mã vạch hoạt động như bàn phím, gõ vào ô Barcode.
   - In bill qua ActiveReports `PrintOut` ra máy in Windows đã chọn.
   - Không có mã cho ngăn kéo tiền, cân, màn hình khách hay ESC/POS [XM].
   - `VideoGrabberNET.dll` chỉ phục vụ chụp ảnh webcam để đính kèm file trong `Tools` (dùng chung mọi app), không phải camera POS [XM].
4. **Nghiệp vụ bán lẻ Santino nặng nhất nằm ngoài exe.** Ví dụ: "châm hàng bán lẻ tự động V4.1.4" gồm Target DOC, tồn an toàn, ưu tiên, giữ hàng; bảng `CF_AR_*V4/V5/V6`; SP và báo cáo `AutoReplenishmentReport` [XM tài liệu và layout; SP chưa đọc].
5. **ERP.VLS** bám theo **Phiếu giao lớp (PGL) = `AC_LichGiangTbl`**:
   - Lịch học được sinh bằng SP `VLS06140_BuildSchedule`.
   - Phiếu báo giảng dùng để tính công/lương giảng viên và doanh thu học viên.
   - Phiếu thu học phí tính theo gói giờ.
   - **Không có điểm danh theo từng học viên × buổi** [XM].
6. **POS_DEMO** là frontend web tĩnh cho **POS nhà hàng** (sơ đồ bàn, gọi món, màn hình bếp, kiểm kho):
   - Gọi REST `/api/Pos_Api_*`, `/api/api_*`.
   - **Không có backend** trong `D:\Data`.
   - Tên trường (`Mahang`, `Tenhang`, `Dongia`, `BANID`, `PHIEUBAN`, `MATHANGID`) khớp schema `TN_*` (nhà hàng) của ERP.NET [XM tên trường; SĐ về backend].

---

## 1. Bức tranh chung các biến thể

| | ERP.NET (chính) | BanHang.exe | ERP.VLS.exe | SoBaBuoc.exe |
|---|---|---|---|---|
| Tiêu đề / ProductID | ERP.NET 7.x | "POS.Net 2.0" / `POS.NET 2.0` (`BanHang/BanHang/MainFrm.cs:486,513`) | "ERP NET 6.7" (`ERP.VLS/ERP/MainFrm.cs:535`) | "ATTP.NET - Quản lý An Toàn Thực Phẩm" / `ATTP.NET 2.0` (`SoBaBuoc/ERP/MainFrm.cs:380,411`) |
| Namespace | `ERP` | `BanHang` | `ERP` | `ERP` |
| Số file .cs ở ns chính | 238 | 30 (+5 CHAT, 4 Schedule, 2 Sys, 17 eInvoice, 218 proxy VNPT) | 103 | 44 (+2 Sys, CHAT, Schedule) |
| Obfuscate chuỗi | có (đã giải) | có (đã giải) | có (đã giải) | **không** |
| Schema nghiệp vụ | `AR_/AP_/IV_/CS_/GJ_...` | **riêng**: `Invoice*/Return*/NhapKho*/XuatKho*/KiemKe*/ChuyenKho*/Order*` | `AC_*` (học vụ) + `CR_*` + `HR_*` + kế toán cũ | `KD_*` + `CF_*` (form động) |
| Khách hàng | nhiều | Santino (thời trang, nhiều cửa hàng), Spa | VLS (trung tâm ngoại ngữ) | DIM (bếp ăn tập thể) |
| Thư viện thêm | – | `VideoGrabberNET.dll`, `Ionic.Zip`, `Logo.png` | `MindFusion.*`, `VLS.Schedule06140.dll`, `VLS.Student06101.dll`, `Reminder.wav` | `Vnserife.fon`, `Ionic.Zip` |

Kết luận [XM]: cả ba biến thể dùng chung `FormControler`, `ToolBarX`, `ReportViewerFrm`, `Menus.LoadMainMenu` của Tools. Menu đọc từ `SY_Menu` của DB đang đăng nhập. Mở form theo tên qua `App.GetFormByName`: tìm trong exe trước, không có thì sinh form động (`BanHang/BanHang/MainFrm.cs:553-600`, lời gọi ở `:571`).

---

## 2. BanHang.exe — bán lẻ / bán đại lý (POS.NET 2.0)

### 2.1 Triển khai

| Nơi | Exe | DB (thư mục `Layout\`) | Ghi chú |
|---|---|---|---|
| `D:\Data\Santino\BanHang_SantinoTest2026\` | BanHang.exe 9,2 MB (26/08/2026) — **chính là bản đã dịch ngược** | `X23STN` 112 .dat, `X23STN_TEST26` 95, `X23STN3` 7, `X23STN2` 6, `X23STN1` 3, `X23STN24` 1 → **tổng 224** | Reports\ có 86 rpx. `UpdateLog.txt` cho thấy sản phẩm có từ 2015 và cập nhật qua web/file server |
| `D:\Data\Spa\` | BanHang.exe 5,5 MB (12/06/2026), **build khác, chưa dịch ngược**. Metadata tên kiểu không đọc được (bị nén/mã hóa) | `X26SPA` 36 .dat | Reports\ có thêm `HR_BangKeHoaHong*` (hoa hồng nhân viên) |
| Audit DB (đọc lại kết quả SELECT đã lưu) | – | `X23STN` (bán hàng), `X23STNKT` (kế toán ERP.NET), `X19SPHN` (một DB bán lẻ khác cùng schema) | `D:\Data\Santino\.audit-doanhso-20261103\s01.response.json` |

### 2.2 MainFrm / LoginFrm (khác ERP.NET)

**MainFrm** (680 dòng, ERP.NET có 1.468) [XM]:
- **Chi nhánh lấy từ user.** `SY_User.BranchID` được gán vào `App.Cn.BranchID`, sau đó dùng làm tiền tố số chứng từ và lọc dữ liệu. Tiêu đề cửa sổ = tên công ty (`GetSysParam("COM1")`) + tên chi nhánh + địa chỉ, hoặc "Quản trị" nếu user không có chi nhánh (`BanHang/BanHang/MainFrm.cs:514-523`).
- **Tự sửa schema khi khởi động.** `ALTER TABLE CF_ObjectGroupTbl ADD PhanTram`, `ALTER TABLE InvoiceDetailTbl ADD PhanTramGiamGia` (`:524-525`). Các form còn tự `ALTER` thêm: `InvoiceDetailTbl.KM` (`InvoiceFrm.cs:2128`), `InvoiceTbl.StorehouseID` (`Invoice2Frm.cs:1906`), `PS365_SettingTbl` (`Pos365SettingFrm.cs:690`).
- **`InvoiceFrm` không bị cache theo tên** nên mở được nhiều cửa sổ bán lẻ cùng lúc. Giữ Ctrl khi bấm menu cũng mở thêm bản mới (`MainFrm.cs:563,584`).
- **Không khởi động** chat (`clsChat`), `Notifier` hay Dashboard tab. ERP.VLS và ERP.NET thì có (`ERP.VLS/ERP/MainFrm.cs:537-539`).
- **Cửa hậu admin.** `Connector.isAdminMode` bật khi tên máy là "NDD", tức máy nhà phát triển (`MainFrm.cs:503`). Cờ này giống ở mọi biến thể.

**LoginFrm** (1.434 dòng, ERP.NET có 3.020) [XM]:
- Cấu hình kết nối lưu trong `settings.config` (mã hóa) theo từng "cấu hình". Có ô Windows auth, Teamview, "UpdateX" và ô cập nhật tự động. Giá trị mặc định trỏ tới DB và URL cập nhật của các khách bán lẻ cũ (`LoginFrm.cs:1341-1357`, đã lược).
- **Giữ Ctrl khi đăng nhập** sẽ kết nối `Master` và mở `RestoreDataFrm` để khôi phục DB mới (`:1133-1157`).
- **Tự chèn user `Admin` mặc định** (mật khẩu hash cứng trong mã, đã lược) vào `SY_User` mỗi lần đăng nhập nếu chưa có (`:1139`). Đây là rủi ro bảo mật.
- **Xác thực.** Hàm MD5 tùy biến `VerifyUserPass` (`BQ089fnCmMqhoIW2x4/K9BXUorQ8jAki5VJiY.cs:184-188`). Có thêm `VerifyUserPassSystem`, tức mật khẩu hệ thống: khi khớp, phiên đăng nhập bị xóa khỏi `SY_UserLog`, nghĩa là đăng nhập không để lại vết (`LoginFrm.cs:1197-1201`, `K9BX...cs:168-182`).
- **Phiên làm việc.** `SY_SetupStp(user, máy (IP), 1, version)` trả `App.Cn.ID`. Khi đăng xuất gọi lại với tham số 0 (`LoginFrm.cs:1196`, `MainFrm.cs:649`).
- **Kỳ làm việc mặc định** = tháng hiện tại theo giờ server (`LoginFrm.cs:1186-1193`).
- **Không có** chọn ngôn ngữ, logo module hay Repair/Shrink DB như ERP.NET.

### 2.3 Form biên dịch trong BanHang.exe

| Form | Nghiệp vụ | Bảng / SP chính | Mẫu in | Dùng thực tế (Layout Santino) |
|---|---|---|---|---|
| `InvoiceFrm` "Phiếu bán hàng (Bán lẻ)" | Bán tại quầy, xem §2.4 | `InvoiceTbl` (`isBanSi=0`), `InvoiceDetailTbl`, `InvoiceLogTbl` (log Zalo); `InvoiceGetItemListStp`, `Invoice_LayChietKhauStp`, `Invoice_LayDoanhSoStp`, `Invoice_TinhCodeGiamGia_Stp`, `Invoice_TinhChietKhauTongDon_Stp`, `InvoiceXemHangHoaStp`, `SY_ZaloSNS_Stp` (`InvoiceFrm.cs:2134-2178,2647,2680,2756,2771,2803,2888`) | `InvoiceReport` + `InvoiceReportStp`; danh sách mẫu trong `SY_RpDTbl` (`:2453-2465`) | **có** (`X23STN`, `X23STN_TEST26`) |
| `Invoice2Frm` "Phiếu bán hàng (Đại lý)" | Bán sỉ / đại lý: bắt buộc chọn KH, có kho xuất, hình thức/điều khoản TT, CTKM, mã đại lý, xuất HĐ MTT, CCCD | `InvoiceTbl` (`isBanSi=1`) ⋈ `CF_ObjectTbl`; `Invoice2GetItemListStp(branch, KH, từ khóa)` (giá theo KH); lọc chi nhánh qua `SY_GetBranchFnc(user)` (`Invoice2Frm.cs:1907-1992`) | `InvoiceDaiLyReport` + `InvoiceDaiLyReportStp` (`:2211-2222`), thêm mẫu `InvoiceDaiLySauCKReport` (30/10/2026) | **có** |
| `ReturnFrm` "Hàng bán trả lại (Bán lẻ)" | Trả hàng lẻ; tìm hàng từ `vItem` | `ReturnTbl`/`ReturnDetailTbl`, số `TL` (`ReturnFrm.cs:905-930`) | `ReturnReport` / `ReturnReportStp` (`:1105`) | thay bằng form động `ReturnBanLeFrm` [SĐ] |
| `Return2Frm` "Hàng bán trả lại (Đại lý)" | Trả hàng đại lý | như trên + `Invoice2GetItemListStp` (`Return2Frm.cs:1098-1123`) | `Return2Report` | **có** |
| `PurchaseFrm` "Mua hàng - nhập kho" | Mua từ NCC | `PurchaseTbl`/`PurchaseDetailTbl` ⋈ `CF_ItemTbl`, số `MH` (`PurchaseFrm.cs:655-679`) | `PurchaseReport` | **có** |
| `NhapKhoFrm` / `XuatKhoFrm` | Nhập / xuất kho nội bộ | `NhapKhoTbl`/`XuatKhoTbl` + Detail, số `PN`/`PX` (`NhapKhoFrm.cs:611-634`, `XuatKhoFrm.cs:611-634`) | `NhapKhoReport`, `XuatKhoReport` | **có** |
| `KiemKeFrm` "Kiểm kê kho" | Kiểm kê và cập nhật tồn | `KiemKeTbl`/`KiemKeDetailTbl`, số `KK`; nút cập nhật gọi `SP_CheckStock_UpdateStockStp(doc, ngày, chi nhánh)` (`KiemKeFrm.cs:502-517,638`) | `KiemKeReport` | thay bằng form động `KiemKeSTNFrm` [SĐ] |
| `StockAdjustmentFrm` "Chuyển chỉnh - nhập xuất" | Điều chỉnh tồn theo lô | `AdjustmentTbl`/`AdjustmentDetailTbl` ⋈ `CF_LotTbl` (`StockAdjustmentFrm.cs:680-681`) | `AdjustmentReport` (`:756`) | không thấy layout |
| `StockTranferFrm` "Chuyển kho" | Chuyển kho theo lô | `TranferTbl`/`TranferDetailTbl` (`StockTranferFrm.cs:629-630`) | `TranferReport` (`:706`) | thay bằng `ChuyenKhoFrm` (form động, có trạng thái + "kho đi đường") [SĐ] |
| `ObjectGroupPriceFrm` | Giá theo nhóm KH | `CF_ObjectGroupPriceTbl` (tự sinh dòng bằng INSERT…SELECT) (`ObjectGroupPriceFrm.cs:224-231`) | – | không thấy layout |
| `HR_ChamCongNgayNghiFrm` | Bảng chấm ngày nghỉ | `HR_BangChamNgayNghiTbl`, `HR_BangChamNgayNghi_UpdateStp` (`HR_ChamCongNgayNghiFrm.cs:374,397`) | `HR_BangLuongThangReport` | Santino dùng form động `HR_ChamCongFrm`/`HR_PayrollFrm` |
| `ThemNhapHangFrm` | Popup thêm hàng nhanh | INSERT trực tiếp (`ThemNhapHangFrm.cs:381`) | – | – |
| `Pos365SettingFrm` / `Pos365SendDataFrm` / `Post365API` | Đẩy hàng hóa và đơn sang **POS365** (SaaS) theo chi nhánh | `PS365_SettingTbl` (thông tin đăng nhập lưu **thô**, đã lược), `PS356_GetItemListStp`, `PS356_GetOrderListStp`, `PS356_GetOrderDetailStp`; REST `/api/auth/credentials`, `/api/products`, `/api/orders` (`Pos365SendDataFrm.cs:445-532`, `Post365API.cs:237-530`) | – | cột `ChuyenPOS365` trên `InvoiceTbl` [XM layout] |
| `ZaloZNS` | Gửi ZNS cảm ơn sau bán / OTP qua nhà cung cấp voip24h | `SY_ZNSSetup` (template, token...; đã lược), `InvoiceLogTbl`, `Invoice_InsertOtpStp` (`ZaloZNS.cs:49-61,97,206,252,294,330`) | – | **có** (`SY_ZNSSetupFrm`) |
| `SetupLinkServerFrm` | Lưu cấu hình kết nối DB thứ hai (mật khẩu mã hóa bằng `EncodeString`), có nút Test | (`SetupLinkServerFrm.cs:367-439`) | – | [SĐ] dùng cho đồng bộ sang DB kế toán |
| `eInvoice*`, `EinvoiceButtonCommandCtl`, `VietelAPI`, `XMLViewerFrm`, `BanHang.VNPT*` | HĐĐT: VNPT (TT78), Viettel, MISA, BKAV, M-Invoice, Bizzi | **chép nguyên từ ERP.NET** (cùng tên file) | – | `CF_HoaDonDienTuListFrm`, `DeNghiXuatHDFrm` |

### 2.4 Luồng bán hàng tại quầy (`InvoiceFrm`) — [XM] trừ khi ghi khác

1. **Mở phiếu.** F2 tạo phiếu mới (cần quyền AddNew).
   - Số phiếu = `{BranchID}-` + tiền tố `BH` + số tự tăng theo ngày (`GetDocPreFix("BH")`) (`InvoiceFrm.cs:2235,2304`).
   - Mặc định ngày = ngày server, `KhachDua=0`, `isBanSi=0`, `BranchID` = chi nhánh của user (`:2236-2238,2198`).
2. **Khách hàng.** Ô `FldObjectID` có nhãn **"Số điện thoại KH"**, tức **mã KH chính là số điện thoại**.
   - Khi đổi KH, gọi `Invoice_LayChietKhauStp(KH, ngày)` → trả `TongChietKhau` (% CK theo hạng) và `XepHang`.
   - % này được áp vào **mọi dòng** `PhanTramGiamGia` đang có (`:2647-2672`).
   - Tab "Doanh số và điểm của khách hàng" lấy từ `Invoice_LayDoanhSoStp(KH, phiếu, ngày, 1)` và nhóm theo `GroupName` (`:2680-2735`).
3. **Chọn hàng**, có ba cách:
   - **Quét mã vạch** vào ô `txtBarcode` (máy quét kiểu bàn phím). Chạy `InvoiceGetItemListStp(branch, mã)`, lấy dòng đầu, rồi `ThemNhanh` (`:2334-2358`).
   - **Ô "Thêm nhanh"**: combo tìm kiếm `InvoiceGetItemListStp '', '%{s}%'`, hiển thị mã/tên/giá/%giảm/giảm tiền/màu/size (`:2134,2362-2384`).
   - **Gõ thẳng vào lưới chi tiết.**
   - Ô SL (`txtSoLuong`) giữ số lượng cho lần thêm kế tiếp, sau đó reset về 1 (`:2415,2423`).
4. **Giá và giảm trên từng dòng** (`ThemNhanh`, `:2387-2426`):
   - Hệ thống điền `UnitPrice`, `PhanTramGiamGia` và `GiamGia` lấy từ bảng giá trả về.
   - `ChietKhauKhac` lấy theo % CK hạng KH.
   - **Quy tắc cứng**: nếu hàng đã giảm ≥ 20% thì không cộng CK hạng nữa (`ChietKhauKhac = 0`) (`:2408-2411`, lặp lại ở `:2591,2615`).
   - Công thức thành tiền (`Amount`, `GiamTien`, `TienCKTong`, `SoTienDoiDiem`, `TotalAmount`...) nạp từ cấu hình DB (`SetFomularFromConfig`, `:2178`), **không nằm trong mã**.
   - Theo SP đồng bộ, công thức kiểm tra là `Amount − GiamGia − TienCKTong − GiamTien − SoTienDoiDiem − TienChietKhauKhac` (`D:\Data\Santino\.audit-doanhso-20261103\LayDuLieuTuBanHangStp.sql:181-193`).
5. **Khuyến mãi**:
   - Nút "Áp dụng mã" gọi `Invoice_TinhCodeGiamGia_Stp(phiếu, mã 1, mã 2)` với 2 mã giảm giá (`:2756`).
   - Nút "Áp dụng CK tổng đơn" gọi `Invoice_TinhChietKhauTongDon_Stp(phiếu)` (`:2771`).
   - Cả hai đều **lưu phiếu trước** (`SaveContinue`), để SP sửa chi tiết trên DB, rồi nạp lại.
   - Mã giảm giá sinh hàng loạt ở form động `GJ_PromotionCodeFrm`: ký tự đầu, từ số–đến số, cố định SĐT, áp dụng giảm tiền.
   - CTKM ở `CTKMListFrm`: tỷ lệ đổi điểm, chỉ tiêu, HTL cuối vụ...
   - Trong DB còn `Invoice_TinhKhuyenMai_Stp`, `Invoice_PhanBoVoucherStp`, `CF_CustomerRank_ApplyInvoiceStp` (`D:\Data\Santino\.audit-x23stn\sync-mismatch-20261102\01.response.json`) [XM tên; logic chưa đọc].
6. **Thu tiền (F3).** Chuyển con trỏ tới "Khách đưa". `TraLai = KhachDua − BaseTotal` là công thức client (`:2170`). Có thêm ô "Chuyển khoản" (checkbox), "Loại thu" (combo cấu hình) và cột `CKTong`, `PaymentTypeID` trong layout.
   - **Không có** thanh toán nhiều phương thức tách tiền.
   - **Không có** ví/thẻ/QR và **không có** ca thu ngân.
7. **Lưu và in (F6)**:
   - **Lưu**: `BaseTotal = Σ TotalAmount` của các dòng. `SearchField` = chuỗi ghép mã;tên của mọi dòng (`:2514-2531`).
   - **Kiểm tra trước khi lưu**: kỳ chưa khóa `SY_CheckDateOfPeriodOpeningFnc`. Non-admin chỉ sửa phiếu mình tạo. Phiếu `isLock=1` không sửa được (`:2171-2177`).
   - **Sau khi lưu**: chạy SQL "after save" cấu hình trong layout (`Do_ExecSQLAfterSaveData`, `:2321`); trong DB có `InvoiceAfterSaveStp`.
   - **In bill**:
     - Tăng `SoLanIn`. Mở `ReportViewerFrm` với `InvoiceReport` + `InvoiceReportStp(Template, DocumentID)`; danh sách mẫu in lấy từ `SY_RpDTbl.DefaultValueVN`.
     - Mẫu và máy in nhớ trong **registry** của máy (`<Form>_Printer`, `<Report>\Template`).
     - F6 in thẳng (`PrintOut`). Nút in thường thì xem trước (`:2438-2491`).
   - **Sau khi in**:
     - Phiếu bị **khóa** (`UPDATE InvoiceTbl SET isLock=1`) (`:2494-2496`).
     - Nếu `SY_ZNSSetup.GoiSauKhiInPhieu=1` thì gửi Zalo ZNS cho KH; tùy cấu hình hỏi trước khi gửi (`:2497-2505`).
   - Trước khi sửa phiếu đã thu tiền hoặc đã khóa, phải bấm Sửa (`:2389-2393,2577-2581`).
8. **Thông tin xuất hóa đơn** (tab riêng):
   - Tên đơn vị, MST, địa chỉ, email.
   - Nút "Tìm MST Online" gọi API công khai `mst.minvoice.com.vn` (`:2864`).
   - Nút xem hàng xuất HĐ gọi `InvoiceXemHangHoaStp` (`:2888`).
   - Phát hành HĐĐT đi qua `DeNghiXuatHDFrm` (đề nghị xuất HĐ, gom nhiều phiếu) và engine `eInvoice*` dùng chung [XM layout; SĐ luồng].
9. **Zalo** (tab "Lịch sử / Zalo ZNS"): gửi ZNS thủ công và gửi OTP (`Invoice_InsertOtpStp`). Nhật ký lưu ở `InvoiceLogTbl` (`ZaloZNS.cs:294`) [XM]. Mục đích của OTP (xác nhận đổi điểm?) chưa rõ [SĐ].
10. **Phím tắt**: F2 tạo mới, F3 thu tiền, F6 lưu và in, F7 tìm (`:2535-2585`). Không có bàn phím số ảo hay nút lớn cho màn cảm ứng.

**Luồng đại lý (`Invoice2Frm`)**:
- Khác bán lẻ ở các điểm: bắt buộc chọn KH; giá lấy theo KH (`Invoice2GetItemListStp(branch, KH, …)`); `BaseTotal = Σ Amount` khi sửa dòng (`Invoice2Frm.cs:2173-2183`).
- Số phiếu dùng tiền tố `BD`; mẫu in `InvoiceDaiLy*`.
- Có checkbox "Xuất hóa đơn MTT" (HĐ khởi tạo từ máy tính tiền) và ô CCCD (`:1403-1417,1954`).
- Layout có thêm popup `Invoice2Frm-MakeRequest` để tạo đề nghị xuất HĐ từ phiếu đại lý [XM tên].

### 2.5 Màn hình dùng thực tế ở Santino (từ 224 file Layout) — [XM tên form và cột]

Phần lớn là **form động**, không có trong exe. Nhóm theo nghiệp vụ (cột hiển thị trích bằng `layout_cols.py`):

| Nhóm | Form (DB `X23STN` / `X23STN_TEST26`) | Cột đáng chú ý |
|---|---|---|
| Bán hàng | `InvoiceFrm`, `Invoice2Frm`, `InvoiceOnlineFrm` (đơn online: người nhận, địa chỉ, SĐT nhận, combo `MaCombo`, `Diem`), `InvoiceOnlineRequestFrm`, `OrderFrm`, `OrderWebFrm` (đơn từ web, có `StatusName`, `OrderDocumentID`), `InvoiceRequestFrm`, `DeNghiXuatHDFrm` (MST, đơn vị mua, `SoHDDT`, `StatusID`, % CK tổng VAT, `KhongXuatHD`, `MSPThueID`) | `InvoiceFrm.gridEX1` có 57 cột, gồm `PromotionCode/2`, `PromotionPercent/Amount`, `KhuyenMaiDetailID`, `ChuyenPOS365`, `ZaloID`, `NhaPhanPhoi`, `HoaDonMTT`, `CCCD`, `PosID`, `TongTienCK`. Detail: `ItemKM`, `KM`, `SoTienDoiDiem`, `ChietKhauHangTang`, `ItemName2` |
| Trả hàng | `Return2Frm`, `ReturnBanLeFrm` (`SoPhieuBan`, `LoaiThu`, `PosID`), `ReturnOnlineFrm` (`MaVanDon`, `PhiVanChuyen`, `SalesOnline`), `RequestReturnFrm` | |
| Kho | `NhapKhoFrm`, `XuatKhoFrm`, `ChuyenKhoFrm` (từ/đến chi nhánh và kho, `KhoDiDuong`, trạng thái), `KiemKeSTNFrm` (`TonKho`, `ChenhLech`), `PurchaseFrm`, `PurchaseBalanceFrm`, `ItemBalanceFrm`, `PlanStockFrm` (Min/Max/Safety/TargetDOC theo kỳ), `PhieuVanTaiFrm` (vận tải: `QuantityVC`, `PaymentObjectID`, chi phí khác) | |
| Giá / KM / KH | `AR_Price2Frm`, `AR_Price2022Frm`, `AR_XemBangGiaFrm`, `CTKMListFrm`, `GJ_PromotionCodeFrm`, `VIPObjectListFrm` (KH VIP + quan hệ), `ThietLapGiamGiaCKKhachVIPFrm` (% giảm theo % tích lũy doanh số), `ObjectListFrm`, `ObjectGroupListFrm` | |
| Hàng hóa | `ItemListFrm`, `TenHang2Frm`, `ItemNam2ListFrm`, `ItemThueListFrm` (MSP thuế), `PhanNhomHHTH2Frm`, `IV_ItemLevelFrm`, `IV_ItemLevelSizeFrm`, `SizeListFrm`, `CategoryListFrm` | Mã hàng 2 (`ItemName2`) là "mã cha" gom nhiều SKU/size |
| Châm hàng tự động | `CF_AR_RetailItemScopeV4Frm`, `CF_AR_ReplenishmentPolicyV4Frm`, `CF_AR_BranchPriorityV4Frm`, `CF_AR_StockHoldV4Frm`, `CF_AR_CoreSizeListFrm`, `CF_ItemMarketingListFrm`, `CF_ItemPriorityListFrm`, `CF_DeliveryRouteListFrm`, `CF_DeliveryRouteDayListFrm`, `CF_SeasonCalendarListFrm`, `CF_ItemSeasonCalendarListFrm`, `AutoReplenishmentReport` (44 cột), `BaoCaoChamHangBanLeReport` | §2.7 |
| Cửa hàng / nhân sự | `BranchListFrm`, `BranchGroupListFrm`, `BranchGroupAwardFrm`, `AR_BranchTargetFrm` (chỉ tiêu doanh thu tháng, bước nhảy), `QuyDinhLuongThuongBLFrm` / `CF_RetailAwardRegulationsTbl` (% lương cơ bản, % thưởng theo % chỉ tiêu nhóm CH), `AR_KhenThuongFrm`, `AR_GopYCuaHangFrm`, `EmployeeListFrm`, `HR_ChamCongFrm` (giờ vào/ra, tăng ca), `HR_PayrollFrm`, `HR_TimeSheetTotalFrm`, `HR_PersonFrm` | |
| Thu chi / KT | `ReceiptFrm`, `PaymentFrm`, `NghiepVuKhacFrm` (định khoản Nợ/Có), `SY_ChuyenSangHoaDonMTTFrm` (nhật ký chuyển sang HĐ MTT theo chi nhánh/MST) | |
| Hệ thống | `SystemMenuManagerFrm`, `NguoiDungFrm`, `NguoiDungPhanQuyenFrm`, `FormControlerSetupFrm`, `FrmReportParaSetup(2)`, `SY_FrmLstSettingXFrm`, `SY_ZNSSetupFrm`, `UserLogFrm` | |
| Báo cáo | khoảng 30 `*Report`: bán hàng chi tiết, NXT (nhiều mẫu), công nợ (tổng hợp/NPP/đại lý), thưởng doanh thu, sinh nhật KH, hàng mẫu, so sánh đơn hàng–tồn, `InvoiceMismatchListReport` | |

Đối tượng DB của `X23STN` (91 bảng có dữ liệu) xác nhận thêm:
- tích điểm/hạng KH `CF_CustomerRank*Tbl`;
- OTP `InvoiceOTPTbl`;
- `WEB_OrderDetailTbl`, `OrderOnline*`;
- `InvoicePos365Tbl`, `SY_APILog`;
- `IV_InventoryDailyTbl`;
- `CF_AR_Replenishment*V5/V6` (cache/snapshot).

Nguồn: `D:\Data\Santino\.audit-doanhso-20261103\s01.response.json`, `D:\Data\Santino\.audit-x23stn\sync-mismatch-20261102\01.response.json` [XM tên].

### 2.6 Đồng bộ bán hàng → kế toán (ERP.NET) — [XM]

- **Cơ chế.** `LayDuLieuTuBanHangStp(@UID, @IsLayDMHH)` nằm trong DB kế toán (`X23STNKT`). Nó đọc tham số từ `CF_ImportData2023Tbl`: kỳ từ–đến và cờ chọn loại chứng từ (`isBanHang`, `isHangBanTraLai`, `isChuyenKho`, `isNhapKho`, `isXuatKho`, `isPhieuThu`, `isPhieuChi`, `isDonDatHang`, `isDeNghiXuat`...). Với mỗi cờ được bật, SP **xóa chứng từ `LinkID='Import'` trong kỳ rồi INSERT lại** từ `X23STN..*`.
- **Ánh xạ bảng**:

  | Nguồn | Đích |
  |---|---|
  | `InvoiceTbl` / `InvoiceOnlineTbl` | `AR_InvoiceTbl` |
  | `ReturnTbl` / `ReturnOnlineTbl` | `AR_ReturnTbl` |
  | `OrderTbl` | `AR_OrderTbl` |
  | `InvoiceRequestTbl` | `AR_InvoiceRequestTbl` |
  | `ChuyenKhoTbl` | `IV_TranferTbl` |
  | `NhapKhoTbl` | `IV_InputTbl` / `IV_AdjustTbl` |
  | `XuatKhoTbl` | `IV_OutputTbl` |
  | `ReceiptTbl` / `PaymentTbl` | `CS_*` |
  | `GJ_EntryTbl` | `GJ_EntryTbl` |

  Danh mục đi kèm: chi nhánh → kho + KH, nhân viên → đối tượng, `CF_CategoryTbl`, `CF_ItemTbl`.
- **Chặn lệch số liệu.** Trước khi lấy, SP kiểm tra từng phiếu: nếu header `BaseTotal` lệch chi tiết > 20 đ (có xét hàng KM `ItemKM`) thì `RAISERROR` "không khớp dữ liệu chi tiết" và dừng.
- Nguồn: `D:\Data\Santino\.audit-doanhso-20261103\LayDuLieuTuBanHangStp.sql:1-200,181-195`.
- **Phía ERP.NET** có form tương tự `AR_ChonTuThuNganFrm` "Chọn dữ liệu từ thu ngân": `AR_ChonDuLieuThuNgan_UpdateStp`, nút "Cập nhật vào kế toán" (`ERP.NET/ERP/AR_ChonTuThuNganFrm.cs:310-361`).
- **Lỗi đã gặp.** Phiếu có tổng header ≠ tổng chi tiết; đã viết `InvoiceMismatchListStp` để liệt kê (`D:\Data\Santino\InvoiceMismatchListStp.sql`). Thêm một số sửa SP báo cáo trong `D:\Data\Santino\.audit-x23stn\*\ket-*.txt`: loại mã vận chuyển `VC%` khỏi công nợ đại lý tổng hợp; mẫu in "Phiếu bán hàng tổng hợp Sau CK"; view `CF_PNHH_ItemName2View` nhân dòng vì join theo `ItemName2` qua nhiều SKU.

### 2.7 Châm hàng bán lẻ tự động (Santino) — [XM tài liệu]

Nguồn:
- `D:\Data\Santino\HUONG_DAN_CHAM_HANG_BAN_LE_TU_DONG_V4_1_4_20260903.docx` (V4.1.4);
- `...HUONG_DAN_THIET_LAP_VA_SU_DUNG_CHAM_HANG_BAN_LE_TU_DONG_20260908.docx`;
- `D:\Data\Santino\CHAM HANG BL-IT.xlsx` (bản đặc tả cho IT: input → logic → output, ma trận ưu tiên);
- `D:\Data\Santino\ChangeHistory.sql` (bảng nền).

- **Đơn vị khai báo = Mã hàng 2** (mã cha). Các SKU/size con tự liên kết.
  - **Phạm vi**: toàn bộ / nhóm cửa hàng / cửa hàng. Cấu hình cụ thể thắng cấu hình chung.
  - **Loại trừ**: để trống "Nhóm châm hàng".
- **Công thức**:
  - `Tồn mục tiêu = CEILING(Tốc độ bán bình quân × Target DOC + Tồn an toàn)`.
  - `Nhu cầu = MAX(0, Tồn mục tiêu − Tồn hiện tại)`.
  - Tốc độ bán tính trên **cửa sổ 30 ngày, chỉ tính ngày có hàng** (loại ngày hết hàng). Chưa có policy thì dùng định mức cũ và ghi chú giải.
- **Chọn policy** khi nhiều policy cùng khớp: cửa hàng > nhóm cửa hàng; Mã hàng 2 > nhóm châm; hiệu lực mới hơn thắng.
- **Phân bổ khi kho tổng thiếu**: giữ hàng chủ động (đúng `HoldQty`) → hàng Marketing → điểm ưu tiên hàng → điểm ưu tiên cửa hàng → tỷ lệ thiếu/tồn mục tiêu → tốc độ bán → tiêu chí cố định để kết quả ổn định.
  - Cửa hàng không nằm trong lần chạy thì không tạo nhu cầu và không chiếm tồn, trừ phần giữ hàng.
- **Lịch tuyến**: ngày châm 1..7 (Thứ 2..Chủ nhật), ví dụ `1;3;5`. Chạy được theo tuyến, nhóm hoặc cửa hàng.
- **Output** (`AutoReplenishmentReport`, 44 cột): MSP, Mã hàng 2, DOC, DOC thực tế, OOS %, Lost Sales, Size coverage, Nhu cầu bổ sung, SL đề nghị, Hành động (Châm ngay / Chờ duyệt / Không châm), Chú giải, thời điểm reset cache...
- **Đã có UAT** (bảng nghiệm thu PASS). Tài liệu ghi "Production sau UAT được khôi phục nguyên trạng".
- Kèm `TAO_MSP_2026.xlsx` (Power Query sinh MSP): quy tắc `MSP = FORM + SIZE + MÃ ĐƠN GIÁ + MÀU`, ví dụ `WJR+46+168+W731`; có ma trận nhóm hàng SKU101..116 × size và kiểm tra trùng/thiếu.
- SP thực thi (ví dụ `sp_AR_SyncRetailItemCatalogV4`, trigger `trg_IV_ItemLevel*_ARCatalogSync`) **chưa đọc định nghĩa** [XM tên trong `01.response.json`].

### 2.8 Thiết bị ngoại vi (BanHang) — kết luận

| Thiết bị | Có? | Bằng chứng |
|---|---|---|
| Máy quét mã vạch | Có, dạng **bàn phím (keyboard wedge)**: quét vào ô `txtBarcode`, sự kiện Enter | `InvoiceFrm.cs:2334-2358` [XM] |
| Máy in bill | Có: chọn máy in Windows từ `PrinterSettings.InstalledPrinters`, lưu registry; ActiveReports `PrintOut`. Không in ESC/POS thô | `InvoiceFrm.cs:2285-2294,2485`; tương tự `ReturnFrm.cs:987`, `Return2Frm.cs:1189` [XM] |
| In tem mã vạch | Có rpx `BarcodeReport.rpx` | `D:\Data\Santino\BanHang_SantinoTest2026\Reports\` [XM tên] |
| Ngăn kéo tiền, cân điện tử, màn hình khách, cổng COM | **Không**. `GetSysParam("COM1")` là **tên công ty**, không phải cổng serial | grep `SerialPort/COM/ESC` không thấy (`MainFrm.cs:512`) [XM] |
| Camera / VideoGrabber | `VideoGrabberNET.dll` có trong thư mục chạy, nhưng chỉ `Tools` dùng: `WebCamCaptureFrm` chụp ảnh để đính kèm (`AttachFileX`) | `Tools/Tools/WebCamCaptureFrm.cs:1108`, `Tools/Tools.Utils/Functions.cs:10478-10511`, `Tools/Tools/AttachFileX.cs:827` [XM] |
| Giao diện cảm ứng | **Không**: lưới Janus, phím F, ô combo. ERP.NET có nhắc `POS.PRO.TOUCH.exe` trong danh sách auto-update, nhưng exe này **không có** trong `D:\Data` | `ERP.NET/ERP/MainFrm.cs:702` [XM] |

### 2.9 Spa (`D:\Data\Spa\`, DB `X26SPA`) — chủ yếu [SĐ]

- Chạy cùng BanHang nhưng build cũ hơn. Layout chỉ 36 file, chủ yếu là form động `*ListFrm`.
- `InvoiceListFrm`:
  - header có `SoBan`, `Tang`, `GioVao`, `PhongLanh`, `EmployeeID2`, `NhanVienGiamGia`;
  - **mỗi dòng dịch vụ chia cho tối đa 4 nhân viên kèm %** (`EmployeeID..4`, `EmployeePercent..4`).
- `ItemListFrm` có `TienHoaHong`, `DonGiaPhongLanh`, `IsService`. Kèm báo cáo `HR_BangKeHoaHong*`. Đây là mô hình **bán dịch vụ spa + hoa hồng kỹ thuật viên** [XM cột; SĐ nghiệp vụ].
- Có danh mục lạ `CF_DaQuyTblFrm` (`TenDaQuy`) và rpx `BangKeCongViecCayTrong*`, có lẽ là di sản template [SĐ].

---

## 3. ERP.VLS.exe + VLS.Schedule06140.dll + VLS.Student06101.dll — trung tâm đào tạo VLS

### 3.1 Mục đích và cấu trúc

- ERP.VLS là **snapshot cũ ERP NET 6.7** (`ERP.VLS/ERP/MainFrm.cs:535`). So với ERP.NET:
  - **bỏ** hầu hết AR/AP/IV/eInvoice/vận chuyển (ERP.NET có thêm khoảng 187 file);
  - **thêm** phân hệ **06 "Giảng dạy - Academy"** (`AC_*`), CRM giáo dục (`CR_*`) và HR đầy đủ (`HR_*`), cùng `GJ_PayrollFrm`, `SelectFileUploadFrm`.
  - Các form dùng chung (CS/GJ/FA/EQ/OF) ở VLS ngắn hơn khoảng 40% [XM số dòng].
- Hai DLL **không thay exe hay Tools.dll**. Chúng là plugin nạp qua khóa metadata **`SY_FrmCfg.KeyID='UCC'`** (UserBaseClass) của form động [XM]:
  - **`VLS.Schedule06140`**: `KeyValue='VLS.Custom.GiaoLop06140, VLS.Schedule06140'` gắn vào form động `AC_PhieuGiaoLopFrm` (`D:\Data\VLS\LuuTru\NoiDungAudit\audit-06140\deploy-generated.sql:139-140`).
    - Engine gọi `Type.GetType(...)` → `Activator.CreateInstance` → gán `ParentmFC` → `Init()` (cơ chế xem ở `Tools/Tools.Layout/LayoutX.cs:886-896`, `Tools/Tools/SysObject.cs:63-75`, `Tools/Tools.SysForm/FrmFormList.cs:366-400`, trên build Tools đã dịch ngược).
    - `Init()` chỉ nhận form `AC_PhieuGiaoLopFrm` (`VLS.Schedule/VLS.Custom/GiaoLop06140.cs:67-72`).
  - **`VLS.Student06101`**: `StudentProfileBootstrap` dùng reflection chèn `AC_HoSoHocVienFrm` vào danh sách form nội bộ. Khi form vỏ hiện lên, nó đóng vỏ và mở form con (`VLS.Student/VLS.Custom/StudentProfileBootstrap.cs:14-72`).
    - `AC_HoSoHocVienFrm` **kế thừa `ERP.AC_HoSoFrm` trong exe** (`VLS.Student/VLS.Custom/AC_HoSoHocVienFrm.cs:14`).
  - **Phụ thuộc nguy hiểm**: DLL gọi reflection vào **tên member đã obfuscate** của exe (`GiaoLop06140.cs:210-292`, `TeacherFinder.cs:34-42`). Đổi build exe là gãy.
- **Ý nghĩa mã**: 06101/06140 = mã menu cũ (`0610` Hồ sơ HV, `0614` PGL) + một chữ số. Menu chính 0610/0614 nay trỏ sang form mới; 06101/06140 bị ẩn (`D:\Data\VLS\LuuTru\KhoiPhucMenuGiangVien-20261021\07-after.json`, `D:\Data\VLS\BanGiao_VLS_20261021\HUONG-DAN.txt`) [XM].
- **Phát hành DLL** qua AutoUpdate, bảng `SY_ResUx(FID, FN, FD, FV, FC)`: `FV` = ProductVersion. Bản hiện hành: Schedule 1.0.2026.1024, Student 1.0.2026.1021 (`VLS.Schedule/Properties/AssemblyInfo.cs`, `HUONG-DAN.txt`) [XM].

### 3.2 Màn hình chính

| Form (menu) | Nghiệp vụ | Bảng / view / SP | Mẫu in |
|---|---|---|---|
| `AC_HoSoHocVienFrm` (0610, form động + DLL 06101; trước là `AC_HoSoFrm`) | Hồ sơ HV/đơn vị; cây cha–con: công ty = `ParentObjectID`, nhóm = `ParentObjectID2`; 8 tab, file đính kèm | `CF_ObjectTbl` (`isStudent=1`, thêm Goals/LearnBest/InterestTopics/NamSinh), `AC_CertificateTbl`, `CR_LienHeTbl`, `vCF_ObjectThongTinChung`, `vCF_ObjectDaHocDaDay`, `CF_ObjectGopYTbl`, `CF_ObjectChatTbl`, task `OF_ScheduleTbl` (`ERP.VLS/ERP/AC_HoSoFrm.cs:2057-2128`) | `AC_HoSoReport`, `AC_CongNoHocVienDetailReport` |
| `AC_HoSoGiangVienFrm` (0611) | Hồ sơ GV (`isTeacher`), gắn mã nhân viên, giờ rảnh đăng ký | `CF_ObjectTbl` ⋈ `HR_NhanVienTbl`, `AC_YKienGiangVienTbl`, `AC_ThoiGianGiangVienTbl` (`AC_HoSoGiangVienFrm.cs:1037-1090`) | – |
| **`AC_PhieuGiaoLopFrm` (0614, form động + `GiaoLop06140`)** | **PGL = lớp**: chọn HV + phiếu thu nguồn, dòng GV (thứ/giờ/từ ngày), sinh lịch | T0 `AC_LichGiangTbl`, T1 `AC_LichGiangHocVienTbl`, T2 `AC_LichGiangGiangVienTbl`, T3 `AC_LichGiangDetailTbl`; mã `LG{MM}{YY}/{4}`; SP `VLS06140_BuildSchedule`, `AC_DatLichGiangReportStp` | `AC_DatLichGiangGiaoLopReport` (A4 dọc), `...GiaoLop2Report` (A4 ngang) + subreport `_720`, `_StudentProfiles` |
| `AC_DatLichGiangFrm` (bản exe cũ của 0614) | Nay chỉ còn dùng **để in** (DLL gọi lại handler in) | như trên (`AC_DatLichGiangFrm.cs:977-1105`) | `AC_DatLichGiangReport` |
| `AC_DatLichGiangTimGiangVienFrm` | Popup tìm GV rảnh; DLL thay handler | `CF_ObjectTbl`, `AC_LichGiangDetailTbl`, `AC_ThoiGianGiangVienTbl` | – |
| `AC_LichGiangFrm` | Xem lịch theo phiếu, xin nghỉ buổi, giờ ĐK/đã học/còn lại | `AC_LichGiang*` (`AC_LichGiangFrm.cs:899-1004`) | – |
| `AC_LichGiangTongHopFrm` (0617) | Lịch tuần **Janus Schedule** (WorkWeek 10 ngày), xin nghỉ, in | `AC_LichGiangProcessView` (`:692-698`) | `AC_DatLichGiangReport` |
| `AC_LichGiangTimelineFrm` | **Janus TimeLine** 2 tháng, nhóm theo GV, màu theo trạng thái, làm mới 30 phút | `AC_LichGiangProcessTimeLineView` (`:607`) | – |
| `AC_PhieuBaoGiang2026Frm` (0621; bản exe `AC_PhieuBaoGiangFrm` 0620 đã ẩn) | **Báo giảng** = công + lương GV + doanh thu HV, định khoản | `AC_PhieuBaoGiangTbl/DetailTbl`, `AC_PhieuBaoGiangAcc2View`, `AC_PhieuBaoGiang_CopyPhieuTruocStp`, `_CopyLichGiangStp` (`AC_PhieuBaoGiangFrm.cs:1269-1450`); bản 2026 thêm `IsChecked`, `TongSoTiet`, `ThuKhac`, `TruKhac`, `VATTNCN`, `*Notes` | `AC_PhieuBaoGiang2026Report` |
| `AC_PhieuThu2026Frm` (06240; bản exe 0624 đã ẩn) | **Thu học phí theo gói giờ** (VND), nhóm "Thông tin xuất hóa đơn công ty" | `AC_PhieuThuTbl`, `AC_PhieuThuView`, `AC_PhieuThuChietKhauTbl`, `AC_PhieuThu_CheckRequierXHDStp` (kiểm tra trước lưu), `AC_PhieuThu_UpdateNguonGoc_Stp` (`D:\Data\VLS\LuuTru\PhieuThu-TrucThuocNhom-20261027\forms.json`) | `AC_PhieuThu2026Report` |
| `AC_PhieuThuKhac2026Frm` (06250), `AC_PhieuChiFrm` (0626), `AC_InvoiceFrm` (0630, Invoice/Quotation tiếng Anh), `AC_CertificateFrm` (0632), `AC_YKienGiangVienFrm` (0613) | Thu khác (có NV bán hàng + xuất HĐ), chi, invoice, chứng chỉ, nhận xét GV về HV | `AC_PhieuThuKhacTbl`, `AC_PhieuChiTbl`, `AC_InvoiceTbl`, `AC_CertificateTbl`, `AC_YKienGiangVienTbl` | các `AC_*Report` |
| `CR_*` | Tiềm năng → KH/HV, liên hệ, chiến dịch, chăm sóc, hậu mãi, giới thiệu, đối tác, quảng cáo | `CR_TiemNangTbl`, `CR_KhachHangTbl`, `CR_ChienDich*`, `CR_ChamSoc*`, `CR_HauMai*`...; **chuyển tiềm năng** INSERT `CF_ObjectTbl(isStudent=1, mã HV+số)` và chuyển task (`CR_ChuyenTiemNangFrm.cs:369-447`) | `CR_TiemNang*`, `CR_HieuQuaChienDichReport`... |
| `HR_*` | Tuyển dụng, hồ sơ/HĐLĐ, lương, BHXH, đào tạo nội bộ (`HR_KhoaHocTbl` là khóa học **nội bộ**, không phải khóa của HV), đánh giá | `HR_*Tbl` | – |

Menu 0615 Trial (học thử), 0616 Book lịch GV tạm, 0618 "Theo dõi lớp nhóm nghỉ học" và 12 danh mục 0606xx (trình độ, nơi học, địa điểm, nhóm, chương trình/Promotion, nguồn gốc, % CK theo giờ...) đều là **form động**; chưa có cấu hình offline [XM tên; SĐ nội dung].

### 3.3 Luồng nghiệp vụ đào tạo

1. **Tiềm năng → học viên**: `CR_TiemNangFrm` → `CR_ChuyenTiemNangFrm` tạo `CF_ObjectTbl.isStudent=1` [XM].
2. **Hồ sơ HV** (0610). Mặc định tạo mới: mã `HV` + 5 số (`AC_HoSoFrm.cs:2090-2112`) [XM].
3. **Thu học phí = mua gói giờ** (`AC_PhieuThuTbl`):
   - Các cột: SoGio, SoTien, PhuPhi, PhiKhac (off campus), ChietKhau/TienChietKhau, ThucNhan, NgayBD/NgayKT, TrinhDo, Nhom, DiaDiemHoc, FieldTrip, ChuongTrinhID, NguonGoc, NguoiGioiThieu, NV bán hàng, XuatHoaDon (`AC_PhieuThuFrm.cs:1477-1483`) [XM].
   - **Hạn mức chiết khấu** = `MAX(ChietKhau) FROM AC_PhieuThuChietKhauTbl WHERE SoGio <= (giờ phiếu này + Σ giờ các phiếu trước của HV)`. Vượt hạn mức: non-admin bị chặn, admin được hỏi (`AC_PhieuThuFrm.cs:1532-1566`) [XM]. Có lỗi chia 0 khi SoTien=0.
4. **Lớp = PGL**. Không có thực thể "Lớp/Khóa" riêng. `Nhom` trống thì gán "N" + số HV [XM].
   - Chọn HV (`isStudent=1`), rồi chọn **phiếu thu của chính HV đó** để ánh xạ TrinhDo, Nhom, NgayBatDau/HetHan, TongSoGioHoc, nơi học (`GiaoLop06140.cs:625-821`).
   - **Chặn lưu** khi: đổi HV/phiếu thu sau khi đã có lịch; Σ giờ GV ≠ tổng giờ lớp; Σ giờ lịch ≠ tổng lớp; giờ không chia hết 15 phút (`:558-591,823-866`).
   - Non-admin không sửa/xóa phiếu của người khác (`:78-81`) [XM].
5. **Tìm GV rảnh** (`VLS.Schedule/VLS.Custom/TeacherFinder.cs:91-162`) [XM]:
   - Ứng viên: `isTeacher=1`, chưa ngừng.
   - **Loại trừ** GV có buổi chưa `Cancel` trong khoảng ngày, đúng thứ, và **giao khoảng giờ** (`d.TuGio < @DenGio AND d.DenGio > @TuGio`, so chuỗi "HH:mm"; buổi tiếp giáp không tính là trùng).
   - Giờ rảnh đăng ký (`AC_ThoiGianGiangVienTbl`) chỉ hiển thị tham khảo, **không lọc**.
   - **Lỗi**: tham số `unusedDocument` bị bỏ qua, nên lịch của chính phiếu đang sửa vẫn làm GV bị coi là bận.
6. **Sinh lịch** — `VLS06140_BuildSchedule(@DocumentID, @Mode AUTO|REBUILD|ALLOCATE, @TotalHours, @TeacherOrder xml)` (`D:\Data\VLS\LuuTru\NoiDungAudit\audit-06140\VLS06140_BuildSchedule.sql`) [XM]:
   - Khóa header (UPDLOCK). Dựng toàn bộ buổi trong `#Sessions`, rồi DELETE + INSERT `AC_LichGiangDetailTbl` trong một transaction.
   - Mỗi GV có `DayMask` (T2=1…CN=64), `Duration` = DenGio − TuGio; buổi cuối được rút ngắn.
   - Chế độ **AUTO/REBUILD**: mỗi GV chạy theo số giờ riêng của dòng.
   - Chế độ **ALLOCATE**: chia một quỹ giờ chung theo thứ tự ưu tiên của dòng trên lưới, ghi lại giờ từng GV, chặn khi lẻ quá 1 chữ số thập phân.
   - Bản exe cũ (`AC_DatLichGiangFrm.cs:1107-1177`) không có transaction và có thể sinh buổi 0 giờ.
7. **Trạng thái buổi**:
   - `Planned` → `Completed` tự động khi `NgayDay <= now`. Lệnh UPDATE **chạy trên toàn bảng mỗi lần mở form** 0614/Timeline/LichGiang (`p19kDqdnSTwCNlOxGQ/JNpCIwPtpyEldfhUYw.cs:190-195`).
   - `Planned` → `Cancel` khi xin nghỉ: ≥ 12h trước ngày học ở `AC_LichGiangTongHopFrm.cs:747-779`, nhưng ≥ 24h trước giờ học ở `AC_LichGiangFrm.cs:985-1004`. **Hai quy tắc không thống nhất** [XM].
8. **Điểm danh từng HV × buổi: KHÔNG CÓ** [XM]. Thông tin học/hủy/phạt chỉ ghi ở dòng báo giảng (`TietHoc`, `TietHuy`, `TietPhat`, `SoTiet`).
9. **Báo giảng → lương GV**:
   - `TienThucNhan = ΣTienGV + PhuCap + Thuong + PhuCapCM − BHXH − KPCĐ` (`AC_PhieuBaoGiangFrm.cs:1336`).
   - `TongSoTiet` chỉ tính trên UI, không lưu (`:1341-1354`).
   - Có định khoản qua view `AC_PhieuBaoGiangAcc2View`.
10. **In PGL + email**:
    - SP in trả 3 tập dữ liệu: GV / danh sách HV / hồ sơ cá nhân. Quy tắc ẩn mục trống, "Others", "Học viên không điền" và phân biệt dòng nhóm/cá nhân **nằm trong SP** (`D:\Data\VLS\bin_VLS_Dev\SQLBackup\PGL_2026-11-06\AC_DatLichGiangReportStp_fix.sql`).
    - Gửi mail qua viewer của Tools (`EmailSendEditorFrm`). `PglEmailFormatting` ép Arial 12pt khi nội dung có "PHIẾU GIAO LỚP" (`VLS.Schedule/VLS.Custom/PglEmailFormatting.cs:25-217`) [XM]. SMTP cấu hình trong DB/Tools (đã lược).
11. **Công nợ giờ học**: chỉ có báo cáo (`AC_CongNoHocVien*`, `AC_TongKetGioDayHocVien*`, `AC_BaoCaoThuTienBaoGiangReport`) [XM tên].
12. **Chứng chỉ**: `AC_CertificateFrm`, đánh số dạng "n /Cer - VLSyy" (`AC_CertificateFrm.cs:550-557`) [XM].

### 3.4 Quy tắc hồ sơ HV (DLL 06101) — [XM]

- **Goals** (6 mục), **LearnBest** (10 mục), **InterestTopics** (14 mục) bị **hardcode** trong `StudentProfileRules.cs:14-22`.
  - Lưu chuỗi ngăn bằng `;` (`:29-42`).
  - "Học viên không điền" phải đứng một mình. Chọn "Others" thì bắt buộc nhập phần mô tả (≤ 1000 ký tự), trừ InterestTopics (`:44-73`).
  - Từ 21/10/2026 cả 3 nhóm **không bắt buộc** (`AC_HoSoHocVienFrm.cs:391`).
- **NamSinh**: có NgaySinh thì lấy năm của NgaySinh và khóa ô nhập; không có thì nhập số trong khoảng 1000 đến năm hiện tại (`StudentProfileRules.cs:75-96`).
- **Nút "Xem lịch giảng"** mở `AC_PhieuGiaoLopFrm`, lọc theo `AC_LichGiangHocVienTbl.ObjectID` (`AC_HoSoHocVienFrm.cs:237-269`).

### 3.5 Thư viện / thiết bị đặc biệt

- **MindFusion Diagramming**: exe VLS không dùng trực tiếp. Tools dùng cho **dashboard dạng sơ đồ**: file `.drb` lưu trong `{Module}_DshBrdCnt`, bấm vào nút trên sơ đồ để mở menu, Ctrl+Click để mở trình vẽ (`Tools/Tools/MyDiagramCxtl.cs:156-293`, `Tools/Tools.SysForm/DashboardFrm.cs:1053-1062`) [XM trên build Tools đã dịch ngược]. Nội dung sơ đồ của VLS chưa rõ [SĐ].
- **Janus Schedule/TimeLine** cho lịch giảng (xem §3.2).
- **Chat nội bộ** (`clsChat`), **nhắc lịch** (`Notifier` + `Reminder.wav`), **AutoUpdate mỗi giờ** (`ERP.VLS/ERP/MainFrm.cs:527-541`) [XM].
- **Không có** ngoại vi bán hàng (máy quét, cân...). Có `ItemBarcodeInputCtl.cs` kế thừa nhưng không thấy dùng trong luồng AC [SĐ].

### 3.6 Thay đổi gần đây (10–11/2026, theo `D:\Data\VLS\BanGiao_VLS_20261021\HUONG-DAN.txt`, `DB\*.sql`, `D:\Data\VLS\LuuTru\*`)

- **20/10**: dựng 06140 (UCC + DLL + SP sinh lịch); nguồn PGL đổi từ `CS_Receipt` sang **phiếu thu HV**; thêm `AC_LichGiangTbl.NgayBatDau`, `AutoStudentRowID`.
- **21/10**:
  - hồ sơ HV 06101; chuyển menu chính; khôi phục menu Hồ sơ GV;
  - sửa view `vCF_ObjectDaHocDaDay` (trước gắn sai HV/GV vì lấy `ObjectID` đầu phiếu) (`DB\Update-KhoaDaHoc.sql`);
  - dropdown nơi học = UNION 2 danh mục, cho phép nhập ngoài danh sách (`DB\Update-NoiHoc.sql`).
- **23/10**: mẫu PGL Arial 12, thêm bản **A4 ngang**; danh sách mẫu lưu trong `SY_RpDTbl`, file rpx đăng ký vào `SY_RpFTbl` (**mẫu in lưu trong DB**).
- **27/10**: bỏ cột lưu thừa `AC_PhieuThuTbl.ParentObjectName2`; view tự tính "Trực thuộc nhóm".
- **05–06/11**: sửa `AC_TongKetGioDayHocVienReportStp` (lọc chi nhánh theo hồ sơ HV) và `AC_DatLichGiangReportStp` (`D:\Data\VLS\bin_VLS_Dev\SQLBackup\`).
- **Quy mô dữ liệu** (audit): khoảng 6,9 nghìn PGL, 10,3 nghìn dòng GV, 8,2 nghìn dòng HV, khoảng 231 nghìn buổi, 14,4 nghìn phiếu thu; 250 buổi lịch sử có `SoGio<=0` [XM audit].
- `bin_VLS_Dev_NamA` chạy **ERP.NET.exe chuẩn** (kế toán "Nam Á"), không có DLL VLS [XM].

### 3.7 Tài liệu "Đề xuất ERP" (PDF/DOCX, 15/07/2026)

- Nội dung thực tế là **22 yêu cầu chỉnh sửa KT01–KT22** của kế toán, không phải mô tả phân hệ [XM].
- Phần lớn đã được đáp ứng bằng các form 2026:
  - **Phiếu báo giảng**: cột đánh dấu đã kiểm, Thu khác/Trừ khác/TNCN, ô diễn giải;
  - **Phiếu thu HV**: bỏ USD/tỷ giá, nhóm xuất HĐ công ty có kiểm tra bắt buộc;
  - **Phiếu thu khác**: NV bán hàng, xuất HĐ.
- Mức độ: [XM tên cột layout; hành vi chưa kiểm chứng].
- Một số yêu cầu thuộc ERP Nam Á (ERP.NET), ngoài phạm vi.
- Tài liệu "Đề xuất sửa ERP & PGL Final.pdf" được audit nhắc tới **không có** trong `D:\Data\VLS`.

---

## 4. SoBaBuoc.exe — Sổ 3 bước an toàn thực phẩm (ATTP.NET 2.0, DIM)

### 4.1 Mục đích

Ghi **sổ kiểm thực 3 bước** cho bếp ăn tập thể:
- **Bước 1**: kiểm tra nguyên liệu trước khi chế biến (tươi sống / khô, bao gói).
- **Bước 2**: kiểm tra khi chế biến.
- **Bước 3**: kiểm tra trước khi ăn.
- Kèm **lưu và hủy mẫu thức ăn**.
- Quản lý **giấy chứng nhận ATTP** của nhà cung cấp và **hợp đồng** có ngày hết hạn.

Mức độ: [XM từ layout/rpx]. Việc 5 mẫu in tương ứng mẫu sổ kiểm thực 3 bước của Bộ Y tế (QĐ 1246/QĐ-BYT) là [SĐ], dựa trên cấu trúc cột.

### 4.2 Mã nguồn: chỉ có khung, nghiệp vụ ATTP nằm trong metadata — [XM]

- `AssemblyTitle/Product = "Quan ly Kinh doanh"` (`SoBaBuoc/Properties/AssemblyInfo.cs`). Chỉ có MainFrm mang chữ ATTP (`SoBaBuoc/ERP/MainFrm.cs:380,411`). **Không có form ATTP nào được biên dịch**.
- 37/46 file trùng tên ERP.NET. Phần riêng là **di sản của các khách khác**:
  - `AR_HoSoKhachHangThanhTamFrm`, `AR_OrderThanhTam*` (bán hàng "Thanh Tâm", đồng bộ BMS `SY_Syn_BMS_OrderStp`) (`AR_OrderThanhTamFrm.cs:562,685`);
  - `KD_ImportLDXFrm`, `KD_LenhDieuXeBaseClassAcc`, `KD_TuyenDuongGiaBaseClassAcc` (lệnh điều xe / tuyến đường, nhập từ Excel; UCC classes) (`KD_ImportLDXFrm.cs:313,507`);
  - `SL_SalaryGroupFrm` (nhóm tính lương) (`SL_SalaryGroupFrm.cs:564-595`);
  - `AR_PromotionBaseClass`, `TestUserBaseClass`, `Common.cs`.
- Những phần này **không có layout** trong DB ATTP nên coi là không dùng [SĐ].
- **MainFrm**:
  - chỉ kiểm cập nhật `ERP.NET.exe;MRP.NET.exe;HR.NET.exe` (`:405`);
  - xóa `UpdateLog.txt` vào ngày 3 hằng tháng (`:394-396`);
  - admin mode khi máy "NDD" và user Admin/… (`:414`).
- **LoginFrm** (1.515 dòng) giống ERP.NET hơn BanHang:
  - F3 chọn danh sách cấu hình, nút "Fix DB", nhóm "Logo - ModuleID" (Main Icon/Top Logo/Left Logo) để đổi thương hiệu (`LoginFrm.cs:662,689,886-906,1164-1166`);
  - `SY_DatabaseSelectorFrm`, `SY_ConfigSelectorFrm`;
  - cũng tự chèn user Admin mặc định (`:1013`, đã lược hash).

### 4.3 Màn hình dùng thực tế (`D:\Data\DIM-ATTP\SoBaBuoc_ATTP_Dim\Layout\SoBaBuocATTP\`, 20 file) và mẫu in

| Form động (DB `SoBaBuocATTP`) | Nghiệp vụ | Trường (header / chi tiết) | Mẫu in |
|---|---|---|---|
| `KD_ATTP11Frm` | **Bước 1.1** — nhập thực phẩm **tươi sống** | H: DocumentDate, BranchID/BranchName (bếp/cơ sở), **LoaiTiec**, Memo, DiaChi, isLock. D: ItemName, SoLuong, Unit, TenCoSo, DiaChiDienThoai, TenChuGiaoHang, ChungTuHoaDon, **GiayKDVSThuY**, **SoKiemDich**, **CamQuan**, CamQuanKD, **ViSinh**, GhiChu | `KD_ATTP11Report.rpx` |
| (form chưa có layout offline) | **Bước 1.2** — thực phẩm **khô / bao gói sẵn** | TenCoSoSX, DiaChiSX, **HanDung**, **BaoQuanNhietDo**, CamQuanDat… | `KD_ATTP12Report.rpx` |
| (như trên) | **Bước 2** — kiểm tra **khi chế biến** | **CaAn**, ItemName (món), NguyenLieuChinh, SoCheXong, NauXong, NguoiThamGia, TrangThietBi, KhuVucCheBien, KhoiLuong, CamQuanDat | `KD_ATTP20Report.rpx` |
| (như trên) | **Bước 3** — kiểm tra **trước khi ăn** | CaAn, TenThucAnLuu, ThoiGianChiaMon, VatDungChia, ThoiGianAn, SoLuongSuatAn, CamQuanDat | `KD_ATTP30Report.rpx` |
| (như trên) | **Lưu và hủy mẫu thức ăn** | TenThucAnLuu, NgayGioLuu, NgayGioHuy, NguoiLuuMau, NguoiHuyMau, KhoiLuong/TheTich, VatDungBaoBiLuu, NhietDoBaoQuan, GhiChuChatLuong | `KD_ATTP40Report.rpx` |
| `CF_MonAnListFrm` | Danh mục món | TenMonAn, NguonGoc, NhietDoBaoQuan, ThoiGianSuDung, XetNghiemNhanh, XetNghiemLayMau, LuuMau | – |
| `CF_GiayATTPListFrm` | Giấy chứng nhận ATTP theo NCC/nguyên liệu | ItemName, NhaCungCap, NgayCapGiayCN, NgayHetHanGiayCN, **SoNgayConLai** | `CF_GiayATTPListReport.rpx` |
| `CF_HopDongListFrm` | Hợp đồng NCC + danh sách mặt hàng | ContractID/Name/Name2, ContractDate, NgayHetHan, SoNgayConLai; D: ItemName | `CF_HopDongListReport.rpx`, `CF_HopDongHetHanReport` |
| `ObjectListFrm` | NCC / chủ giao hàng | ObjectID, ObjectName, TenCoSo, TenChuGiaoHang, DiaChiDienThoai | – |
| `CF_BranchListFrm` | Cơ sở / bếp | BranchName/Name2, NguoiPhuTrach, DiaChi, DienThoai, MST, NganhNghe, BranchGroup | – |
| `KD_NguoiDungFrm`, `NguoiDungPhanQuyen(User)Frm` | User + phân quyền theo đối tượng (Run/Add/Update/Delete/Manager/Admin/ExportExcel/LockDoc/HideAmount) | | |

Ghi chú:
- Reports\ còn có `KD_BaoCaoNXT/NhapKho/XuatKho/CongNo*`, `KD_PhieuNhap/Xuat`, `KD_DonHangReport`. Có thể là kho nguyên liệu, hoặc di sản [SĐ].
- Có 3 DB: `SoBaBuocATTP` (đang dùng), `SoBaBuocCT`, `SoBaBuocTB` (gần như rỗng: chỉ 3 và 1 layout) [XM]. Ý nghĩa CT/TB chưa rõ.

### 4.4 Luồng (suy từ cấu trúc) — [SĐ]

1. Khai báo cơ sở bếp, NCC, món ăn, giấy CN ATTP, hợp đồng.
2. Mỗi ngày / mỗi bữa (`LoaiTiec`, `CaAn`):
   - lập phiếu Bước 1.1 và 1.2 khi nhận hàng;
   - lập Bước 2 khi nấu;
   - lập Bước 3 khi chia món;
   - lập phiếu lưu mẫu, sau đó ghi giờ hủy mẫu.
3. In sổ theo mẫu, có đánh số trang "Trang 1/5".
4. Báo cáo cảnh báo giấy CN và hợp đồng sắp hết hạn (`SoNgayConLai`).
5. Khóa phiếu bằng `isLock`.

---

## 5. POS_DEMO — demo POS web tĩnh (`D:\Data\POS_DEMO\POS_DEMO\`)

### 5.1 Màn hình — [XM]

| File | Màn hình | Hành vi |
|---|---|---|
| `dashboard.js` + `dashboard.css` (**thiếu `dashboard.html`**) | **Sơ đồ bàn theo khu vực** + toolbar (Đặt món, Tính tiền, Trang chủ) | Tải khu vực → bàn. Thẻ bàn dùng `b.class` + `b.html` **do server trả về** (HTML dựng sẵn). Mở bàn thì hỏi số khách → `menu.html?ban=&songuoi=`. "Tính tiền" chỉ hiện bảng món qua `Pos_Api_TinhTien`; **chưa có thanh toán thật** (`dashboard.js:65-90,177-215,296`) |
| `menu.html` + `menu.js` + `menu.css` | **Thực đơn gọi món** (mobile-first): nhóm món ở sidebar, tìm kiếm, giỏ, ghi chú từng món và cả đơn, sửa SL/giá | `Pos_Api_MenuMonAn` → gom nhóm phía client; "Món đã đặt" → `Pos_Api_Data{act:MonDatTruoc}`; "Gọi món" → `Pos_Api_SaveOrder{BANID, SoKhach, MonJsonStr:[{MONID,SOLUONG,GIABAN,GHICHU}], GhiChu}` rồi quay về dashboard (`menu.js:211-288,946-1056`). Có cờ `TheoThoiGia` (món theo thời giá) |
| `kitchen.html` + `kitchen.js` | **Màn hình bếp (KDS)**: lọc theo trạng thái, món ngon/món khóa hôm nay | `api_GetOrdersForKitchen`; nút chuyển trạng thái `Chưa thực hiện → Đang thực hiện → Hoàn thành → Làm lại` qua `api_UpdateTrangThaiMon{PHIEUBAN, MATHANGID, Status}`; `api_GetDanhSachMonGon`, `api_GetMonKhoaHomNay`. **Lỗi**: lúc mở trang không gọi `fetchOrders()`, dòng tự làm mới 30 giây bị comment (`kitchen.js:124-231`) |
| `inventory_report.html` | Kiểm kho nhanh: tồn cuối kỳ, nhập thực tế, chênh lệch | `axios` (CDN) `GET /api/api_GetTonKho`, `POST /api/saveKiemKho [{Mahang, ThucTe, ChenhLech}]` |
| `phieu_kiem_kho.html` | Phiếu kiểm kho nhập tay (tồn sổ / thực tế / lý do) | **Không gọi API**: "Lưu" chỉ `console.log`; có xuất CSV |
| `appclient.js` | Lớp `AppClient` | `fetch` JSON với `baseUrl="/api"`, callback `(code,msg,data)`, quy ước response `{code, msg, records}`; `jsonToTable` gọi `/sys/Caption` để lấy tiêu đề cột theo tên trường (giống `LangField` của Tools); `showPopup` |

### 5.2 Đánh giá

- **Backend không có** trong `D:\Data`. Đã grep `Pos_Api_`, `api_GetOrdersForKitchen` trong toàn bộ `.cs/.sql/.json` mà không thấy [XM].
- Tên trường khớp schema **nhà hàng `TN_*` của ERP.NET**: `TN_PhieubanFrm` "Phiếu bán hàng (Thu Ngân)" dùng `TN_Phieuban` (Banid), `TN_Phieubanct`, `TN_Phieubanct_Tramon` (MATHANGID), `TN_Phieubanct_InBill`, `TN_dmBan`, `TN_dmHanghoa` (Mahang), `TN_dmNhanvien`, `TN_dmKhachhang`; in bill bổ sung qua `ChonMayInBillFrm` (A5/khổ bill) (`ERP.NET/ERP/TN_PhieubanFrm.cs:1469-1503,1698-1710`, `ERP.NET/ERP/TN_MonAnFrm.cs:854-885`). Kết luận: POS_DEMO là frontend gọi món/bếp cho DB nhà hàng kiểu `TN_*`, backend là API thủ tục kiểu `act` [SĐ mạnh].
- **Khả năng tái sử dụng**:
  - **dùng làm mẫu UX** (sơ đồ bàn, gọi món trên điện thoại, KDS 4 trạng thái);
  - **dùng làm hợp đồng API tham khảo** (danh sách endpoint/trường ở trên).
  - **Không nên dùng nguyên mã** vì:
    - jQuery/Bootstrap 4 + chuỗi HTML ghép tay;
    - XSS: chèn `innerHTML` từ dữ liệu server, `onclick` ghép chuỗi;
    - gọi API kiểu RPC `act`, không có xác thực (token bị comment);
    - đường dẫn bị lặp `/api//Pos_Api_*` (baseUrl + path có `/`);
    - phụ thuộc `/assets/...` không có trong thư mục;
    - thiếu `dashboard.html`;
    - không có thanh toán, ca hay in.

---

## 6. So sánh với ERP.NET chính

### 6.1 Trùng tên file (namespace chính + Sys/CHAT/Schedule/eInvoice) — [XM]

| Biến thể | Trùng / tổng | Trùng với ERP.NET | Chỉ có ở biến thể |
|---|---|---|---|
| BanHang | 41 / 58 | CHAT (5), Schedule (4), `PeriodSetupFrm`, `SetupFrm`, `LoginFrm`, `MainFrm`, toàn bộ `eInvoice*` (17 + 8 form), `EinvoiceButtonCommandCtl`, `VietelAPI`, `XMLViewerFrm`, `SetupLinkServerFrm`, `clsFolderBrowser`, `CheckNotOfuscated` | `InvoiceFrm`, `Invoice2Frm`, `ReturnFrm`, `Return2Frm`, `PurchaseFrm`, `NhapKhoFrm`, `XuatKhoFrm`, `KiemKeFrm`, `StockAdjustmentFrm`, `StockTranferFrm`, `ObjectGroupPriceFrm`, `ThemNhapHangFrm`, `HR_ChamCongNgayNghiFrm`, `Pos365*`, `Post365API`, `ZaloZNS` |
| ERP.VLS | khoảng 40 (CS/GJ/FA/EQ/OF/SY…) | các form kế toán cũ, ngắn hơn khoảng 40% | toàn bộ `AC_*`, `CR_*` (trừ `CR_EmailFrm`), `HR_*`, `GJ_PayrollFrm`, `SelectFileUploadFrm` |
| SoBaBuoc | 37 / 46 | AR_* (ThanhTam, KM, giá...), OF_*, SY_* | `AR_HoSoKhachHangThanhTamFrm`, `AR_Promotion*BaseClass`, `KD_*` (điều xe), `SL_SalaryGroupFrm`, `Common`, `SelectFileUploadFrm` |

**Lưu ý về tên trùng.** BanHang `InvoiceFrm` **không phải** ERP.NET `AR_InvoiceFrm`: khác bảng (`InvoiceTbl` vs `AR_InvoiceTbl`) và khác cột. Nhưng có **cùng tên** với form động `InvoiceFrm` trong metadata DB bán hàng. Exe được ưu tiên, layout của DB vẫn có thể đè nguồn dữ liệu (`InvoiceFrm.cs:2143-2157`: `Lyt.TableMaster.isValid()`).

### 6.2 MainFrm / LoginFrm

| | ERP.NET | BanHang | ERP.VLS | SoBaBuoc |
|---|---|---|---|---|
| MainFrm (dòng) | 1.468 | 680 | 723 | 593 |
| Chat / Notifier | có | **không** | có | không thấy |
| Chi nhánh theo user | có (`isFixBranch`, chọn module) | **cứng theo `SY_User.BranchID`**, ghi lên tiêu đề | không | đọc BranchID / CostCenterID |
| Tự ALTER schema khi mở | ít | **nhiều** | – | – |
| Multi-instance form bán | – | `InvoiceFrm` mở được nhiều cửa sổ | – | – |
| LoginFrm (dòng) | 3.020 | 1.434 | 1.361 | 1.515 |
| Đặc biệt ở Login | nhiều cấu hình, ngôn ngữ, logo module, Repair/Shrink DB | Ctrl+Login → Restore DB; tự chèn Admin; mật khẩu hệ thống không để log | Windows auth, Teamview, cập nhật LAN | F3 chọn cấu hình, Fix DB, logo/icon tùy biến |

### 6.3 Trả lời câu hỏi "giao diện bán hàng cảm ứng / thu ngân / in bill / thiết bị"

- **Cảm ứng**: không có trong BanHang. Chỉ POS_DEMO (web, mobile-first) có giao diện chạm.
- **Màn hình thu ngân**:
  - BanHang chỉ có ô Khách đưa / Trả lại / Chuyển khoản trên phiếu bán, **không có ca, không có chốt két**.
  - Ở ERP.NET, "thu ngân" là `TN_PhieubanFrm` (nhà hàng) và `AR_ChonTuThuNganFrm` (lấy dữ liệu thu ngân vào kế toán).
- **In bill**: ActiveReports ra máy in Windows. Mẫu và máy in nhớ trong registry từng máy. Đếm `SoLanIn`; in xong thì khóa phiếu.
- **Máy quét**: kiểu bàn phím. **Cân / ngăn kéo / màn hình khách**: không có. **Camera**: chỉ chụp ảnh đính kèm (Tools).

---

## 7. Hàm ý cho bản web

1. **Lấy metadata DB và SP làm chuẩn, không lấy exe.**
   - Với cả ba biến thể, phải trích `SY_Menu`, `SY_FrmLstTbl`, `SY_FrmCfg`, `SY_FrmDrdwTbl`, `SY_FrmExpTbl`, `SY_FrmOptBtnTbl`, `SY_RpDTbl`, `SY_RpFTbl` của từng DB (`X23STN`, `X26SPA`, CTVLS, `SoBaBuocATTP`) giống cách đã làm cho MedData.
   - Mã exe chỉ bổ sung hành vi cho vài form (`InvoiceFrm`, `Invoice2Frm`, PGL, hồ sơ HV).
2. **Engine form động phải hỗ trợ "hook" theo form.** Các điểm cần có:
   - UCC (VLS), `SetFomularFromConfig`, `Do_ExecSQLAfterSaveData`, `SetActionCheckData`, `SetLock`.
   - Trên web, chuyển thành **hook phía server** (BeforeSave / AfterSave / FieldChanged / Action) viết bằng mã domain. Không nạp DLL động.
   - Logic của `GiaoLop06140` và `AC_HoSoHocVienFrm` thành service (kiểm tra tổng giờ, đồng bộ HV từ phiếu thu, chiết khấu theo giờ).
3. **Tính tiền phải ở server và trong một transaction.** Hiện công thức dòng nằm trong cấu hình client, còn KM/CK tổng đơn thì SP sửa trực tiếp chi tiết sau khi lưu. Hệ quả là đã phát sinh **lệch header/chi tiết** (`InvoiceMismatchListStp`, chốt chặn trong `LayDuLieuTuBanHangStp`). Bản web cần:
   - một hàm tính giá duy nhất phía server: giá, % giảm, giảm tiền, CK hạng (quy tắc ≥ 20%), CK tổng đơn, mã giảm giá ×2, đổi điểm, hàng KM;
   - header luôn bằng tổng chi tiết;
   - kiểm thử với dữ liệu thật.
4. **POS bán lẻ web nên bổ sung những gì exe chưa có**:
   - ca thu ngân (mở/chốt ca, tiền đầu ca, đối soát);
   - thanh toán nhiều phương thức, QR/chuyển khoản;
   - idempotency khi bấm "Lưu và in" nhiều lần.
   - Phần "in xong thì khóa" (`isLock`) nên đổi thành trạng thái rõ ràng: Nháp → Đã thu → Đã in/Khóa → Đã đồng bộ KT.
5. **Thiết bị**:
   - máy quét kiểu bàn phím dùng trực tiếp trên web (input + Enter);
   - in bill: dùng HTML/PDF khổ 80 mm in qua trình duyệt, hoặc một agent in cục bộ / WebUSB nếu cần in im lặng. Mẫu in **lưu trong DB theo template** (`SY_RpDTbl`/`SY_RpFTbl`), nên cần trình dựng mẫu tương đương;
   - ngăn kéo tiền/cân: hiện không dùng, để mở cho sau;
   - webcam đính kèm dùng `getUserMedia`.
6. **Hai DB bán hàng / kế toán.** Phải quyết định: giữ mô hình "DB bán hàng riêng + job đồng bộ" (`LayDuLieuTuBanHangStp`: xóa rồi chèn lại theo kỳ, `LinkID='Import'`), hay hợp nhất schema. Nếu giữ thì bản web cần UI chạy đồng bộ, báo lỗi lệch và chặn sửa chứng từ đã đồng bộ.
7. **Đa chi nhánh và phân quyền dữ liệu.**
   - `BranchID` của user quyết định số chứng từ (`{Branch}-BH…`) và bộ lọc. `SY_GetBranchFnc(user)` cho đại lý. Non-admin chỉ sửa chứng từ mình tạo. Kỳ khóa qua `SY_CheckDateOfPeriodOpeningFnc`.
   - Tất cả phải chuyển thành policy phía server. Hiện filter ghép chuỗi SQL ở client nên có **nguy cơ SQL injection** khắp nơi.
8. **Tích hợp ngoài** chuyển thành adapter phía server, kèm hàng đợi và log (`SY_APILog`, `InvoiceLogTbl`):
   - Zalo ZNS / OTP (voip24h);
   - POS365;
   - tra MST;
   - HĐĐT 6 nhà cung cấp;
   - HĐ khởi tạo từ máy tính tiền (MTT).
   - **Bí mật hiện lưu thô** trong bảng cấu hình (`PS365_SettingTbl`, `SY_ZNSSetup`) và có gọi HTTP không TLS, đồng thời bỏ kiểm chứng chứng chỉ: callback luôn trả `true` (`ZaloZNS.cs:97,205-206,366-369`). Bản web phải dùng kho bí mật.
9. **Châm hàng tự động** là module tính toán nặng (snapshot/cache V5/V6, trigger đồng bộ catalog). Trên web nên chạy job nền, kết quả có phiên bản (run-id), UI chỉ đọc kết quả và duyệt "Hành động". Tài liệu V4.1.4 và `CHAM HANG BL-IT.xlsx` đủ làm đặc tả nghiệm thu.
10. **VLS**:
    - Lịch và timeline dùng thư viện web (resource = GV, màu theo trạng thái).
    - `Completed` tính lúc đọc hoặc chạy job, **không UPDATE toàn bảng mỗi lần mở form**.
    - Thống nhất quy tắc xin nghỉ 12h/24h.
    - Sửa `TeacherFinder` để bỏ qua lịch của chính phiếu đang sửa.
    - Đưa Goals/LearnBest/Topics vào bảng danh mục, nhưng giữ định dạng lưu `;`.
    - Cân nhắc thêm **điểm danh HV × buổi** (hiện không có) nếu khách cần.
    - Mẫu in PGL tái dùng SP 3 tập dữ liệu, render HTML→PDF với Arial 12.
11. **SoBaBuoc** có thể dựng gần như hoàn toàn bằng engine form động web, cộng 5 mẫu in sổ: nhiều header–detail đơn giản, cảnh báo hết hạn, khóa phiếu. Nên thêm nhập liệu nhanh trên tablet tại bếp (cảm quan Đạt/Không đạt, ảnh mẫu lưu).
12. **POS_DEMO**: dùng làm mẫu UX và tham chiếu API cho POS nhà hàng (`TN_*`). Viết lại frontend trong stack web chung, thêm xác thực, realtime cho bếp (SignalR/SSE thay cho polling 30 giây) và thanh toán.
13. **Bảo mật và vận hành cần loại bỏ**:
    - admin theo tên máy "NDD";
    - tự chèn user Admin với hash cứng;
    - mật khẩu hệ thống không để log;
    - Ctrl+Login khôi phục DB;
    - `ALTER TABLE` lúc mở form.
    - Migration schema phải tách thành script có phiên bản.

---

## 8. Câu hỏi còn mở

**BanHang / Santino / Spa**
1. **Công thức dòng** `InvoiceDetailTbl` trong `SY_FrmExpTbl`/config của `InvoiceFrm`/`Invoice2Frm` ở DB `X23STN`: Amount, GiamTien, TienCKTong, SoTienDoiDiem, TotalAmount, VAT. Phải đọc từ DB.
2. **Định nghĩa SP chưa đọc**:
   - `Invoice_LayChietKhauStp`, `Invoice_LayDoanhSoStp`, `Invoice_TinhCodeGiamGia_Stp`, `Invoice_TinhChietKhauTongDon_Stp`, `Invoice_TinhKhuyenMai_Stp`, `Invoice_PhanBoVoucherStp`, `CF_CustomerRank_ApplyInvoiceStp`, `InvoiceAfterSaveStp`, `InvoiceGetItemListStp`;
   - các SP châm hàng V4–V6, `SP_CheckStock_UpdateStockStp`.
3. **Tích điểm/hạng KH** tính khi nào? Lúc lưu, lúc in, hay job? OTP Zalo dùng để xác nhận việc gì (đổi điểm)?
4. **`OrderWebFrm`/`WEB_OrderDetailTbl`/`OrderOnlineTbl`**: có một website bán hàng đang đẩy đơn vào DB không? `WA_UserLog` và module `WA` có phải bản web cũ không?
5. **Spa**: BanHang.exe 12/06/2026 khác bản Santino. Cần dịch ngược riêng để biết form spa (bàn/tầng/phòng lạnh, chia hoa hồng 4 nhân viên) là exe hay form động. Ý nghĩa `X19SPHN`?
6. **Lịch chạy `LayDuLieuTuBanHangStp`**: chạy tay hay job? Cấu hình `CF_ImportData2023Tbl` do ai đặt? Vì sao bỏ nhánh mua hàng (`AND 1=0`)?
7. **Số máy POS mỗi cửa hàng** và ý nghĩa `PosID`. Có cần chạy offline không? (BanHang hiện cần kết nối SQL trực tiếp.)

**VLS**
8. Cấu hình `SY_FrmCfg`/`SY_FrmExpTbl` của `AC_PhieuBaoGiang2026Frm`, `AC_PhieuThu2026Frm`, `AC_PhieuThuKhac2026Frm` (công thức thực nhận, thuế TNCN, kiểm tra xuất HĐ).
9. Các view/SP: `AC_LichGiangProcess(TimeLine)View`, `AC_PhieuBaoGiangAcc2View`, `AC_PhieuBaoGiang_Copy*Stp`, `AC_PhieuThu_*Stp`.
10. Form động 0615/0616/0618 và 12 danh mục 0606xx. Khách có cần điểm danh thật không?
11. Dashboard MindFusion (`SY_DshBrdCnt`) của VLS có dữ liệu không? Menu CR_*/HR_* có bật trên DB CTVLS không?
12. Tài liệu "Đề xuất sửa ERP & PGL Final.pdf" nằm ở đâu?

**SoBaBuoc**
13. Metadata `SY_Menu`/`SY_FrmCfg` của `SoBaBuocATTP`: tên form động cho bước 1.2/2/3/lưu mẫu, bảng `KD_*` thật, công thức `SoNgayConLai`. Offline mới chỉ có layout của `KD_ATTP11Frm`.
14. `SoBaBuocCT`/`SoBaBuocTB` là đơn vị nào? Một DB cho mỗi khách bếp hay cho mỗi chi nhánh?
15. Các rpx `KD_BaoCaoNXT/NhapKho/XuatKho/CongNo` có còn dùng (quản lý kho nguyên liệu bếp) không?

**POS_DEMO**
16. Backend của `/api/Pos_Api_*`, `/api/api_*` ở đâu (dự án nào, DB nào)? `dashboard.html` và `/assets/appclient.js` bản gốc ở đâu? Demo này nhắm khách nào?

---

*Script phụ (chỉ đọc), nằm trong `C:\Users\Admin\AppData\Local\Temp\claude\99847b411338bb8a\a75445d9-f9f1-40f0-9b0c-f15552cd37f2\scratchpad\`:*
- *`layout_cols.py`: đọc cột hiển thị trong Layout `.dat`;*
- *`docx2txt.py`: trích văn bản docx;*
- *`xlsx_peek.py`: xem sheet và đầu bảng xlsx;*
- *`resp_keys.py`: cấu trúc file `*.response.json`;*
- *`frm_names.py`: liệt kê tên kiểu trong exe.*
