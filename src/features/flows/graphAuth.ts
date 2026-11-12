import { PublicClientApplication } from "@azure/msal-browser";
import { authSettings } from "../../browser/auth-config";

const scopes = ["https://graph.microsoft.com/AuditLogsQuery.Read.All"];
export const auditClientId =
  (import.meta.env.VITE_FLOW_AUDIT_CLIENT_ID as string | undefined)?.trim() ||
  "";

export async function connectGraph(
  clientId: string,
  signal: AbortSignal,
  loginHint?: string,
) {
  const settings = authSettings();
  if (
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(clientId) ||
    clientId.toLowerCase() === settings.clientId.toLowerCase()
  )
    throw new Error(
      "Nhập Client ID của đăng ký Entra riêng dành cho nhật ký Cloud Flow.",
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
