import { expect, it } from "vitest";
import { RecordService } from "../src/data/recordService";
import { PowerAppsTransport } from "../src/data/powerAppsTransport";
import { FakeTransport } from "./support";
import { DataverseError } from "../src/data/transport";
import type { RecordSnapshot, TableMetadata } from "../src/domain/types";
const table: TableMetadata = {
  logicalName: "ph_item",
  entitySetName: "ph_items",
  primaryIdAttribute: "ph_itemid",
  displayName: "Item",
  auditEnabled: true,
  fields: {},
  states: [],
  statuses: [],
};
const row: RecordSnapshot = {
  id: "00000000-0000-0000-0000-000000000001",
  table: "ph_item",
  name: "Item",
  state: 0,
  status: 1,
  stateLabel: "Active",
  statusLabel: "Active",
  etag: 'W/"42"',
};
it("deletes exactly the loaded row with its etag", async () => {
  const t = new FakeTransport(() => undefined);
  await new RecordService(t).delete(table, row);
  expect(t.requests).toEqual([
    { method: "DELETE", path: "ph_items(" + row.id + ")", etag: row.etag },
  ]);
});
it("blocks mismatched/missing snapshots and duplicate writes", async () => {
  const t = new FakeTransport(() => new Promise(() => {}));
  const s = new RecordService(t);
  await expect(s.delete(table, { ...row, table: "other" })).rejects.toThrow();
  await expect(s.delete(table, { ...row, etag: undefined })).rejects.toThrow();
  void s.delete(table, row);
  await expect(s.delete(table, row)).rejects.toThrow();
  expect(t.requests).toHaveLength(1);
});
it("sends conditional DELETE, accepts 204, and never retries mutations", async () => {
  let request: unknown;
  const t = new PowerAppsTransport(async (r) => {
    request = r;
    return { success: true, data: { statusCode: 204, body: "" } };
  });
  await t.request({
    method: "DELETE",
    path: "ph_items(" + row.id + ")",
    etag: row.etag,
  });
  expect(request).toMatchObject({
    method: "DELETE",
    headers: { "If-Match": row.etag },
  });
  for (const path of [
    "audits(" + row.id + ")",
    "ph_items",
    "ph_items(" + row.id + ")?$filter=x",
  ])
    await expect(
      t.request({ method: "DELETE", path, etag: row.etag }),
    ).rejects.toThrow();
  await expect(
    t.request({ method: "DELETE", path: "ph_items(" + row.id + ")" }),
  ).rejects.toThrow();
  let calls = 0;
  const failing = new PowerAppsTransport(async () => {
    calls++;
    throw new DataverseError("rate limit", 429);
  });
  await expect(
    failing.request({
      method: "DELETE",
      path: "ph_items(" + row.id + ")",
      etag: row.etag,
    }),
  ).rejects.toThrow();
  expect(calls).toBe(1);
});
