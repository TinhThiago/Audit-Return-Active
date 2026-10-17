import { expect, it, vi } from "vitest";
import { BrowserTransport } from "../src/browser/browserTransport";
import { BrowserAuth } from "../src/browser/auth";
import type { IPublicClientApplication } from "@azure/msal-browser";
it("blocks reads and mutations throughout a pending session interaction", async () => {
  const token = vi.fn().mockResolvedValue("token");
  const send = vi.fn();
  const pending = vi.fn();
  const t = new BrowserTransport(
    { getToken: token },
    send,
    pending,
    () => false,
  );
  for (const method of ["GET", "PATCH", "DELETE"] as const)
    await expect(
      t.request({
        method,
        path: "ph_items(00000000-0000-0000-0000-000000000001)",
        etag: 'W/"42"',
        ...(method === "PATCH"
          ? { body: { statecode: 1, statuscode: 8 } }
          : {}),
      }),
    ).rejects.toThrow(/phiên đăng nhập/);
  expect(token).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  expect(pending).not.toHaveBeenCalled();
});
const tenant = "6ab8e229-ae5c-482e-b463-5b926f94e34c";
const account = {
  tenantId: tenant,
  homeAccountId: "one",
  username: "user@example.com",
};
function authFixture(selected: unknown = account) {
  const msal = {
    initialize: vi.fn(),
    getActiveAccount: vi.fn(() => selected),
    getAllAccounts: vi.fn(() => []),
    setActiveAccount: vi.fn(),
    acquireTokenSilent: vi
      .fn()
      .mockResolvedValue({ accessToken: "access-token", account }),
    loginPopup: vi.fn().mockResolvedValue({ account }),
    acquireTokenPopup: vi.fn().mockResolvedValue({ account }),
    logoutPopup: vi.fn(),
  };
  return {
    msal,
    auth: new BrowserAuth(msal as unknown as IPublicClientApplication, {
      tenantId: tenant,
      clientId: "test",
      redirectUri: "https://example.com/Audit/auth-callback.html",
    }),
  };
}
it("rejects foreign tenant and never acquires a token for it", async () => {
  const { msal, auth } = authFixture({ ...account, tenantId: "foreign" });
  await auth.initialize();
  expect(auth.getAccount()).toBeNull();
  await expect(auth.getToken()).rejects.toThrow();
  expect(msal.acquireTokenSilent).not.toHaveBeenCalled();
});
it("requests Production delegated scope silently and requires explicit interaction on expiry", async () => {
  const { msal, auth } = authFixture();
  await auth.initialize();
  expect(await auth.getToken()).toBe("access-token");
  expect(msal.acquireTokenSilent.mock.calls[0][0]).toMatchObject({
    scopes: ["https://phuochung1.crm5.dynamics.com/user_impersonation"],
  });
  msal.acquireTokenSilent.mockRejectedValue(new Error("expired"));
  await expect(auth.getToken()).rejects.toMatchObject({ status: 401 });
  expect(msal.loginPopup).not.toHaveBeenCalled();
  expect(msal.acquireTokenPopup).not.toHaveBeenCalled();
});
it("rejects a silent response belonging to another account", async () => {
  const { msal, auth } = authFixture();
  msal.acquireTokenSilent.mockResolvedValue({
    accessToken: "wrong",
    account: { ...account, homeAccountId: "two" },
  });
  await expect(auth.getToken()).rejects.toThrow();
});
it("blocks foreign URLs before acquiring tokens or sending requests", async () => {
  const token = vi.fn().mockResolvedValue("secret");
  const send = vi.fn();
  const t = new BrowserTransport({ getToken: token }, send);
  for (const path of [
    "https://evil.example/api/data/v9.2/audits",
    "//evil.example/api/data/v9.2/audits",
    "../admin",
    "%2e%2e/admin",
  ])
    await expect(t.request({ method: "GET", path })).rejects.toThrow();
  expect(token).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it("preserves ETag and does not retry a failed write", async () => {
  const send = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: { message: "limited" } }), {
      status: 429,
    }),
  );
  const pending = vi.fn();
  const t = new BrowserTransport(
    { getToken: async () => "token" },
    send,
    pending,
  );
  await expect(
    t.request({
      method: "PATCH",
      path: "ph_items(00000000-0000-0000-0000-000000000001)",
      body: { statecode: 1, statuscode: 8 },
      etag: 'W/"42"',
    }),
  ).rejects.toMatchObject({ status: 429 });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][1]).toMatchObject({
    headers: { Authorization: "Bearer token", "If-Match": 'W/"42"' },
    redirect: "error",
    credentials: "omit",
  });
  expect(pending.mock.calls).toEqual([[1], [-1]]);
});
it("supports empty DELETE response and blocks audit deletion", async () => {
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const t = new BrowserTransport({ getToken: async () => "token" }, send);
  await expect(
    t.request({
      method: "DELETE",
      path: "ph_items(00000000-0000-0000-0000-000000000001)",
      etag: 'W/"42"',
    }),
  ).resolves.toBeUndefined();
  await expect(
    t.request({
      method: "DELETE",
      path: "audits(00000000-0000-0000-0000-000000000001)",
      etag: 'W/"42"',
    }),
  ).rejects.toThrow();
  expect(send).toHaveBeenCalledTimes(1);
});
it("passes abort to fetch and preserves HTTP permission failures", async () => {
  const controller = new AbortController();
  const send = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: { message: "forbidden" } }), {
      status: 403,
    }),
  );
  const t = new BrowserTransport({ getToken: async () => "token" }, send);
  await expect(
    t.request({ method: "GET", path: "audits", signal: controller.signal }),
  ).rejects.toMatchObject({ status: 403 });
  expect(send.mock.calls[0][1].signal).toBe(controller.signal);
});
