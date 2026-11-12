# Tra cứu trực tiếp Cloud Flow đã xóa

Bản GitHub Pages dùng Microsoft Graph Audit Search với tài khoản người dùng. Sau khi cấu hình một lần, mở **Cloud Flow đã xóa**, chọn khoảng thời gian, bấm **Tải lịch sử xóa** và xác nhận tài khoản Microsoft nếu có popup. Không cần mở Purview để xuất file.

## Cấu hình Entra một lần

1. Tạo đăng ký **PH Cloud Flow Audit** riêng, chọn **Accounts in this organizational directory only** trong tenant Phước Hưng. Giữ nguyên đăng ký app Dataverse/Transfer Environment.
2. Authentication → **Single-page application** → thêm `https://tinhthiago.github.io/Audit-Return-Active/auth-callback.html`. Không tạo secret hay bật implicit grant.
3. API permissions → Microsoft Graph → **Delegated permissions** → `AuditLogsQuery.Read.All`. Quyền này rộng hơn bộ lọc của trang và cần **admin consent**. Quản trị viên nên giới hạn nhóm được dùng đăng ký này theo chính sách tenant. Tài khoản tra cứu cần quyền đọc Purview Audit và môi trường cần ghi nhận sự kiện Power Automate.
4. Sao chép **Application (client) ID** vào trang. Nếu muốn cấu hình sẵn cho mọi lần mở app, đặt repository variable `VITE_FLOW_AUDIT_CLIENT_ID` ở Settings → Secrets and variables → Actions → Variables và chạy lại workflow Pages. Client ID là định danh công khai; không nhập token hoặc mật khẩu vào app.

## Dữ liệu và giới hạn

- Microsoft tạo một truy vấn Audit Search bất đồng bộ cho sự kiện `DeleteFlow` (`microsoftFlow`). Truy vấn trả các môi trường mà quyền Purview cho phép; xem cột Môi trường để nhận diện kết quả. Dừng chờ chỉ dừng tab nhận kết quả, truy vấn phía Microsoft có thể tiếp tục.
- App dùng tên có sẵn trong sự kiện. Nếu thiếu, với flow có ID môi trường Production và Flow ID khớp, app thử đọc tên cũ từ một sự kiện xóa Workflow Dataverse duy nhất trong khoảng ±5 phút. Đối chiếu tối đa 30 dòng thiếu tên mỗi lượt; bước này cần audit Workflow đã bật trước khi xóa và quyền đọc Dataverse. Flow ngoài Solution hoặc log thiếu trường có thể chỉ hiện Flow ID. CSV và danh sách tên JSON vẫn dùng được nếu cần bổ sung.
- Không khôi phục hoặc thay đổi flow. Mốc 21 ngày chỉ là khoảng thời gian tính từ nhật ký; quản trị viên xác nhận và khôi phục trong Power Automate.
- Kết quả chỉ nằm trong tab. App đăng nhập đọc audit riêng, không dùng token Dataverse để gọi Graph. Hết thời gian chờ hoặc không đủ quyền sẽ báo rõ. Không có kết quả có thể do thời gian ghi log, lưu giữ log hoặc phạm vi quyền.

Tham khảo: [Graph Audit Search](https://learn.microsoft.com/en-us/graph/api/security-auditcoreroot-post-auditlogqueries?view=graph-rest-1.0) · [Vai trò Purview Audit](https://learn.microsoft.com/en-us/purview/audit-search) · [Audit Workflow và Power Automate](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/use-auditing-dataverse).
