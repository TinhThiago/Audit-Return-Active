import { readGraphRecords } from "./deletedFlows";

const origin = "https://graph.microsoft.com";
const queries = "/v1.0/security/auditLog/queries";
const queryIdPattern = /^[A-Za-z0-9_-]{1,200}$/;
const day = 86_400_000;

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export type GraphAuditQuery = {
  id: string;
  days: number;
  workloadOnly: boolean;
};

export class GraphAuditWaitError extends Error {
  constructor(readonly query: GraphAuditQuery) {
    super(
      "Chưa nhận được kết quả từ Microsoft trong 5 phút. Bấm Tiếp tục chờ để kiểm tra lại truy vấn này.",
    );
    this.name = "GraphAuditWaitError";
  }
}

export class GraphAudit {
  constructor(
    private token: () => Promise<string>,
    private send: typeof fetch = globalThis.fetch.bind(globalThis),
    private pause = wait,
  ) {}

  async search(
    days: number,
    signal: AbortSignal,
    now = Date.now(),
    workloadOnly = false,
  ) {
    return this.run(days, signal, now, workloadOnly);
  }

  async resume(query: GraphAuditQuery, signal: AbortSignal) {
    if (!queryIdPattern.test(query.id))
      throw new Error("Mã truy vấn Microsoft Graph không hợp lệ.");
    return this.run(query.days, signal, Date.now(), query.workloadOnly, query);
  }

  private async run(
    days: number,
    signal: AbortSignal,
    now: number,
    workloadOnly: boolean,
    query?: GraphAuditQuery,
  ) {
    if (![1, 7, 21, 30, 90].includes(days))
      throw new Error("Khoảng thời gian không hợp lệ.");
    const timeout = AbortSignal.timeout(300_000);
    const deadline = AbortSignal.any([signal, timeout]);
    const request = async (url: URL, body?: object) => {
      deadline.throwIfAborted();
      const token = await this.token();
      deadline.throwIfAborted();
      for (let attempt = 0; ; attempt++) {
        const response = await this.send(url, {
          method: body ? "POST" : "GET",
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          signal: deadline,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (response.ok)
          return (await response.json()) as Record<string, unknown>;
        if (!body && [429, 503, 504].includes(response.status) && attempt < 3) {
          const retry = response.headers.get("Retry-After");
          const seconds = Number(retry);
          const delay =
            retry && Number.isFinite(seconds) && seconds >= 0
              ? seconds * 1000
              : retry && Number.isFinite(Date.parse(retry))
                ? Math.max(0, Date.parse(retry) - Date.now())
                : 1500 * 2 ** attempt;
          await response.body?.cancel();
          await this.pause(Math.min(delay, 300_000), deadline);
          continue;
        }
        await response.body?.cancel();
        if ([401, 403].includes(response.status))
          throw new Error(
            "Microsoft Graph từ chối truy cập. Kiểm tra admin consent và vai trò đọc Audit của tài khoản.",
          );
        throw new Error(
          `Không tải được nhật ký Microsoft Graph (HTTP ${response.status}).`,
        );
      }
    };
    const unpack = (body: Record<string, unknown>) =>
      body.value && typeof body.value === "object" && !Array.isArray(body.value)
        ? (body.value as Record<string, unknown>)
        : body;
    try {
      let status: unknown;
      if (query) {
        status = unpack(
          await request(new URL(queries + "/" + query.id, origin)),
        ).status;
      } else {
        const created = unpack(
          await request(new URL(queries, origin), {
            displayName: "PH Audit · Deleted cloud flows",
            filterStartDateTime: new Date(now - days * day).toISOString(),
            filterEndDateTime: new Date(now).toISOString(),
            recordTypeFilters: ["microsoftFlow"],
            ...(!workloadOnly ? { operationFilters: ["DeleteFlow"] } : {}),
          }),
        );
        if (typeof created.id !== "string" || !queryIdPattern.test(created.id))
          throw new Error("Microsoft Graph không trả ID tra cứu hợp lệ.");
        query = { id: created.id, days, workloadOnly };
        status = created.status ?? "notStarted";
      }
      const path = queries + "/" + query.id;
      while (status === "running" || status === "notStarted") {
        await this.pause(5000, deadline);
        status = unpack(await request(new URL(path, origin))).status;
      }
      if (status !== "succeeded")
        throw new Error(
          "Microsoft chưa hoàn tất tra cứu. Hãy thử lại với khoảng thời gian ngắn hơn.",
        );

      const recordsPath = `${path}/records`;
      let next: URL | undefined = new URL(recordsPath, origin);
      const visited = new Set<string>();
      const records: unknown[] = [];
      while (next) {
        if (
          next.origin !== origin ||
          next.pathname !== recordsPath ||
          next.username ||
          next.password ||
          next.hash ||
          visited.has(next.href)
        )
          throw new Error("Liên kết phân trang nhật ký không hợp lệ.");
        if (visited.size >= 100 || records.length >= 25_000)
          throw new Error(
            "Quá nhiều kết quả. Hãy chọn khoảng thời gian ngắn hơn.",
          );
        visited.add(next.href);
        const result = await request(next);
        if (
          !Array.isArray(result.value) ||
          result.value.length > 25_000 - records.length
        )
          throw new Error(
            "Trang kết quả Microsoft Graph không hợp lệ hoặc quá lớn.",
          );
        records.push(...result.value);
        const continuation = result["@odata.nextLink"];
        if (continuation != null && typeof continuation !== "string")
          throw new Error("Liên kết phân trang nhật ký không hợp lệ.");
        next = continuation ? new URL(continuation, origin) : undefined;
      }
      return {
        ...readGraphRecords(records),
        graph: { received: records.length, days, workloadOnly },
      };
    } catch (error) {
      if (query && timeout.aborted && !signal.aborted)
        throw new GraphAuditWaitError(query);
      throw error;
    }
  }
}
