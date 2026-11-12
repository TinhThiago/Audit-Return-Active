export type DeletedFlow = {
  key: string;
  flowId: string;
  environmentId: string;
  title: string;
  actor: string;
  deletedAt: number | null;
};
type Data = Record<string, unknown>;
const object = (value: unknown): Data | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : undefined;
const first = (...values: unknown[]) =>
  values.find((v) => typeof v === "string" && v.trim()) as string | undefined;
const guid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const id = (value?: string) =>
  value && guid.test(value.trim()) ? value.trim().toLowerCase() : "";
const label = (value?: string) => {
  const name = value?.trim() || "";
  return id(name) || /^https?:\/\//i.test(name) ? "" : name;
};
function pathIds(value?: string) {
  const match = value?.match(/\/environments\/([^/?#]+)\/flows\/([^/?#]+)/i);
  return {
    environmentId: match?.[1].toLowerCase() || "",
    flowId: id(match?.[2]),
  };
}

// Purview CSV uses doubled quotes in the JSON cell and can contain quoted line breaks.
function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = input.charCodeAt(0) === 0xfeff ? 1 : 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += ch;
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && !field) quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (quoted)
    throw new Error(
      "CSV bị cắt giữa một trường có dấu ngoặc kép. Hãy tải lại file từ Purview.",
    );
  if (row.length || field) rows.push([...row, field]);
  return rows;
}

export type FlowAuditReport = { events: DeletedFlow[]; unreadable: number };

function normalizeDeletion(
  data: Data,
  fallbackKey: string,
): DeletedFlow | undefined {
  const operation = first(data.Operation)?.toLowerCase().replace(/\s/g, "");
  if (!operation || !["deleteflow", "deletedflow"].includes(operation))
    return undefined;
  const status = first(data.ResultStatus)?.toLowerCase().trim();
  if (status && !["success", "succeeded", "true"].includes(status))
    return undefined;
  const detailsPath = pathIds(first(data.FlowDetailsUrl));
  const path = detailsPath.flowId ? detailsPath : pathIds(first(data.ObjectId));
  const environmentId =
    first(data.EnvironmentId, data.EnvironmentName, path.environmentId)
      ?.trim()
      .toLowerCase() || "";
  const flowId =
    id(first(data.FlowId)) ||
    id(first(data.FlowName)) ||
    id(first(data.ObjectId)) ||
    path.flowId;
  const title =
    label(first(data.FlowDisplayName)) || label(first(data.DisplayName));
  const key = first(data.Id, data.ID) || fallbackKey;
  const timestamp = first(data.CreationTime)?.trim();
  const time =
    timestamp && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/i.test(timestamp)
      ? Date.parse(
          /(?:z|[+-]\d{2}:?\d{2})$/i.test(timestamp)
            ? timestamp
            : `${timestamp}Z`,
        )
      : NaN;
  return {
    key,
    flowId,
    environmentId,
    title,
    actor: first(data.UserUPN, data.UserId, data.UserKey) || "",
    deletedAt: Number.isFinite(time) ? time : null,
  };
}

export function readGraphRecords(records: unknown[]): FlowAuditReport {
  const events: DeletedFlow[] = [];
  const seen = new Set<string>();
  let unreadable = 0;
  for (const [index, input] of records.entries()) {
    const row = object(input);
    if (!row) {
      unreadable++;
      continue;
    }
    let data = object(row.auditData);
    if (!data && typeof row.auditData === "string") {
      try {
        data = object(JSON.parse(row.auditData));
      } catch {
        unreadable++;
      }
    }
    const type = first(row.auditLogRecordType)?.toLowerCase();
    if (type && type !== "microsoftflow" && type !== "unknownfuturevalue")
      continue;
    const event = normalizeDeletion(
      {
        ...data,
        Id: first(row.id, data?.Id),
        Operation: first(row.operation, data?.Operation),
        CreationTime: first(data?.CreationTime, row.createdDateTime),
        UserId: first(data?.UserId, row.userPrincipalName, row.userId),
        ObjectId: first(data?.ObjectId, row.objectId),
      },
      `graph-${index}`,
    );
    if (!event || seen.has(event.key)) continue;
    seen.add(event.key);
    events.push(event);
  }
  return {
    events: events.sort(
      (a, b) => (b.deletedAt ?? -Infinity) - (a.deletedAt ?? -Infinity),
    ),
    unreadable,
  };
}

export function readPurviewCsv(input: string): FlowAuditReport {
  const [header, ...rows] = parseCsv(input);
  const col = (name: string) =>
    header?.findIndex((x) => x.trim().toLowerCase() === name) ?? -1;
  const audit = col("auditdata"),
    operations = col("operations"),
    user = col("userids");
  if (audit < 0)
    throw new Error(
      "File CSV không có cột AuditData. Hãy dùng file gốc xuất từ Microsoft Purview.",
    );
  const events: DeletedFlow[] = [];
  let unreadable = 0;
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    if (!row.some(Boolean)) continue;
    let data: Data | undefined;
    try {
      data = object(JSON.parse(row[audit]));
    } catch {
      /* Count invalid AuditData rows. */
    }
    if (!data) {
      unreadable++;
      continue;
    }
    const event = normalizeDeletion(
      {
        ...data,
        Operation: first(data.Operation, row[operations]),
        UserId: first(data.UserId, row[user]),
      },
      `row-${index}`,
    );
    if (!event || seen.has(event.key)) continue;
    seen.add(event.key);
    events.push(event);
  }
  return {
    events: events.sort(
      (a, b) => (b.deletedAt ?? -Infinity) - (a.deletedAt ?? -Infinity),
    ),
    unreadable,
  };
}

export function readFlowNames(input: string) {
  const parsed: unknown = JSON.parse(input.replace(/^\uFEFF/, ""));
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const names = new Map<string, string>();
  const conflicts = new Set<string>();
  for (const item of rows) {
    const row = object(item);
    if (!row) continue;
    const flowId = id(first(row.FlowName));
    const env = first(row.EnvironmentName)?.trim().toLowerCase();
    const name = label(first(row.DisplayName));
    if (!env || !flowId || !name) continue;
    const key = `${env}:${flowId}`;
    if (conflicts.has(key)) continue;
    if (names.has(key) && names.get(key) !== name) {
      names.delete(key);
      conflicts.add(key);
    } else names.set(key, name);
  }
  if (!names.size)
    throw new Error(
      "JSON không có tên flow hợp lệ. Dùng lệnh xuất trong hướng dẫn trên trang.",
    );
  return names;
}

export const flowTitle = (
  event: DeletedFlow,
  names: ReadonlyMap<string, string>,
) => event.title || names.get(`${event.environmentId}:${event.flowId}`) || "";

export function restoreWindow(deletedAt: number | null, now: number) {
  if (deletedAt === null || deletedAt > now)
    return { status: "unknown" } as const;
  const deadline = deletedAt + 21 * 86_400_000;
  return { deadline, status: now < deadline ? "within" : "expired" } as const;
}
