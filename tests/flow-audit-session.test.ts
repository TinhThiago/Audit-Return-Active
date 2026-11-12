import { expect, it, vi } from "vitest";
import {
  InteractionRequiredAuthError,
  type IPublicClientApplication,
} from "@azure/msal-browser";
import { BrowserAuth } from "../src/browser/auth";
import { flowAuditAuthError } from "../src/features/flows/graphAuth";

const settings = {
  clientId: "test",
  tenantId: "tenant",
  redirectUri: "https://example.com/auth-callback.html",
};
const account = {
  tenantId: "tenant",
  homeAccountId: "user",
  username: "user@example.com",
};
const result = { account, accessToken: "graph-token" };
function fixture() {
  const msal = {
    getActiveAccount: vi.fn().mockReturnValue(account),
    acquireTokenSilent: vi.fn().mockResolvedValue(result),
    acquireTokenPopup: vi.fn().mockResolvedValue(result),
  };
  return {
    auth: new BrowserAuth(
      msal as unknown as IPublicClientApplication,
      settings,
    ),
    msal,
  };
}

it("uses the active session to request the Graph scope without opening a second login", async () => {
  const { auth, msal } = fixture();
  const token = await auth.connectFlowAudit(new AbortController().signal);
  expect(msal.acquireTokenSilent).toHaveBeenCalledWith({
    account,
    scopes: ["https://graph.microsoft.com/AuditLogsQuery.Read.All"],
    redirectUri: settings.redirectUri,
  });
  expect(await token()).toBe("graph-token");
  expect(msal.acquireTokenPopup).not.toHaveBeenCalled();
  msal.getActiveAccount.mockReturnValue({
    ...account,
    homeAccountId: "different",
  });
  await expect(token()).rejects.toThrow(/Tài khoản đã thay đổi/);
});

it("opens a popup once for interaction-required and does not open one during polling", async () => {
  const { auth, msal } = fixture();
  const interaction = new InteractionRequiredAuthError(
    "consent_required",
    "Consent required",
  );
  msal.acquireTokenSilent.mockRejectedValue(interaction);
  const token = await auth.connectFlowAudit(new AbortController().signal);
  expect(msal.acquireTokenPopup).toHaveBeenCalledWith(
    expect.objectContaining({ account }),
  );
  expect(await token()).toBe("graph-token");
  await expect(token()).rejects.toBe(interaction);
  expect(msal.acquireTokenPopup).toHaveBeenCalledTimes(1);
});

it("shows safe Microsoft error codes without displaying the raw auth error", () => {
  const text = flowAuditAuthError({
    errorCode: "invalid_request",
    errorMessage: "AADSTS50011 some internal information",
  });
  expect(text).toContain("invalid_request / AADSTS50011");
  expect(text).toContain("Redirect URI");
  expect(text).not.toContain("some internal information");
});
