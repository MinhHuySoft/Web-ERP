# Cấu trúc và tổ chức Frontend Web-ERP (cho kỹ thuật và agent)

> **Đọc nhanh:** FE là **HTML + CSS + JS thuần** (ES modules, không build, không npm, không framework) trong `web/`.
> FE **không có nghiệp vụ**: gọi BE, nhận **HTML thô theo chuẩn ERP-HTML**, làm sạch, rồi "nâng cấp" theo vai trò
> `data-erp` thành giao diện (Ribbon / Sidebar, tab, lưới, form, hộp thoại, theme). Sửa file → tải lại trang là thấy.
>
> - BE trả HTML thế nào: [`be-tra-html-cho-fe.md`](be-tra-html-cho-fe.md) · đặc tả: [`02-chuan-html-erp.md`](../kien-truc/02-chuan-html-erp.md)
> - Chuẩn giao diện (token, danh sách cấm, kiểm tra trước khi merge): [`03-chuan-giao-dien.md`](../kien-truc/03-chuan-giao-dien.md)
> - Quyết định dự án: [`QUYET-DINH.md`](../QUYET-DINH.md) (QĐ-04 giao diện, QĐ-05 công nghệ, QĐ-06 phạm vi FE)

---

## 1. Nguyên tắc

1. **BE quyết, FE hiển thị.** Quyền, trạng thái, đánh số, kiểm tra nghiệp vụ ở BE. FE không tự mở khóa ô, không tự ghép
   URL nghiệp vụ (trừ 4 điểm vào trong `web/config.js`).
2. **Không chạy gì từ BE:** mọi HTML nhận về đi qua `core/sanitize.js` (bỏ `script/style/class/on*`, URL `javascript:`,
   thẻ ngoài danh sách cho phép).
3. **Một nguồn màu / chữ / khoảng cách:** token `--erp-*` trong `css/tokens.css`; component không đặt màu cứng.
4. **Không build:** `// @ts-check` + JSDoc thay TypeScript; mỗi file là một ES module.
5. **Giao diện Operate** (ứng dụng nghiệp vụ): quen thuộc, gọn, đủ tương phản, không trang trí thừa
   (xem chuẩn giao diện).

## 2. Chạy và thử

```bash
python -I tools/dev-server.py --port 5180          # mở http://127.0.0.1:5180/
python -I tools/mock-gen/build_mock.py              # sinh lại web/mock/ từ metadata Medcom (dữ liệu giả)
```

- **Mock = BE giả:** `web/config.js` trỏ 4 điểm vào tới `web/mock/*.html`. Dev server nhận POST tới `/mock/*`, trả file
  tương ứng và **in dữ liệu form ra console** (để kiểm tra FE gửi đúng chuẩn).
- **Kiểm tra chuẩn:** mở `/tools/validate.html` (dán HTML hoặc nhập URL). Có thể gọi trong code:
  `import { validate } from '/js/tools/validate.js'; validate(new DOMParser().parseFromString(html, 'text/html'))`.
- **Nối BE thật:** sửa `loginUrl`, `sessionUrl`, `menuUrl`, `homeUrl` (+ `allowedOrigins` nếu khác origin) trong `web/config.js`.

## 3. Bản đồ thư mục

```
web/
  index.html              khung trang: nạp CSS theo lớp, config.js, js/app.js; #erp-app là gốc ứng dụng
  config.js               window.ERP_CONFIG: 4 điểm vào BE, allowedOrigins, contractVersion, defaultTheme
  assets/                 favicon / logo
  css/
    layers.css            @layer reset, tokens, base, components, themes, utilities  (thứ tự ưu tiên toàn dự án)
    tokens.css            token --erp-* (mặc định = ribbon-classic), thang chữ, chuyển động, mật độ;
                          lớp utilities: biến dẫn xuất (--erp-primary, *-soft, --erp-on-primary) + màu người dùng
    base.css              reset, nút .erp-btn, huy hiệu, thông điệp .erp-msg, toast, menu bật lên, bề mặt trình duyệt
    shell.css             vỏ: lưới .erp-app, thanh tiêu đề, Sidebar, thanh tab tài liệu, thanh trạng thái,
                          bảng lệnh Ctrl+K, đăng nhập, bảng "Giao diện & hiển thị"
    ribbon.css            Ribbon
    screen.css            màn hình: đầu màn, toolbar, thanh lọc, bản ghi, tab con
    fields.css            lưới 40 cột (→ 20 → 4 cột theo container query), ô nhập, ô ngày, tra cứu
    grid.css              lưới dữ liệu (bảng, nhóm, footer, sửa ô) + dạng thẻ trên màn hẹp
    dialog.css            hộp thoại <dialog>
    dashboard.css         dải KPI, biểu đồ, khối liên kết nhanh
    responsive.css        điểm gãy 1279 / 1023 / 767px (ngăn kéo menu, thanh điều hướng dưới, toolbar cuộn ngang)
    print.css             in
    themes/<tên>.css      12 theme: chỉ ghi đè token + vài hiệu ứng riêng, dẫn xuất màu từ --erp-primary
  js/
    app.js                khởi động: applySettings() → new Shell(#erp-app).start()
    core/                 hạ tầng dùng chung, không biết gì về màn hình
      dom.js              h() tạo phần tử, $() và $$() chọn phần tử, fold() bỏ dấu tiếng Việt, debounce(), uid(), closestRole()
      http.js             fetchHtml(): fetch + header chuẩn + sanitize + absolutize; pick()/pickAll() lấy vai trò; adopt()
      sanitize.js         danh sách thẻ cho phép, bỏ thuộc tính nguy hiểm, đổi URL tương đối → tuyệt đối
      format.js           định dạng số / ngày kiểu Việt Nam; parse ngược về giá trị bất biến
      icons.js            bộ icon SVG (icon(name)), guessIcon() đoán icon theo tên chức năng
      ui.js               toast(), openDialog(), confirmBox(), messageBox()
      settings.js         cài đặt người dùng (theme, mật độ, cỡ chữ, kiểu menu, màu, gradient…), THEMES,
                          applySettings() → data-* trên <html> + biến CSS; bố cục lưới, gần đây, yêu thích
      color.js            tương phản WCAG, tự chỉnh màu đủ 4.5:1, chọn chữ trắng/đen, sinh màu phụ
    shell/                vỏ ứng dụng (tồn tại suốt phiên)
      shell.js            class Shell: nạp phiên + menu, dựng thanh tiêu đề / Ribbon / Sidebar / thanh trạng thái,
                          phím tắt toàn cục, đăng nhập / đăng xuất, popupMenu()
      menu-model.js       parseMenu(nav[data-erp=menu]) → cây MenuNode; leaves()
      ribbon.js           Ribbon từ cây menu (cấp 1 = tab, cấp 2 = nhóm, lá = nút)
      sidebar.js          Sidebar dọc: phân hệ, nhóm, lọc không dấu, yêu thích, thu gọn, kéo giãn
      tabs.js             TabManager: mở/đóng tab, tải URL, xử lý response, gửi form, xác nhận, hộp thoại, tải file
      palette.js          bảng lệnh Ctrl+K (tìm chức năng)
      settings-panel.js   bảng "Giao diện & hiển thị" (Theme · Màu sắc · Bố cục & chữ)
    enhance/              "nâng cấp" HTML của BE theo vai trò data-erp (chạy mỗi lần vẽ màn hình / hộp thoại)
      screen.js           enhanceScreen() (đầu màn, breadcrumb, yêu thích) + enhanceFragment() (thứ tự chạy, mục 4)
      toolbar.js          menu[data-erp=toolbar] → nút có icon, phím tắt, nhóm, menu "Thêm…"
      forms.js            interceptNavigation() (bắt link/nút), collectFormData() (form + dòng lưới + __selected),
                          validateRecord()
      fields.js           div[data-erp=field] → ô số / ngày / tra cứu / công tắc / mật khẩu; lưới 40 cột; theo dõi "có thay đổi"
      lookup.js           tra cứu F4: gọi data-lookup-src, bảng bật lên, điền data-lookup-fill
      grid.js             class Grid: sắp xếp, lọc, nhóm, cố định / ẩn / đổi rộng cột, tổng, ảo hóa (≥160 dòng),
                          sửa trực tiếp, dạng thẻ, xuất CSV nhanh, serialize() dòng thay đổi
      messages.js         thông điệp: success/info → toast; error/warning → khung + gắn vào ô
      dashboard.js        KPI → dải chỉ số; table[data-erp=chart] → biểu đồ SVG
    tools/validate.js     validate(doc) → danh sách lỗi/cảnh báo theo đặc tả (mục 19)
  tools/validate.html     trang kiểm tra cho đội BE
  mock/                   HTML mẫu (BE giả) do tools/mock-gen/build_mock.py sinh — KHÔNG sửa tay

tools/                    (ngoài web/) dev-server.py, mock-gen/build_mock.py, metadata-export/, legacy-decompile/
docs/                     phân tích hệ thống cũ (legacy-analysis/), kiến trúc & chuẩn (kien-truc/), hướng dẫn (huong-dan/)
```

## 4. Luồng chạy

### 4.1 Khởi động

```mermaid
sequenceDiagram
  participant A as app.js
  participant S as Shell
  participant BE as Backend / mock
  A->>A: applySettings() — theme, mật độ, cỡ chữ, màu lên <html>
  A->>S: new Shell(#erp-app).start()
  S->>BE: GET sessionUrl
  alt 401 hoặc không có [data-erp=session]
    S->>BE: GET loginUrl → form[data-erp=login] → POST; có session thì vào luôn, thành công khác (303 homeUrl) thì start() lại
  end
  S->>BE: GET menuUrl → parseMenu() → Ribbon + Sidebar
  S->>BE: GET homeUrl → tab Trang chủ (ghim)
```

Khung `.erp-app` là lưới 4 vùng cố định: `title` (thanh tiêu đề) · `ribbon` · `body` (Sidebar + thanh tab + vùng làm
việc) · `status`. Vùng nào ẩn (Ribbon khi dùng Sidebar, thanh trạng thái trên điện thoại) thì co về 0.

### 4.2 Mở một màn hình

1. Người dùng bấm menu / link → `interceptNavigation` (forms.js) chặn, đọc `data-target` → `ctx.navigate(url, target)`.
2. `TabManager.open(url, {target})`: `tab` (mặc định; trùng URL thì chuyển tab), `self`, `dialog`, `_blank` (tải file).
3. `load()` → `fetchHtml(url)`: gửi `X-ERP-Request: fragment`, `X-ERP-Contract`; **sanitize + absolutize** HTML.
4. `handle(res)` (tabs.js) — trung tâm xử lý response:
   - 401 → màn đăng nhập;
   - có `form[data-erp=confirm]` → hỏi xác nhận (`askConfirm`) rồi gửi lại;
   - có `screen` → `render()`: thay nội dung tab, đặt tiêu đề = `h1`, `enhanceScreen()`; trùng `data-screen-key` với tab
     khác → chuyển sang tab đó;
   - có `dialog` → `showDialog()`;
   - `messages` ngoài screen → toast / hộp thông báo.
5. `enhanceScreen()` dựng đầu màn (breadcrumb theo `data-menu-id`, tiêu đề, huy hiệu chế độ, sao yêu thích, đưa toolbar
   lên cùng hàng), rồi `enhanceFragment()` chạy **theo đúng thứ tự**:

   `interceptNavigation` → tắt bong bóng kiểm tra của trình duyệt → `toolbar` → `filter` → `record` (tab của bản ghi)
   → `fields` → `grid` → `tabs` (tab chi tiết, nạp lười `data-src`) → `messages` → `dashboard` → `attachments` /
   `report-result` → nút trong form tự do / hộp thoại.

   Thêm bước mới thì chèn đúng chỗ: ví dụ cái gì cần ô đã nâng cấp thì đặt **sau** `fields`.

### 4.3 Gửi form

1. Nút `type=submit` (có `form`, `formaction`, `formmethod`) hoặc Enter trong form → `TabManager.submit()`.
2. Nút `save` / `save-new` → `validateRecord()` (ô bắt buộc, định dạng; mở đúng tab chứa ô lỗi).
3. `data-confirm` trên nút → hộp hỏi trước khi gửi.
4. `collectFormData()`:
   - mọi `name` trong form (kể cả control ngoài form có thuộc tính `form`);
   - dòng thay đổi của lưới có `data-form` = id form, dạng `T1[i].__key/__state/<cột>` (`Grid.serialize()`);
   - `__selected` khi nút có `data-requires-selection`.
5. GET (filter) → mở lại URL kèm query trong cùng tab. POST → `fetchHtml(..., {method:'POST'})` → `handle()` như 4.2.
   Response rỗng (204) → toast "Đã gửi".

### 4.4 Ngữ cảnh truyền cho enhancer (`TabContext`)

```js
{ tab, shell,
  navigate(url, target),      // mở link theo data-target
  submit(form, submitter, extra),
  reload(),                   // F5 của tab
  setDirty(bool),             // đánh dấu có thay đổi (hỏi trước khi rời)
  registerKey(combo, fn) }    // phím tắt theo tab (vd 'ctrl+s')
```

Hộp thoại dùng ngữ cảnh tương tự (`dialogCtx`) — enhancer không cần biết đang ở tab hay hộp thoại.

## 5. CSS: lớp, token, theme

- **Thứ tự lớp** (`css/layers.css`): `reset → tokens → base → components → themes → utilities`. Theme thắng component
  mà không cần `!important`; `utilities` (biến dẫn xuất, màu người dùng) thắng tất cả.
- **Token** (`tokens.css`): màu vai trò (`--erp-bg/surface/text/border/accent/success/warning/danger/info`), chữ
  `--erp-text/-muted/-faint` (đều ≥ 4.5:1), thang chữ `--erp-fs-xs..2xl` (6 bậc, theo `rem`), chuyển động
  `--erp-dur*`, `--erp-ease-out`, bo góc, bóng, mật độ (`--erp-row-h`, `--erp-ctl-h`, `--erp-gap`, `--erp-pad`).
- **Dẫn xuất** (lớp utilities): `--erp-primary` = màu người dùng (`--erp-accent-user`) hoặc `--erp-accent` của theme;
  `--erp-primary-soft/-hover`, `--erp-on-primary` (chữ trên nền màu), `--erp-*-soft`, `--erp-focus-ring`.
- **Theme** = khối `:root[data-theme="<tên>"]` ghi đè token. Màu nhuốm (thanh tiêu đề, dòng chọn, nút ribbon, bề mặt
  tông màu…) **phải** viết bằng `color-mix(in srgb, var(--erp-primary) N%, <nền>)` hoặc `var(--erp-tone-1..3, <mặc định>)`
  để đổi theo màu người dùng chọn.
- **Thuộc tính trên `<html>`** do `applySettings()` đặt: `data-theme`, `data-density` (`compact/standard/comfortable`),
  `data-nav` (`ribbon/sidebar`), `data-sidebar` (`full/rail`), `data-motion`, `data-user-chrome`, `data-user-bg`.
- **Responsive:** điểm gãy `1279 / 1023 / 767px` (`responsive.css`); form 40 cột co theo **container query** (40 → 20 → 4);
  lưới < 620px tự chuyển dạng thẻ.
- **Tên lớp:** tiền tố `erp-`, kiểu BEM nhẹ: `.erp-grid`, `.erp-grid__bar`, `.erp-btn--primary`, trạng thái `.is-*`.
  HTML từ BE không có class — mọi class do JS gắn khi nâng cấp.

## 6. Trạng thái và lưu trữ

| Khóa `localStorage` | Nội dung | File |
|---|---|---|
| `erp.settings.v1` | theme, mật độ, cỡ chữ, kiểu menu, màu chủ đạo, gradient, Sidebar thu gọn/độ rộng, giảm chuyển động | `core/settings.js` |
| `erp.grid.<screen-id>.<grid-id>` | bố cục lưới: thứ tự / độ rộng / ẩn cột, sắp xếp, nhóm | `core/settings.js` + `enhance/grid.js` |
| `erp.recent`, `erp.favorites` | màn gần đây (20), yêu thích | `core/settings.js` |

Khi BE có endpoint lưu cài đặt theo người dùng: chỉ thay hàm `read()` / `store()` trong `core/settings.js`.

## 7. Muốn sửa X thì mở file Y

| Việc | File |
|---|---|
| Đổi URL backend, origin cho phép | `web/config.js` |
| Thanh tiêu đề, thanh trạng thái, phím tắt toàn cục, đăng nhập | `js/shell/shell.js`, `css/shell.css` |
| Cách mở tab / xử lý response / gửi form / xác nhận / hộp thoại | `js/shell/tabs.js` |
| Ribbon / Sidebar / bảng lệnh Ctrl+K | `js/shell/ribbon.js`, `sidebar.js`, `palette.js` (+ `menu-model.js`) |
| Bảng "Giao diện & hiển thị" | `js/shell/settings-panel.js`, `css/shell.css` |
| Nút toolbar (icon, phím tắt mặc định, màu nút chính) | `js/enhance/toolbar.js` (`ACTION_TONE`, `DEFAULT_KEYS`) |
| Ô nhập (số, ngày, tra cứu, công tắc…) | `js/enhance/fields.js`, `lookup.js`, `css/fields.css` |
| Lưới dữ liệu | `js/enhance/grid.js`, `css/grid.css` |
| Dữ liệu gửi lên khi lưu | `js/enhance/forms.js` (`collectFormData`), `Grid.serialize()` |
| Thông điệp / toast | `js/enhance/messages.js`, `js/core/ui.js`, `css/base.css` |
| Định dạng số / ngày | `js/core/format.js` |
| Icon | `js/core/icons.js` (đường SVG nét 1.8, tên trùng `data-action` / phân hệ) |
| Màu, thang chữ, mật độ | `css/tokens.css`; theme: `css/themes/<tên>.css` |
| Danh sách thẻ / thuộc tính được phép từ BE | `js/core/sanitize.js` |
| Luật kiểm tra chuẩn | `js/tools/validate.js` |
| Mock (BE giả) | `tools/mock-gen/build_mock.py` → chạy lại → `web/mock/` |

## 8. Công thức mở rộng

**Thêm một vai trò `data-erp` mới (vd `timeline`):**
1. Ghi vào đặc tả `docs/kien-truc/02-chuan-html-erp.md` (tăng 1.x) và hướng dẫn BE.
2. Thêm tên vào `ROLES` trong `js/tools/validate.js` (+ luật kiểm tra nếu có).
3. Nếu dùng thẻ mới: thêm vào `ALLOW` trong `js/core/sanitize.js`; thuộc tính URL mới: thêm vào `URL_ATTRS`.
4. Viết `js/enhance/timeline.js` (`export function enhanceTimeline(root, ctx)`), gọi trong `enhanceFragment()` đúng thứ tự.
5. CSS trong file component phù hợp (lớp `components`), chỉ dùng token.
6. Thêm mẫu vào `tools/mock-gen/build_mock.py`, sinh lại mock, chạy validator.

**Thêm loại ô (`data-control`):** nhánh mới trong `enhanceField()` (`fields.js`) + `CONTROLS` trong `validate.js` +
CSS trong `fields.css` + `field_html()` trong `build_mock.py`.

**Thêm hành động toolbar chuẩn:** icon trong `icons.js` (cùng tên `data-action`), phím mặc định trong `toolbar.js`,
cập nhật bảng mục 7 của đặc tả.

**Thêm theme:** `css/themes/<tên>.css` (khối `:root[data-theme="<tên>"]`, màu nhuốm dẫn xuất từ `--erp-primary`),
khai báo trong `THEMES` (`core/settings.js`, có `dark` / `vivid` / `locked` nếu cần), thêm `<link>` vào `index.html`,
thêm ảnh xem trước `[data-theme-preview="<tên>"]` cuối `css/shell.css`. Kiểm tra tương phản chữ phụ ≥ 4.5:1.

**Thêm màn mock:** dùng các hàm trong `build_mock.py` (`build_list`, `build_edit`, `build_report`, `grid_screen`,
`record_screen`, `process_screen`…), thêm vào `CURATED` nếu là màn viết tay; chạy lại generator; validator 0 lỗi.

## 9. Quy ước code

- Mỗi file JS: `// @ts-check`, JSDoc cho tham số; ES module; **không biến toàn cục** (trừ `window.ERP_CONFIG`,
  `window.ErpApp` để gỡ lỗi).
- Tạo DOM bằng `h(tag, attrs, ...children)` (`core/dom.js`); chỉ dùng `innerHTML` cho chuỗi tự sinh đã escape (vd hàng
  lưới) — **không bao giờ** gán HTML của BE chưa qua `sanitize`.
- Chú thích, chữ giao diện bằng tiếng Việt; tên biến / hàm tiếng Anh.
- Không màu / cỡ chữ / thời gian chuyển động cứng trong component — dùng token. Không `!important` trừ chỗ bắt buộc
  (giảm chuyển động, ẩn khi in, tương phản cao).
- Không thêm thư viện ngoài, không bước build. Cần thứ gì thì viết module nhỏ trong `core/`.

## 10. Kiểm tra trước khi merge

- [ ] Mở app với mock, không lỗi console; thử màn bị ảnh hưởng ở **1280px, 768px, 375px**.
- [ ] Thử ít nhất theme **Ribbon cổ điển**, **Ribbon tối** và một theme kính (Glassmorphism); thử chế độ **Sidebar**.
- [ ] Nếu đổi `build_mock.py`: chạy lại generator, `validate` toàn bộ `web/mock/` → **0 lỗi**.
- [ ] Đối chiếu [chuẩn giao diện](../kien-truc/03-chuan-giao-dien.md) mục 3–4 (danh sách cấm, tương phản, trạng thái, bố cục).
- [ ] Đổi hành vi giao tiếp với BE → cập nhật đặc tả + hướng dẫn BE cùng lúc.
