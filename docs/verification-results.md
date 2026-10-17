# Verification results — 2026-10-07

Canonical source: D:\Phước hưng\Code app\Audit-Return-Active.

## Automated final verification

- npm test: 22 tests passed across 7 files.
- npm run typecheck: passed.
- npm run format:check: passed.
- npm run build: passed; main bundle gzip 83.32 kB, CSS gzip 4.05 kB.
- Independent review: status reason selector disappearing after selection fixed; regression tests verify selector remains editable and duplicate clicks send one PATCH.
- Tests cover GUID validation, metadata caching, scoped transport, pagination/filter isolation, audit null/missing distinctions, activation mapping/ETag/read-back and stale request handling.

## Live Production verification

- Connection consent granted with explicit user authorization.
- 837 table definitions loaded with readable labels and logical names.
- Sản phẩm / ph_item_master, GUID 6b429899-30c1-f111-aaaf-6045bd5a2f39: 3 Create/Update events read successfully.
- Update details resolved ph_name to Tên sản phẩm and displayed old/new values correctly.
- Delete mode required table only and returned 103 deletion events with record GUIDs, users and timestamps.
- Prefer maxpagesize=50 is a request hint; observed audit response had 103 events. App preserves server @odata.nextLink and does not silently truncate with $top. Real multi-page Production audit retrieval is not verified; continuation behavior is covered with fixtures.
- Return Active read record name, Active state 0, status 1 and ETag W/"7312617". Already-active row disabled the write button.
- No Production PATCH was performed. Mutation behavior is covered by transport/service/component tests; a designated inactive test row is needed for live write validation.
- Final pa app push returned success for existing app b18369a1-7454-4e33-9921-532eaab86f9d.

## Access limitations

The app has not been shared to additional users; licensing, roles and user-specific Entra connections must be configured when sharing. A second-user run has not been verified. Activity and specialized state lifecycles are intentionally unsupported by generic activation policy.

Final published version refreshed through Power Apps Refresh prompt; Create/Update query and old/new detail verified again. Screenshot: screenshots/audit-final.jpg.

## Revision handoff 2026-10-07

- 28 tests across 8 files passed; TypeScript/build passed.
- Final review zero-results ARIA finding fixed with a red/green regression test.
- Push attempt failed with ApplicationNotFound. Read-only app list confirmed no Audit- Return Active app in configured Production.
- User selected source-only handoff, twice. No replacement app created. Local power.config.json appId cleared to null to avoid stale deployment target.
- Local Play host execution was rejected by the user. User clarified direct localhost was used; code now immediately explains the official authenticated Local Play workflow and adds npm run local. No local Dataverse live run was performed.
- Record display recovery verified against reversible CP1252/UTF8 fixtures; original strings preserved. Not yet verified against live affected records.

Local hostname root cause: Microsoft player LocalAppMetadataProvider._isValidLocalUrl accepts hostname localhost, not 127.0.0.1. Confirmed in public es6.player-boot.js. package dev changed to vite --host localhost; 29 tests/build pass. Did not stop/restart user's server. localhost test reached Fetching your app; full local read pending user restart.

## Return Active / Delete — 08/10/2026
- 35 tests across 10 files passed; TypeScript and production build passed.
- Tests verify conditional single-row DELETE/204, mismatched snapshot/no ETag rejection, duplicate write guard, no DELETE retry, confirmation cancel/identity, success clearing displayed row, mutual Active/Delete lock and reload requirement on failure.
- Menu/page renamed Return Active / Delete; Delete beside Active; lookup includes active and inactive records.
- Source only; no Dataverse record deleted, no app published or server started.


## Deactivate — 10/10/2026
Shared state/status policy and mutation service support Inactive target with ETag, mutual write locking and readback. Regression tests cover inactive status mapping, already-inactive no-op, multiple inactive status selection and Deactivate UI hiding Delete. Source-only handoff, no server started and no live Dataverse write.


### Kiểm tra cuối Deactivate — 10/10/2026

- `npm.cmd test`: 40/40 tests đạt trên 10 files.
- `npm.cmd run build`: TypeScript và Vite build thành công.
- Regression: dropdown hiển thị status Inactive mặc định từ metadata; khi đổi status, gửi đúng giá trị đã chọn.
- Các kiểm tra cập nhật trạng thái dùng transport giả lập; không ghi dữ liệu Production.

## GitHub Pages — 17/10/2026

- User approved public repository and browser Microsoft sign-in on 16/10.
- 52 automated tests across 12 files; includes tenant/token isolation, scoped browser transport, empty DELETE, ETag, write-no-retry, auth popup gating and stale logout workspace clearing.
- Power Apps and browser builds checked separately. Pages emits only browser code and dedicated MSAL callback; no dataSourcesInfo/connectionReferences in Pages artifact.
- Production dependency npm audit: 0 vulnerabilities. Existing dev tooling advisories are not bundled in Pages; CLI dependency compatibility retained.
- Independent review session interaction race fixed with three red/green regressions. No live Dataverse writes performed.
- Live Microsoft login remains subject to SPA redirect registration and consent; build/test do not establish these.
