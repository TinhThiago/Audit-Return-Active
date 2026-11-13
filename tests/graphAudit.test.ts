import { expect, it, vi } from "vitest";
import { GraphAudit } from "../src/features/flows/graphAudit";
import { AuditService } from "../src/data/auditService";
import { FakeTransport } from "./support";

const flowId = "12345678-1234-1234-1234-123456789abc";
const records =
  "https://graph.microsoft.com/v1.0/security/auditLog/queries/query-id/records";
const record = {
  id: "event",
  operation: "DeleteFlow",
  auditLogRecordType: "microsoftFlow",
  createdDateTime: "2026-11-01T12:00:00Z",
  userPrincipalName: "operator@example.com",
  auditData: {
    FlowDetailsUrl: `https://make.powerautomate.com/environments/env/flows/${flowId}/details`,
    FlowDisplayName: "Duyệt đề nghị",
  },
};
const result = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const pause = async () => {};

it("queries only flow deletion, polls, joins pages, and reads the real title and actor", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(result({ id: "query-id", status: "running" }, 201))
    .mockResolvedValueOnce(result({ value: { status: "succeeded" } }))
    .mockResolvedValueOnce(
      result({
        value: [record],
        "@odata.nextLink": `${records}?%24skiptoken=two`,
      }),
    )
    .mockResolvedValueOnce(
      result({
        value: [record, { ...record, id: "other", operation: "EditFlow" }],
      }),
    );
  const report = await new GraphAudit(async () => "token", fetch, pause).search(
    21,
    new AbortController().signal,
    Date.parse("2026-11-12T12:00:00Z"),
  );
  expect(report.events).toEqual([
    {
      key: "event",
      flowId,
      environmentId: "env",
      title: "Duyệt đề nghị",
      actor: "operator@example.com",
      deletedAt: Date.parse("2026-11-01T12:00:00Z"),
    },
  ]);
  expect(fetch.mock.calls.map((call) => call[1]?.method)).toEqual([
    "POST",
    "GET",
    "GET",
    "GET",
  ]);
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
    recordTypeFilters: ["microsoftFlow"],
    operationFilters: ["DeleteFlow"],
    filterStartDateTime: "2026-10-22T12:00:00.000Z",
  });
});

it.each([
  "https://other.example/records",
  "https://graph.microsoft.com/v1.0/me",
])("rejects out-of-scope pagination: %s", async (next) => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(result({ id: "query-id", status: "succeeded" }))
    .mockResolvedValueOnce(result({ value: [], "@odata.nextLink": next }));
  await expect(
    new GraphAudit(async () => "token", fetch, pause).search(
      7,
      new AbortController().signal,
    ),
  ).rejects.toThrow(/phân trang/);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("does not repeat query creation on rate limit or send after cancellation", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(result({}, 429));
  const audit = new GraphAudit(async () => "token", fetch, pause);
  await expect(audit.search(7, new AbortController().signal)).rejects.toThrow(
    /429/,
  );
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(audit.search(7, cancelled.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("reads the old Dataverse workflow name only from an unambiguous matching delete event", async () => {
  const transport = new FakeTransport((request) =>
    request.path.startsWith("audits?")
      ? { value: [{ auditid: flowId }] }
      : { AuditDetail: { OldValue: { name: "Tên trước khi xóa" } } },
  );
  const date = Date.parse("2026-11-01T12:00:00Z");
  expect(
    await new AuditService(transport).deletedCloudFlowTitle(flowId, date),
  ).toBe("Tên trước khi xóa");
  expect(
    new URLSearchParams(transport.requests[0].path.split("?")[1]).get(
      "$filter",
    ),
  ).toContain(
    `objecttypecode eq 'workflow' and operation eq 3 and _objectid_value eq ${flowId}`,
  );
  const ambiguous = new FakeTransport(() => ({
    value: [{ auditid: flowId }, { auditid: flowId }],
  }));
  expect(
    await new AuditService(ambiguous).deletedCloudFlowTitle(flowId, date),
  ).toBeUndefined();
  expect(ambiguous.requests).toHaveLength(1);
});

it("distinguishes no records from an alternate delete operation found by workload-only lookup", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(result({ id: "query-id", status: "succeeded" }))
    .mockResolvedValueOnce(result({ value: [] }))
    .mockResolvedValueOnce(result({ id: "query-id", status: "succeeded" }))
    .mockResolvedValueOnce(
      result({
        value: [
          { ...record, operation: "FlowDeleted" },
          { ...record, id: "edit", operation: "EditFlow" },
          { ...record, id: "failed", resultStatus: "Failed" },
        ],
      }),
    );
  const audit = new GraphAudit(async () => "token", fetch, pause);
  const signal = new AbortController().signal;
  expect(await audit.search(7, signal)).toMatchObject({
    events: [],
    graph: { received: 0, days: 7, workloadOnly: false },
  });
  const report = await audit.search(7, signal, Date.now(), true);
  expect(report.graph).toEqual({ received: 3, days: 7, workloadOnly: true });
  expect(report.events.map((event) => event.key)).toEqual(["event"]);
  const body = JSON.parse(String(fetch.mock.calls[2][1]?.body));
  expect(body.recordTypeFilters).toEqual(["microsoftFlow"]);
  expect(body).not.toHaveProperty("operationFilters");
});

it("resumes a timed-out Graph query without creating a second query", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(result({ id: "query-id", status: "running" }))
    .mockResolvedValueOnce(result({ status: "succeeded" }))
    .mockResolvedValueOnce(result({ value: [record] }));
  const timeout = new AbortController();
  const spy = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValueOnce(timeout.signal);
  const signal = new AbortController().signal;
  let caught: unknown;
  try {
    await new GraphAudit(
      async () => "token",
      fetch,
      async (_ms, waiting) => {
        timeout.abort(new DOMException("Time limit", "TimeoutError"));
        waiting.throwIfAborted();
      },
    ).search(7, signal, Date.now(), true);
  } catch (error) {
    caught = error;
  } finally {
    spy.mockRestore();
  }
  expect(caught).toMatchObject({
    name: "GraphAuditWaitError",
    query: { id: "query-id", days: 7, workloadOnly: true },
  });
  const { query } = caught as {
    query: { id: string; days: number; workloadOnly: boolean };
  };
  const report = await new GraphAudit(async () => "token", fetch, pause).resume(
    query,
    signal,
  );
  expect(report.events).toHaveLength(1);
  expect(report.graph).toEqual({ received: 1, days: 7, workloadOnly: true });
  expect(fetch.mock.calls.map((call) => call[1]?.method)).toEqual([
    "POST",
    "GET",
    "GET",
  ]);
  expect(String(fetch.mock.calls[1][0])).toBe(
    records.replace(/\/records$/, ""),
  );
});

it("recovers a query that Graph accepted despite returning 504", async () => {
  let displayName: string;
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(async (_url, options) => {
      displayName = JSON.parse(String(options?.body)).displayName;
      return result({}, 504);
    })
    .mockImplementationOnce(async () =>
      result({
        value: [
          {
            id: "another-query",
            displayName: "PH Audit · Deleted cloud flows",
          },
          { id: "query-id", displayName, status: "running" },
        ],
      }),
    )
    .mockResolvedValueOnce(result({ status: "succeeded" }))
    .mockResolvedValueOnce(result({ value: [record] }));
  const report = await new GraphAudit(async () => "token", fetch, pause).search(
    1,
    new AbortController().signal,
  );
  expect(report.events.map((event) => event.key)).toEqual(["event"]);
  expect(
    fetch.mock.calls.map(([url, init]) => [String(url), init?.method]),
  ).toEqual([
    [records.replace(/\/query-id\/records$/, ""), "POST"],
    [records.replace(/\/query-id\/records$/, ""), "GET"],
    [records.replace(/\/records$/, ""), "GET"],
    [records, "GET"],
  ]);
});

it("offers another lookup of an unconfirmed 504 without resubmitting", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, options) => {
    if (options?.method === "POST") return result({}, 504);
    return result({ value: [] });
  });
  const audit = new GraphAudit(async () => "token", fetch, pause);
  const signal = new AbortController().signal;
  const error = await audit.search(1, signal).catch((error: unknown) => error);
  expect(error).toMatchObject({
    name: "GraphAuditWaitError",
    message: expect.stringMatching(/504.*chưa xác nhận/i),
    query: { displayName: expect.any(String), days: 1, workloadOnly: false },
  });
  const { query } =
    error as import("../src/features/flows/graphAudit").GraphAuditWaitError;
  await expect(audit.resume(query, signal)).rejects.toMatchObject({ query });
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
});
