import { environment } from "../config/environment";
import {
  DataverseError,
  type DataverseRequest,
  type DataverseTransport,
} from "./transport";
export interface HttpRequest {
  method: "GET" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, unknown>;
  body?: string;
}
type ConnectorResult = { success: boolean; data: unknown; error?: unknown };
type Invoke = (request: HttpRequest) => Promise<ConnectorResult>;
const abort = (signal?: AbortSignal) => {
  if (signal?.aborted)
    throw new DOMException("Request cancelled", "AbortError");
};
export function safePath(path: string): string {
  const decoded = decodeURIComponent(path);
  if (/^(\/\/)|\\|(^|\/)\.\.(\/|$)/.test(decoded.split("?")[0]))
    throw new Error("Đường dẫn Dataverse không hợp lệ.");
  const url = new URL(
    path.startsWith("https://")
      ? path
      : environment.api + path.replace(/^\/api\/data\/v9\.2\//, ""),
    environment.url,
  );
  if (
    url.origin !== environment.url ||
    !url.pathname.startsWith(environment.api)
  )
    throw new Error("Request phải thuộc Dataverse Phuoc Hung Production.");
  return url.pathname.slice(environment.api.length) + url.search;
}
function parse(value: unknown): unknown {
  if (typeof value === "string") {
    if (!value.trim()) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      throw new DataverseError("Connector trả về dữ liệu không phải JSON.");
    }
  }
  return value;
}
function failure(error: unknown): DataverseError {
  if (error instanceof DataverseError) return error;
  const e = error as
    | {
        message?: string;
        status?: number;
        statusCode?: number;
        httpStatusCode?: number;
        response?: { status?: number; headers?: Record<string, string> };
      }
    | undefined;
  return new DataverseError(
    e?.message || "Không thể gọi Dataverse qua connection Entra.",
    e?.statusCode ?? e?.httpStatusCode ?? e?.status ?? e?.response?.status,
  );
}
export class ScopedTransport implements DataverseTransport {
  constructor(private readonly call: Invoke) {}
  async request<T>(r: DataverseRequest): Promise<T> {
    const path = safePath(r.path);
    if (
      r.method === "PATCH" &&
      (!/^[a-z][a-z0-9_]*\([0-9a-f-]{36}\)$/i.test(path) ||
        !r.body ||
        Object.keys(r.body).sort().join(",") !== "statecode,statuscode" ||
        !Object.values(r.body).every(Number.isInteger) ||
        !r.etag)
    )
      throw new Error(
        "Chỉ hỗ trợ cập nhật statecode/statuscode của bản ghi đã đọc và có phiên bản.",
      );
    if (
      r.method === "DELETE" &&
      (!/^[a-z][a-z0-9_]*\([0-9a-f-]{36}\)$/i.test(path) ||
        path.startsWith("audits(") ||
        !r.etag ||
        r.body)
    )
      throw new Error(
        "Chỉ xóa một bản ghi đã đọc và có phiên bản; không hỗ trợ xóa audit.",
      );
    for (let attempt = 0; attempt < 4; attempt++) {
      abort(r.signal);
      try {
        const result = await this.call({
          method: r.method,
          url: environment.url + environment.api + path,
          headers: {
            Accept: "application/json",
            "OData-Version": "4.0",
            "OData-MaxVersion": "4.0",
            Prefer:
              'odata.maxpagesize=50, odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
            ...(r.method === "DELETE" ? { "If-Match": r.etag } : {}),
            ...(r.method === "PATCH"
              ? { "Content-Type": "application/json", "If-Match": r.etag }
              : {}),
          },
          ...(r.body ? { body: JSON.stringify(r.body) } : {}),
        });
        abort(r.signal);
        if (!result.success) throw failure(result.error);
        const data = parse(result.data);
        if (data && typeof data === "object" && "statusCode" in data) {
          const envelope = data as {
            statusCode: number;
            body: unknown;
            headers?: Record<string, string>;
          };
          const body = parse(envelope.body);
          if (envelope.statusCode >= 400)
            throw new DataverseError(
              (body as { error?: { message?: string } })?.error?.message ||
                "Dataverse request thất bại.",
              envelope.statusCode,
              Number(
                envelope.headers?.["Retry-After"] ??
                  envelope.headers?.["retry-after"],
              ) || undefined,
            );
          return body as T;
        }
        return data as T;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        const err = failure(e);
        if (r.method !== "GET" || err.status !== 429 || attempt === 3)
          throw err;
        const delay = Math.min(err.retryAfter ?? 2 ** attempt, 30) * 1000;
        await new Promise<void>((resolve, reject) => {
          const done = () => {
            r.signal?.removeEventListener("abort", cancel);
            resolve();
          };
          const timer = setTimeout(done, delay);
          const cancel = () => {
            clearTimeout(timer);
            r.signal?.removeEventListener("abort", cancel);
            reject(new DOMException("Request cancelled", "AbortError"));
          };
          r.signal?.addEventListener("abort", cancel, { once: true });
        });
      }
    }
    throw new DataverseError("Đã vượt số lần thử đọc Dataverse.");
  }
}
