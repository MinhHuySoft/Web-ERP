# Chuẩn giao diện Web-ERP

Mục tiêu: giao diện gọn, chắc tay, đọc như một sản phẩm ERP thật. Không "thô", không "lộ AI".

Nguồn tham khảo đã đọc (11/11/2026):
- **impeccable** (pbakaus/impeccable): bộ quy tắc thiết kế cho agent, gồm danh sách "AI slop" và sàn chất lượng (craft floor). Web-ERP thuộc chế độ **Operate**, tức người dùng đến để làm việc. Ở chế độ này, độ chính xác và tiết chế được ưu tiên hơn sự phô diễn.
- **UI UX Pro Max** (nextlevelbuilder/ui-ux-pro-max-skill): 10 nhóm quy tắc UX có thứ tự ưu tiên, và bảng gợi ý theo loại sản phẩm. Với các nhóm *Inventory & Stock*, *CRM*, *B2B*, bảng gợi ý:
  - phong cách: **Flat + Minimalism/Swiss**;
  - màu: trung tính, màu trạng thái xanh/vàng/đỏ;
  - chuyển động: hover đổi màu, khoảng 150 ms;
  - tránh: trang trí thừa, bóng đổ phức tạp, hiệu ứng 3D, gradient tím/hồng kiểu AI.

Phạm vi áp dụng:
- Toàn bộ `web/css`, `web/js`, và mock trong `tools/mock-gen`.
- Các theme người dùng chọn (glassmorphism, neumorphism, claymorphism, aurora, neon…) giữ nguyên chất riêng theo QĐ-04, nhưng vẫn phải đạt **sàn chất lượng** ở mục 4.

## 1. Nguyên tắc

1. **Quen thuộc trước, cá tính sau.** Điều khiển phải là điều khiển chuẩn: nút, tab, ô nhập, select, bảng có tiêu đề cột sắp xếp được. Không tự chế dạng mới cho việc quen thuộc.
2. **Mỗi màu phải có vai trò.** Màu nhấn chỉ dùng cho hành động chính, mục đang chọn và trạng thái. Màu trạng thái chỉ dùng khi mang ý nghĩa, và luôn đi kèm chữ hoặc icon.
3. **Phân cấp bằng cỡ chữ, độ đậm và khoảng cách,** không bằng khung, viền màu hay hiệu ứng.
4. **Chuyển động chỉ để báo trạng thái** (mở, đóng, đã lưu, đang tải). Ngắn (120–180 ms), giảm tốc khi đến, không nảy.
5. **Nhất quán toàn hệ thống.** Nếu nút "Lưu" ở hai màn trông khác nhau thì một trong hai đang sai.

## 2. Token bắt buộc (`web/css/tokens.css`)

Component **không** đặt màu cứng, cỡ chữ lẻ hay thời gian chuyển động lẻ. Chỉ dùng các token sau.

| Nhóm | Token | Ghi chú |
|---|---|---|
| Cỡ chữ | `--erp-fs-xs` 12 · `-sm` 13 · `-md` 14 · `-lg` 16 · `-xl` 20 · `-2xl` 24 (px, khi gốc 14px) | Tính theo `rem`, nên đổi theo cỡ chữ người dùng chọn. Không thêm bậc mới. |
| Màu chữ | `--erp-text` / `--erp-text-muted` / `--erp-text-faint` | Cả ba phải đạt ≥ 4.5:1 trên `surface` và `bg` của **mọi** theme. |
| Màu vai trò | `--erp-primary` (hành động, chọn), `--erp-success/-warning/-danger/-info`, `--erp-favorite` | Bản nhạt dùng `*-soft`. |
| Chuyển động | `--erp-dur-fast` 120ms · `--erp-dur` 180ms · `--erp-ease-out` | Thoát nhanh hơn vào (~70%). |
| Hình khối | `--erp-radius-sm/-/-lg`, `--erp-shadow-sm/-/-lg` | Bóng luôn có độ lệch và nhòe mềm. |

## 2b. Màu do người dùng chọn

Người dùng tự đổi màu trong *Giao diện & hiển thị → Màu sắc*. Mã nằm ở `web/js/core/settings.js` (`applyColors`) và `web/js/core/color.js`.

- **Màu chủ đạo** (`--erp-accent-user`): chọn từ 10 màu mẫu, một màu bất kỳ, hoặc "Theo theme".
  - **Mọi màu nhuốm phải dẫn xuất từ `--erp-primary`**, không viết cứng: thanh tiêu đề, nút ribbon khi rê chuột, dòng lưới đang chọn, bề mặt tông màu (Material You, Claymorphism, Glassy Aero), ánh neon…
  - Theme mới cũng phải theo quy tắc này. Dùng `color-mix(in srgb, var(--erp-primary) N%, <nền>)` thay cho mã màu cứng.
- **Màu phụ** `--erp-tone-1..3`: lấy từ gradient người dùng chọn, hoặc xoay sắc độ từ màu chủ đạo. Các theme có nền rực (Glassmorphism, Aurora, Fluent Mica, Claymorphism) tô nền bằng các màu này, kèm giá trị mặc định khi người dùng chưa chọn.
- **Gradient 2–3 màu và góc**, áp cho **thanh tiêu đề** và/hoặc **nền ứng dụng**:
  - Ở theme sáng, nền được pha nhạt vào `--erp-bg` (20%); ở theme tối pha 38%. Nhờ vậy chữ đặt thẳng trên nền vẫn đủ tương phản.
  - Theme `vivid` không bị thay nền; theme đó tô gradient riêng bằng `--erp-tone-*`.
- **Tương phản luôn được giữ:**
  - Màu chủ đạo tự đậm/nhạt dần cho tới khi đạt 4.5:1 với nền theme; bảng cài đặt báo khi đã chỉnh.
  - Chữ trên nút (`--erp-on-primary`) và trên thanh tiêu đề tự chọn trắng hoặc gần đen theo độ sáng.
  - Nếu các màu gradient chênh sáng tối khiến chữ thanh tiêu đề dưới 4.5:1, bảng cài đặt cảnh báo.
  - Mọi gradient mẫu đều đạt ≥ 4.5:1.
- **Theme khóa màu** (`locked`: Tương phản cao) bỏ qua mọi màu người dùng chọn.

## 3. Danh sách cấm (dấu hiệu "lộ AI")

| Không làm | Làm thay | Hiện trạng |
|---|---|---|
| Viền màu dày (> 1px) ở mép trái của thẻ, thông báo, mục danh sách | Phân biệt bằng icon, chữ, chấm trạng thái nhỏ | Đã bỏ ở KPI và toast |
| Các thẻ chỉ số rời nhau, cùng cỡ, mỗi thẻ một vạch màu ("hero-metric template") | Một dải chỉ số chung khung, ngăn bằng vạch 1px | Đã sửa (`dashboard.css`) |
| Nhãn CHỮ HOA giãn cách đặt trên tiêu đề (eyebrow / kicker) | Tiêu đề tự đứng được; nhóm phụ dùng chữ thường, đậm 600 | Đã sửa (sidebar, tiêu đề khung form) |
| Kính mờ, blur, gradient làm trang trí ở theme mặc định | Nền đặc, viền 1px, bóng mềm. Blur chỉ dùng cho lớp phủ của hộp thoại. | Đã sửa (toast, thanh tiêu đề Ribbon) |
| Hiệu ứng nảy, đàn hồi, chuyển động dài | Giảm tốc ngắn bằng `--erp-ease-out` | Đã sửa (toast) |
| Ký tự Unicode hoặc emoji thay icon (✓ ★ ☰ …) | Icon SVG trong `web/js/core/icons.js`, cùng nét 1.8 | Đã sửa ô có/không của lưới |
| Chữ gradient | Nhấn bằng độ đậm hoặc cỡ chữ | Đã bỏ ở theme Aurora |
| Hộp thoại cho việc không cần cắt ngang | Xử lý tại chỗ (toast, khung trong màn hình) | — |
| Cỡ chữ lẻ tùy hứng (trước đây có 27 giá trị) | 6 bậc `--erp-fs-*` | Đã gom |

## 4. Sàn chất lượng: kiểm tra trước khi merge

**Tương phản và khả năng tiếp cận**
- [ ] Chữ thường và placeholder ≥ 4.5:1; chữ lớn, icon có nghĩa, viền ô nhập ≥ 3:1. Kiểm tra ở cả theme sáng và tối.
- [ ] Mọi điều khiển có focus nhìn thấy được (`--erp-focus-ring`); thứ tự Tab khớp thứ tự nhìn.
- [ ] Nút chỉ có icon phải có `aria-label`. Icon trang trí cạnh chữ dùng `aria-hidden`.
- [ ] Thông tin không chỉ dựa vào màu: trạng thái luôn có chữ (huy hiệu trạng thái, nhãn toast).

**Bề mặt trình duyệt** (đã theme hóa trong `base.css`)
- [ ] Vùng chọn chữ, con trỏ nhập (`caret-color`), ô tích/radio gốc (`accent-color`), thanh cuộn (`scrollbar-color`).
- [ ] Số trong lưới, ô số, ô ngày, KPI dùng `font-variant-numeric: tabular-nums`.

**Thông điệp** (chuẩn ERP-HTML 13.1)
- [ ] `success` / `info` hiện bằng **toast**. Toast tự đóng sau 4–5 giây, dừng khi rê chuột, không lấy focus, đọc qua `aria-live`.
- [ ] `error` / `warning` hiện bằng **khung trên đầu màn hình** và **tại ô nhập** (`data-field`). Không để tự biến mất.
- [ ] Chữ hướng dẫn cho ô phức tạp dùng `small[data-erp="hint"]`, hiện cố định dưới ô. Không đặt trong `messages`, vì sẽ thành toast rồi biến mất.

**Trạng thái**
- [ ] Mỗi điều khiển có đủ: bình thường, hover, focus, nhấn, vô hiệu, đang xử lý, lỗi.
- [ ] Lưới có trạng thái rỗng, đang tải, lỗi tải. Nút gửi bị khóa trong khi chờ (`data-pending`).

**Bố cục**
- [ ] Không cuộn ngang ở 375px. Thử ở 375, 768, 1280 và ≥ 1440px.
- [ ] Vùng bấm trên web ≥ 24×24px, trên thiết bị cảm ứng ≥ 40px (đã có quy tắc `pointer: coarse`).
- [ ] Khoảng cách theo bậc 4px: nhóm liên quan đặt sát, nhóm khác nhau tách rộng.
- [ ] Hàng lọc giữ một độ cao. Tên tra cứu hiện ngay trong ô, nên chọn mã không làm xô nút hay lưới.

**Chuyển động**
- [ ] Chỉ dùng `transform` và `opacity`. Tôn trọng `prefers-reduced-motion` và tùy chọn "Giảm chuyển động". Không có hiệu ứng chạy khi tải trang.

## 5. Ngoại lệ có chủ đích

- **Vạch 3px ở ô đầu dòng lưới** (dòng đang chọn, thêm mới, đã sửa) là chỉ báo trạng thái dữ liệu, giống bộ chọn dòng của Janus GridEX trên WinForms. Đây không phải trang trí, nên được giữ.
- **Các theme phong cách** (glassmorphism, neumorphism, claymorphism, aurora, neon-cyber, glassy-aero) do chủ dự án yêu cầu (QĐ-04). Theme được dùng kính mờ, gradient, bóng nổi như ngôn ngữ riêng, nhưng không được phá tương phản và trạng thái ở mục 4.
- **Font hệ thống** (Segoe UI Variable / Segoe UI): đúng với giao diện Operate và môi trường Windows của người dùng hiện tại, hiển thị tiếng Việt tốt.
  - Nếu cần đồng nhất trên mọi máy, có thể tự host **Be Vietnam Pro** hoặc **Inter** (giấy phép OFL, có bộ ký tự tiếng Việt).
  - Việc này cần tải tệp font vào `web/fonts/`, nên chủ dự án duyệt trước.

## 6. Việc tiếp theo (chưa làm)

- Trạng thái đang tải dạng khung xương (skeleton) cho lưới và màn hình, thay cho dòng chữ "Đang tải…".
- Trạng thái rỗng có hướng dẫn hành động (ví dụ "Chưa có chứng từ trong kỳ — Thêm mới (F2)").
- Rà các theme phong cách theo sàn chất lượng: tương phản chữ trên nền kính, focus ring trên nền gradient.
- Chỉ số KPI có so sánh kỳ trước. Cần backend trả thêm giá trị kỳ trước trong `data-erp="kpi"`.
