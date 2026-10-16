// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ActivationPage } from "../src/features/activation/ActivationPage";
import { RecordService } from "../src/data/recordService";
import { MetadataService } from "../src/data/metadataService";
import { FakeTransport } from "./support";
import type { TableMetadata } from "../src/domain/types";
let services: { records: RecordService; metadata: MetadataService };
vi.mock("../src/app/providers", () => ({ useServices: () => services }));
afterEach(cleanup);
const id = "00000000-0000-0000-0000-000000000001";
const table: TableMetadata = {
  logicalName: "ph_item",
  entitySetName: "ph_items",
  primaryIdAttribute: "ph_itemid",
  primaryNameAttribute: "ph_name",
  displayName: "Vật tư",
  auditEnabled: true,
  states: [],
  statuses: [],
  fields: {},
};
function setup() {
  const t = new FakeTransport((r) => {
    if (r.method === "PATCH") return new Promise(() => {});
    if (r.path.includes("StateAttributeMetadata"))
      return {
        value: [
          {
            LogicalName: "statecode",
            OptionSet: {
              Options: [
                {
                  Value: 0,
                  InvariantName: "Active",
                  Label: { UserLocalizedLabel: { Label: "Active" } },
                },
                { Value: 1, InvariantName: "Inactive" },
              ],
            },
          },
        ],
      };
    if (r.path.includes("StatusAttributeMetadata"))
      return {
        value: [
          {
            LogicalName: "statuscode",
            OptionSet: {
              Options: [
                {
                  Value: 7,
                  State: 0,
                  Label: { UserLocalizedLabel: { Label: "Hoạt động" } },
                },
                {
                  Value: 9,
                  State: 0,
                  Label: { UserLocalizedLabel: { Label: "Sẵn sàng" } },
                },
                { Value: 8, State: 1 },
              ],
            },
          },
        ],
      };
    if (r.path.includes("/Attributes")) return { value: [] };
    if (r.path.startsWith("EntityDefinitions"))
      return {
        value: [
          {
            LogicalName: "ph_item",
            IsCustomEntity: true,
            IsManaged: false,
            EntitySetName: "ph_items",
            PrimaryIdAttribute: "ph_itemid",
            PrimaryNameAttribute: "ph_name",
            IsAuditEnabled: { Value: true },
          },
        ],
      };
    return {
      ph_itemid: id,
      ph_name: "Vật tư A",
      statecode: 1,
      statuscode: 8,
      "@odata.etag": 'W/"42"',
    };
  });
  services = {
    records: new RecordService(t),
    metadata: new MetadataService(t),
  };
  return t;
}
it("keeps active status visible and editable before the write", async () => {
  const t = setup();
  render(<ActivationPage table={table} />);
  fireEvent.change(screen.getByLabelText(/ID \/ GUID/), {
    target: { value: id },
  });
  fireEvent.click(screen.getByText("Xem bản ghi"));
  const status = await screen.findByLabelText(/Status reason khi Active/);
  fireEvent.change(status, { target: { value: "7" } });
  expect(screen.getByLabelText(/Status reason khi Active/)).toBe(status);
  fireEvent.change(status, { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: /^Active$/ }));
  await waitFor(() =>
    expect(t.requests.find((r) => r.method === "PATCH")?.body).toEqual({
      statecode: 0,
      statuscode: 9,
    }),
  );
});
it("double-click Active sends only one write and freezes GUID while saving", async () => {
  const t = setup();
  render(<ActivationPage table={table} />);
  fireEvent.change(screen.getByLabelText(/ID \/ GUID/), {
    target: { value: id },
  });
  fireEvent.click(screen.getByText("Xem bản ghi"));
  fireEvent.change(await screen.findByLabelText(/Status reason khi Active/), {
    target: { value: "7" },
  });
  const active = screen.getByRole("button", { name: /^Active$/ });
  fireEvent.click(active);
  fireEvent.click(active);
  await waitFor(() =>
    expect(t.requests.filter((r) => r.method === "PATCH")).toHaveLength(1),
  );
  expect(
    (screen.getByLabelText(/ID \/ GUID/) as HTMLInputElement).disabled,
  ).toBe(true);
});

afterEach(() => vi.restoreAllMocks());
async function loadRow() {
  render(<ActivationPage table={table} />);
  fireEvent.change(screen.getByLabelText(/ID \/ GUID/), {
    target: { value: id },
  });
  fireEvent.click(screen.getByText("Xem bản ghi"));
  return await screen.findByRole("button", { name: /^Delete$/ });
}
it("cancel does not delete; confirmation contains record identity and success clears the row", async () => {
  const t = setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const remove = await loadRow();
  fireEvent.click(remove);
  expect(confirm.mock.calls[0][0]).toContain(id);
  expect(confirm.mock.calls[0][0]).toContain("ph_item");
  expect(t.requests.filter((r) => r.method === "DELETE")).toHaveLength(0);
  confirm.mockReturnValue(true);
  fireEvent.click(remove);
  await waitFor(() =>
    expect(t.requests.filter((r) => r.method === "DELETE")).toHaveLength(1),
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText(/ID \/ GUID/) as HTMLInputElement).value,
    ).toBe(""),
  );
  expect(screen.queryByRole("button", { name: /^Delete$/ })).toBeNull();
  expect(screen.getByText(/Đã xóa bản ghi/)).toBeTruthy();
});
it("blocks repeated Delete and Active while deletion is pending", async () => {
  setup();
  const request = vi
    .spyOn(services.records, "delete")
    .mockImplementation(() => new Promise(() => {}));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const remove = await loadRow();
  fireEvent.change(screen.getByLabelText(/Status reason khi Active/), {
    target: { value: "7" },
  });
  fireEvent.click(remove);
  fireEvent.click(remove);
  expect(request).toHaveBeenCalledTimes(1);
  expect(
    (screen.getByRole("button", { name: /^Active$/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByLabelText(/ID \/ GUID/) as HTMLInputElement).disabled,
  ).toBe(true);
});
it("preserves the row and requires reload after a delete failure", async () => {
  setup();
  vi.spyOn(services.records, "delete").mockRejectedValue(new Error("conflict"));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(await loadRow());
  await screen.findByText(/conflict/);
  expect((screen.getByLabelText(/ID \/ GUID/) as HTMLInputElement).value).toBe(
    id,
  );
  expect(
    (screen.getByRole("button", { name: /^Delete$/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: /^Tải lại$/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

it("Deactivate page targets Inactive and hides Delete", async () => {
  setup();
  vi.spyOn(services.records, "get").mockResolvedValue({
    id,
    table: table.logicalName,
    name: "Item",
    state: 0,
    status: 7,
    stateLabel: "Active",
    statusLabel: "Active",
    etag: 'W/"42"',
  });
  const deactivate = vi
    .spyOn(services.records, "deactivate")
    .mockResolvedValue({
      kind: "verifiedInactive",
      record: {
        id,
        table: table.logicalName,
        name: "Item",
        state: 1,
        status: 8,
        stateLabel: "Inactive",
        statusLabel: "Inactive",
        etag: 'W/"43"',
      },
    });
  render(<ActivationPage table={table} mode="deactivate" />);
  fireEvent.change(screen.getByLabelText(/ID \/ GUID/), {
    target: { value: id },
  });
  fireEvent.click(screen.getByText("Xem bản ghi"));
  const button = await screen.findByRole("button", { name: /^Deactivate$/ });
  expect(screen.queryByRole("button", { name: /^Delete$/ })).toBeNull();
  fireEvent.click(button);
  await waitFor(() => expect(deactivate).toHaveBeenCalledTimes(1));
  await screen.findByText(/Đã chuyển bản ghi sang Inactive/);
  expect(
    (screen.getByRole("button", { name: /^Deactivate$/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("shows the default Inactive reason and sends the user's changed selection", async () => {
  setup();
  vi.spyOn(services.metadata, "getTable").mockResolvedValue({
    ...table,
    states: [
      { value: 0, invariantName: "Active", label: "Active", defaultStatus: 7 },
      {
        value: 1,
        invariantName: "Inactive",
        label: "Inactive",
        defaultStatus: 8,
      },
    ],
    statuses: [
      { value: 7, state: 0, label: "Active" },
      { value: 8, state: 1, label: "Inactive" },
      { value: 10, state: 1, label: "Paused" },
    ],
  });
  const row = {
    id,
    table: table.logicalName,
    name: "Item",
    state: 0,
    status: 7,
    stateLabel: "Active",
    statusLabel: "Active",
    etag: 'W/"42"',
  };
  vi.spyOn(services.records, "get").mockResolvedValue(row);
  const deactivate = vi
    .spyOn(services.records, "deactivate")
    .mockResolvedValue({
      kind: "verifiedInactive",
      record: {
        ...row,
        state: 1,
        status: 10,
        stateLabel: "Inactive",
        statusLabel: "Paused",
      },
    });
  render(<ActivationPage table={table} mode="deactivate" />);
  fireEvent.change(screen.getByLabelText(/ID \/ GUID/), {
    target: { value: id },
  });
  fireEvent.click(screen.getByText("Xem bản ghi"));
  const status = await screen.findByLabelText(/Status reason khi Inactive/);
  expect((status as HTMLSelectElement).value).toBe("8");
  fireEvent.change(status, { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: /^Deactivate$/ }));
  await waitFor(() => expect(deactivate).toHaveBeenCalledTimes(1));
  expect(deactivate.mock.calls[0][2]).toBe(10);
});
