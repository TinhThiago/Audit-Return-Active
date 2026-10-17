# Audit GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Publish Audit on GitHub Pages with Microsoft sign-in while preserving Power Apps runtime.
**Architecture:** Browser MSAL session gates a scoped Dataverse transport. Existing services/UI remain shared; Vite selects runtime and emits a separate auth callback.
**Tech Stack:** React, TypeScript, Vite, MSAL Browser, Vitest, GitHub Actions.
**Spec:** ../../github-pages-design.md (approved by user).

## Global Constraints
- Production Dataverse origin only; tenant/client IDs per approved design.
- No client secret, no Production write tests, no automatic write retry.
- Preserve Power Apps/Local Play; publish only frontend artifact.

## Review Focus
- Wrong tenant cannot access workspace; test auth account filtering.
- Absolute/encoded foreign URLs cannot receive tokens; test transport boundary.
- Conditional writes preserve ETag and never retry; test PATCH/DELETE failure.
- Session renew/sign-out cannot switch identity under pending write; block session controls during in-flight requests.
- Callback and assets resolve under project base path; verify browser artifact.

### Task 1: Browser boundary and auth
**Files:** src/browser/{auth,auth-config,browserTransport}.ts; tests/browser.test.ts
**Interfaces:** BrowserAuth.initialize/signIn/getToken/signOut/getAccount; BrowserTransport implements DataverseTransport.
- [ ] Add failing tests for tenant, silent-token errors, scoped paths, ETag, write retry.
- [ ] Run targeted test (RED), implement, rerun (GREEN).
- [ ] Reuse existing PowerAppsTransport request validation/retry by injecting fetch-backed connector invocation; ensure native response is enveloped to preserve ETag body and statuses.

### Task 2: Runtime/UI/build
**Files:** src/browser/BrowserRoot.tsx; src/{main.tsx,app/{App,providers}.tsx}; vite.config.ts; auth-callback.html; src/browser/auth-callback.ts
- [ ] Gate workspace on signed-in tenant account; create services per session; expose explicit grant/signout actions and show callback configuration.
- [ ] Add runtime prop to App to load metadata without Power Apps getContext in browser runtime.
- [ ] Add browser build script and conditional Vite plugin; test both runtime builds.
- [ ] Add auth/UI regression and verify existing tests.

### Task 3: Publish and verify
**Files:** .github/workflows/pages.yml, .gitignore, README.md, docs/github-pages.md
- [ ] Workflow test/build/browser deploy with repository base path; no secrets/connector config in Pages artifact.
- [ ] Inspect candidate Git files and artifacts; commit clean public source.
- [ ] Create TinhThiago/Audit-Return-Active public repository, push main, enable Actions Pages; inspect workflow and HTTPS result.
- [ ] Report actual deploy status and exact remaining Entra redirect setup; no unsupported claim of live auth verification.

## Execution ledger
- User approved public repository and reuse of SPA registration. Native execution selected to carry out explicit deployment request without another authorization round.
- Canonical project has no Git repository; initialize there, preserving existing source and user-managed dev server.

- 17/10: Review phát hiện request có thể bắt đầu khi popup đang mở. Đã thêm transport session gate + workspace inert; ba regression tests RED→GREEN. Tổng 52 tests.
- Ruling: dùng dist-pages riêng cho artifact browser để không ghi đè build Power Apps dist.
