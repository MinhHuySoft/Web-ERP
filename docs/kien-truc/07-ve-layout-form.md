# 07. Trình vẽ layout form (Ctrl+F12)

Vẽ lại bố cục ô của form chứng từ ngay trên web, như trình thiết kế layout `LayoutSettingFrm` của ERP WinForms
(Ctrl+F12, chế độ quản trị). Bố cục lưu **thẳng vào cấu hình form** (`SY_FrmCfg`), nên WinForms và web cùng dùng.

- Chuẩn HTML: [02-chuan-html-erp.md](02-chuan-html-erp.md) mục 15.3 (`section[data-erp=layout-designer]`).
- Chuỗi LYT 21 vị trí: [10-engine-form-dong.md](../legacy-analysis/10-engine-form-dong.md) §4.7–4.9.
- FE: `web/js/layout/designer.js`, `web/css/layout-designer.css` (dùng khung chung `.erp-pd` của trình thiết kế mẫu in).
- BE (repo Web-ERP-BE): `ErpLayout`, `LayoutModel`, `LayoutScreens`, `ScreenEndpoints.Layout`, migration `0003_form_layouts`.

## 1. ERP WinForms làm gì (đã đọc mã dịch ngược, không chép mã)

**Mở và đọc**

- Ctrl+F12 trên form, sau khi qua chế độ quản trị (`CheckAdminMode`). Quyền form không được kiểm.
- FID là tên form đang chạy, có hậu tố Para nếu menu có Para (vd `AR_InvoiceFrm_HN`).
- Đọc mọi dòng `SY_FrmCfg` của FID, không qua bộ đệm.
- Có 15 trang: `1,2,3,A,B,C` (tab master) và `5…13` (trang chi tiết 1…9, cùng trang với lưới T1…T9).
- Mỗi trang đọc `LYT{trang}` theo `SubValue` (số thứ tự). `SubValue` không phải số thì bị bỏ.
- Danh sách cột lấy từ nguồn dữ liệu chính của form (bảng/view và cột nối).

**Sửa**

- Thêm cột:
  - bấm đúp tạo ô theo kiểu dữ liệu: có/không `6;4;1`, ngày `4;4;1`, số `5;4;1`, còn lại `1;4;1`;
  - "Add GroupBox" tạo `GrpBox{n}` = `23;6;3`;
  - "Add User Control" tạo `UserControl{n}` = `28;6;1` (nhãn).
- Đổi chỗ bằng kéo thả. Khi lưu, đánh số lại 1..n trong từng vùng và ghi `SubValue` 3 chữ số ("001").
- Sửa mọi vị trí của chuỗi 21 vị trí qua bảng thuộc tính, trừ vị trí 6 (giữ nguyên).
- Nhóm (ControlType 23):
  - ô con nằm ở `LYT{trang}{Nhóm}`;
  - nhóm lồng nối tiếp tên (`LYT1GrpBox1GrpBox2`);
  - thuộc tính của ô con ở `LYS{trang}{Nhóm}`.
- Thuộc tính riêng của control (`LYS…`, mã FH, PT, LBS, PV1…) sửa ở bảng thuộc tính thứ hai.
- Tiêu đề tab master: `T1V…TCV`. Tiêu đề trang chi tiết là `DCP` của lưới.

**Lưu**

- Xóa **mọi** dòng `SY_FrmCfg` của FID, rồi ghi lại toàn bộ:
  - không dùng giao dịch, không ghi nhật ký;
  - UserAutoID cũ được giữ, dòng mới lấy mã mới;
  - `VDate = GETDATE()`, cập nhật `PFID`.
- Xóa bộ đệm của **chính máy đó**. Máy WinForms khác giữ bố cục cũ tới 1 ngày (`Forever1Day`).
- Bỏ một nhóm: các ô con thành dòng mồ côi. Bỏ một ô: thuộc tính `LYS` của ô bị xóa.

## 2. Web làm gì

**Màn vẽ** (`GET /erp/screens/{Form}/layout`)

- Mở bằng nút "Vẽ layout" (Ctrl+F12) trên chứng từ, chỉ hiện với người có **quyền Admin trên form**.
- Bố cục tải từ `data-layout-src`, dạng JSON `erp-form-layout/1` (mục 3).

**Thao tác trên khung vẽ** (lưới 40 cột như LayoutX)

- Chọn ô để sửa thuộc tính ở cột phải.
- Kéo ô để đổi chỗ, thả lên tên tab để chuyển tab, thả vào nhóm để đưa ô vào nhóm.
- Kéo cạnh phải để đổi độ rộng; Alt+← / Alt+→ đổi chỗ với ô kề.
- Delete bỏ ô khỏi bố cục. Bỏ một nhóm thì ô con lên một cấp, không mất ô.
- Kéo cột chưa dùng (cột trái) vào khung, hoặc bấm đúp để thêm vào cuối tab.
- Thêm nhóm, thêm nhãn.
- Hoàn tác / làm lại (Ctrl+Z / Ctrl+Y). Lưu bằng Ctrl+S, có ghi chú.

**Thuộc tính sửa được** (vị trí trong chuỗi LYT)

| Nhóm | Thuộc tính (vị trí) |
|---|---|
| Hiển thị chính | tiêu đề (7), loại control (0), rộng (1), cao (2), chừa sau (19), rộng nhãn (5) |
| Cờ | xuống dòng (3), chỉ đọc (4), bắt buộc (17), ẩn (18) |
| Quyền và kiểm tra | quyền xem (9), quyền sửa (8), cho sửa khi (14), kiểm dữ liệu (12) |
| Giá trị | giá trị mặc định (10), rộng trên điện thoại (20) |

- Mặc định bằng SQL (15) **chỉ hiện để xem**: web không cho nhập SQL.
- Các vị trí khác giữ nguyên.

**Xem trước**

- Vẽ tab đang chọn bằng đúng bộ nâng cấp ô của FE (`enhanceFields`), như màn chứng từ.

**Phiên bản**

- Liệt kê các lần lưu từ web.
- Có thể khôi phục về **trước** một lần lưu; thao tác khôi phục cũng thành một phiên bản mới.

## 3. Dữ liệu `erp-form-layout/1`

BE gửi:

```jsonc
{
  "$schema": "erp-form-layout/1", "form": "AP_PurposeRequestListFrm", "title": "Đề nghị mua hàng",
  "revision": "<sha256 các dòng bố cục>", "canSave": true,
  "tabs": [
    { "id": "1", "kind": "master", "captionKey": "T1V", "caption": "", "defaultCaption": "Thông tin chung" },
    { "id": "5", "kind": "detail", "page": 1, "caption": "Hàng hóa đề nghị", "defaultCaption": "Chi tiết 1", "hint": "…" }
  ],
  "items": [ { "tab": "1", "group": "", "name": "PurchaseRequestID", "cfg": "1;4;1;1;;;;;;;;;;;;;;;;0;0", "text": null } ],
  "fields": [ { "name": "PurchaseDate", "type": "date", "caption": "Ngày đề nghị" } ],
  "versions": [ { "no": 2, "at": "13/11/2026 16:00", "by": "Admin", "kind": "save", "restoredFrom": null, "comment": "…" } ],
  "notes": ["…"], "note": null
}
```

- `items` theo thứ tự trong từng vùng.
- `group` là đường dẫn nhóm cha, tức tên các nhóm nối nhau như phần sau `LYT{tab}`.
- `text` là chữ trên nút (LYS `BT` / `LT`, chữ mặc định của control), chỉ để hiện.

FE gửi lại (`Json`):

```json
{ "$schema": "erp-form-layout/1", "form": "…", "revision": "…", "captions": {"T1V": "…"},
  "items": [{ "tab": "1", "group": "", "name": "…", "cfg": "…" }] }
```

## 4. Lưu ở BE (an toàn hơn WinForms)

- **Quyền**: Admin trên form (`SY_UserPermisstion.isAdmin`, như quyền sửa mẫu in), và màn phải có trong menu của người dùng.
- **Không lưu được** khi:
  - form viết tay có bố cục trong mã / tệp mô tả (`useDbConfig: false`);
  - DB công ty chưa có bảng sao lưu (`web.FormLayoutVersion`, chạy `WebErp.Admin tenant migrate <mã>`).
- **Kiểm lại toàn bộ đầu vào** (không tin FE):
  - schema, form đúng màn;
  - tab thuộc 15 tab, tên ô `^[A-Za-z_][A-Za-z0-9_]{0,49}$`, không trùng;
  - nhóm cha có thật, KeyID ≤ 50 ký tự;
  - loại control hợp lệ, độ rộng 0–40 hoặc 99, chuỗi ≤ 4000 ký tự;
  - tiêu đề tab ≤ 200 ký tự.
- **Một giao dịch** gồm:
  - `sp_getapplock` theo FID;
  - đọc dòng với `UPDLOCK, HOLDLOCK`;
  - so `revision`: khác thì trả **409** "bố cục đã bị đổi (trên WinForms hoặc bởi người khác) từ lúc bạn mở", không ghi gì.
- **Chỉ ghi dòng bố cục**, theo kiểu chênh lệch (xóa / sửa / thêm theo UserAutoID):
  - LYT của các vùng đọc được: thứ tự "001"…;
  - UserAutoID cũ được giữ; dòng mới có UserAutoID 25 chữ số như WinForms, `VDate = GETDATE()`, `PFID` như các dòng cùng FID;
  - LYS của ô đi theo ô khi ô đổi vùng, bỏ ô thì bỏ LYS của ô;
  - tiêu đề `T?V`.
- **Không đụng**:
  - các dòng khác của FID (`T0…`, `SP`, `WO`, hook…);
  - dòng LYT/LYS mồ côi (không thuộc vùng nào đọc được);
  - dòng có thứ tự không phải số.
- **Phiên bản**: `web.FormLayoutVersion` giữ ảnh JSON các dòng bố cục trước và sau (cột UserAutoID, KeyID, SubID, KeyValue,
  SubValue, VDate, PFID), sha256, người, giờ, ghi chú.
- **Khôi phục**: ghi lại đúng ảnh "trước" của phiên bản (cùng UserAutoID và giá trị).
- **Sau khi lưu**: xóa bộ đệm metadata 5 phút của BE cho form; ghi nhật ký `WebErp.Layout`.
- **Báo cho người dùng**: máy đang mở ERP WinForms cần mở lại ERP để thấy bố cục mới.

## 5. Chưa làm (GĐ sau)

- Sửa thuộc tính riêng `LYS` của control (FH, PT, LBS, PV1…). Hiện giữ nguyên.
- Đổi tên ô / nhóm.
- Chép bố cục từ form khác.
- Chuyển cả tab.
- Thêm cột vào bảng (WinForms có lệnh `ALTER TABLE`; web không làm).
- Nhập mặc định bằng SQL (vị trí 15).
- Sửa tiêu đề trang chi tiết (`DCP`) và quyền xem trang (`TPV`).
- Ghi `SY_UserLog` (chờ đường ghi M4 chung).
