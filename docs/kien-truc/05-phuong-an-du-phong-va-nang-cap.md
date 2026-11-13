# 05 — Phương án dự phòng và nâng cấp hạ tầng BE

> **Trạng thái: chưa áp dụng.** Giai đoạn đầu chạy **1 BE trên 1 VPS** theo [QĐ-07](../QUYET-DINH.md). Tài liệu này chỉ để chừa
> đường lui và đường nâng cấp khi cần.
>
> Muốn áp dụng bậc nào thì chủ dự án ra quyết định mới trong `QUYET-DINH.md` và ghi rõ bậc đó.
> Ghi ngày 2026-11-12.

## 0. Các bậc

| Bậc | Mô hình | Khi nào cần | Thêm gì so với bậc 0 |
|---|---|---|---|
| **0 (hiện tại)** | 1 BE, 1 VPS, cấu hình trong SQLite | Giai đoạn đầu | — |
| 1 | 2 VPS: một chạy chính, một chờ. Đồng bộ bằng Syncthing | Cần dựng lại nhanh khi VPS hỏng; chấp nhận vài phút gián đoạn và đổi DNS bằng tay | VPS 2, Syncthing, bản chụp SQLite |
| 2 | 2 VPS chạy song song sau load balancer | Cần chuyển máy tự động, cập nhật không gián đoạn, hoặc tải tăng | Load balancer, sticky session; dữ liệu cả hai máy cùng ghi đưa vào DB công ty |
| 3 | Nhiều BE + DB cấu hình SQL Server dùng chung | Hơn 2 máy, hoặc cấu hình đổi thường xuyên đến mức không thể ghi một nơi | DB cấu hình riêng; khóa Data Protection lưu trong DB |

Không bắt buộc đi lần lượt. Từ bậc 0 có thể lên thẳng bậc 2.

## 1. Việc nên làm ngay ở bậc 0 để sau này không phải làm lại

Các việc dưới đây rẻ khi làm từ đầu, nhưng tốn công nếu sửa sau. Chúng **không** kéo theo việc dựng thêm máy.

| Việc | Vì sao | Cần cho bậc |
|---|---|---|
| Đọc/ghi cấu hình và danh sách thu hồi qua một lớp riêng (`ITenantStore`, `IRevocationStore`), SQL đơn giản, migration đánh số | Đã có trong QĐ-07 hệ quả 8. Đổi nơi lưu không phải sửa nghiệp vụ | 1, 2, 3 |
| Không giữ trạng thái form trong RAM; trạng thái đi trong HTML (`__version`, input ẩn) | Đã có trong QĐ-07 hệ quả 2. Máy nào nhận request cũng xử lý được | 1, 2, 3 |
| Khóa chống lặp `__idem` ghi vào `web.CommandJournal` trong **DB công ty** | Hai máy cùng thấy, và cùng transaction với chứng từ | 2, 3 |
| Khóa Data Protection bọc bằng chứng chỉ `.pfx`, không dùng DPAPI theo máy | Đã có trong QĐ-07, bổ sung 2026-11-11, hệ quả 7. Máy khác giải mã được | 1, 2, 3 |
| Cookie đăng nhập tự chứa thông tin (mặc định của ASP.NET Core), thay cho phiên lưu SQLite | Đơn giản hơn ở bậc 0; khi lên bậc 1–2 không phải chuyển phiên. **Đã duyệt 2026-11-12** (QĐ-07 hệ quả 2) | 1, 2, 3 |
| Token "nhớ đăng nhập" và danh sách phiên bị thu hồi lưu ở schema `web` của DB công ty | Ở bậc 2 cả hai máy cùng ghi. Kiểm thu hồi có cache 30–60 giây, nên độ trễ không đáng kể. **Đã ghi vào QĐ-07 hệ quả 2** | 2 |
| Job nền lấy khóa `sp_getapplock` trong DB công ty trước khi chạy | Ở bậc 0 vô hại; ở bậc 2 tránh hai máy cùng gửi email hay nhắc duyệt | 2, 3 |
| Thư mục đính kèm tách khỏi thư mục BE; tên tệp là GUID | Đồng bộ được mà không bao giờ trùng tên | 1, 2 |
| Đọc IP người dùng qua middleware `ForwardedHeaders`, bật bằng cấu hình | Khi có load balancer chỉ cần bật | 2, 3 |
| Mọi domain của khách **CNAME về một tên chung** (xem CQ-11) | Đổi VPS, hay lên bậc 1–2, chỉ phải sửa một bản ghi DNS | 1, 2, 3 |
| Migration theo kiểu "thêm trước, xóa sau" | Lúc cập nhật cuốn chiếu, hai bản BE chạy cùng lúc vẫn đúng | 2, 3 |

## 2. Điều kiện chung cho mọi bậc từ 1 trở lên

- **Khách hàng phải cho phép mọi VPS.** Danh sách IP được mở cổng SQL, hoặc đường VPN, phải gồm IP của mọi VPS (QĐ-07, bổ sung
  2026-11-11, hệ quả 3). Thiếu thì chuyển máy xong vẫn không vào được DB của khách.
- **DB của công ty phát triển nằm trên VPS 1.** VPS 1 chết thì DB này chết theo, dù BE còn chạy ở máy khác.
  - Cần sao lưu log (log shipping), hoặc sao lưu định kỳ rồi khôi phục sang VPS 2.
  - Bản Express không có SQL Agent nên phải lên lịch bằng Task Scheduler (CQ-10).
  - Các khách hàng khác không bị ảnh hưởng.
- **Không đồng bộ DB đang mở bằng Syncthing:** tệp SQLite đang chạy (`.db`, `-wal`, `-shm`), tệp `.mdf`/`.ldf`. Chép giữa
  chừng là hỏng DB.
- **Không cho Syncthing ghi thẳng vào thư mục IIS đang chạy.** DLL đang bị khóa, chép dở là lỗi. Gói cài được đồng bộ vào một
  thư mục chờ, rồi script triển khai trên từng máy chạy `app_offline.htm` → chép → bỏ `app_offline.htm`.
- **Khóa Data Protection:**
  - cùng `ApplicationName` trên mọi máy;
  - chứng chỉ bọc khóa cài tay trên từng máy;
  - chỉ một máy được sinh khóa mới, các máy khác tắt tự sinh khóa (`DisableAutomaticKeyGeneration`).
- **Bảo mật Syncthing:**
  - cổng 22000 chỉ mở giữa các VPS;
  - giao diện quản trị (8384) chỉ nghe `localhost`, có mật khẩu.
- **Đồng bộ không phải sao lưu.** Xóa nhầm hay hỏng dữ liệu sẽ lan sang máy kia. Vẫn giữ sao lưu có lịch sử ra ngoài các VPS
  (QĐ-07 hệ quả 6).
- **Chứng chỉ TLS của mọi domain có trên mọi máy:** đồng bộ tệp chứng chỉ, hoặc cấp bằng DNS-01.
- **Giám sát `/health` từ bên ngoài**, báo về điện thoại.

## 3. Bậc 1 — Một máy chính, một máy chờ (Syncthing)

**Mô hình:** BE chạy trên VPS chính. VPS dự phòng cài sẵn cùng bản BE, ở trạng thái chờ.

| Dữ liệu | Cách đưa sang VPS dự phòng |
|---|---|
| Cấu hình SQLite | VPS chính chụp bằng `VACUUM INTO` vào thư mục đồng bộ, vài phút một lần và ngay sau mỗi lần sửa ở trang quản trị. VPS dự phòng chỉ nạp bản chụp khi được nâng lên làm chính |
| Phiên đăng nhập | Cookie tự chứa, mã hóa bằng khóa Data Protection dùng chung. Không cần đồng bộ |
| Khóa Data Protection, tệp đính kèm, ảnh, chứng chỉ TLS, gói cài | Syncthing |

- Thư mục trên VPS chính đặt **Send Only**, trên VPS dự phòng đặt **Receive Only**. Chỉ một bên ghi nên không sinh tệp
  `.sync-conflict`.
- **VPS dự phòng khi đang chờ:** chỉ đọc, không chạy job nền, không ghi SQLite.
- **Nâng máy dự phòng lên làm chính,** theo thứ tự:
  1. Tắt hẳn máy chính, hoặc chắc chắn nó đã chết. Tại mỗi thời điểm chỉ một máy được làm chính, không thì dữ liệu cấu hình
     rẽ nhánh.
  2. Nạp bản chụp SQLite mới nhất.
  3. Bật job nền và quyền ghi.
  4. Đổi bản ghi DNS chung, TTL thấp (60–300 giây).
- **Có thể mất khi chuyển máy:**
  - thay đổi cấu hình sau bản chụp cuối;
  - tệp đính kèm chưa kịp đồng bộ.

  Dữ liệu nghiệp vụ, token "nhớ đăng nhập" và danh sách thu hồi nằm trong DB của khách nên không mất.

## 4. Bậc 2 — Hai máy chạy song song sau load balancer

**Mô hình:** hai VPS cùng nhận request qua một load balancer. Máy nào chết thì load balancer tự bỏ máy đó ra.

**Điều kiện cứng: không để hai máy cùng ghi một tệp SQLite.** Syncthing không gộp được dữ liệu bên trong tệp: hai bên cùng ghi
thì sinh tệp xung đột hoặc làm hỏng DB. Cách làm là chia theo **ai cần ghi cái gì**:

| Dữ liệu | Ai ghi | Để ở đâu |
|---|---|---|
| Cấu hình công ty (domain, chuỗi kết nối) | Chỉ trang quản trị, ít khi đổi | SQLite trên **VPS 1**. Bản chụp đi một chiều sang VPS 2; VPS 2 nạp lại khi có bản mới |
| Phiên đăng nhập | Không cần lưu | Cookie tự chứa thông tin |
| Token nhớ đăng nhập, phiên bị thu hồi, `__idem`, cài đặt người dùng | Cả hai máy | Schema `web` trong **DB của từng công ty**. Hai máy vốn đã cùng nối vào DB đó |
| Khóa chạy job nền | Cả hai máy | `sp_getapplock` trong DB của từng công ty: máy nào giữ được khóa thì máy đó chạy |
| Tệp đính kèm, ảnh | Cả hai máy | Syncthing **hai chiều**. Tên tệp là GUID nên không bao giờ trùng |
| Khóa Data Protection | Chỉ VPS 1 sinh khóa | Syncthing một chiều; VPS 2 tắt tự sinh khóa |

Như vậy không cần thêm DB dùng chung: thứ gì cả hai máy cùng ghi thì nằm trong DB của công ty. Chỉ cấu hình là ghi một nơi.

**Đặt load balancer ở đâu:**

- **Không đặt trên VPS 1**, vì VPS 1 chết thì load balancer chết theo.
- Chọn một trong hai:
  - load balancer của nhà cung cấp VPS, nếu hai VPS cùng một nhà cung cấp;
  - Cloudflare Load Balancing: khác nhà cung cấp vẫn dùng được, có kiểm `/health` và giữ người dùng ở một máy.
- Không dùng DNS round-robin: không kiểm sức khỏe máy, nên máy chết vẫn bị chia request.
- Không dùng Windows NLB: cần hai máy cùng mạng nội bộ, VPS thường không có.

**Cần làm thêm:**

- **Giữ người dùng ở một máy (sticky session).** Tệp vừa tải lên máy 1 phải vài giây sau mới sang máy 2.
- **IP thật của người dùng** lấy từ `X-Forwarded-For`, và chỉ tin header này khi request đến từ load balancer. IP thật cần
  cho `SY_UserLog` (QĐ-01.7) và cho giới hạn số lần đăng nhập sai.
- **Cập nhật cuốn chiếu:** rút máy 1 khỏi load balancer → cập nhật → kiểm `/health` → đưa vào lại → làm tiếp máy 2.
- **Kết quả kiểm thu hồi phiên được cache 30–60 giây,** để không phải hỏi DB của khách qua Internet ở mỗi request.

**Giới hạn còn lại:** VPS 1 chết thì người dùng vẫn làm bình thường trên VPS 2. Chỉ trang quản trị là không sửa được cấu hình,
cho tới khi chỉ định VPS 2 làm nơi ghi. Việc này làm bằng tay và không gấp.

## 5. Bậc 3 — Nhiều BE dùng chung một DB cấu hình (SQL Server)

**Mô hình:** các BE nằm sau một load balancer (như bậc 2). Cấu hình lưu trong một DB SQL Server riêng, mọi BE cùng đọc/ghi.
Trang quản trị cũng ghi vào DB này. Phiên vẫn là cookie tự chứa như bậc 0.

**Cái gì để ở đâu:**

| DB cấu hình (chung) | DB từng công ty (schema `web`, QĐ-02) |
|---|---|
| Domain, công ty, chuỗi kết nối (mã hóa), chế độ bảo trì | `web.CommandJournal`: khóa chống lặp `__idem`, cùng transaction với chứng từ |
| Mốc đăng xuất cả công ty | `web.UserSetting`, `web.GridLayout`, token nhớ đăng nhập, danh sách thu hồi phiên |
| Khóa Data Protection (bọc bằng chứng chỉ cài trên mọi máy) | `SY_UserLog`: ghi như WinForms (QĐ-01.7) |
| Tài khoản quản trị, nhật ký thao tác quản trị | |
| Khóa điều phối job nền (mỗi lúc chỉ một máy chạy) | |

**DB cấu hình thành điểm hỏng chung.** DB này chết thì không ai đăng nhập được, dù DB của các công ty vẫn chạy. Cách giảm rủi
ro:

- BE giữ cấu hình trong bộ nhớ và kiểm cột `Version` 30–60 giây một lần, không truy vấn DB cấu hình ở mỗi request.
- Mỗi máy giữ bản cấu hình gần nhất (đã mã hóa) trên đĩa, để vẫn khởi động được khi DB cấu hình chưa lên.
- Phiên là cookie tự chứa nên không phụ thuộc DB cấu hình. DB cấu hình chập chờn thì người đang làm không bị đăng xuất.
- Có sao lưu định kỳ. Cần an toàn cao hơn thì dùng Basic Availability Group (có trong bản Standard).

**Bí mật:**

- Kết nối tới DB cấu hình bằng Windows Authentication (app pool / gMSA), không lưu mật khẩu trên đĩa.
- Login SQL của BE chỉ có quyền cần thiết; trang quản trị dùng một login riêng có quyền ghi.

## 6. Câu hỏi cần trả lời khi quyết định nâng cấp

| Câu hỏi | Bậc |
|---|---|
| Chuyển sang VPS dự phòng bằng tay (có cảnh báo về điện thoại) hay tự động? Đề xuất: bằng tay, tránh hai máy cùng làm chính | 1 |
| Load balancer của nhà cung cấp VPS hay Cloudflare? Hai VPS có cùng nhà cung cấp không? | 2, 3 |
| DB của công ty phát triển: log shipping hay sao lưu/khôi phục theo lịch? Phụ thuộc CQ-10 (bản SQL Server) | 1, 2, 3 |
| Thời gian gián đoạn tối đa chấp nhận được, và lượng dữ liệu cấu hình mất tối đa (khoảng cách giữa hai bản chụp) | 1 |
