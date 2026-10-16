import { expect, it } from "vitest";
import { normalizeGuid } from "../src/domain/guid";
it("normalizes GUID with braces and rejects malformed identifiers", () => {
  expect(normalizeGuid(" {6B429899-30C1-F111-AAAF-6045BD5A2F39} ")).toBe(
    "6b429899-30c1-f111-aaaf-6045bd5a2f39",
  );
  for (const v of [
    "",
    "bad' or true",
    "6b42989930c1f111aaaf6045bd5a2f39",
    "{6b429899-30c1-f111-aaaf-6045bd5a2f39",
  ])
    expect(() => normalizeGuid(v)).toThrow();
});
