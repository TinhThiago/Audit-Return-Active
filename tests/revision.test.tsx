// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TablePicker } from "../src/features/shared/TablePicker";
import { AuditPage } from "../src/features/audit/AuditPage";
import { formatDate } from "../src/ui/components";
import { displayRecordName } from "../src/ui/displayRecordName";
import { MetadataService } from "../src/data/metadataService";
import { FakeTransport } from "./support";
import type { TableMetadata } from "../src/domain/types";
vi.mock("../src/app/providers", () => ({
  useServices: () => ({
    audit: { list: vi.fn() },
    records: { lookup: vi.fn() },
  }),
}));
afterEach(cleanup);
const table: TableMetadata = {
  logicalName: "ph_item",
  displayName: "Sản phẩm",
  entitySetName: "ph_items",
  primaryIdAttribute: "ph_itemid",
  primaryNameAttribute: "ph_name",
  auditEnabled: true,
  states: [],
  statuses: [],
  fields: {},
};
it("lists only custom unmanaged tables and filters at the server", async () => {
  const row = (name: string, custom: boolean, managed: boolean) => ({
    LogicalName: name,
    EntitySetName: name + "s",
    PrimaryIdAttribute: name + "id",
    IsCustomEntity: custom,
    IsManaged: managed,
  });
  const t = new FakeTransport(() => ({
    value: [
      row("ph_item", true, false),
      row("ph_managed", true, true),
      row("account", false, false),
    ],
  }));
  expect(
    (await new MetadataService(t).listTables()).map((t) => t.logicalName),
  ).toEqual(["ph_item"]);
  expect(t.requests[0].path).toContain(
    "IsCustomEntity eq true and IsManaged eq false",
  );
});
it("formats a complete date with seconds in UTC+7", () => {
  expect(formatDate("2026-10-06T02:50:31Z")).toBe("06/10/2026 09:50:31");
  expect(formatDate("bad")).toBe("Không được cung cấp");
});
it("repairs lossless mojibake for record display and preserves valid names", () => {
  const original = "[Dieu chinh migration] Sơ chế > Chẵn";
  const damaged = new TextDecoder("windows-1252").decode(
    new TextEncoder().encode(original),
  );
  expect(displayRecordName(damaged)).toBe(original);
  for (const name of [
    "Sơ chế > Chẵn",
    "MÃ SẢN PHẨM",
    "Crème brûlée",
    "Item Â",
    "Không � phục hồi",
  ])
    expect(displayRecordName(name)).toBe(name);
});
it("searches inside the table combobox, selects with keyboard and closes on Escape", () => {
  const change = vi.fn();
  render(
    <TablePicker
      tables={[
        table,
        {
          ...table,
          logicalName: "ph_tracking",
          displayName: "Theo dõi công đoạn",
        },
      ]}
      value=""
      onChange={change}
    />,
  );
  expect(screen.queryByLabelText("Tìm table")).toBeNull();
  const combo = screen.getByRole("combobox");
  fireEvent.change(combo, { target: { value: "tracking" } });
  expect(screen.queryByRole("option", { name: /Sản phẩm/ })).toBeNull();
  fireEvent.keyDown(combo, { key: "ArrowDown" });
  fireEvent.keyDown(combo, { key: "Enter" });
  expect(change).toHaveBeenCalledWith("ph_tracking");
  fireEvent.focus(combo);
  fireEvent.keyDown(combo, { key: "Escape" });
  expect(combo.getAttribute("aria-expanded")).toBe("false");
});
it("places query and refresh controls in the record filter region", () => {
  render(<AuditPage table={table} mode="createUpdate" />);
  const region = screen.getByRole("region", { name: "Bộ lọc audit" });
  expect(
    within(region).getByRole("button", { name: "Xem audit" }),
  ).toBeTruthy();
  expect(within(region).getByRole("button", { name: "Làm mới" })).toBeTruthy();
});

it("has no active descendant when the table search has zero results", () => {
  render(<TablePicker tables={[table]} value="" onChange={() => {}} />);
  const combo = screen.getByRole("combobox");
  fireEvent.change(combo, { target: { value: "unmatched" } });
  fireEvent.keyDown(combo, { key: "ArrowUp" });
  expect(combo.getAttribute("aria-activedescendant")).toBeNull();
});
