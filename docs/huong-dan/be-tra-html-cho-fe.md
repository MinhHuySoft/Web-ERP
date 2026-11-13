# Hướng dẫn cho Backend (người và agent): trả HTML cho Frontend Web-ERP

> **Đọc nhanh:** BE trả **HTML ngữ nghĩa, không CSS/JS/class**. Ý nghĩa đánh dấu bằng `data-erp="<vai trò>"` + vài
> `data-*`. FE tự dựng giao diện (Ribbon, tab, lưới, form, theme…). Mọi nghiệp vụ (quyền, khóa sổ, đánh số, hook SP,
> kiểm tra) ở BE.
>
> - Đặc tả chuẩn (nguồn gốc, khi khác biệt thì đặc tả thắng): [`docs/kien-truc/02-chuan-html-erp.md`](../kien-truc/02-chuan-html-erp.md) — ERP-HTML v1.0.
> - Ví dụ chạy thật: thư mục [`web/mock/`](../../web/mock/) (FE đang chạy bằng các file này).
> - Kiểm tra HTML của bạn: mở `web/tools/validate.html` (dán HTML hoặc nhập URL) — phải **0 lỗi**.
> - Cấu trúc FE (nếu cần biết FE xử lý thế nào): [`fe-cau-truc-va-to-chuc.md`](fe-cau-truc-va-to-chuc.md).
> - Tổ chức mã và thư mục của BE: [`be-cau-truc-va-to-chuc.md`](be-cau-truc-va-to-chuc.md).

---

## 1. Mười quy tắc vàng

1. **HTML5 hợp lệ, UTF-8, `lang="vi"`**; chữ hiển thị đã dịch theo ngôn ngữ phiên.
2. **Không** `style`, `<style>`, `<link rel=stylesheet>`, `<script>`, `on*`, **không `class`** (FE xóa hết khi nhận).
3. **Đúng thẻ HTML:** `table/thead/tbody/th/td`, `form/fieldset/legend/label/input/select/textarea`, `button`, `a`,
   `menu/li`, `nav/ul/li`, `dl/dt/dd`, `data`, `template`. HTML phải dùng được cả khi không có JS (link mở được, form gửi được).
4. **Mọi URL nằm trong HTML** (`href`, `action`, `formaction`, `data-lookup-src`, `data-src`…). FE không tự ghép URL
   nghiệp vụ, trừ 4 điểm vào ở mục 3. URL tương đối được tính theo URL của response.
5. **Giá trị máy tách khỏi chữ hiển thị:** số `1234567.5` (dấu chấm, không phân cách nghìn), ngày `2026-11-11`,
   ngày giờ `2026-11-11T08:30:00`, logic `true`/`false`. Chữ hiển thị có thể đã định dạng sẵn.
6. **Tên trường = tên cột ERP** (`ObjectID`, `DocumentDate`…); **mã màn hình = `FormName`** ERP.
7. **Quyền do BE quyết:** không được phép thì **không gửi** nút/cột/dữ liệu (hoặc gửi `disabled`/`readonly`). Cột bị ẩn
   vì quyền (vd ẩn số tiền) thì **không có dữ liệu trong HTML**.
8. **Mọi `form method="post"` có token chống giả mạo** (`__RequestVerificationToken`); form `record` ở chế độ sửa có
   **`__version`** (vd `DateUpdate` lúc mở) để BE phát hiện xung đột (trả 409).
9. **Không gửi bí mật** (mật khẩu, hash, chuỗi kết nối, token API). Ô mật khẩu luôn `value=""`.
10. **Thông điệp đúng loại:** `error`/`warning` chặn hoặc cảnh báo, `success`/`info` báo kết quả; câu hỏi "vẫn lưu?"
    dùng `form[data-erp="confirm"]`, không dùng `messages`.

## 2. Trao đổi HTTP

**Request FE gửi** (mọi lần gọi): `Accept: text/html`, `X-ERP-Request: fragment`, `X-ERP-Contract: 1.0`,
`X-ERP-Tab: <mã tab>` (tùy dùng). Cookie phiên đi kèm (`credentials: include`). Đọc = `GET`; gửi form = `POST`
`application/x-www-form-urlencoded` (hoặc `multipart/form-data` khi có file).

BE **có thể** trả trang HTML đầy đủ (`<!doctype html>…<body>`); FE chỉ lấy các phần sau trong `body`, bỏ qua phần còn lại:
`[data-erp="screen"]` (cái đầu tiên), mọi `[data-erp="messages"]`, `[data-erp="dialog"]`, `form[data-erp="confirm"]`,
và `session` / `menu` / `login` / `lookup-result` khi FE gọi đúng điểm đó.

| Mã | Khi nào | FE làm gì |
|---|---|---|
| 200 | Bình thường | Tách vai trò như trên |
| 302/303 | Sau POST thành công muốn mở URL khác (PRG) | Theo redirect, cập nhật URL của tab |
| 400/422 | Dữ liệu sai | Hiển thị `screen` có ô lỗi, hoặc `messages` |
| 401 | Chưa đăng nhập / hết phiên | Mở màn đăng nhập (`loginUrl`) |
| 403 | Không có quyền | Hiển thị `messages` nếu có |
| 404 | Không có màn / bản ghi | Báo "không tìm thấy" |
| 409 | Bản ghi đã bị người khác sửa (`__version` lệch) | Hiển thị `messages` |
| 5xx | Lỗi hệ thống | Lỗi chung + `messages` nếu có |

Header response tùy chọn: `X-ERP-Title` (tiêu đề tab), `X-ERP-Contract: 1.0`. Tải file: `Content-Disposition: attachment`.

**Sau POST thành công nên trả 303 về URL GET của màn (Post/Redirect/Get).** FE dùng URL cuối cùng của tab để nạp lại (F5)
và để **đánh thức tab ngủ** (FE nhả bộ nhớ của tab ít dùng khi mở nhiều tab). Nếu BE trả thẳng `200` + `screen` sau POST,
FE không dám GET lại URL POST nên tab đó không được ngủ — trừ khi `screen` có `data-refresh-src="<URL GET của màn>"`.

## 3. Bản đồ endpoint BE cần làm

4 điểm vào **cố định** do FE cấu hình (`web/config.js`); mọi URL khác BE tự đặt và đưa vào HTML. Cột "URL gợi ý" chỉ là
gợi ý — BE được đặt tùy ý.

| Việc | Method | URL gợi ý | Trả về |
|---|---|---|---|
| Đăng nhập (`loginUrl`) | GET / POST | `/erp/login` | `form[data-erp="login"]`; POST thành công → 303 về `homeUrl` (hoặc `sessionUrl`); thất bại → 200 + form đăng nhập + `messages` `error` |
| Phiên (`sessionUrl`) | GET | `/erp/session` | `section[data-erp="session"]`; 401 nếu chưa đăng nhập |
| Menu (`menuUrl`) | GET | `/erp/menu` | `nav[data-erp="menu"]` theo quyền (`SY_GetUserMenuFnc`) |
| Trang chủ (`homeUrl`) | GET | `/erp/home` | `screen` `DASHBOARD` |
| Mở màn danh sách / chứng từ | GET | `/erp/screens/{FormName}?…lọc` | `screen` |
| Mở 1 bản ghi | GET | `/erp/screens/{FormName}/{key}` | `screen` `EDIT` `data-mode="view"` |
| Sửa / thêm | GET | `…/{key}/edit`, `…/new` | `screen` `data-mode="edit"` / `"new"` |
| Lưu | POST | `…/{key}/save` | **Nên 303 về bản ghi** (Post/Redirect/Get); lỗi → `screen` + `messages`; hỏi → `confirm` |
| Xóa / duyệt / nút tùy biến | POST | `…/{key}/delete`, `…/actions/{tên}` | `messages`, `screen`, hoặc `dialog` (khi cần tham số) |
| Tra cứu F4 | GET | `/erp/lookups/{nguồn}?q={q}` | `table[data-erp="lookup-result"]` |
| Báo cáo | GET | `/erp/reports/{FormName}?…tham số` | `screen` `REPORT` |
| Tab chi tiết nạp lười | GET | `…/{key}/tabs/{T2}` | nội dung panel (vd `table[data-erp="grid"]`) |
| Xuất Excel / In | GET | `…&format=xlsx|pdf` | file (`Content-Disposition`) |
| In theo mẫu (chứng từ / báo cáo) | GET | `/erp/print/{Report}?DocumentID=a;b&Template=…` | `screen` `REPORT` + `print-document` (mục 5.4b) |
| Trình thiết kế mẫu in | GET | `/erp/screens/{Form}/print/designer?Template=…&DocumentID=…` | `screen` + `print-designer` (mục 5.4c) |
| Lưu mẫu in | POST | `/erp/screens/{Form}/print/designer/save` | `messages` (`success` / `error` + 422) |
| Mẫu in của `data-template-src` | GET | `/erp/print/templates/{Report}/{Template}.rpx` hoặc `.json` | XML `.rpx` (bản mới nhất `SY_RpFTbl`, không có thì thư mục `Reports`) hoặc JSON `erp-print-template/1` |

## 4. Bảng tra vai trò `data-erp`

| Vai trò | Thẻ | Bắt buộc | Hay dùng thêm |
|---|---|---|---|
| `login` | `form` | `method="post"`, `action`, token | ô `Database`, `UserName`, `Password` |
| `session` | `section` > `dl` > `div[data-key]` > `dt`+`dd` | `data-key` chuẩn: `company`, `tax-code`, `branch`, `period`, `database`, `user`, `language` | `dd[data-value]`; `a[data-action=logout|change-password]` |
| `menu` / `menu-group` / `menu-item` | `nav` > `ul` > `li` | `menu-item` có `data-menu-id` + `a[href]` | `data-kind` (`form`/`report`/`command`), `data-screen-id`, `data-para`, `data-icon` |
| `screen` | `section` | `data-screen-id`, `data-form-type`, `data-mode`, `data-screen-key`, `<h1>` | `data-menu-id`, `data-para`, `data-refresh-src` |
| `toolbar` | `menu` > `li` > `a`/`button` | `data-action` trên nút | `data-shortcut`, `data-confirm`, `data-icon`, `data-target`, `data-requires-selection`, `li[data-group]`, `li[data-overflow]` |
| `filter` | `form method="get"` | `action`, nút `submit` | ô `field` |
| `record` | `form method="post"` | `id` duy nhất, token; `__version` khi sửa | `data-key-field`, `data-key` |
| `tab` | `fieldset` trong `record` | `legend` | `data-tab-id` |
| `field` | `div` | `data-control`, `label[for]` + đúng 1 control | `data-span` (1–40), `data-row-start`, `data-rows`, `data-gap-after`, `data-span-mobile`, `data-invalid` |
| `lookup-text` | `output` trong `field` lookup | `for` | — |
| `hint` / `error` | `small` trong `field` | — | — |
| `grid` | `table` | `th[data-field]`; `tr[data-key]` khi có `data-key-field` | xem mục 5.1, 5.3 |
| `row-template` | `template` | `data-grid-id` | 1 `tr` mẫu |
| `options` | `template` | `data-field` | các `option` cho cột `select` của lưới sửa |
| `tabs` / `tab-panel` | `section` | `tab-panel` có `data-title` | `data-tab-id`, `data-badge`, `data-src` |
| `messages` / `message` | `div` / `p` | `data-msg-type` | `data-field`, `data-legacy-type` |
| `confirm` | `form method="post"` | `input[name=__confirm]`, 2 nút `name="__answer"` (`yes`/`no`), token | — |
| `dialog` | `section` | `<h1>` | `data-size` (`sm`/`md`/`lg`/`full`) |
| `lookup-result` | `table` | `tr[data-value][data-text]`, `th[data-field]` | `data-total`, `th[data-hidden]` |
| `report-result` | `section` trong `screen` REPORT | 1 hoặc nhiều `grid` | `toolbar` xuất/in |
| `status` | `data` | `value` | `data-tone` (`neutral`/`info`/`success`/`warning`/`danger`) |
| `kpi` / `chart` | `section` / `table` (DASHBOARD) | `kpi`: `h2` + `data[value]`; `chart`: `data-chart="bar|line"` | `kpi[data-tone]` |
| `attachments` | `section` | — | `data-upload`, form `multipart/form-data` |

## 5. Mẫu HTML chép dùng

Các mẫu dưới đây qua được bộ kiểm tra (0 lỗi). Thay URL, tên cột, dữ liệu cho đúng màn của bạn.

### 5.1 Màn danh sách (`LIST`, hoặc danh sách chứng từ `EDIT` ở `data-mode="find"`)

```html
<section data-erp="screen" data-screen-id="AR_InvoiceFrm" data-form-type="EDIT" data-mode="find"
         data-screen-key="AR_InvoiceFrm" data-menu-id="06035">
  <h1>Hóa đơn bán hàng</h1>
  <menu data-erp="toolbar">
    <li><a data-action="new" href="/erp/screens/AR_InvoiceFrm/new" data-target="tab" data-shortcut="F2">Thêm</a></li>
    <li><a data-action="reload" href="/erp/screens/AR_InvoiceFrm" data-target="self">Nạp lại</a></li>
    <li><a data-action="export" href="/erp/screens/AR_InvoiceFrm?format=xlsx" download>Xuất Excel</a></li>
  </menu>
  <form data-erp="filter" method="get" action="/erp/screens/AR_InvoiceFrm">
    <div data-erp="field" data-control="date" data-span="6"><label for="flt-from">Từ ngày</label>
      <input id="flt-from" name="FromDate" type="date" value="2026-11-01"></div>
    <div data-erp="field" data-control="date" data-span="6"><label for="flt-to">Đến ngày</label>
      <input id="flt-to" name="ToDate" type="date" value="2026-11-30"></div>
    <div data-erp="field" data-control="select" data-span="8"><label for="flt-br">Chi nhánh</label>
      <select id="flt-br" name="BranchID"><option value="">(Tất cả)</option><option value="HN" selected>Hà Nội</option></select></div>
    <div data-erp="field" data-control="search" data-span="14"><label for="flt-q">Tìm nhanh</label>
      <input id="flt-q" name="q" type="search" placeholder="Số CT, khách hàng…"></div>
    <button type="submit" data-action="find">Lọc</button>
  </form>
  <table data-erp="grid" data-grid-id="T0" data-key-field="DocumentID" data-selectable="single"
         data-total-rows="2" data-sort="DocumentID:desc">
    <thead><tr>
      <th scope="col" data-field="DocumentID" data-type="link" data-width="120" data-frozen>Số chứng từ</th>
      <th scope="col" data-field="DocumentDate" data-type="date" data-width="95">Ngày</th>
      <th scope="col" data-field="ObjectName" data-type="text" data-width="240">Khách hàng</th>
      <th scope="col" data-field="StatusName" data-type="status" data-width="120">Trạng thái</th>
      <th scope="col" data-field="TotalAmount" data-type="money" data-decimals="0" data-width="130" data-sum="sum">Tổng tiền</th>
    </tr></thead>
    <tbody>
      <tr data-key="SI1126/0001">
        <td data-value="SI1126/0001"><a href="/erp/screens/AR_InvoiceFrm/SI1126-0001" data-target="tab">SI1126/0001</a></td>
        <td data-value="2026-11-10">10/11/2026</td>
        <td>Bệnh viện Đa khoa A</td>
        <td data-value="2"><data data-erp="status" value="2" data-tone="success">Đã duyệt</data></td>
        <td data-value="12500000">12.500.000</td>
      </tr>
      <tr data-key="SI1126/0002" data-tone="danger">
        <td data-value="SI1126/0002"><a href="/erp/screens/AR_InvoiceFrm/SI1126-0002" data-target="tab">SI1126/0002</a></td>
        <td data-value="2026-11-11">11/11/2026</td>
        <td>Phòng khám B</td>
        <td data-value="9"><data data-erp="status" value="9" data-tone="danger">Hủy</data></td>
        <td data-value="0">0</td>
      </tr>
    </tbody>
    <tfoot><tr><td colspan="4">Tổng cộng</td><td data-field="TotalAmount" data-value="12500000">12.500.000</td></tr></tfoot>
  </table>
</section>
```

Ghi nhớ cho lưới:

- `data-type` cột: `text`, `number`, `money`, `quantity`, `percent`, `date`, `datetime`, `bool`, `link`, `status`, `image`.
- Ô số/ngày/bool **phải** có `td[data-value]` dạng bất biến (`bool` = `true`/`false`; FE tự vẽ dấu tích).
- `tfoot` = tổng **toàn bộ** dữ liệu ở server (`td[data-field][data-value]`). Không có `tfoot` thì FE tự cộng các dòng
  đang xem theo `th[data-sum]`.
- Thêm khi cần: `th[data-hidden]` (ẩn mặc định), `th[data-wrap]`, `th[data-group="Tên nhóm"]` (tiêu đề 2 tầng),
  `table[data-group-by="BranchID"]`, `table[data-selectable="multi"]` + nút `data-requires-selection` (FE gửi `__selected`).
- Nhiều nghìn dòng vẫn được (FE ảo hóa từ 160 dòng). `data-total-rows` có thể lớn hơn số dòng gửi.

### 5.2 Chứng từ — xem (`EDIT`, `data-mode="view"`)

```html
<section data-erp="screen" data-screen-id="AR_InvoiceFrm" data-form-type="EDIT" data-mode="view"
         data-screen-key="AR_InvoiceFrm:SI1126/0001" data-menu-id="06035">
  <h1>Hóa đơn bán hàng — SI1126/0001</h1>
  <menu data-erp="toolbar">
    <li data-group="Chứng từ"><a data-action="new" href="/erp/screens/AR_InvoiceFrm/new" data-target="tab">Thêm</a></li>
    <li data-group="Chứng từ"><a data-action="edit" href="/erp/screens/AR_InvoiceFrm/SI1126-0001/edit" data-target="self">Sửa</a></li>
    <li data-group="Chứng từ"><button type="submit" form="rec-SI1126-0001" formaction="/erp/screens/AR_InvoiceFrm/SI1126-0001/delete"
        formmethod="post" data-action="delete" data-confirm="Xóa chứng từ này?">Xóa</button></li>
    <li data-group="In"><a data-action="print" href="/erp/reports/AR_Invoice2Report?DocumentID=SI1126%2F0001" data-target="_blank">In</a></li>
    <li data-overflow><button type="submit" form="rec-SI1126-0001" formaction="/erp/screens/AR_InvoiceFrm/SI1126-0001/actions/LapPhieuThu"
        formmethod="post" data-action="custom" data-icon="cash" data-confirm="Lập phiếu thu cho hóa đơn này?">Lập phiếu thu</button></li>
  </menu>
  <form data-erp="record" id="rec-SI1126-0001" method="post" action="/erp/screens/AR_InvoiceFrm/SI1126-0001/save"
        data-key-field="DocumentID" data-key="SI1126/0001">
    <input type="hidden" name="__RequestVerificationToken" value="…">
    <fieldset data-erp="tab" data-tab-id="1"><legend>Thông tin chung</legend>
      <div data-erp="field" data-control="text" data-span="8"><label for="f-DocumentID">Số chứng từ</label>
        <input id="f-DocumentID" name="DocumentID" value="SI1126/0001" readonly></div>
      <div data-erp="field" data-control="date" data-span="6"><label for="f-DocumentDate">Ngày</label>
        <input id="f-DocumentDate" name="DocumentDate" type="date" value="2026-11-10" readonly></div>
      <div data-erp="field" data-control="lookup" data-span="16" data-row-start><label for="f-ObjectID">Khách hàng</label>
        <input id="f-ObjectID" name="ObjectID" value="KH0001" readonly data-lookup-src="/erp/lookups/CF_ObjectTbl?q={q}">
        <output data-erp="lookup-text" for="f-ObjectID">Bệnh viện Đa khoa A</output></div>
      <div data-erp="field" data-control="money" data-span="8"><label for="f-TotalAmount">Tổng tiền</label>
        <input id="f-TotalAmount" name="TotalAmount" value="12500000" data-decimals="0" readonly></div>
    </fieldset>
  </form>
  <section data-erp="tabs">
    <section data-erp="tab-panel" data-tab-id="T1" data-title="Chi tiết hàng hóa" data-badge="1">
      <table data-erp="grid" data-grid-id="T1" data-key-field="UserAutoID" data-selectable="single">
        <thead><tr>
          <th scope="col" data-field="ItemID" data-type="text" data-width="100">Mã hàng</th>
          <th scope="col" data-field="ItemName" data-type="text" data-width="240">Tên hàng</th>
          <th scope="col" data-field="Quantity" data-type="quantity" data-decimals="0" data-sum="sum">Số lượng</th>
          <th scope="col" data-field="Amount" data-type="money" data-decimals="0" data-sum="sum">Thành tiền</th>
        </tr></thead>
        <tbody><tr data-key="1001"><td>VT0001</td><td>Máy đo huyết áp</td><td data-value="5">5</td><td data-value="12500000">12.500.000</td></tr></tbody>
      </table>
    </section>
    <section data-erp="tab-panel" data-tab-id="T2" data-title="Hóa đơn GTGT" data-src="/erp/screens/AR_InvoiceFrm/SI1126-0001/tabs/T2"></section>
  </section>
</section>
```

- Chế độ `view`: mọi ô `readonly` (hoặc `disabled` với `select`/`checkbox`). **FE không tự mở khóa ô.**
- Từ 2 `fieldset[data-erp="tab"]` trở lên → FE vẽ thành tab; 1 cái → khung có tiêu đề.
- Bố cục ô theo **lưới 40 cột** của WinForms (`data-span` = SizeX, `data-row-start` = isFirstPos…), xem mục 7.

### 5.3 Chứng từ — sửa / thêm (`data-mode="edit"` / `"new"`) với lưới sửa trực tiếp

```html
<section data-erp="screen" data-screen-id="AR_InvoiceFrm" data-form-type="EDIT" data-mode="edit"
         data-screen-key="AR_InvoiceFrm:SI1126/0001">
  <h1>Hóa đơn bán hàng — SI1126/0001</h1>
  <menu data-erp="toolbar">
    <li><button type="submit" form="rec-SI1126-0001" formaction="/erp/screens/AR_InvoiceFrm/SI1126-0001/save"
        formmethod="post" data-action="save" data-shortcut="Ctrl+S">Lưu</button></li>
    <li><a data-action="cancel" href="/erp/screens/AR_InvoiceFrm/SI1126-0001" data-target="self">Hủy</a></li>
  </menu>
  <form data-erp="record" id="rec-SI1126-0001" method="post" action="/erp/screens/AR_InvoiceFrm/SI1126-0001/save"
        data-key-field="DocumentID" data-key="SI1126/0001">
    <input type="hidden" name="__RequestVerificationToken" value="…">
    <input type="hidden" name="__version" value="2026-11-10T16:05:11.320">
    <fieldset data-erp="tab" data-tab-id="1"><legend>Thông tin chung</legend>
      <div data-erp="field" data-control="date" data-span="6"><label for="e-DocumentDate">Ngày</label>
        <input id="e-DocumentDate" name="DocumentDate" type="date" value="2026-11-10" required></div>
      <div data-erp="field" data-control="lookup" data-span="16"><label for="e-ObjectID">Khách hàng</label>
        <input id="e-ObjectID" name="ObjectID" value="KH0001" required
               data-lookup-src="/erp/lookups/CF_ObjectTbl?q={q}" data-lookup-fill="ObjectName,Address">
        <output data-erp="lookup-text" for="e-ObjectID">Bệnh viện Đa khoa A</output></div>
      <div data-erp="field" data-control="checkbox" data-span="6"><label for="e-IsVAT">Có VAT</label>
        <input type="hidden" name="IsVAT" value="false"><input id="e-IsVAT" name="IsVAT" type="checkbox" value="true" checked></div>
      <div data-erp="field" data-control="textarea" data-span="40" data-rows="2" data-row-start><label for="e-Memo">Diễn giải</label>
        <textarea id="e-Memo" name="Memo" rows="2">Bán theo hợp đồng 12/2026</textarea>
        <small data-erp="hint">Tối đa 500 ký tự.</small></div>
    </fieldset>
  </form>
  <section data-erp="tabs">
    <section data-erp="tab-panel" data-tab-id="T1" data-title="Chi tiết hàng hóa">
      <table data-erp="grid" data-grid-id="T1" data-key-field="UserAutoID" data-editable data-form="rec-SI1126-0001" data-selectable="multi">
        <thead><tr>
          <th scope="col" data-field="ItemID" data-type="text" data-editor="lookup" data-required
              data-lookup-src="/erp/lookups/CF_ItemTbl?q={q}" data-lookup-fill="ItemName,UnitID">Mã hàng</th>
          <th scope="col" data-field="ItemName" data-type="text" data-readonly>Tên hàng</th>
          <th scope="col" data-field="UnitID" data-type="text" data-editor="select">ĐVT</th>
          <th scope="col" data-field="Quantity" data-type="quantity" data-decimals="0" data-editor="number" data-sum="sum">Số lượng</th>
          <th scope="col" data-field="UnitPrice" data-type="money" data-decimals="0" data-editor="money">Đơn giá</th>
        </tr></thead>
        <tbody>
          <tr data-key="1001"><td>VT0001</td><td>Máy đo huyết áp</td><td data-value="Cai">Cái</td><td data-value="5">5</td><td data-value="2500000">2.500.000</td></tr>
        </tbody>
      </table>
      <template data-erp="row-template" data-grid-id="T1"><tr data-key=""><td></td><td></td><td data-value="Cai">Cái</td><td data-value="1">1</td><td data-value="0">0</td></tr></template>
      <template data-erp="options" data-field="UnitID"><option value="Cai">Cái</option><option value="Hop">Hộp</option></template>
    </section>
  </section>
</section>
```

- **Checkbox:** đặt `input[type=hidden][value=false]` **trước** checkbox cùng tên → bỏ tích vẫn gửi `false`.
- **Lưới sửa:** `data-editable` + `data-form="<id record>"`; mỗi cột sửa được có `data-editor`
  (`text`/`number`/`money`/`date`/`select`/`lookup`/`checkbox`/`none`); `select` cần `template[data-erp=options]`.
- **Dòng mới:** `template[data-erp="row-template"]` chứa đúng 1 `tr` với giá trị mặc định.
- Ô báo lỗi trả về sau khi lưu thất bại: `div[data-erp=field][data-invalid]` + `small[data-erp="error"]` (hoặc
  `messages` có `data-field`). Lỗi theo dòng lưới: hiện tại gửi `messages` `error` nêu rõ dòng/mã hàng
  (vd "Dòng 2 – VT0002: số lượng phải lớn hơn 0"); `td[data-invalid]` theo đặc tả FE chưa hiển thị (mục 8).

### 5.4 Báo cáo (`REPORT`)

```html
<section data-erp="screen" data-screen-id="AP_PurchaseDetailReport" data-form-type="REPORT" data-mode="view"
         data-screen-key="AP_PurchaseDetailReport">
  <h1>Bảng kê chứng từ mua hàng</h1>
  <form data-erp="filter" method="get" action="/erp/reports/AP_PurchaseDetailReport">
    <div data-erp="field" data-control="date" data-span="6"><label for="rp-from">Từ ngày</label>
      <input id="rp-from" name="FromDate" type="date" value="2026-11-01"></div>
    <div data-erp="field" data-control="date" data-span="6"><label for="rp-to">Đến ngày</label>
      <input id="rp-to" name="ToDate" type="date" value="2026-11-30"></div>
    <button type="submit" data-action="find">Xem báo cáo</button>
  </form>
  <section data-erp="report-result">
    <table data-erp="grid" data-grid-id="R0" data-selectable="none">
      <caption>Bảng kê chứng từ mua hàng</caption>
      <thead><tr>
        <th scope="col" data-field="DocumentID" data-type="text">Số CT</th>
        <th scope="col" data-field="Amount" data-type="money" data-decimals="0" data-sum="sum">Thành tiền</th>
      </tr></thead>
      <tbody><tr><td>PI1126/0001</td><td data-value="15000000">15.000.000</td></tr></tbody>
    </table>
    <menu data-erp="toolbar">
      <li><a data-action="export" href="/erp/reports/AP_PurchaseDetailReport?FromDate=2026-11-01&amp;ToDate=2026-11-30&amp;format=xlsx" download>Xuất Excel</a></li>
      <li><a data-action="print" href="/erp/reports/AP_PurchaseDetailReport?FromDate=2026-11-01&amp;ToDate=2026-11-30&amp;format=pdf" data-target="_blank">In / PDF</a></li>
    </menu>
  </section>
</section>
```

- Tham số filter lấy từ tham số của SP `<FormName>Stp` (`@FromDate`, `@ToDate`, `@BranchID`, `@Template`…).
- SP trả nhiều result set → mỗi bảng thêm 1 `table[data-erp=grid]` có `caption`. Bảng `Msg/Type` → `messages`.

### 5.4b In theo mẫu (`print-document`, chuẩn 15.1)

```html
<section data-erp="screen" data-screen-id="AR_InvoiceReport" data-form-type="REPORT" data-mode="view"
         data-screen-key="print:AR_InvoiceReport:HD1126/0001">
  <h1>Hóa đơn bán hàng</h1>
  <form data-erp="filter" method="get" action="/erp/print/AR_InvoiceReport">
    <input type="hidden" name="DocumentID" value="HD1126/0001;HD1126/0002">
    <div data-erp="field" data-control="select" data-span="12"><label for="pt">Mẫu in</label>
      <select id="pt" name="Template"><option value="AR_InvoiceReport" selected>Hóa đơn</option></select></div>
    <button type="submit" data-action="find">Xem</button>
  </form>
  <section data-erp="print-document" data-template-src="/erp/print/templates/AR_InvoiceReport/AR_InvoiceReport.rpx"
           data-template-format="rpx" data-number-group="." data-number-decimal="," data-title="Hóa đơn HD1126/0001">
    <dl data-erp="print-params">
      <dd data-name="Template">AR_InvoiceReport</dd>
      <dd data-name="Sys.SysCom1">CÔNG TY …</dd><dd data-name="Sys.ReportLocation">TP. Hồ Chí Minh</dd>
    </dl>
    <table data-erp="grid" data-grid-id="R0">
      <thead><tr><th data-field="DocumentID" data-type="text">DocumentID</th><th data-field="Amount" data-type="money">Amount</th></tr></thead>
      <tbody><tr><td>HD1126/0001</td><td data-value="1850000">1.850.000</td></tr></tbody>
    </table>
  </section>
</section>
```

Cách làm như WinForms (`ReportViewerFrm`, xem `docs/kien-truc/06-mau-in.md`):

1. **Tên báo cáo**: `<Form bỏ "Frm">Report` (nút In của chứng từ; `BPRN` trong `SY_FrmCfg` đè). Nút In trên chứng từ:
   `<a data-action="print" href="/erp/print/AR_InvoiceReport?DocumentID=…">In</a>` (mở tab mới, không `_blank`).
2. **Mẫu**: danh sách lấy từ `SY_RpDTbl` (`RpName` = báo cáo, `PName = 'Template'`, giá trị "tệp;Tên;…"); mặc định là
   mẫu đầu. Nội dung mẫu: bản mới nhất (`FileDate`) của `SY_RpFTbl` cho `FileName`, không có thì tệp trong thư mục
   `Reports` của công ty; mẫu đã "tách sang web" thì JSON trong `web.PrintTemplateVersion`.
3. **Dữ liệu**: chạy `<Report>Stp` với `@Template` + `@DocumentID` (nhiều chứng từ nối bằng `;`) và các tham số khác của
   SP, trong giao dịch chỉ đọc. Mỗi result set → một lưới `R0`, `R1`…; giá trị máy như mục 6 (số bất biến, ngày ISO,
   `td[data-null]` cho NULL). Không đổi mã thành tên (in đúng cột SP trả). Mỗi `th` NÊN có `data-format` = định dạng của
   cột trong `SY_FmtFldTbl`/`SY_FmatTbl` (như `GetFormatString`), vì WinForms tự gán định dạng đó cho ô để trống `OutputFormat`.
4. **Tham số in**: tham số của SP (tên trơn), `Sys.*` = `GetSysParam` (ít nhất `SysCom1..4`, `ReportLocation`,
   `ReportPrintDate`, `ServerDate`, `SubTitle`), `Lang.*` cho nhãn `Lng*` có trong mẫu, `Caption.*` cho nhãn `PAR*`,
   `Image.logo` (logo công ty). BE có thể quét tên control trong `.rpx` (`Name="Lng…"`, `"SysCom…"`) để chỉ gửi phần cần.
5. **Quyền**: mở màn in theo quyền in của form; `data-design-href` chỉ khi được sửa mẫu (`EPER`, Admin luôn được).
6. Sau khi in (GĐ sau): ghi `LanIn/PrintCount`, `AutoLock` như WinForms.

### 5.4c Trình thiết kế mẫu in (`print-designer`, chuẩn 15.2)

```html
<section data-erp="screen" data-screen-id="CS_ReceiptReport" data-form-type="CUSTOM" data-mode="edit" data-screen-key="design:CS_ReceiptFrm:CS_ReceiptReport">
  <h1>Thiết kế mẫu in — In phiếu thu</h1>
  <section data-erp="print-designer" data-template-name="CS_ReceiptReport"
           data-template-src="/erp/screens/CS_ReceiptFrm/print/templates/CS_ReceiptReport.rpx" data-template-format="rpx"
           data-preview-src="/erp/screens/CS_ReceiptFrm/print?DocumentID=PT1126/0001&amp;Template=CS_ReceiptReport">
    <form method="post" action="/erp/screens/CS_ReceiptFrm/print/designer/save">
      <input type="hidden" name="__RequestVerificationToken" value="…">
      <input type="hidden" name="Template" value="CS_ReceiptReport">
    </form>
  </section>
</section>
```

1. **Quyền sửa** như ERP: `EPER` trong `SY_FrmCfg` của báo cáo (mặc định mọi người dùng), nhóm Admin luôn được. Không được
   sửa → không gửi `form` (FE chỉ cho xem) và không gửi `data-design-href` trên màn in.
2. **Lưu** (`POST …/save`, multipart): `Template`, `Json`, `Comment` + token. Kiểm lại mẫu (`$schema`, ≤ 2 MB, tên control,
   biểu thức chỉ đọc), ghi một phiên bản mới **bất biến** vào `web.PrintTemplateVersion` (người lưu, giờ, ghi chú, nguồn
   `.rpx` + ngày + sha256 nếu sửa từ mẫu WinForms) và trỏ `web.PrintTemplate` của (báo cáo, mẫu) sang phiên bản đó. Từ đó
   `data-template-src` trả JSON (`data-template-format="json"`). Ghi nhật ký "Sửa mẫu in" như WinForms.
3. **Không** ghi vào `SY_RpFTbl` (WinForms vẫn dùng `.rpx` của nó) — hai bên chạy song song; khi `.rpx` đổi sau phiên bản web,
   màn thiết kế nên báo để người dùng quyết định.

### 5.5 Tra cứu F4 (response của `data-lookup-src`)

```html
<table data-erp="lookup-result" data-total="2">
  <thead><tr><th data-field="ObjectID">Mã</th><th data-field="ObjectName">Tên khách hàng</th><th data-field="Address" data-hidden>Địa chỉ</th></tr></thead>
  <tbody>
    <tr data-value="KH0001" data-text="Bệnh viện Đa khoa A"><td>KH0001</td><td>Bệnh viện Đa khoa A</td><td>12 Lê Lợi, Q.1</td></tr>
    <tr data-value="KH0002" data-text="Phòng khám B"><td>KH0002</td><td>Phòng khám B</td><td>5 Trần Phú</td></tr>
  </tbody>
</table>
```

FE thay `{q}` bằng chữ người dùng gõ. Khi chọn: gán `data-value` vào ô, hiện `data-text` ở `lookup-text`, và điền các ô
có tên trong `data-lookup-fill` bằng ô kết quả có `th[data-field]` trùng tên (cột `data-hidden` vẫn dùng để điền).
Giới hạn ~50 dòng; còn nhiều hơn thì `data-total` > số dòng gửi.

### 5.6 Thông điệp, hỏi xác nhận, hộp thoại

```html
<div data-erp="messages">
  <p data-erp="message" data-msg-type="error" data-legacy-type="1">Ngày chứng từ thuộc kỳ đã khóa sổ.</p>
  <p data-erp="message" data-msg-type="warning" data-field="ObjectID">Khách hàng vượt hạn mức công nợ 15.000.000.</p>
</div>
```

```html
<form data-erp="confirm" method="post" action="/erp/screens/AR_InvoiceFrm/SI1126-0001/save">
  <p data-erp="message" data-msg-type="warning" data-legacy-type="0">Số lượng xuất vượt tồn kho (tồn 12, xuất 15). Vẫn lưu?</p>
  <input type="hidden" name="__confirm" value="stock-check-7f1c">
  <input type="hidden" name="__RequestVerificationToken" value="…">
  <button type="submit" name="__answer" value="yes" data-action="confirm-yes">Vẫn lưu</button>
  <button type="submit" name="__answer" value="no" data-action="confirm-no">Hủy</button>
</form>
```

```html
<section data-erp="dialog" data-size="md">
  <h1>Duyệt đề nghị mua hàng</h1>
  <form method="post" action="/erp/screens/AP_ApprovePurchaseRequestListFrm/actions/Duyet">
    <div data-erp="field" data-control="textarea" data-span="40"><label for="d-notes">Ghi chú</label>
      <textarea id="d-notes" name="Notes"></textarea></div>
    <input type="hidden" name="__RequestVerificationToken" value="…">
    <button type="submit" data-action="approve">Duyệt</button>
    <button type="button" data-action="close">Đóng</button>
  </form>
</section>
```

FE hiển thị:

| Trả về | Trong một `screen` | Không kèm `screen` (vd kết quả nút) |
|---|---|---|
| `success` / `info` | Toast tự đóng 4–5 giây | Toast |
| `error` / `warning` | Khung trên đầu màn + tại ô (`data-field`) | Hộp thông báo |
| `confirm` | Hộp hỏi; người dùng chọn → FE **gửi lại toàn bộ dữ liệu form gốc** + `__confirm` + `__answer` | như bên trái |
| `dialog` | Mở hộp thoại; gửi form trong hộp: `messages` → báo + đóng; `screen` → thay màn tab gốc; `dialog` → thay hộp | |

**Ánh xạ `Msg/MsgType` của SP/hook ERP:** `1`, `4` → `error`; `0`, `5` → `confirm` (hỏi "vẫn tiếp tục?");
còn lại → `warning` hoặc `info`. Luôn giữ `data-legacy-type` = `MsgType` gốc.

Chữ hướng dẫn cố định cho ô nhập dùng `small[data-erp="hint"]` trong `field` — **không** đặt trong `messages`
(sẽ thành toast rồi biến mất).

### 5.7 Đăng nhập, phiên, menu, trang chủ

Xem mẫu đầy đủ ở đặc tả mục 5 và các file `web/mock/login.html`, `session.html`, `menu.html`, `home.html`. Điểm chính:

- `menu`: chỉ gửi mục người dùng được thấy, thứ tự theo `MenuID`, tối đa 5 cấp. Cấp 1 = tab Ribbon / phân hệ Sidebar
  (`data-icon` tên phân hệ: `system`, `catalog`, `purchase`, `sales`, `warehouse`, `stock`, `cash`, `tools`, `asset`,
  `cost`, `ledger`, `business`, `hr`, `office`, `report`, `dashboard`, `settings`).
- Mục lá `data-kind="command"` với `a[data-action="logout"]` là đăng xuất.
- Trang chủ `DASHBOARD`: `section[data-erp="kpi"][data-tone]` (`h2` + `data[value]`), `table[data-erp="chart"][data-chart="bar"]`,
  `section[data-erp="tab-panel"][data-title]` cho khối liên kết nhanh.

## 6. Dữ liệu FE gửi lên — BE phải đọc

| Trường | Khi nào | Ý nghĩa |
|---|---|---|
| Mọi `name` trong form | Luôn | Giá trị **bất biến** (số dấu chấm, ngày ISO, checkbox `true`/`false`) |
| `__RequestVerificationToken` | POST | Như BE đã đặt |
| `__version` | Lưu bản ghi | So với dữ liệu hiện tại; lệch → **409** + `messages` |
| `T1[i].__key`, `T1[i].__state`, `T1[i].<cột>` | Form có lưới `data-form` = id form | `__state` = `new` / `modified` / `deleted`; `__key` rỗng nếu mới; `i` liên tục từ 0 theo thứ tự hiển thị; dòng không đổi **không gửi** (trừ lưới có `data-send-all` → gửi cả `unchanged`) |
| `__selected` (lặp) | Nút có `data-requires-selection` | Khóa các dòng đang chọn của lưới đầu tiên trong màn |
| `__confirm`, `__answer` | Gửi lại sau `confirm` | `__answer` = `yes` / `no`, kèm **toàn bộ** dữ liệu form gốc |
| Query string | Filter `GET` | Ô lọc có giá trị (FE bỏ ô rỗng và trường bắt đầu `__`) |

Ví dụ thân POST khi lưu chứng từ ở 5.3:

```
__RequestVerificationToken=…&__version=2026-11-10T16:05:11.320&DocumentDate=2026-11-10&ObjectID=KH0001
&IsVAT=false&IsVAT=true&Memo=…
&T1[0].__key=1001&T1[0].__state=modified&T1[0].ItemID=VT0001&T1[0].Quantity=6&T1[0].UnitPrice=2500000
&T1[1].__key=&T1[1].__state=new&T1[1].ItemID=VT0002&T1[1].Quantity=1&T1[1].UnitPrice=0
```

(Checkbox đã tích gửi cả `false` của input ẩn lẫn `true` → BE lấy **giá trị cuối**.)

## 7. Ánh xạ từ metadata ERP.NET sang HTML

| ERP.NET | HTML |
|---|---|
| `SY_Menu` (theo quyền `SY_GetUserMenuFnc`) | `nav[data-erp=menu]`: nhóm = `menu-group`, mục có `FormName` = `menu-item` |
| `FormName` + `Para` | `data-screen-id` + `data-para` |
| `SY_FrmLstTbl.FormType` `LIST`/`LISTEDIT`/`EDIT` | `data-form-type` cùng tên; báo cáo `*Report` = `REPORT`; form viết tay = `CUSTOM` hoặc loại gần nhất |
| `SY_FrmCfg` `LYT*` vị trí 0 `ControlType` | `data-control`: 1 `text` (SizeY>1 → `textarea`), 2 `select`, 2 + `SY_FrmDrdwTbl` `lookup`, 3 `multiselect`, 4 `date`, 5 `number`/`money`/`quantity`/`percent`, 6 `checkbox`, 7 `color`, 20 `radio`, 24/26 `button`, 28 `label`, 30 `html` |
| `LYT` vị trí 1 `SizeX` / 2 `SizeY` / 3 `isFirstPos` | `data-span` (1–40) / `data-rows` / `data-row-start` |
| `LYT` vị trí 4 `ReadOnly` / 17 `Required` / 18 `Hidden` | `readonly` / `required` / **không gửi ô** |
| `LYT` vị trí 19 `SizeP` / 20 `SizeWebM` | `data-gap-after` / `data-span-mobile` (1–4) |
| `LYT` vị trí 7 caption | `label` |
| Tab master `LYT1/2/3/A/B/C`, caption `T1V`… | `fieldset[data-erp=tab]` + `legend` |
| Lưới `T0` (danh sách), chi tiết `T1`…`T9`, `TA`…`TJ` | `table[data-erp=grid][data-grid-id]` |
| `GD2` (thứ tự cột), `HDE` (ẩn), `LCK` (khóa), `WWC` (xuống dòng), `CS` (nhóm cột) | thứ tự `th`, `data-hidden`, `data-readonly`, `data-wrap`, `data-group` |
| Định dạng có điều kiện của lưới | `tr[data-tone]` (`danger`/`warning`/`success`/`muted`), `tr[data-strong]` |
| `SY_FrmOptBtnTbl`, `*ButtonCtl`, `StatusButtonCtl` | `toolbar` `data-action="custom"` + `data-icon`; cần tham số → trả `dialog` |
| Bảng trạng thái (`…StatusTbl`) | `data[data-erp=status][value][data-tone]` |
| Hook SP `Msg/MsgType` | `messages` / `confirm` (mục 5.6) |
| Tiền tố số chứng từ (`DPR`, `PreFix`) | do BE đánh số; FE không tự sinh |

## 8. FE đã hỗ trợ đến đâu (cập nhật 2026-11-11)

| Tính năng | Trạng thái |
|---|---|
| Mọi vai trò ở mục 4; lưới sắp xếp / lọc / nhóm / cố định cột / tổng / ảo hóa / sửa trực tiếp; tab nạp lười `data-src`; `data-lookup-min`; `data-send-all`; `data-requires-selection`; `data-refresh-src`; `data-group-by`; `data-layout-key`; `X-ERP-Title`; tải file | **Đã hỗ trợ** |
| `data-query-src` (sắp xếp / lọc / phân trang phía server), `nav[data-erp=pager]` | Chưa — FE xử lý trên các dòng đã nhận. BE hãy gửi đủ dòng (FE ảo hóa) hoặc giới hạn hợp lý + `data-total-rows` |
| `data-options-src` | Chưa — dùng `template[data-erp=options]` |
| Tô màu theo **ô** (`td[data-tone]`), `tr[data-tone="info"]` | Chưa — dùng `tr[data-tone]` `danger`/`warning`/`success`/`muted`, hoặc `data[data-erp=status]` trong ô |
| Lỗi theo ô lưới do BE trả (`td[data-invalid][title]`) | Chưa hiển thị — gửi `messages` `error` nêu rõ dòng |
| `data-lookup-add`, `data-lookup-free`, `data-label-width`, `data-begin-group` (menu) | Chưa — FE bỏ qua, gửi cũng không sao |
| `print-document` (mẫu `.rpx` hoặc JSON, dựng trang, in đúng khổ) | **Đã hỗ trợ** (2026-11-13). Chưa: subreport, QR, tem nhiều cột, crossLine, biểu đồ (cảnh báo trên màn in) |
| `print-designer` (trình thiết kế: kéo thả, thuộc tính, nhóm, tổng, biểu thức, xem trước, lưu) | **Đã hỗ trợ** (2026-11-13, MVP GĐ2) |

FE **bỏ qua** thuộc tính/vai trò không biết (tương thích tiến). Cần tính năng mới → đề xuất bổ sung đặc tả (tăng 1.x).

## 9. Lỗi hay gặp

| Sai | Đúng |
|---|---|
| `<td>12.500.000</td>` cho cột tiền | `<td data-value="12500000">12.500.000</td>` |
| `value="10/11/2026"` cho ô ngày | `value="2026-11-10"` |
| Dùng `class="btn-primary"`, `style="…"` để làm đẹp | Không gửi; FE tự vẽ theo `data-action` |
| Nút "Xóa" là `<a href=…/delete>` | `<button type="submit" form=… formaction=… formmethod="post" data-action="delete" data-confirm=…>` |
| Ẩn cột số tiền bằng `data-hidden` khi user không có quyền | **Không gửi** cột đó |
| `label` không có `for`, hoặc `for` trỏ sai `id` | `label[for]` = `id` của control; `id` duy nhất trong trang |
| Cùng `id` form cho 2 bản ghi mở ở 2 tab | `id` theo khóa chứng từ (`rec-SI1126-0001`) |
| Trả `messages` "Vẫn lưu?" | Dùng `form[data-erp=confirm]` |
| Ghi chú cố định của màn đặt trong `messages` `info` | Toast sẽ biến mất; dùng `small[data-erp=hint]` hoặc chữ trong `h1`/`caption` |
| `<tr>` thiếu `data-key` khi bảng có `data-key-field` | Mọi dòng có `data-key` |
| Gửi mật khẩu/token trong `value` | Ô mật khẩu luôn rỗng; token API không bao giờ vào HTML |

## 10. Kiểm tra trước khi giao

- [ ] `web/tools/validate.html` báo **0 lỗi** cho mọi loại response của màn (danh sách, xem, sửa, thêm, lưu lỗi, confirm, dialog, lookup).
- [ ] Không có `style` / `class` / `script` / `on*`.
- [ ] Mọi `screen` có `data-screen-id`, `data-form-type`, `data-mode`, `data-screen-key`, `h1`.
- [ ] Mọi `field` có `label[for]` đúng; số và ngày dạng bất biến.
- [ ] Mọi `th` có `data-field`; mọi `tr` có `data-key` khi lưới có khóa.
- [ ] POST có token; `record` sửa có `__version`; BE trả 409 khi lệch.
- [ ] Nút / cột không được phép không có trong HTML; ô mật khẩu rỗng.
- [ ] Thông điệp SP map đúng `data-msg-type` / `confirm`, giữ `data-legacy-type`.
- [ ] Mở thử trong FE thật: đặt `loginUrl`, `sessionUrl`, `menuUrl`, `homeUrl` trong `web/config.js` trỏ về BE, chạy và bấm thử.

## 11. Bảng tra nhanh file mock tương ứng

| Trường hợp | File trong `web/mock/` |
|---|---|
| Đăng nhập / phiên / menu / trang chủ | `login.html`, `session.html`, `menu.html`, `home.html` |
| Danh sách sửa trực tiếp (LIST) | `screens/CF_ChuyenKhoaListFrm.html`, `.edit.html`, `.saved.html` |
| Danh sách chứng từ (EDIT find) | `screens/AR_InvoiceFrm.html` |
| Chứng từ xem / sửa / thêm / đã lưu | `records/AR_InvoiceFrm/1.html`, `1.edit.html`, `new.html`, `1.saved.html` |
| Hỏi xác nhận | `records/AR_InvoiceFrm/1.confirm.html` |
| Báo cáo | `reports/AP_PurchaseDetailReport.html` |
| Màn xử lý (tham số + chạy + kết quả) | `screens/IV_UnitCostProcessFrm.html`, `.done.html` |
| Tra cứu | `lookups/CF_ObjectTbl.html`, `CF_ItemTbl.html` |
| Kết quả hành động, đính kèm, hộp thoại | `actions/custom-ok.html`, `deleted.html`, `locked.html`, `attachments.html`, `change-password.html` |
| In theo mẫu (JSON / `.rpx`) | `print/CS_ReceiptReport.html`, `print/AR_InvoiceReport.html`, mẫu ở `print/templates/` |
| Thiết kế mẫu in, kết quả lưu | `print/CS_ReceiptReport.designer.html`, `print/AR_InvoiceReport.designer.html`, `actions/print-template-saved.html` |
