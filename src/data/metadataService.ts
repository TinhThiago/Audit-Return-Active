import type { JsonRow, ODataPage, TableMetadata } from "../domain/types";
import type { DataverseTransport } from "./transport";
type Label = {
  UserLocalizedLabel?: { Label: string };
  LocalizedLabels?: { Label: string; LanguageCode: number }[];
};
const identifier = (v: unknown): string => {
  if (typeof v !== "string" || !/^[a-z][a-z0-9_]*$/i.test(v))
    throw new Error("Metadata chứa identifier không hợp lệ.");
  return v;
};
export function label(v: unknown, fallback: string): string {
  const x = v as Label | undefined;
  return (
    x?.UserLocalizedLabel?.Label ||
    x?.LocalizedLabels?.find((l) => l.LanguageCode === 1066)?.Label ||
    x?.LocalizedLabels?.[0]?.Label ||
    fallback
  );
}
export class MetadataService {
  private catalog?: { expires: number; tables: TableMetadata[] };
  private details = new Map<
    string,
    { expires: number; table: TableMetadata }
  >();
  constructor(private t: DataverseTransport) {}
  async listTables(signal?: AbortSignal): Promise<TableMetadata[]> {
    if (this.catalog && this.catalog.expires > Date.now())
      return this.catalog.tables;
    let path: string | undefined =
      "EntityDefinitions?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,DisplayName,IsAuditEnabled,ObjectTypeCode,IsCustomEntity,IsManaged,IsActivity&$filter=IsPrivate eq false and IsCustomEntity eq true and IsManaged eq false";
    const tables: TableMetadata[] = [];
    const visited = new Set<string>();
    while (path) {
      if (visited.has(path)) throw new Error("Metadata phân trang lặp.");
      visited.add(path);
      const page: ODataPage<JsonRow> = await this.t.request({
        method: "GET",
        path,
        signal,
      });
      if (!Array.isArray(page?.value))
        throw new Error("Không nhận được danh mục table từ Dataverse.");
      for (const row of page.value) {
        if (
          row.IsCustomEntity !== true ||
          row.IsManaged !== false ||
          !row.EntitySetName ||
          !row.PrimaryIdAttribute
        )
          continue;
        tables.push({
          logicalName: identifier(row.LogicalName),
          entitySetName: identifier(row.EntitySetName),
          primaryIdAttribute: identifier(row.PrimaryIdAttribute),
          primaryNameAttribute: row.PrimaryNameAttribute
            ? identifier(row.PrimaryNameAttribute)
            : undefined,
          displayName: label(row.DisplayName, String(row.LogicalName)),
          auditEnabled:
            (row.IsAuditEnabled as { Value?: boolean })?.Value === true,
          objectTypeCode: row.ObjectTypeCode as number | undefined,
          isCustomEntity: row.IsCustomEntity === true,
          isActivity: row.IsActivity === true,
          states: [],
          statuses: [],
          fields: {},
        });
      }
      path = page["@odata.nextLink"];
    }
    tables.sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName, "vi") ||
        a.logicalName.localeCompare(b.logicalName),
    );
    this.catalog = { expires: Date.now() + 900000, tables };
    return tables;
  }
  async getTable(
    logicalName: string,
    signal?: AbortSignal,
  ): Promise<TableMetadata> {
    const cached = this.details.get(logicalName);
    if (cached && cached.expires > Date.now()) return cached.table;
    const table = (await this.listTables(signal)).find(
      (t) => t.logicalName === logicalName,
    );
    if (!table) throw new Error("Table không có trong metadata môi trường.");
    const base = `EntityDefinitions(LogicalName='${table.logicalName}')/Attributes`;
    const [attrs, state, status] = await Promise.all([
      this.all(`${base}?$select=LogicalName,DisplayName,AttributeType`, signal),
      this.all(
        `${base}/Microsoft.Dynamics.CRM.StateAttributeMetadata?$select=LogicalName&$expand=OptionSet`,
        signal,
      ),
      this.all(
        `${base}/Microsoft.Dynamics.CRM.StatusAttributeMetadata?$select=LogicalName&$expand=OptionSet`,
        signal,
      ),
    ]);
    const states = (
      (
        state.find((r) => r.LogicalName === "statecode")?.OptionSet as {
          Options?: JsonRow[];
        }
      )?.Options || []
    ).map((o) => ({
      value: Number(o.Value),
      label: label(o.Label, String(o.Value)),
      defaultStatus: o.DefaultStatus as number | undefined,
      invariantName: o.InvariantName as string | undefined,
    }));
    const statuses = (
      (
        status.find((r) => r.LogicalName === "statuscode")?.OptionSet as {
          Options?: JsonRow[];
        }
      )?.Options || []
    ).map((o) => ({
      value: Number(o.Value),
      state: Number(o.State),
      label: label(o.Label, String(o.Value)),
    }));
    const detailed = {
      ...table,
      states,
      statuses,
      fields: Object.fromEntries(
        attrs.map((r) => [
          String(r.LogicalName),
          label(r.DisplayName, String(r.LogicalName)),
        ]),
      ),
    };
    this.details.set(logicalName, {
      expires: Date.now() + 900000,
      table: detailed,
    });
    return detailed;
  }
  private async all(path: string, signal?: AbortSignal): Promise<JsonRow[]> {
    const rows: JsonRow[] = [];
    const visited = new Set<string>();
    let next: string | undefined = path;
    while (next) {
      if (visited.has(next)) throw new Error("Metadata phân trang lặp.");
      visited.add(next);
      const page: ODataPage<JsonRow> = await this.t.request({
        method: "GET",
        path: next,
        signal,
      });
      if (!Array.isArray(page?.value))
        throw new Error("Metadata thuộc tính không hợp lệ.");
      rows.push(...page.value);
      next = page["@odata.nextLink"];
    }
    return rows;
  }
}
