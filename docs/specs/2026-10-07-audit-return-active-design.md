# Audit- Return Active

Ngày: 07/10/2026. Thiết kế giao diện và phạm vi đã được người dùng duyệt trong chat.

## Mục tiêu và môi trường

Tạo Power Apps Code App tên chính xác `Audit- Return Active` cho Phuoc Hung Production, environment ID `bdded998-c7e6-e6a3-b58a-58112acc2c9a`, Dataverse URL `https://phuochung1.crm5.dynamics.com`. App phục vụ tra cứu audit và kích hoạt lại một bản ghi đang inactive. Không sửa các dự án Power BI hiện có. Mã nguồn nằm trong thư mục độc lập `Audit-Return-Active`.

## Ba luồng nghiệp vụ

### Audit Create/Update

Chọn table theo DisplayName, kèm LogicalName để phân biệt table trùng tên. Nhập GUID hoặc chọn bản ghi qua lookup phân trang trên server. GUID được chuẩn hóa và kiểm tra trước khi gọi API. Truy vấn audit theo table và `_objectid_value`, chỉ operation Create/Update; hiển thị mới nhất trước, thời gian theo Asia/Bangkok, người thực hiện, thao tác và audit ID. Bản ghi đã bị xóa vẫn có thể tra cứu bằng GUID nhập trực tiếp.

Chọn một sự kiện để tải RetrieveAuditDetails và hiển thị label trường, giá trị trước và sau. Dùng metadata và formatted values cho choice/lookup; phân biệt null, giá trị không được cung cấp và chuỗi rỗng. Không suy diễn các trường chưa audit. Khi đổi table hoặc GUID, bỏ kết quả và panel cũ; request cũ không được ghi đè lựa chọn mới.

### Audit Delete

Chỉ cần chọn table để tra cứu; không bắt buộc GUID hoặc khoảng ngày. Query operation Delete có phân trang, thời gian mới nhất trước. Khoảng ngày là bộ lọc tùy chọn để thu hẹp dữ liệu. Hiển thị các sự kiện xóa cùng GUID, người thực hiện, thời gian và audit ID. Không join về row hiện tại đã bị xóa hoặc hứa hiển thị đầy đủ snapshot row; tên/giá trị chỉ xuất hiện nếu dữ liệu audit thực sự cung cấp. Một GUID có thể có nhiều sự kiện xóa. Luồng này không phục hồi row đã xóa.

### Return Active

Chọn table và nhập GUID hoặc lookup bản ghi inactive. Đọc tên, ID, statecode/statuscode và phiên bản hiện tại trước khi cho phép thao tác. Xác định state Active và status reason tương ứng từ metadata/state mapping của table; không hardcode statuscode = 1 cho mọi table. Table không có vòng đời active/inactive hoặc cần thao tác nghiệp vụ chuyên biệt được hiển thị là không hỗ trợ kích hoạt tổng quát.

Khi có nhiều status reason active hợp lệ, dùng default status của state Active nếu hợp lệ, nếu không yêu cầu người dùng chọn. Nút Active gửi một thay đổi trạng thái, khóa trong lúc xử lý và không tự retry thao tác ghi. Dùng kiểm tra phiên bản nếu transport hỗ trợ; khi có xung đột, yêu cầu tải lại. Đọc lại sau ghi và chỉ báo thành công khi trạng thái đã active. Nếu ghi thành công nhưng đọc lại thất bại, thông báo chưa xác minh và cho phép tải lại, không tự ghi lần nữa. Bản ghi đã active không bị cập nhật lại. Quyền, validation và plugin Dataverse vẫn áp dụng.

## Giao diện PH Standard

Nguồn tham chiếu: https://ph-ui-library.khoitran.chatgpt.site/#all, đã đọc trong trình duyệt.

Global header 42px và sidebar thu gọn cho ba trang. Nền trắng/off-white, chữ charcoal #343A40, viền #E9ECEF, walnut #5B3E1C dùng cho điểm nhấn nhỏ. Montserrat cho tiêu đề, Roboto cho nội dung; tiêu đề trang 22px, record 20px, dữ liệu/label 14px, metadata 12px. Control cao 40px radius 6px; surface radius 8px; command bar 48px; khoảng cách làm việc 8px, top 16px hoặc mobile 12px. Nút outlined, tag trạng thái xám; màu ngữ nghĩa dùng khi cần chú ý lỗi/cảnh báo. Panel chi tiết audit giữ vị trí danh sách khi đóng. Mobile giữ chữ dữ liệu 14px, layout thích nghi và hỗ trợ cuộn bảng.

Phân biệt chưa tra cứu, đang tải, không có kết quả, không đủ quyền, lỗi kết nối, throttling và thành công. Lỗi hiển thị gần nội dung, giữ bộ lọc để thử lại. Label, focus, bàn phím và tên accessible đầy đủ; không thêm nút Share hoặc account giả chưa có hành vi.

## Kiến trúc và kết nối

React, TypeScript strict và Vite. Các tầng riêng: app shell/providers, UI components/tokens, features audit và activation, domain types/validators/state policy, data services và Power Apps transport adapter. UI không dựng OData trực tiếp. Adapter là điểm duy nhất phụ thuộc SDK; dịch vụ nghiệp vụ có thể kiểm thử bằng fake transport mà không ghi Production.

Ưu tiên SDK chính thức Power Apps và generated services cho CRUD/metadata được hỗ trợ. Trong bước kiểm tra kỹ thuật trước triển khai, xác minh cơ chế gọi audit functions và metadata động. Nếu SDK không cung cấp khả năng cần thiết, dùng connector hoặc Dataverse Custom API được xác thực trong Power Platform, theo quyền người gọi; không dùng flow chạy với tài khoản chủ để mở rộng quyền người dùng. Không nhúng client secret/access token trong mã nguồn. Chưa coi kết nối audit đã được xác minh chỉ từ tài liệu.

Chỉ chấp nhận table/column/entity set từ metadata đã xác thực. Danh sách table không áp thêm điều kiện custom/unmanaged chưa được yêu cầu; table có audit được ưu tiên cho audit, table có trạng thái phù hợp cho activation. Thiết lập allowlist vận hành nếu tenant yêu cầu.

## Hiệu năng và tính đúng đắn

Lọc và sort trên server, select tối thiểu, mỗi trang mặc định 50 sự kiện, phân trang bằng continuation của Dataverse. Hiển thị rõ còn trang; không tải toàn môi trường. Chỉ tải chi tiết audit được chọn, tránh N+1. Cache metadata theo môi trường/table với thời hạn, cache query theo đầy đủ bộ lọc và người dùng trong phiên; không lưu dữ liệu audit vào localStorage. Lookup debounce khoảng 300ms, giới hạn kết quả và có phân trang. Hủy hoặc bỏ kết quả request cũ. Retry có giới hạn cho đọc khi throttling theo Retry-After; không retry tự động ghi.

## Kiểm chứng và bàn giao

Kiểm thử domain/transport cho GUID không hợp lệ, query Delete không cần GUID, giá trị null/missing, phân trang, metadata state/status, bản ghi đã active, xung đột và lỗi đọc lại sau ghi. Chạy TypeScript check, build và các test nghiệp vụ. Kiểm tra UI ba trang, panel, loading/error/empty, bàn phím và viewport mobile.

Kiểm tra live audit bằng table `ph_item_master`, GUID `6b429899-30c1-f111-aaaf-6045bd5a2f39` đã có trong tài liệu workspace; dữ liệu thực tế phải được đọc lại để đối chiếu. Không kích hoạt thử một row Production khi người dùng chưa chỉ định row dùng để kiểm thử. Bàn giao mã nguồn, cấu hình môi trường, hướng dẫn đăng nhập/build/deploy và kết quả kiểm chứng. App chỉ được báo đã tạo trên Power Apps khi có app ID và kiểm chứng mở được; kiểm tra offline không được báo thành kết nối live thành công.

## Điều kiện thực tế cần kiểm tra trong triển khai

Máy có Node/npm, chưa tìm thấy lệnh pac trong PATH. Cần xác minh CLI Power Apps hiện hành, phiên đăng nhập, quyền tạo Code App, setting Code Apps, data connections và quyền audit trong môi trường đích. Nếu đăng nhập/consent yêu cầu người dùng thao tác, bảo toàn source và báo chính xác bước đang chờ. Workspace hiện không phải Git repository nên đặc tả không được commit vào Git.

## Nguồn kỹ thuật

- https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse
- https://learn.microsoft.com/en-us/power-apps/developer/data-platform/auditing/retrieve-audit-data

