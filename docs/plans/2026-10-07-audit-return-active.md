# Audit- Return Active Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Tạo Power Apps Code App tra cứu Create/Update, Delete và kích hoạt lại bản ghi inactive trong Phuoc Hung Production.

**Architecture:** React/TypeScript UI gọi các service nghiệp vụ qua transport adapter Power Apps. Audit phân trang và tải chi tiết theo yêu cầu; activation đọc metadata, kiểm tra trạng thái, ghi một lần rồi đọc lại. Xác minh transport audit trước khi xây dựng UI phụ thuộc vào kết nối đó.

**Tech Stack:** React, TypeScript strict, Vite, SDK/CLI Power Apps chính thức, Vitest và React Testing Library.

**Spec:** ../specs/2026-10-07-audit-return-active-design.md

## Global Constraints

- App name `Audit- Return Active`; source directory `Audit-Return-Active`.
- Environment `bdded998-c7e6-e6a3-b58a-58112acc2c9a`; Dataverse `https://phuochung1.crm5.dynamics.com`.
- Không sửa các dự án Power BI hiện có; workspace không phải Git repository nên không commit.
- UI theo PH Standard: header 42px, command bar 48px, control 40px/radius 6px, surface radius 8px, data 14px, Montserrat headings và Roboto body.
- Không nhúng secret/token; dùng quyền người gọi; không lưu audit vào localStorage.
- Audit page mặc định 50, lookup debounce khoảng 300ms; lọc/sort ở server; metadata cache theo environment/table.
- Không tự retry ghi và không kích hoạt thử row Production khi người dùng chưa chỉ định row kiểm thử.
- Không báo live/deploy thành công nếu chỉ kiểm tra offline.

## Review Focus

1. Label table trùng hoặc thiếu bản dịch: vẫn phân biệt bằng LogicalName và fallback hợp lý — Task 1.
2. GUID đã bị xóa: nhập trực tiếp vẫn truy vấn được lịch sử, không phụ thuộc lookup hiện tại — Task 2.
3. Response cũ về sau khi đổi bộ lọc: không hiển thị dưới ngữ cảnh mới — Task 4.
4. Table có nhiều active status hoặc lifecycle chuyên biệt: không chọn bừa status hoặc ghi sai — Task 3.
5. Ghi xong nhưng mất kết nối khi đọc lại: thông báo chưa xác minh, không tự gửi lại cập nhật — Task 3.

## File Map

Các đường dẫn dưới đây nằm trong `Audit-Return-Active/`.

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`: build/test/runtime.
- `src/main.tsx`, `src/app/App.tsx`, `src/app/providers.tsx`: bootstrap, shell, query cache.
- `src/config/environment.ts`: cấu hình môi trường không chứa secret.
- `src/domain/types.ts`, `guid.ts`, `statePolicy.ts`: contract, validation và lựa chọn trạng thái.
- `src/data/transport.ts`, `powerAppsTransport.ts`, `metadataService.ts`, `auditService.ts`, `recordService.ts`: truy cập Power Apps/Dataverse.
- `src/ui/tokens.css`, `components.tsx`: PH tokens và control dùng chung.
- `src/features/audit/AuditPage.tsx`, `AuditDetails.tsx`: Create/Update và Delete.
- `src/features/activation/ActivationPage.tsx`: đọc bản ghi và Active.
- `src/features/shared/TablePicker.tsx`, `RecordLookup.tsx`: chọn table và ID.
- `tests/guid.test.ts`, `metadata.test.ts`, `audit.test.ts`, `activation.test.ts`, `request-context.test.tsx`: kiểm thử nghiệp vụ.
- `README.md`, `.env.example`, `docs/connection-verification.md`, `docs/verification-results.md`: vận hành, kết nối và bằng chứng.

## Task 1: Xác minh Power Apps transport và metadata

**Interfaces:** `TableMetadata` chứa logicalName, entitySetName, primaryIdAttribute, primaryNameAttribute, displayName, auditEnabled và state/status metadata. `DataverseTransport` cung cấp `request<T>(request: DataverseRequest): Promise<T>`; request có method, path, query/body, signal và optional etag. Chỉ adapter xử lý SDK/connector.

- [ ] Đọc tài liệu Microsoft hiện hành về CLI/SDK, audit function và metadata; kiểm tra đăng nhập/settings môi trường bằng công cụ hiện có. Ghi cơ chế đã xác minh trong `docs/connection-verification.md`; không giả định generated CRUD tự hỗ trợ RetrieveAuditDetails.
- [ ] Xác minh read-only metadata và một audit request. Nếu SDK thiếu capability, kiểm tra connector/Custom API theo quyền người gọi trước khi chọn adapter; nếu cần consent/login thì giữ nguyên source và báo bước cần người dùng thực hiện.
- [ ] Tạo scaffold/config chính thức phù hợp CLI đã xác minh; chưa thay đổi table hay row Production.
- [ ] Viết `tests/metadata.test.ts`: table trùng label có logicalName riêng; label thiếu fallback logicalName; entity set không lấy từ input tùy ý; cache tách environment/table. Chạy `npm test -- tests/metadata.test.ts`, xác nhận FAIL trước implementation.
- [ ] Implement transport và `MetadataService.listTables(signal?): Promise<TableMetadata[]>`, `getTable(logicalName, signal?): Promise<TableMetadata>` trong các file ở File Map. Cache metadata trong phiên với TTL 15 phút; clear khi thay tài khoản/môi trường.
- [ ] Chạy test metadata và `npm run typecheck`; xác nhận PASS. Ghi rõ phần live đã/chưa kiểm chứng.

## Task 2: Audit query, pagination và details

**Consumes:** Task 1 transport và metadata.

**Produces:** `AuditService.list(filter: AuditFilter, continuation?: string, signal?: AbortSignal): Promise<AuditPage>`; `details(auditId: string, table: TableMetadata, signal?: AbortSignal): Promise<AuditChange[]>`. `AuditFilter` chứa table logicalName, mode createUpdate/delete, optional recordId/from/to. `AuditPage` chứa events và optional continuation. `AuditChange` chứa field logicalName/label và old/new values với availability riêng.

- [ ] Viết tests GUID và audit: GUID có braces được chuẩn hóa; GUID sai bị chặn trước transport; Create/Update thiếu GUID không gọi API; Delete chỉ có table gọi được; GUID đã xóa không cần lookup; operation/filter đúng; continuation giữ bộ lọc; details phân biệt null/missing/empty. Chạy `npm test -- tests/guid.test.ts tests/audit.test.ts`, xác nhận FAIL.
- [ ] Implement `normalizeGuid(value: string): string` trong `src/domain/guid.ts`; `AuditService` query select tối thiểu, order createdon desc, page 50; validate continuation theo môi trường và endpoint cho phép, không nhận URL ngoài nguồn.
- [ ] Implement details qua RetrieveAuditDetails, map metadata/formatted labels; không dùng attributemask để suy diễn thay đổi. Retry đọc có giới hạn theo Retry-After, tối đa ba lần; request abort không retry.
- [ ] Chạy test và typecheck, xác nhận PASS; kiểm tra live một Update với audit ID lấy từ danh sách của `ph_item_master` và GUID trong spec, không hardcode audit ID.

## Task 3: Return Active policy và record service

**Consumes:** Metadata/transport Task 1 và GUID Task 2.

**Produces:** `resolveActiveTarget(table: TableMetadata, selectedStatus?: number): ActiveDecision`; `RecordService.get(table, id, signal?): Promise<RecordSnapshot>`; `activate(table, snapshot, selectedStatus?): Promise<ActivationResult>`. Snapshot có ID/name/state/status/optional etag; result phân biệt verifiedActive, alreadyActive và verificationPending.

- [ ] Viết tests activation: status Active khác 1; nhiều status không có default cần chọn; unsupported lifecycle bị chặn; GUID sai không gọi API; alreadyActive không ghi; etag được dùng nếu adapter hỗ trợ; conflict không retry; ghi thành công nhưng GET thất bại trả verificationPending và chỉ có một lần ghi. Chạy `npm test -- tests/activation.test.ts`, xác nhận FAIL.
- [ ] Implement state policy bằng mapping metadata được xác minh, không suy ra Active từ nhãn dịch tùy ý; hỗ trợ trạng thái Active/Inactive tổng quát, chặn lifecycle cần action đặc thù.
- [ ] Implement record get/select tối thiểu và activate: kiểm tra snapshot/ngữ cảnh, patch state/status, không retry ghi, đọc lại xác nhận. Sau verificationPending UI chỉ đề xuất tải lại.
- [ ] Chạy test activation và typecheck, xác nhận PASS. Live write chỉ khi người dùng chỉ định row Production kiểm thử; dùng fake transport cho kiểm thử cập nhật còn lại.

## Task 4: UI ba màn hình theo PH Standard

**Consumes:** TableMetadata, AuditService và RecordService từ Tasks 1–3.

**Produces:** App shell, TablePicker có label + logicalName, RecordLookup debounce/server paging, AuditPage theo mode, panel AuditDetails và ActivationPage.

- [ ] Viết `tests/request-context.test.tsx`: khi đổi table/GUID trong lúc request cũ đang chạy thì results/detail/activation snapshot cũ bị bỏ; double click Active chỉ gửi một cập nhật; error giữ input. Chạy test, xác nhận FAIL.
- [ ] Implement providers với query keys gồm môi trường/người dùng/bộ lọc, data chỉ giữ trong phiên; components/tokens theo spec. Không có dữ liệu mẫu tự hiển thị như dữ liệu thật.
- [ ] Implement Create/Update có nhập GUID + lookup, Delete không cần ID, pagination rõ và details tải theo sự kiện; các trạng thái loading/empty/error/permission/throttling riêng.
- [ ] Implement ActivationPage hiển thị row/status trước Active, lựa chọn status khi cần, khóa khi đang ghi và readback feedback. Mọi hành động dùng snapshot cùng table/ID đang chọn.
- [ ] Chạy test UI và typecheck, xác nhận PASS. Kiểm tra trình duyệt ở desktop/mobile, focus/bàn phím, panel close giữ vị trí danh sách; lưu bằng chứng kiểm chứng UI.

## Task 5: Build, deploy và bàn giao

**Consumes:** Source và services/UI hoàn chỉnh Tasks 1–4.

**Produces:** Source có thể build, cấu hình Power Apps theo môi trường, README và verification-results; app ID/link khi deploy thực tế thành công.

- [ ] Chạy `npm test`, `npm run typecheck`, `npm run build`; tất cả exit 0. Kiểm tra bundle không chứa secret và không có unresolved integration stub; ghi số test và giới hạn live validation.
- [ ] Rà soát source với spec: query/pagination, status metadata, request races, quyền người gọi, lỗi sau ghi và UI reference. Sửa lỗi rồi chỉ chạy lại các checks có liên quan.
- [ ] Viết README chứa setup/login/start/build/deploy đúng CLI hiện hành, quyền audit cần thiết, trạng thái tích hợp và giới hạn lifecycle; `.env.example` chỉ chứa cấu hình không bí mật.
- [ ] Tạo/push Code App tên `Audit- Return Active` trong environment đích theo CLI chính thức khi kết nối/quyền cho phép. Không mở rộng sharing hoặc quyền ngoài yêu cầu.
- [ ] Mở app thực tế, kiểm tra metadata, Create/Update và Delete read-only. Activation live write chờ row được chỉ định nếu chưa có. Ghi app ID/link và verification-results; nếu deploy bị chặn, ghi chính xác blocker thay vì báo đã tạo app.

## Handoff

Đề xuất triển khai trực tiếp trong chat này do Tasks 2–4 dùng chung contract/transport của Task 1. Người dùng có thể chọn subagents nếu muốn triển khai và review độc lập theo task. Chưa bắt đầu code trước khi người dùng review kế hoạch và chọn cách thực hiện.
