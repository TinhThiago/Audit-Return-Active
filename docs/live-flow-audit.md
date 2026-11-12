# Tra cứu trực tiếp Cloud Flow đã xóa

Bản GitHub Pages dùng Microsoft Graph Audit Search với tài khoản người dùng. Sau khi cấu hình một lần, mở **Cloud Flow đã xóa**, chọn khoảng thời gian, bấm **Tải lịch sử xóa** và xác nhận tài khoản Microsoft nếu có popup. Không cần mở Purview để xuất file.

## Cấu hình Entra một lần

1. Theo mặc định, trang dùng Client ID của đăng ký đăng nhập Audit/Transfer Environment trong tenant Phước Hưng. Không cần tạo đăng ký mới hoặc nhập Client ID khi tải.
2. Authentication → **Single-page application** → thêm `https://tinhthiago.github.io/Audit-Return-Active/auth-callback.html`. Không tạo secret hay bật implicit grant.
3. API permissions → Microsoft Graph → **Delegated permissions** → `AuditLogsQuery.Read.All`. Quyền này rộng hơn bộ lọc của trang và cần **admin consent**. Quản trị viên nên giới hạn nhóm được dùng đăng ký này theo chính sách tenant. Tài khoản tra cứu cần quyền đọc Purview Audit và môi trường cần ghi nhận sự kiện Power Automate.
4. Nếu cần dùng đăng ký audit riêng, đặt repository variable `VITE_FLOW_AUDIT_CLIENT_ID` ở Settings → Secrets and variables → Actions → Variables rồi chạy lại workflow Pages. Không đặt token, mật khẩu hoặc Client Secret vào biến build.

## Dữ liệu và giới hạn

- Microsoft tạo một truy vấn Audit Search bất đồng bộ cho sự kiện `DeleteFlow` (`microsoftFlow`). Truy vấn trả các môi trường mà quyền Purview cho phép; xem cột Môi trường để nhận diện kết quả. Dừng chờ chỉ dừng tab nhận kết quả, truy vấn phía Microsoft có thể tiếp tục.
- App dùng tên có sẵn trong sự kiện. Nếu thiếu, với flow có ID môi trường Production và Flow ID khớp, app thử đọc tên cũ từ một sự kiện xóa Workflow Dataverse duy nhất trong khoảng ±5 phút. Đối chiếu tối đa 30 dòng thiếu tên mỗi lượt; bước này cần audit Workflow đã bật trước khi xóa và quyền đọc Dataverse. Flow ngoài Solution hoặc log thiếu trường có thể chỉ hiện Flow ID. CSV và danh sách tên JSON vẫn dùng được nếu cần bổ sung.
- Không khôi phục hoặc thay đổi flow. Mốc 21 ngày chỉ là khoảng thời gian tính từ nhật ký; quản trị viên xác nhận và khôi phục trong Power Automate.
- Kết quả chỉ nằm trong tab. App lấy token Microsoft Graph cho thao tác tra cứu. Token Dataverse không được gửi tới Microsoft Graph. Hết thời gian chờ hoặc không đủ quyền sẽ báo rõ. Không có kết quả có thể do thời gian ghi log, lưu giữ log hoặc phạm vi quyền.

Tham khảo: [Graph Audit Search](https://learn.microsoft.com/en-us/graph/api/security-auditcoreroot-post-auditlogqueries?view=graph-rest-1.0) · [Vai trò Purview Audit](https://learn.microsoft.com/en-us/purview/audit-search) · [Audit Workflow và Power Automate](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/use-auditing-dataverse).
