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
  days: number;
  workloadOnly: boolean;
} & ({ id: string } | { displayName: string });

const queryNamePrefix = "PH Audit · Deleted cloud flows · ";

class GraphAuditHttpError extends Error {
  constructor(readonly status: number) {
    super(`Không tải được nhật ký Microsoft Graph (HTTP ${status}).`);
  }
}

const retryableRead = (status: number) => [429, 502, 503, 504].includes(status);

export class GraphAuditWaitError extends Error {
  constructor(readonly query: GraphAuditQuery) {
    super(
      "displayName" in query
        ? "Microsoft Graph hết thời gian phản hồi (HTTP 504), chưa xác nhận được truy vấn đã tạo. Bấm Tiếp tục chờ để tìm lại yêu cầu đã gửi."
        : "Chưa lấy được kết quả từ Microsoft. Bấm Tiếp tục chờ để kiểm tra lại truy vấn này.",
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
    if ("id" in query && !queryIdPattern.test(query.id))
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
        if (!body && retryableRead(response.status) && attempt < 3) {
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
        throw new GraphAuditHttpError(response.status);
      }
    };
    const unpack = (body: Record<string, unknown>) =>
      body.value && typeof body.value === "object" && !Array.isArray(body.value)
        ? (body.value as Record<string, unknown>)
        : body;
    const findSubmittedQuery = async (displayName: string) => {
      for (let round = 0; round < 3; round++) {
        if (round) await this.pause(2000 * 2 ** (round - 1), deadline);
        let next = new URL(queries, origin);
        const visited = new Set<string>();
        for (let page = 0; page < 5; page++) {
          if (
            next.origin !== origin ||
            next.pathname !== queries ||
            next.username ||
            next.password ||
            next.hash ||
            visited.has(next.href)
          )
            break;
          visited.add(next.href);
          const result = await request(next);
          if (!Array.isArray(result.value)) break;
          const match = result.value.find(
            (item) =>
              item?.displayName === displayName &&
              typeof item.id === "string" &&
              queryIdPattern.test(item.id),
          );
          if (match)
            return {
              id: match.id as string,
              status: match.status ?? "notStarted",
            };
          const continuation = result["@odata.nextLink"];
          if (typeof continuation !== "string" || !continuation) break;
          try {
            next = new URL(continuation, origin);
          } catch {
            break;
          }
        }
      }
    };
    try {
      let status: unknown;
      if (query && "id" in query) {
        status = unpack(
          await request(new URL(queries + "/" + query.id, origin)),
        ).status;
      } else if (!query) {
        const displayName = queryNamePrefix + globalThis.crypto.randomUUID();
        try {
          const created = unpack(
            await request(new URL(queries, origin), {
              displayName,
              filterStartDateTime: new Date(now - days * day).toISOString(),
              filterEndDateTime: new Date(now).toISOString(),
              recordTypeFilters: ["microsoftFlow"],
              ...(!workloadOnly ? { operationFilters: ["DeleteFlow"] } : {}),
            }),
          );
          if (
            typeof created.id !== "string" ||
            !queryIdPattern.test(created.id)
          )
            throw new Error("Microsoft Graph không trả ID tra cứu hợp lệ.");
          query = { id: created.id, days, workloadOnly };
          status = created.status ?? "notStarted";
        } catch (error) {
          if (!(error instanceof GraphAuditHttpError) || error.status !== 504)
            throw error;
          query = { displayName, days, workloadOnly };
        }
      }
      if ("displayName" in query) {
        const found = await findSubmittedQuery(query.displayName);
        if (!found) throw new GraphAuditWaitError(query);
        query = { id: found.id, days, workloadOnly };
        status = found.status;
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
      if (
        query &&
        !signal.aborted &&
        (timeout.aborted ||
          (error instanceof GraphAuditHttpError && retryableRead(error.status)))
      )
        throw new GraphAuditWaitError(query);
      throw error;
    }
  }
}
