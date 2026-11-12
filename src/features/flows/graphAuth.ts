import { PublicClientApplication } from "@azure/msal-browser";
import { authSettings } from "../../browser/auth-config";

const scopes = ["https://graph.microsoft.com/AuditLogsQuery.Read.All"];
export async function connectGraph(signal: AbortSignal, loginHint?: string) {
  const settings = authSettings();
  const clientId =
    import.meta.env.VITE_FLOW_AUDIT_CLIENT_ID?.trim() || settings.clientId;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(clientId))
    throw new Error(
      "Client ID của app đọc Audit không hợp lệ. Liên hệ quản trị viên để kiểm tra cấu hình.",
    );
  const msal = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId}`,
      redirectUri: settings.redirectUri,
    },
    cache: { cacheLocation: "memoryStorage" },
  });
  await msal.initialize();
  signal.throwIfAborted();
  const result = await msal.loginPopup({
    scopes,
    loginHint,
    ...(loginHint ? {} : { prompt: "select_account" }),
  });
  signal.throwIfAborted();
  const account = result.account;
  if (
    !account ||
    account.tenantId.toLowerCase() !== settings.tenantId.toLowerCase() ||
    (loginHint && account.username.toLowerCase() !== loginHint.toLowerCase())
  )
    throw new Error("Hãy chọn đúng tài khoản công việc đang dùng trong app.");
  if (!result.accessToken)
    throw new Error(
      "Microsoft không trả token đọc audit. Kiểm tra quyền và admin consent.",
    );
  let initial = result.accessToken;
  return async () => {
    signal.throwIfAborted();
    if (initial) {
      const token = initial;
      initial = "";
      return token;
    }
    const fresh = await msal.acquireTokenSilent({ scopes, account });
    if (
      !fresh.accessToken ||
      fresh.account?.homeAccountId !== account.homeAccountId ||
      fresh.account.tenantId !== account.tenantId
    )
      throw new Error("Phiên tra cứu audit đã thay đổi. Hãy tải lại.");
    return fresh.accessToken;
  };
}
