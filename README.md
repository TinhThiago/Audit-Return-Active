# Audit- Return Active

Ứng dụng tra cứu audit và quản lý trạng thái bản ghi trong Dataverse Phuoc Hung Production.

**[Mở GitHub Pages](https://tinhthiago.github.io/Audit-Return-Active/)** · [Cấu hình Microsoft Entra](docs/github-pages.md)

## Chức năng

- **Create / Update:** chọn table theo label và GUID để xem lịch sử, người sửa, thời gian và chi tiết trước/sau.
- **Audit Delete:** chọn table để xem lịch sử các bản ghi đã xóa.
- **Return Active / Delete:** đọc bản ghi trước khi kích hoạt hoặc xóa. Delete xác nhận tên/table/GUID và có thể tác động dữ liệu liên quan theo cấu hình cascade của Dataverse.
- **Deactivate:** chuyển bản ghi Active sang Inactive theo metadata state/status.

Chỉ liệt kê table custom unmanaged. Combobox tìm theo label/logical name, hỗ trợ tiếng Việt không dấu. Ngày giờ dd/MM/yyyy HH:mm:ss, UTC+7.

## GitHub Pages

Đăng nhập Microsoft bằng MSAL/PKCE, không có backend hoặc client secret. Truy cập dữ liệu dùng quyền của người đăng nhập; source/UI công khai không cấp quyền Dataverse. Cần thêm SPA Redirect URI **https://tinhthiago.github.io/Audit-Return-Active/auth-callback.html** vào registration cùng Transfer Environment trước lần đăng nhập đầu tiên. Xem [hướng dẫn chi tiết](docs/github-pages.md).

Workflow push nhánh main chạy test, build và deploy riêng dist-pages. Các biến Actions VITE_MICROSOFT_TENANT_ID/VITE_MICROSOFT_CLIENT_ID là ID công khai; không đặt secret vào VITE_.

## Phát triển

Cần Node.js 24 và npm.

~~~powershell
npm.cmd ci
npm.cmd test
npm.cmd run build:pages
~~~

- npm.cmd run dev:browser: chế độ browser local; đăng ký thêm SPA callback localhost tương ứng nếu cần đăng nhập local.
- npm.cmd run dev và npm.cmd run local: giữ luồng Power Apps Local Play; localhost phải tiếp tục chạy khi dùng Local Play.
- npm.cmd run build: build Power Apps vào dist. power.config.json giữ appId=null, chưa tạo/publish lại Power Apps cloud.
- npm.cmd run build:pages: build browser vào dist-pages, base mặc định /Audit-Return-Active/.

## Cập nhật dữ liệu

Active/Deactivate lấy state/status từ metadata, dùng ETag If-Match và đọc lại để xác minh. App khóa thao tác trùng, không tự retry lệnh ghi. Sau lỗi hoặc kết quả chưa xác minh, tải lại bản ghi trước khi thử tiếp. Không hỗ trợ vòng đời đặc thù của activity hoặc bảng không có Active/Inactive tổng quát.

Token do MSAL quản lý trong session. Không lưu payload audit/bản ghi vào localStorage/IndexedDB. Khi popup tài khoản đang xử lý, workspace và transport đều khóa request mới. Đăng xuất/cấp quyền lại dựng lại workspace để xóa lựa chọn và snapshot cũ.

## Kiểm chứng

52 tests kiểm tra domain, service, transport và UI bằng dữ liệu giả lập. Build TypeScript, Power Apps và Pages được kiểm tra riêng. Không chạy Active, Deactivate hoặc Delete thật trên Production để nghiệm thu Pages. Callback Entra và quyền người dùng cần kiểm tra sau khi quản trị cấu hình.

Xem [kết quả kiểm tra](docs/verification-results.md). Các ghi chú source-only ngày 07–10/10 là lịch sử trước yêu cầu GitHub Pages đã duyệt ngày 16/10/2026.
