import type { BrowserAuth } from "../../browser/auth";
import { PublicClientApplication } from "@azure/msal-browser";
import { authSettings } from "../../browser/auth-config";

const scopes = ["https://graph.microsoft.com/AuditLogsQuery.Read.All"];
export async function connectGraph(
  signal: AbortSignal,
  loginHint?: string,
  browserAuth?: BrowserAuth,
) {
  const settings = authSettings();
  const clientId =
    import.meta.env.VITE_FLOW_AUDIT_CLIENT_ID?.trim() || settings.clientId;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(clientId))
    throw new Error(
      "Client ID của app đọc Audit không hợp lệ. Liên hệ quản trị viên để kiểm tra cấu hình.",
    );
  if (
    browserAuth &&
    clientId.toLowerCase() === browserAuth.settings.clientId.toLowerCase()
  )
    return browserAuth.connectFlowAudit(signal);
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

export function flowAuditAuthError(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError")
    return "Đã hết thời gian chờ Microsoft trả kết quả. Hãy thử khoảng thời gian ngắn hơn.";
  if (!error || typeof error !== "object" || !("errorCode" in error))
    return error instanceof Error ? error.message : "Không tải được nhật ký.";
  const code =
    typeof error.errorCode === "string" &&
    /^[a-z0-9_-]{1,80}$/i.test(error.errorCode)
      ? error.errorCode
      : "";
  const detail =
    "errorMessage" in error && typeof error.errorMessage === "string"
      ? error.errorMessage
      : "";
  const aad = (
    detail +
    " " +
    (error instanceof Error ? error.message : "")
  ).match(/\bAADSTS\d{4,10}\b/i)?.[0];
  const codes = [code, aad].filter(Boolean).join(" / ");
  let guidance =
    "Kiểm tra quyền AuditLogsQuery.Read.All, admin consent và quyền đọc Purview của tài khoản.";
  if (code === "interaction_in_progress")
    guidance = "Hoàn tất hoặc đóng popup Microsoft đang mở, sau đó tải lại.";
  if (code === "user_cancelled")
    guidance = "Bạn đã đóng popup. Bấm Tải lịch sử xóa để thử lại.";
  if (
    [
      "popup_window_error",
      "empty_window_error",
      "monitor_popup_timeout",
    ].includes(code)
  )
    guidance = "Cho phép popup cho trang Audit và thử lại.";
  if (aad === "AADSTS50011")
    guidance = "Kiểm tra Redirect URI loại SPA của đăng ký Entra.";
  return (
    "Không kết nối được Microsoft Audit" +
    (codes ? " (" + codes + ")" : "") +
    ". " +
    guidance
  );
}
