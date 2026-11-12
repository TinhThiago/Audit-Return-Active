// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authSettings } from "../src/browser/auth-config";
import { connectGraph } from "../src/features/flows/graphAuth";

const mock = vi.hoisted(() => ({
  create: vi.fn(),
  login: vi.fn(),
  silent: vi.fn(),
}));
vi.mock("@azure/msal-browser", () => ({
  PublicClientApplication: class {
    constructor(settings: unknown) {
      mock.create(settings);
    }
    async initialize() {}
    loginPopup = mock.login;
    acquireTokenSilent = mock.silent;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_FLOW_AUDIT_CLIENT_ID", "");
  const account = {
    tenantId: authSettings().tenantId,
    homeAccountId: "account",
    username: "user@example.com",
  };
  mock.login.mockResolvedValue({ account, accessToken: "graph-token" });
  mock.silent.mockResolvedValue({
    account,
    accessToken: "refreshed-graph-token",
  });
});
afterEach(() => vi.unstubAllEnvs());

it("uses the shared Entra client by default and requests a Graph-specific token", async () => {
  const settings = authSettings();
  const token = await connectGraph(
    new AbortController().signal,
    "user@example.com",
  );
  expect(mock.create).toHaveBeenCalledWith({
    auth: {
      clientId: settings.clientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId}`,
      redirectUri: settings.redirectUri,
    },
    cache: { cacheLocation: "memoryStorage" },
  });
  expect(mock.login).toHaveBeenCalledWith({
    scopes: ["https://graph.microsoft.com/AuditLogsQuery.Read.All"],
    loginHint: "user@example.com",
  });
  expect(await token()).toBe("graph-token");
  expect(await token()).toBe("refreshed-graph-token");
});

it("honors a configured override and fails before sign-in if the override is invalid", async () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  vi.stubEnv("VITE_FLOW_AUDIT_CLIENT_ID", id);
  await connectGraph(new AbortController().signal);
  expect(mock.create).toHaveBeenCalledWith(
    expect.objectContaining({
      auth: expect.objectContaining({ clientId: id }),
    }),
  );
  vi.stubEnv("VITE_FLOW_AUDIT_CLIENT_ID", "invalid");
  await expect(connectGraph(new AbortController().signal)).rejects.toThrow(
    /Client ID/,
  );
  expect(mock.login).toHaveBeenCalledTimes(1);
});
