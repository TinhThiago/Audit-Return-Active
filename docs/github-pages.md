# GitHub Pages và đăng nhập Microsoft

App Pages độc lập sử dụng MSAL/PKCE, không cần backend hoặc client secret. Các chức năng Audit Create/Update, Audit Delete, Return Active / Delete và Deactivate dùng quyền của tài khoản Microsoft đăng nhập.

## Microsoft Entra — cấu hình một lần

1. App registration: client ID `7c279345-da37-45cc-ab63-70dba694349e`, tenant `6ab8e229-ae5c-482e-b463-5b926f94e34c` (cùng SPA registration của Transfer Environment).
2. Authentication → Add a platform → **Single-page application (SPA)**. Thêm chính xác:

   `https://tinhthiago.github.io/Audit-Return-Active/auth-callback.html`

   Giữ nguyên callback của Transfer Environment. Không cần implicit grant hoặc client secret.
3. API permissions: Dataverse/Dynamics CRM → Delegated → **user_impersonation**, consent theo chính sách tenant.
4. Người dùng cần quyền đọc audit, đọc metadata/bản ghi, Write khi Active/Deactivate và Delete khi xóa. App không cấp quyền thay Dataverse.

Màn hình đăng nhập hiển thị callback và ID thực tế. Nếu dùng registration riêng, đặt Actions Variables `VITE_MICROSOFT_TENANT_ID` / `VITE_MICROSOFT_CLIENT_ID`, rồi chạy lại workflow. Không đặt secret vào biến `VITE_`.

## Sử dụng

Bấm **Đăng nhập Microsoft** và cho phép popup. Khi phiên cần consent/đăng nhập lại, bấm **Cấp quyền lại** ở header rồi đọc lại bản ghi trước khi thao tác. Lệnh ghi không tự gửi lại. Các nút tài khoản tạm khóa trong khi request đang chạy. Đăng xuất hoặc cấp quyền lại sẽ dựng lại workspace và xóa lựa chọn/bản ghi đang hiển thị.

Token do MSAL lưu trong session; app không ghi audit/payload bản ghi vào localStorage/IndexedDB. Delete vẫn xác nhận tên, table và GUID, dùng If-Match và tuân theo cascade/plugin của Dataverse.

## Build và deploy

- `npm.cmd run build:pages`: TypeScript + browser build vào `dist-pages`, base mặc định `/Audit-Return-Active/`.
- `npm.cmd run dev:browser`: chạy chế độ browser local; cần đăng ký callback localhost nếu muốn đăng nhập local.
- `npm.cmd run build`: giữ build Power Apps vào `dist`.
- `npm.cmd run dev` và `npm.cmd run local`: giữ Local Play hiện có.

GitHub Settings → Pages → Source: **GitHub Actions**. Push `main` chạy test và deploy chỉ `dist-pages`; không upload `.power`, power.config.json, source, node_modules hoặc cấu hình connection vào artifact Pages. Source repository public vẫn có cấu hình Power Apps không chứa credential để giữ khả năng build chế độ cũ.

Workflow tự nhận base_path; callback riêng không cần rewrite. Không dùng thư mục `dist` của Power Apps để xuất bản Pages.

## Kiểm chứng và giới hạn

Test giả lập xác thực/HTTP và build không chứng minh callback Entra đã được đăng ký hoặc user có đủ quyền audit. Chỉ kiểm tra đọc sau đăng nhập, không tự dùng bản ghi Production để thử Active/Deactivate/Delete.

Tham khảo: [Dataverse SPA](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/oauth-cross-origin-resource-sharing-connect-single-page-application), [MSAL popup](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/login-user).
