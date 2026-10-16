import type {
  AuditChange,
  AuditFilter,
  AuditPage,
  AuditValue,
  JsonRow,
  ODataPage,
  TableMetadata,
} from "../domain/types";
import { normalizeGuid } from "../domain/guid";
import type { DataverseTransport } from "./transport";
import { safePath } from "./powerAppsTransport";
const annotation = "@OData.Community.Display.V1.FormattedValue";
const scalar = (value: unknown) => (typeof value === "string" ? value : "");
function date(value: string, end: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Ngày lọc không hợp lệ.");
  const time = new Date(`${value}T00:00:00+07:00`);
  if (
    !Number.isFinite(time.getTime()) ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(time) !== value
  )
    throw new Error("Ngày lọc không hợp lệ.");
  if (end) time.setTime(time.getTime() + 86400000);
  return time.toISOString();
}
export class AuditService {
  constructor(private t: DataverseTransport) {}
  async list(
    filter: AuditFilter,
    continuation?: string,
    signal?: AbortSignal,
  ): Promise<AuditPage> {
    if (!/^[a-z][a-z0-9_]*$/i.test(filter.table.logicalName))
      throw new Error("Table không hợp lệ.");
    const recordId =
      filter.mode === "createUpdate"
        ? normalizeGuid(filter.recordId || "")
        : undefined;
    if (filter.from && filter.to && filter.from > filter.to)
      throw new Error("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
    const parts = [
      `objecttypecode eq '${filter.table.logicalName}'`,
      filter.mode === "delete"
        ? "operation eq 3"
        : "(operation eq 1 or operation eq 2)",
    ];
    if (recordId) parts.push(`_objectid_value eq ${recordId}`);
    if (filter.from) parts.push(`createdon ge ${date(filter.from, false)}`);
    if (filter.to) parts.push(`createdon lt ${date(filter.to, true)}`);
    const signature = JSON.stringify([
      filter.table.logicalName,
      filter.mode,
      recordId,
      filter.from || "",
      filter.to || "",
    ]);
    let path: string;
    if (continuation) {
      let token: { signature: string; path: string };
      try {
        token = JSON.parse(continuation);
      } catch {
        throw new Error("Trang tiếp theo không hợp lệ.");
      }
      if (token.signature !== signature || typeof token.path !== "string")
        throw new Error("Trang tiếp theo không khớp bộ lọc hiện tại.");
      path = safePath(token.path);
      if (!path.startsWith("audits?"))
        throw new Error("Trang tiếp theo không phải dữ liệu audit.");
    } else
      path =
        "audits?" +
        new URLSearchParams({
          $select:
            "auditid,createdon,operation,action,_userid_value,_objectid_value,objecttypecode",
          $filter: parts.join(" and "),
          $orderby: "createdon desc,auditid desc",
        }).toString();
    const page = await this.t.request<ODataPage<JsonRow>>({
      method: "GET",
      path,
      signal,
    });
    if (!Array.isArray(page?.value))
      throw new Error("Không nhận được danh sách audit hợp lệ.");
    return {
      events: page.value.map((r) => ({
        id: normalizeGuid(String(r.auditid)),
        recordId: scalar(r._objectid_value),
        at: scalar(r.createdon),
        user:
          scalar(r["_userid_value" + annotation]) ||
          scalar(r._userid_value) ||
          "Không được cung cấp",
        operation: Number(r.operation),
        action: scalar(r["action" + annotation]) || String(r.action ?? ""),
      })),
      continuation: page["@odata.nextLink"]
        ? JSON.stringify({ signature, path: safePath(page["@odata.nextLink"]) })
        : undefined,
    };
  }
  async details(
    id: string,
    table: TableMetadata,
    signal?: AbortSignal,
  ): Promise<AuditChange[]> {
    const response = await this.t.request<{ AuditDetail?: JsonRow }>({
      method: "GET",
      path: `audits(${normalizeGuid(id)})/Microsoft.Dynamics.CRM.RetrieveAuditDetails`,
      signal,
    });
    if (!response?.AuditDetail)
      throw new Error("Dataverse không cung cấp chi tiết sự kiện này.");
    const old = (response.AuditDetail.OldValue || {}) as JsonRow;
    const next = (response.AuditDetail.NewValue || {}) as JsonRow;
    const fields = [
      ...new Set([...Object.keys(old), ...Object.keys(next)]),
    ].filter((f) => !f.includes("@") && f !== table.primaryIdAttribute);
    const value = (row: JsonRow, field: string): AuditValue => ({
      available: Object.hasOwn(row, field),
      value: row[field],
      formatted:
        typeof row[field + annotation] === "string"
          ? String(row[field + annotation])
          : undefined,
    });
    return fields.map((field) => ({
      field,
      label:
        table.fields[field] ||
        table.fields[field.replace(/^_/, "").replace(/_value$/, "")] ||
        field,
      old: value(old, field),
      new: value(next, field),
    }));
  }
}
