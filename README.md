# Audit- Return Active

Power Apps Code App cho Phuoc Hung Production. Mã nguồn chính thức: `D:\Phước hưng\Code app\Audit-Return-Active`.

## Chức năng

- Create/Update: chọn custom unmanaged table theo DisplayName + LogicalName trong combobox tìm kiếm, nhập GUID hoặc lookup, xem lịch sử và chi tiết trước/sau.
- Delete: chỉ chọn table, tra cứu sự kiện xóa và GUID đã xóa; có lọc ngày tùy chọn, phân trang theo nguồn. Không khôi phục row đã xóa.
- Return Active: đọc row và state/status metadata, cập nhật đúng trạng thái với If-Match ETag, chặn gửi lặp và đọc lại để xác minh. Không hardcode statuscode = 1.

## Chạy và build

Yêu cầu Node.js >=22 và npm. Dependencies được khóa trong package-lock.json.

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run local
```

Chạy `npm run local` rồi dùng URL **Local Play** do Power Apps CLI in ra, trong trình duyệt đang đăng nhập tenant. Giữ terminal chạy. URL localhost trực tiếp không có phiên Power Apps để gọi Dataverse. `npm run dev` chỉ chạy Vite, dùng khi tự quản lý local host. Không thay đổi bảo mật trình duyệt để né yêu cầu Local Network Access.

CLI Power Apps được cài local:

```powershell
.\node_modules\.bin\pa.cmd auth status
.\node_modules\.bin\pa.cmd auth login
.\node_modules\.bin\pa.cmd app push --non-interactive --json
```

`power.config.json` giữ environment Production, appId đã được đặt null vì app cũ không còn tồn tại. Chỉ bàn giao mã nguồn theo yêu cầu; chưa tạo/publish lại. Khi người dùng quyết định xuất bản, lệnh push với appId null sẽ tạo app mới. Không đưa access token/client secret vào source hay biến VITE_*.

## Kết nối và quyền

App dùng SDK chính thức `@microsoft/power-apps`, `getClient(...).executeAsync` với connector InvokeHttp. Connection hiện có **Dataverse Audit Lookup - PH** dùng HTTP with Microsoft Entra ID (preauthorized), có cả BaseResourceUrl và Token:ResourceUri bằng `https://phuochung1.crm5.dynamics.com`.

Adapter giới hạn URL tại `/api/data/v9.2/` của origin này, chỉ GET, PATCH statecode/statuscode và DELETE một row đã đọc có ETag. SDK/Power Apps quản lý xác thực. Người dùng phải đồng ý connection trong Power Apps và có quyền Dataverse của chính connection họ sử dụng. App không thêm flow chạy dưới tài khoản chủ và không thay đổi sharing/quyền Dataverse. Khi chia sẻ app, quản trị cần đảm bảo người chạy dùng connection Entra của mình, đúng URL Production; chưa kiểm chứng bằng tài khoản người dùng thứ hai.

Quyền audit cần Read Audit Summary và quyền xem Audit History/chi tiết tương ứng; activation cần quyền Update table/record và tuân thủ validation/plugin. Code Apps phải được bật và người dùng có license phù hợp.

## Giới hạn nghiệp vụ

Chỉ kích hoạt tổng quát table có đúng hai state với InvariantName Active/Inactive và có status mapping hợp lệ. Các activity hoặc vòng đời chuyên biệt được chặn. Snapshot phải có ETag để tránh ghi lên row đã thay đổi. Sau lỗi ghi hoặc lỗi xác minh, tải lại trước khi thử tiếp; không tự retry PATCH.

Audit chỉ phản ánh các trường được audit và còn trong thời hạn lưu. Delete là sự kiện xóa, không phải bản sao đầy đủ row. Chuỗi rỗng, null và giá trị không được cung cấp được phân biệt.

## Cấu trúc

- `src/app`: shell, services provider, request lifecycle.
- `src/features`: audit, activation, table picker/lookup.
- `src/data`: Power Apps transport, metadata, audit và record services.
- `src/domain`: types, GUID validation và state/status policy.
- `src/ui`: PH Standard tokens và controls.
- `src/generated`, `.power/schemas`: schema/service do CLI Microsoft sinh.
- `tests`: domain, transport, pagination và component/race tests.
- `docs`: thiết kế, kế hoạch và kết quả kiểm chứng.

Metadata cache 15 phút trong phiên. Query lọc/sort ở server, gửi đề nghị trang 50 row và theo @odata.nextLink; kích thước thực tế do server/connector quyết định (live Delete trả 103 sự kiện). Lookup debounce 300ms và details tải theo yêu cầu. Không lưu audit trong localStorage.

## Bàn giao lần sửa 07/10/2026

Chỉ bàn giao mã nguồn. App ID cũ b18369a1-7454-4e33-9921-532eaab86f9d trả ApplicationNotFound và không nằm trong danh sách Code Apps Production. Chưa tạo app thay thế.

28 tests, TypeScript và build đạt. Regression tests bao gồm custom unmanaged filter, tìm trong combobox, bàn phím/kết quả rỗng, định dạng ngày giờ và vị trí nút audit.

Tên bản ghi bị mojibake được phục hồi trên giao diện khi có thể đảo mã hóa UTF-8/CP1252 không mất dữ liệu. Tên gốc vẫn giữ trong tooltip. Không sửa dữ liệu Dataverse hoặc giá trị audit; lỗi chứa ký tự thay thế không thể phục hồi tự động. Chưa kiểm chứng lại với dữ liệu thật sau lần sửa này.

Xem docs/revision-2026-10-07.md và docs/verification-results.md. Kết quả live trong verification-results thuộc bản trước; lần sửa hiện tại không có app cloud để kiểm chứng. Chưa thực hiện PATCH Production.

## Sửa lỗi Local Play hostname

Lệnh dev dùng localhost vì player Microsoft hiện kiểm tra hostname local phải bằng localhost (127.0.0.1 bị từ chối trước khi fetch config). Dừng server cũ bằng Ctrl+C, chạy npm.cmd run dev và mở link Local Play mới có cả _localAppUrl và _localConnectionUrl dùng localhost. Không cần tạo/publish app. 29 tests và build đạt. Phiên kiểm thử với localhost đã vượt màn hình lỗi và tới Fetching your app; chưa xác minh tải dữ liệu với server khởi động lại do người dùng quản lý.


## Return Active / Delete

Delete cạnh Active xóa đúng bản ghi đang hiển thị (kể cả đang Active). App xác nhận tên/table/GUID trước khi gửi DELETE có If-Match ETag. Hai thao tác khóa lẫn nhau, không tự retry mutation; lỗi cần tải lại. Thành công xóa snapshot khỏi màn hình. Dataverse kiểm tra quyền Delete, plugin và quan hệ cascade; dữ liệu liên quan có thể bị xóa theo cấu hình. Lookup hiển thị cả Active/Inactive. Không xóa audit. Chỉ bàn giao source; không xóa thật trên Production.


## Deactivate

Mục Deactivate trên panel trái: chọn table và ID/GUID hoặc lookup, Xem bản ghi, chọn status reason Inactive nếu cần rồi Deactivate. App lấy state/status từ metadata, gửi PATCH với ETag và đọc lại xác minh Inactive. Bản ghi đã Inactive không gửi cập nhật; lỗi ghi/đọc lại cần tải lại trước khi thử tiếp. Hoạt động trên từng bản ghi, không chạy bulk. Không thử ghi Production.

