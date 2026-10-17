import {
  PublicClientApplication,
  type IPublicClientApplication,
} from "@azure/msal-browser";
import { environment } from "../config/environment";
import { DataverseError } from "../data/transport";
import { authSettings } from "./auth-config";

export class BrowserAuth {
  private initialized?: Promise<void>;
  constructor(
    private msal: IPublicClientApplication = new PublicClientApplication({
      auth: {
        clientId: authSettings().clientId,
        authority: `https://login.microsoftonline.com/${authSettings().tenantId}`,
        redirectUri: authSettings().redirectUri,
      },
      cache: { cacheLocation: "sessionStorage" },
    }),
    readonly settings = authSettings(),
  ) {}
  async initialize() {
    this.initialized ??= this.msal.initialize();
    await this.initialized;
    const current = this.msal.getActiveAccount();
    const account =
      current?.tenantId === this.settings.tenantId
        ? current
        : this.msal
            .getAllAccounts()
            .find((a) => a.tenantId === this.settings.tenantId);
    this.msal.setActiveAccount(account || null);
  }
  getAccount() {
    const account = this.msal.getActiveAccount();
    return account?.tenantId === this.settings.tenantId ? account : null;
  }
  private scopes() {
    return [`${environment.url}/user_impersonation`];
  }
  async signIn(retryPending = false) {
    await this.initialize();
    const account = this.getAccount();
    const options = {
      scopes: this.scopes(),
      redirectUri: this.settings.redirectUri,
      overrideInteractionInProgress: retryPending,
    };
    const result = account
      ? await this.msal.acquireTokenPopup({ ...options, account })
      : await this.msal.loginPopup({ ...options, prompt: "select_account" });
    if (result.account?.tenantId !== this.settings.tenantId) {
      this.msal.setActiveAccount(null);
      throw new Error("Chọn tài khoản Microsoft thuộc đúng tenant Phước Hưng.");
    }
    this.msal.setActiveAccount(result.account);
  }
  async getToken() {
    const account = this.getAccount();
    if (!account)
      throw new DataverseError("Đăng nhập Microsoft để tiếp tục.", 401);
    try {
      const result = await this.msal.acquireTokenSilent({
        account,
        scopes: this.scopes(),
        redirectUri: this.settings.redirectUri,
      });
      if (
        !result.accessToken ||
        result.account?.tenantId !== this.settings.tenantId ||
        result.account.homeAccountId !== account.homeAccountId
      )
        throw new Error("Account mismatch");
      return result.accessToken;
    } catch {
      throw new DataverseError(
        "Phiên cần cấp quyền lại. Bấm Cấp quyền lại ở thanh tài khoản.",
        401,
      );
    }
  }
  async signOut() {
    await this.msal.logoutPopup({
      account: this.getAccount() || undefined,
      postLogoutRedirectUri: this.settings.redirectUri,
    });
    this.msal.setActiveAccount(null);
  }
}

export function loginError(error: unknown): string {
  const code =
    error &&
    typeof error === "object" &&
    "errorCode" in error &&
    typeof error.errorCode === "string"
      ? error.errorCode.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
      : "";
  if (code === "interaction_in_progress")
    return "Một lượt đăng nhập đang chạy. Hoàn tất popup hoặc bấm Hủy lượt đăng nhập cũ và thử lại; đóng popup cũ nếu còn mở.";
  if (code === "user_cancelled")
    return "Đăng nhập đã hủy. Bấm Đăng nhập Microsoft để thử lại.";
  return `Không hoàn tất đăng nhập${code ? ` (${code})` : ""}. Kiểm tra popup, SPA Redirect URI và quyền Dataverse user_impersonation trong Entra.`;
}
