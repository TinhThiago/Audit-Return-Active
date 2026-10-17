import { ScopedTransport } from "../data/requestTransport";
import type { DataverseRequest, DataverseTransport } from "../data/transport";

export class BrowserTransport implements DataverseTransport {
  constructor(
    private auth: { getToken(): Promise<string> },
    private send: typeof fetch = globalThis.fetch.bind(globalThis),
    private pending: (delta: number) => void = () => {},
    private sessionReady: () => boolean = () => true,
  ) {}
  async request<T>(request: DataverseRequest): Promise<T> {
    if (!this.sessionReady())
      throw new Error(
        "Đang xử lý phiên đăng nhập. Chờ hoàn tất trước khi tra cứu hoặc thay đổi dữ liệu.",
      );
    this.pending(1);
    try {
      // Reuse the existing path/mutation allowlist and GET-only throttling policy.
      const transport = new ScopedTransport(async (input) => {
        const token = await this.auth.getToken();
        const response = await this.send(input.url, {
          method: input.method,
          headers: {
            ...(input.headers as Record<string, string>),
            Authorization: `Bearer ${token}`,
          },
          ...(input.body !== undefined ? { body: input.body } : {}),
          signal: request.signal,
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
        });
        const text = await response.text();
        let body: unknown;
        if (text.trim()) {
          try {
            body = JSON.parse(text);
          } catch {
            throw new Error(
              `Dataverse trả về dữ liệu không phải JSON (HTTP ${response.status}).`,
            );
          }
        }
        if (
          response.ok &&
          body &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          response.headers.has("ETag")
        )
          body = { ...body, "@odata.etag": response.headers.get("ETag") };
        return {
          success: true,
          data: {
            statusCode: response.status,
            headers: {
              "Retry-After": response.headers.get("Retry-After") || "",
            },
            body,
          },
        };
      });
      return await transport.request<T>(request);
    } finally {
      this.pending(-1);
    }
  }
}
