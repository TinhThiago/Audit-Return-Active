import { describe, expect, it } from "vitest";
import { MetadataService } from "../src/data/metadataService";
import { FakeTransport } from "./support";
describe("metadata catalog", () => {
  it("distinguishes duplicate labels and falls back to logical name", async () => {
    const t = new FakeTransport(() => ({
      value: [
        {
          LogicalName: "ph_one",
          IsCustomEntity: true,
          IsManaged: false,
          EntitySetName: "ph_ones",
          PrimaryIdAttribute: "ph_oneid",
          DisplayName: { UserLocalizedLabel: { Label: "Danh mục" } },
          IsAuditEnabled: { Value: true },
        },
        {
          LogicalName: "ph_two",
          IsCustomEntity: true,
          IsManaged: false,
          EntitySetName: "ph_twos",
          PrimaryIdAttribute: "ph_twoid",
          DisplayName: { UserLocalizedLabel: { Label: "Danh mục" } },
        },
        {
          LogicalName: "ph_three",
          IsCustomEntity: true,
          IsManaged: false,
          EntitySetName: "ph_threes",
          PrimaryIdAttribute: "ph_threeid",
          DisplayName: { LocalizedLabels: [] },
        },
      ],
    }));
    const s = new MetadataService(t);
    const rows = await s.listTables();
    expect(rows.map((r) => r.logicalName).sort()).toEqual([
      "ph_one",
      "ph_three",
      "ph_two",
    ]);
    expect(rows.find((r) => r.logicalName === "ph_three")?.displayName).toBe(
      "ph_three",
    );
    expect(rows.filter((r) => r.displayName === "Danh mục")).toHaveLength(2);
    expect(rows.find((r) => r.logicalName === "ph_one")?.auditEnabled).toBe(
      true,
    );
  });
  it("follows metadata pagination and caches within a service instance", async () => {
    const t = new FakeTransport((r) =>
      r.path.includes("page=2")
        ? {
            value: [
              {
                LogicalName: "ph_two",
                IsCustomEntity: true,
                IsManaged: false,
                EntitySetName: "ph_twos",
                PrimaryIdAttribute: "ph_twoid",
              },
            ],
          }
        : {
            value: [
              {
                LogicalName: "ph_one",
                IsCustomEntity: true,
                IsManaged: false,
                EntitySetName: "ph_ones",
                PrimaryIdAttribute: "ph_oneid",
              },
            ],
            "@odata.nextLink":
              "https://phuochung1.crm5.dynamics.com/api/data/v9.2/EntityDefinitions?page=2",
          },
    );
    const s = new MetadataService(t);
    expect(await s.listTables()).toHaveLength(2);
    await s.listTables();
    expect(t.requests).toHaveLength(2);
    await expect(s.getTable("untrusted")).rejects.toThrow();
  });
});
