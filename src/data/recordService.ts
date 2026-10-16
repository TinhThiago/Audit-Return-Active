import type {
  ActivationResult,
  JsonRow,
  ODataPage,
  RecordSnapshot,
  TableMetadata,
} from "../domain/types";
import { normalizeGuid } from "../domain/guid";
import { resolveStateTarget } from "../domain/statePolicy";
import type { DataverseTransport } from "./transport";
import { safePath } from "./powerAppsTransport";
const format = "@OData.Community.Display.V1.FormattedValue";
function assertTable(table: TableMetadata) {
  for (const v of [
    table.logicalName,
    table.entitySetName,
    table.primaryIdAttribute,
    table.primaryNameAttribute,
  ].filter(Boolean))
    if (!/^[a-z][a-z0-9_]*$/i.test(v!))
      throw new Error("Metadata table không hợp lệ.");
}
export class RecordService {
  private writes = new Set<string>();
  constructor(private t: DataverseTransport) {}
  async get(
    table: TableMetadata,
    id: string,
    signal?: AbortSignal,
  ): Promise<RecordSnapshot> {
    assertTable(table);
    const guid = normalizeGuid(id);
    const columns = [
      table.primaryIdAttribute,
      table.primaryNameAttribute,
      "statecode",
      "statuscode",
    ]
      .filter(Boolean)
      .join(",");
    const row = await this.t.request<JsonRow>({
      method: "GET",
      path: `${table.entitySetName}(${guid})?$select=${columns}`,
      signal,
    });
    if (
      !row ||
      !Number.isInteger(row.statecode) ||
      !Number.isInteger(row.statuscode)
    )
      throw new Error("Bản ghi không cung cấp trạng thái Active/Inactive.");
    return {
      id: guid,
      table: table.logicalName,
      name: String(row[table.primaryNameAttribute || ""] || guid),
      state: Number(row.statecode),
      status: Number(row.statuscode),
      stateLabel: String(
        row["statecode" + format] ||
          table.states.find((s) => s.value === row.statecode)?.label ||
          row.statecode,
      ),
      statusLabel: String(
        row["statuscode" + format] ||
          table.statuses.find((s) => s.value === row.statuscode)?.label ||
          row.statuscode,
      ),
      etag:
        typeof row["@odata.etag"] === "string" ? row["@odata.etag"] : undefined,
    };
  }
  async lookup(
    table: TableMetadata,
    search: string,
    inactiveOnly: boolean,
    continuation?: string,
    signal?: AbortSignal,
  ): Promise<{ rows: { id: string; name: string }[]; continuation?: string }> {
    assertTable(table);
    if (!table.primaryNameAttribute) return { rows: [] };
    const q = search.trim().slice(0, 120).replace(/'/g, "''");
    const filters: string[] = [];
    if (q) filters.push(`contains(${table.primaryNameAttribute},'${q}')`);
    if (inactiveOnly) {
      const inactive = table.states.find((s) => s.invariantName === "Inactive");
      if (!inactive) return { rows: [] };
      filters.push(`statecode eq ${inactive.value}`);
    }
    const path = continuation
      ? safePath(continuation)
      : table.entitySetName +
        "?" +
        new URLSearchParams({
          $select: `${table.primaryIdAttribute},${table.primaryNameAttribute}`,
          $orderby: `${table.primaryNameAttribute} asc,${table.primaryIdAttribute} asc`,
          ...(filters.length ? { $filter: filters.join(" and ") } : {}),
        }).toString();
    if (!path.startsWith(table.entitySetName + "?"))
      throw new Error("Trang lookup không khớp table.");
    const page = await this.t.request<ODataPage<JsonRow>>({
      method: "GET",
      path,
      signal,
    });
    if (!Array.isArray(page?.value))
      throw new Error("Không nhận được danh sách bản ghi.");
    return {
      rows: page.value.map((r) => ({
        id: normalizeGuid(String(r[table.primaryIdAttribute])),
        name: String(
          r[table.primaryNameAttribute!] || r[table.primaryIdAttribute],
        ),
      })),
      continuation: page["@odata.nextLink"]
        ? safePath(page["@odata.nextLink"])
        : undefined,
    };
  }
  async delete(table: TableMetadata, snapshot: RecordSnapshot): Promise<void> {
    assertTable(table);
    const id = normalizeGuid(snapshot.id);
    if (snapshot.table !== table.logicalName)
      throw new Error("Bản ghi không khớp table đang chọn.");
    if (!snapshot.etag)
      throw new Error("Không có phiên bản bản ghi. Tải lại trước khi xóa.");
    const key = table.logicalName + ":" + id;
    if (this.writes.has(key)) throw new Error("Bản ghi đang được xử lý.");
    this.writes.add(key);
    try {
      await this.t.request({
        method: "DELETE",
        path: table.entitySetName + "(" + id + ")",
        etag: snapshot.etag,
      });
    } finally {
      this.writes.delete(key);
    }
  }
  async activate(
    table: TableMetadata,
    snapshot: RecordSnapshot,
    selectedStatus?: number,
  ): Promise<ActivationResult> {
    return this.changeState(table, snapshot, selectedStatus, "Active");
  }
  async deactivate(
    table: TableMetadata,
    snapshot: RecordSnapshot,
    selectedStatus?: number,
  ) {
    const result = await this.changeState(
      table,
      snapshot,
      selectedStatus,
      "Inactive",
    );
    if (result.kind === "verificationPending") return result;
    return {
      kind:
        result.kind === "alreadyActive"
          ? ("alreadyInactive" as const)
          : ("verifiedInactive" as const),
      record: result.record,
    };
  }
  private async changeState(
    table: TableMetadata,
    snapshot: RecordSnapshot,
    selectedStatus: number | undefined,
    targetName: "Active" | "Inactive",
  ): Promise<ActivationResult> {
    assertTable(table);
    const id = normalizeGuid(snapshot.id);
    if (snapshot.table !== table.logicalName)
      throw new Error("Bản ghi không khớp table đang chọn.");
    const target = resolveStateTarget(table, selectedStatus, targetName);
    if (target.kind !== "ready")
      throw new Error(
        target.kind === "unsupported"
          ? target.reason
          : `Chọn status reason ${targetName} trước khi cập nhật.`,
      );
    if (snapshot.state === target.state)
      return { kind: "alreadyActive", record: snapshot };
    if (
      snapshot.state !==
      table.states.find(
        (s) =>
          s.invariantName === (targetName === "Active" ? "Inactive" : "Active"),
      )?.value
    )
      throw new Error("Bản ghi không ở trạng thái nguồn hợp lệ.");
    if (!snapshot.etag)
      throw new Error(
        "Không có phiên bản bản ghi. Tải lại trước khi kích hoạt.",
      );
    const key = table.logicalName + ":" + id;
    if (this.writes.has(key)) throw new Error("Bản ghi đang được kích hoạt.");
    this.writes.add(key);
    try {
      await this.t.request({
        method: "PATCH",
        path: `${table.entitySetName}(${id})`,
        body: { statecode: target.state, statuscode: target.status },
        etag: snapshot.etag,
      });
      try {
        const record = await this.get(table, id);
        if (record.state === target.state)
          return { kind: "verifiedActive", record };
        return {
          kind: "verificationPending",
          message: `Request đã hoàn tất nhưng trạng thái đọc lại chưa ${targetName}. Tải lại để kiểm tra kết quả.`,
        };
      } catch {
        return {
          kind: "verificationPending",
          message:
            "Đã gửi thay đổi thành công nhưng chưa đọc lại được bản ghi. Tải lại để xác minh; không gửi cập nhật lần nữa.",
        };
      }
    } finally {
      this.writes.delete(key);
    }
  }
}
