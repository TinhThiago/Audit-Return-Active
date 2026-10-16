import { expect, it } from "vitest";
import { resolveActiveTarget } from "../src/domain/statePolicy";
import { RecordService } from "../src/data/recordService";
import { DataverseError } from "../src/data/transport";
import { FakeTransport } from "./support";
import type { RecordSnapshot, TableMetadata } from "../src/domain/types";
const table: TableMetadata = {
  logicalName: "ph_item",
  entitySetName: "ph_items",
  primaryIdAttribute: "ph_itemid",
  primaryNameAttribute: "ph_name",
  displayName: "Vật tư",
  isCustomEntity: true,
  auditEnabled: true,
  fields: {},
  states: [
    { value: 0, label: "Hoạt động", invariantName: "Active", defaultStatus: 7 },
    { value: 1, label: "Ngừng", invariantName: "Inactive" },
  ],
  statuses: [
    { value: 7, state: 0, label: "Active" },
    { value: 8, state: 1, label: "Inactive" },
  ],
};
const snapshot: RecordSnapshot = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Vật tư A",
  state: 1,
  status: 8,
  stateLabel: "Inactive",
  statusLabel: "Inactive",
  etag: 'W/"42"',
  table: "ph_item",
};
it("uses metadata default status instead of assuming statuscode 1", () => {
  expect(resolveActiveTarget(table)).toMatchObject({
    kind: "ready",
    state: 0,
    status: 7,
  });
});
it("requires a selection for multiple active statuses without a valid default", () => {
  const t = {
    ...table,
    states: [
      { value: 0, label: "Active", invariantName: "Active" },
      { value: 1, label: "Inactive", invariantName: "Inactive" },
    ],
    statuses: [...table.statuses, { value: 9, state: 0, label: "Other" }],
  };
  expect(resolveActiveTarget(t).kind).toBe("chooseStatus");
  expect(resolveActiveTarget(t, 9)).toMatchObject({ kind: "ready", status: 9 });
  expect(resolveActiveTarget(t, 8).kind).toBe("unsupported");
});
it("rejects special lifecycles and unknown metadata", () => {
  expect(resolveActiveTarget({ ...table, isActivity: true }).kind).toBe(
    "unsupported",
  );
  expect(resolveActiveTarget({ ...table, states: [] }).kind).toBe(
    "unsupported",
  );
  expect(
    resolveActiveTarget({
      ...table,
      states: [
        ...table.states,
        { value: 2, label: "Won", invariantName: "Won" },
      ],
    }).kind,
  ).toBe("unsupported");
});
it("does not update an already active record", async () => {
  const t = new FakeTransport(() => {
    throw new Error("unexpected request");
  });
  expect(
    (
      await new RecordService(t).activate(table, {
        ...snapshot,
        state: 0,
        status: 7,
      })
    ).kind,
  ).toBe("alreadyActive");
  expect(t.requests).toHaveLength(0);
});
it("updates only state/status with etag and verifies readback", async () => {
  const t = new FakeTransport((r) =>
    r.method === "PATCH"
      ? undefined
      : {
          ph_itemid: snapshot.id,
          ph_name: "Vật tư A",
          statecode: 0,
          statuscode: 7,
          "@odata.etag": 'W/"43"',
        },
  );
  const result = await new RecordService(t).activate(table, snapshot);
  expect(result.kind).toBe("verifiedActive");
  expect(t.requests[0]).toMatchObject({
    body: { statecode: 0, statuscode: 7 },
    etag: 'W/"42"',
  });
  expect(t.requests).toHaveLength(2);
});
it("write success with readback failure is pending and never updates twice", async () => {
  const t = new FakeTransport((r) => {
    if (r.method === "GET") throw new Error("offline");
    return undefined;
  });
  expect((await new RecordService(t).activate(table, snapshot)).kind).toBe(
    "verificationPending",
  );
  expect(t.requests.filter((r) => r.method === "PATCH")).toHaveLength(1);
});
it("conflict is propagated without retry and snapshot mismatch is blocked", async () => {
  const t = new FakeTransport(() => {
    throw new DataverseError("changed", 412);
  });
  const s = new RecordService(t);
  await expect(s.activate(table, snapshot)).rejects.toMatchObject({
    status: 412,
  });
  expect(t.requests).toHaveLength(1);
  await expect(
    s.activate(table, { ...snapshot, table: "other" }),
  ).rejects.toThrow();
  expect(t.requests).toHaveLength(1);
});

it("deactivates with metadata status and verifies Inactive", async () => {
  const t = new FakeTransport((r) =>
    r.method === "PATCH"
      ? undefined
      : {
          ph_itemid: snapshot.id,
          ph_name: "Item",
          statecode: 1,
          statuscode: 8,
          "@odata.etag": 'W/"43"',
        },
  );
  const result = await new RecordService(t).deactivate(table, {
    ...snapshot,
    state: 0,
    status: 7,
  });
  expect(result.kind).toBe("verifiedInactive");
  expect(t.requests[0]).toMatchObject({
    method: "PATCH",
    body: { statecode: 1, statuscode: 8 },
    etag: snapshot.etag,
  });
  expect(t.requests).toHaveLength(2);
});
it("does not send a write for already Inactive records", async () => {
  const t = new FakeTransport(() => {
    throw new Error("unexpected request");
  });
  expect((await new RecordService(t).deactivate(table, snapshot)).kind).toBe(
    "alreadyInactive",
  );
  expect(t.requests).toHaveLength(0);
});
it("requires a valid Inactive status when multiple options have no default", async () => {
  const t = new FakeTransport(() => undefined);
  const metadata = {
    ...table,
    statuses: [
      ...table.statuses,
      { value: 10, state: 1, label: "Other inactive" },
    ],
  };
  await expect(
    new RecordService(t).deactivate(metadata, {
      ...snapshot,
      state: 0,
      status: 7,
    }),
  ).rejects.toThrow();
  expect(t.requests).toHaveLength(0);
});
