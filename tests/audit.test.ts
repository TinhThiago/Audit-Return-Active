import { expect, it } from "vitest";
import { AuditService } from "../src/data/auditService";
import { FakeTransport } from "./support";
import type { TableMetadata } from "../src/domain/types";
export const table: TableMetadata = {
  logicalName: "ph_item_master",
  entitySetName: "ph_item_masters",
  primaryIdAttribute: "ph_item_masterid",
  primaryNameAttribute: "ph_name",
  displayName: "Danh mục vật tư",
  auditEnabled: true,
  states: [],
  statuses: [],
  fields: { ph_name: "Tên vật tư" },
};
const id = "6b429899-30c1-f111-aaaf-6045bd5a2f39";
it("create/update requires GUID before any query, deleted GUID still queries audit directly", async () => {
  const t = new FakeTransport(() => ({ value: [] }));
  const s = new AuditService(t);
  await expect(s.list({ table, mode: "createUpdate" })).rejects.toThrow();
  expect(t.requests).toHaveLength(0);
  await s.list({ table, mode: "createUpdate", recordId: id });
  expect(
    new URLSearchParams(t.requests[0].path.split("?")[1]).get("$filter"),
  ).toContain(`_objectid_value eq ${id}`);
  expect(
    new URLSearchParams(t.requests[0].path.split("?")[1]).get("$filter"),
  ).toContain("(operation eq 1 or operation eq 2)");
});
it("delete needs table only, returns deletion events and retains pagination", async () => {
  const t = new FakeTransport(() => ({
    value: [
      {
        auditid: id,
        _objectid_value: id,
        createdon: "2026-10-07T02:00:00Z",
        operation: 3,
        "_userid_value@OData.Community.Display.V1.FormattedValue": "Tình",
      },
    ],
    "@odata.nextLink":
      "https://phuochung1.crm5.dynamics.com/api/data/v9.2/audits?$skiptoken=one",
  }));
  const result = await new AuditService(t).list({ table, mode: "delete" });
  expect(result.events[0]).toMatchObject({
    recordId: id,
    user: "Tình",
    operation: 3,
  });
  expect(result.continuation).toContain("$skiptoken=one");
  expect(
    new URLSearchParams(t.requests[0].path.split("?")[1]).get("$filter"),
  ).toContain("operation eq 3");
  expect(
    new URLSearchParams(t.requests[0].path.split("?")[1]).get("$filter"),
  ).not.toContain("_objectid_value eq");
});
it("details preserve null, missing and empty rather than invent old data", async () => {
  const t = new FakeTransport(() => ({
    AuditDetail: {
      "@odata.type": "#Microsoft.Dynamics.CRM.AttributeAuditDetail",
      OldValue: { ph_name: null },
      NewValue: {
        ph_name: "",
        statecode: 0,
        "statecode@OData.Community.Display.V1.FormattedValue": "Active",
      },
    },
  }));
  const result = await new AuditService(t).details(id, table);
  expect(result.find((r) => r.field === "ph_name")).toMatchObject({
    label: "Tên vật tư",
    old: { available: true, value: null },
    new: { available: true, value: "" },
  });
  expect(result.find((r) => r.field === "statecode")).toMatchObject({
    old: { available: false },
    new: { available: true, value: 0, formatted: "Active" },
  });
});
it("rejects pagination from another query or origin and invalid date ranges", async () => {
  const s = new AuditService(new FakeTransport(() => ({ value: [] })));
  await expect(
    s.list({ table, mode: "delete" }, "https://evil.example/audits"),
  ).rejects.toThrow();
  await expect(
    s.list({ table, mode: "delete", from: "2026-10-10", to: "2026-10-01" }),
  ).rejects.toThrow();
});
