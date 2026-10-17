# Audit- Return Active — GitHub và GitHub Pages

## Kết quả cần đạt

Đưa mã nguồn hiện tại tại `D:\Phước hưng\Code app\Audit-Return-Active` lên GitHub và có trang GitHub Pages sử dụng được tương tự Transfer Environment. Giữ Audit Create/Update, Audit Delete, Return Active / Delete và Deactivate.

Đã tham khảo trực tiếp mã nguồn, workflow và tài liệu trong `D:\Phước hưng\Code app\Transfer-Envirroment`. Phiên này không có công cụ đọc đoạn chat khác.

## Thiết kế đề xuất để duyệt

- Repository dự kiến: `TinhThiago/Audit-Return-Active`, public như một dự án Pages công khai. Cần xác nhận phạm vi công khai trước khi upload source. Chỉ website/source công khai; truy cập Dataverse vẫn yêu cầu đăng nhập và quyền người dùng.
- Website dự kiến: `https://tinhthiago.github.io/Audit-Return-Active/`. Địa chỉ thực tế sẽ được đối chiếu với kết quả deploy.
- Thêm chế độ browser dùng MSAL Authorization Code + PKCE; giữ chế độ Power Apps và connector hiện có cho Local Play.
- Dùng tenant hiện tại `6ab8e229-ae5c-482e-b463-5b926f94e34c` và SPA client của Transfer Environment `7c279345-da37-45cc-ab63-70dba694349e`, cho phép override bằng cấu hình build. Không dùng client secret trong frontend.
- Callback tĩnh riêng: `https://tinhthiago.github.io/Audit-Return-Active/auth-callback.html`. Cần đăng ký chính xác dưới platform SPA của app registration. Việc URI này đã được đăng ký chưa được kiểm chứng.
- Trang đăng nhập hiển thị tài khoản, đăng nhập/đăng xuất, hướng dẫn callback và lỗi cấp quyền. Chỉ tạo workspace dịch vụ sau khi có phiên hợp lệ. Đăng xuất/đổi tài khoản xóa trạng thái dữ liệu trong UI.
- Browser transport chỉ gọi Dataverse Production `https://phuochung1.crm5.dynamics.com/api/data/v9.2/`, giữ kiểm tra đường dẫn, ETag, giới hạn PATCH state/status và DELETE một bản ghi. Không tự retry thao tác ghi. Không lưu audit hoặc payload bản ghi vào browser storage.
- Token do MSAL quản lý trong session. Lấy token silent; khi cần tương tác, báo nút cấp quyền, không tự bật popup hoặc tự gửi lại thao tác ghi.
- Giữ nguyên layout và quy tắc custom unmanaged. Không thêm chuyển môi trường vào app Audit.
- Workflow GitHub Actions chạy test, TypeScript/build rồi deploy riêng `dist`; base path và callback hoạt động tại đường dẫn repository. Giữ build Power Apps riêng.
- Trước upload, rà soát file được track: loại node_modules, dist, cache, log, token, secrets và cấu hình connection riêng khỏi bản browser; giữ file cấu hình mẫu cần thiết. Không sao chép các thư mục `.runtime` của Transfer Environment.

## Kiểm chứng

1. Chạy lại bộ test hiện có; thêm test auth/tenant/token và browser transport với boundary giả lập.
2. Kiểm tra URL ngoài allowlist, conditional PATCH/DELETE, 401/403/429 và không retry write.
3. Build cả Power Apps và Pages, kiểm tra callback/assets đúng base path.
4. Rà soát source/build không chứa credential trước commit và push.
5. Xác minh commit remote, workflow deploy và trang HTTPS mở thành công.
6. Chỉ kiểm tra Dataverse đọc sau đăng nhập; không chạy Active, Deactivate hoặc Delete trên Production để thử.

## Điều kiện và giới hạn

GitHub CLI chưa có trong PATH ở phiên kiểm tra; cần dùng đường dẫn CLI sẵn có hoặc phiên trình duyệt GitHub trước khi tạo/push repository. Không đọc hoặc in token ra output.

GitHub Pages hoạt động không đồng nghĩa quyền audit/ghi Dataverse đã đủ. Tài khoản Microsoft cần quyền audit và quyền tương ứng với thao tác từng bảng. Cần quyền quản trị app registration để bổ sung callback nếu còn thiếu; không thay cấu hình của Transfer Environment.

Người dùng đã duyệt thiết kế ngày 16/10/2026 và yêu cầu tiếp tục triển khai. Repository đã tồn tại công khai; cập nhật vào repository đó.
